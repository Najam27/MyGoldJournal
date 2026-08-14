import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getActive: vi.fn(), touch: vi.fn(), open: vi.fn(), close: vi.fn(), summary: vi.fn(), completeHistory: vi.fn(), historyAttempt: vi.fn(), historyAccepted: vi.fn(), historyFailure: vi.fn() }));
vi.mock("./mt5Db", () => ({ getActiveMt5Connection: mocks.getActive, touchMt5Connection: mocks.touch, upsertMt5OpenPosition: mocks.open, upsertMt5ClosedPosition: mocks.close, updateMt5AccountSummary: mocks.summary, completeMt5HistorySync: mocks.completeHistory, recordMt5HistoryAttempt: mocks.historyAttempt, recordMt5HistoryAccepted: mocks.historyAccepted, recordMt5HistoryFailure: mocks.historyFailure }));

import { processMt5Payload } from "./mt5Ingest";

const key = (suffix: string) => `mt5_live_key_${suffix.padEnd(32, "x")}`;
const openPayload = (api_key = key("open")) => ({ event: "open" as const, api_key, ticket: "123456789", symbol: "XAUUSD", direction: "Buy", lots: 0.01, open_price: 3285.5, sl_price: 3275, tp_price: 3310, risk_usd: 45, reward_usd: 200, rr_ratio: 4.44, floating_pnl: 12.5, open_time: "2026-07-11 09:30:00" });

describe("MT5 EA ingest", () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.getActive.mockResolvedValue({ id: 44, userId: 77, accountId: 12, active: true });
    mocks.touch.mockResolvedValue(undefined);
    mocks.open.mockResolvedValue(undefined);
    mocks.close.mockResolvedValue(undefined);
    mocks.summary.mockResolvedValue(undefined);
    mocks.completeHistory.mockResolvedValue(undefined);
    mocks.historyAttempt.mockResolvedValue(undefined);
    mocks.historyAccepted.mockResolvedValue(undefined);
    mocks.historyFailure.mockResolvedValue(undefined);
  });

  it("authorizes by active API key, touches the connection, and upserts an open position under its account", async () => {
    await expect(processMt5Payload(openPayload())).resolves.toEqual({ status: 200, body: { ok: true, event: "open" } });
    expect(mocks.getActive).toHaveBeenCalledWith(key("open"));
    expect(mocks.touch).toHaveBeenCalledWith(44);
    expect(mocks.open).toHaveBeenCalledWith(77, 12, expect.objectContaining({ ticket: 123456789n, direction: "BUY", floatingPnl: 12.5, symbol: "XAUUSD" }));
  });

  it("accepts the dot-formatted timestamps emitted by MQL5 for live and historical positions", async () => {
    await expect(processMt5Payload(openPayload(key("mql-date")))).resolves.toEqual({ status: 200, body: { ok: true, event: "open" } });
    expect(mocks.open).toHaveBeenCalledWith(77, 12, expect.objectContaining({ openTime: new Date("2026-07-11T04:30:00Z") }));
  });

  it("preserves an explicit UTC+3 broker timestamp so journal sync can classify the corresponding PKT session", async () => {
    await expect(processMt5Payload({ ...openPayload(key("broker-utc3")), open_time: "2026.07.11 09:30:00+03:00" })).resolves.toEqual({ status: 200, body: { ok: true, event: "open" } });
    expect(mocks.open).toHaveBeenCalledWith(77, 12, expect.objectContaining({ openTime: new Date("2026-07-11T06:30:00Z") }));
  });

  it("rejects an unknown API key without touching a connection or writing a position", async () => {
    mocks.getActive.mockResolvedValue(null);
    await expect(processMt5Payload(openPayload(key("unknown")))).resolves.toEqual({ status: 401, body: { ok: false, code: "UNAUTHORIZED" } });
    expect(mocks.touch).not.toHaveBeenCalled();
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("stores a close event as a closed position with realized P&L and a normalized result", async () => {
    const { floating_pnl, open_time, ...base } = openPayload(key("close"));
    await expect(processMt5Payload({ ...base, event: "close", close_price: 3308, realized_pnl: 168, result: "Win", close_time: "2026-07-11 11:45:00", open_time })).resolves.toEqual({ status: 200, body: { ok: true, event: "close" } });
    expect(mocks.close).toHaveBeenCalledWith(77, 12, expect.objectContaining({ ticket: 123456789n, result: "WIN", realizedPnl: 168, closePrice: 3308 }));
  });

  it("stores MT5 account balance, equity, margin, and floating P&L only after resolving the API key", async () => {
    await expect(processMt5Payload({ event: "summary", api_key: key("summary"), mt5_login: "90123456", broker_server: "Broker-Live", currency: "USD", balance: 10000, equity: 10042.5, margin: 250, free_margin: 9792.5, floating_pnl: 42.5 })).resolves.toEqual({ status: 200, body: { ok: true, event: "summary" } });
    expect(mocks.summary).toHaveBeenCalledWith(44, expect.objectContaining({ mt5Login: 90123456n, balance: 10000, equity: 10042.5, floatingPnl: 42.5, brokerServer: "Broker-Live" }));
  });

  it("upserts a bounded historical closed-trade batch under the resolved account and marks a completed backfill", async () => {
    const { floating_pnl, api_key: _nestedApiKeyMustBeAbsent, ...position } = openPayload(key("history"));
    const closed = { ...position, close_price: 3308, realized_pnl: 168, result: "Win", close_time: "2026-07-11 11:45:00" };
    await expect(processMt5Payload({ event: "history_batch", api_key: key("history"), positions: [closed], complete: true })).resolves.toEqual({ status: 200, body: { ok: true, event: "history_batch", synced: 1, complete: true } });
    expect(mocks.close).toHaveBeenCalledWith(77, 12, expect.objectContaining({ ticket: 123456789n, result: "WIN" }));
    expect(mocks.historyAttempt).toHaveBeenCalledWith(44, 1);
    expect(mocks.historyAccepted).toHaveBeenCalledWith(44, 1, true);
    expect(mocks.completeHistory).toHaveBeenCalledWith(44, 12);
  });

  it("limits a single API key to five events per second", async () => {
    const burstKey = key("rate");
    for (let index = 0; index < 5; index += 1) await expect(processMt5Payload({ event: "ping", api_key: burstKey })).resolves.toMatchObject({ status: 200 });
    await expect(processMt5Payload({ event: "ping", api_key: burstKey })).resolves.toEqual({ status: 429, body: { ok: false, code: "RATE_LIMITED" } });
  });
});
