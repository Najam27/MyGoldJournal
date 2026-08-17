import { createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { completeMt5HistorySync, getActiveMt5Connection, recordMt5HistoryAccepted, recordMt5HistoryAttempt, recordMt5HistoryFailure, touchMt5Connection, updateMt5AccountSummary, upsertMt5ClosedPosition, upsertMt5OpenPosition } from "./mt5Db";

const numeric = z.coerce.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000);
const apiKey = z.string().trim().min(24).max(96).regex(/^[A-Za-z0-9_-]+$/);
const ticket = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform(value => BigInt(value));
const timestamp = z.string().trim().min(8).max(40).transform(value => {
  const mqlDate = value.replace(/^(\d{4})\.(\d{2})\.(\d{2})/, "$1-$2-$3");
  const normalized = /[zZ]|[+-]\d\d:?\d\d$/.test(mqlDate) ? mqlDate : `${mqlDate.replace(" ", "T")}+03:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid MT5 timestamp");
  return parsed;
});
const direction = z.enum(["Buy", "Sell", "BUY", "SELL"]).transform(value => value.toUpperCase() as "BUY" | "SELL");
const result = z.enum(["Win", "Loss", "Break-even", "WIN", "LOSS", "BREAK_EVEN"]).transform(value => value === "Win" || value === "WIN" ? "WIN" : value === "Loss" || value === "LOSS" ? "LOSS" : "BREAK_EVEN" as const);

const positionBase = z.object({ ticket, symbol: z.string().trim().min(1).max(32), direction, lots: numeric.gt(0), open_price: numeric.gt(0), sl_price: numeric.optional().default(0), tp_price: numeric.optional().default(0), risk_usd: numeric.min(0), reward_usd: numeric.min(0), rr_ratio: numeric.min(0) });
const base = positionBase.extend({ api_key: apiKey });
const closedFields = z.object({ close_price: numeric.gt(0), realized_pnl: numeric, result, close_time: timestamp, open_time: timestamp.optional() });
const validateClosedChronology = (value: { open_time?: Date; close_time: Date }, ctx: z.RefinementCtx) => {
  if (value.open_time && value.close_time.getTime() < value.open_time.getTime()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["close_time"], message: "close_time must not precede open_time" });
};
const closedPosition = positionBase.merge(closedFields).superRefine(validateClosedChronology);
const closedEvent = base.merge(closedFields).extend({ event: z.literal("close") }).superRefine(validateClosedChronology);
export const mt5Payload = z.discriminatedUnion("event", [
  z.object({ event: z.literal("ping"), api_key: apiKey }),
  z.object({ event: z.literal("summary"), api_key: apiKey, mt5_login: ticket, broker_server: z.string().trim().min(1).max(160), currency: z.string().trim().min(1).max(16), balance: numeric, equity: numeric, margin: numeric.min(0), free_margin: numeric, floating_pnl: numeric }),
  base.extend({ event: z.literal("open"), floating_pnl: numeric, open_time: timestamp }),
  closedEvent,
  z.object({ event: z.literal("history_batch"), api_key: apiKey, positions: z.array(closedPosition).max(50), complete: z.boolean().default(false) }),
]);

const RATE_WINDOW_MS = 1_000;
const MAX_RATE_KEYS = 10_000;
const requests = new Map<string, { startedAt: number; count: number }>();
let lastRateSweep = 0;
export function getMt5RateLimiterSize() { return requests.size; }

function canAccept(key: string) {
  const now = Date.now();
  if (now - lastRateSweep >= RATE_WINDOW_MS) {
    for (const [bucket, value] of Array.from(requests.entries())) if (now - value.startedAt >= RATE_WINDOW_MS) requests.delete(bucket);
    lastRateSweep = now;
  }
  const bucketKey = createHash("sha256").update(key, "utf8").digest("hex");
  const current = requests.get(bucketKey);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    if (!current && requests.size >= MAX_RATE_KEYS) return false;
    requests.set(bucketKey, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= 5) return false;
  current.count += 1;
  return true;
}

export async function processMt5Payload(body: unknown) {
  const payload = mt5Payload.parse(body);
  if (!canAccept(payload.api_key)) return { status: 429, body: { ok: false, code: "RATE_LIMITED" } };
  const connection = await getActiveMt5Connection(payload.api_key);
  if (!connection) return { status: 401, body: { ok: false, code: "UNAUTHORIZED" } };
  await touchMt5Connection(connection.id);
  if (payload.event === "ping") return { status: 200, body: { ok: true, event: "ping" } };
  if (payload.event === "summary") {
    await updateMt5AccountSummary(connection.id, { mt5Login: payload.mt5_login, brokerServer: payload.broker_server, currency: payload.currency, balance: payload.balance, equity: payload.equity, margin: payload.margin, freeMargin: payload.free_margin, floatingPnl: payload.floating_pnl });
    return { status: 200, body: { ok: true, event: "summary" } };
  }
  if (payload.event === "history_batch") {
    await recordMt5HistoryAttempt(connection.id, payload.positions.length);
    try {
      for (const position of payload.positions) {
        await upsertMt5ClosedPosition(connection.userId, connection.accountId, { ticket: position.ticket, symbol: position.symbol, direction: position.direction, lots: position.lots, openPrice: position.open_price, closePrice: position.close_price, slPrice: position.sl_price > 0 ? position.sl_price : null, tpPrice: position.tp_price > 0 ? position.tp_price : null, riskUsd: position.risk_usd, rewardUsd: position.reward_usd, rrRatio: position.rr_ratio, realizedPnl: position.realized_pnl, result: position.result, closeTime: position.close_time, openTime: position.open_time ?? position.close_time });
      }
      await recordMt5HistoryAccepted(connection.id, payload.positions.length, payload.complete);
      if (payload.complete) await completeMt5HistorySync(connection.id, connection.accountId);
      return { status: 200, body: { ok: true, event: "history_batch", synced: payload.positions.length, complete: payload.complete } };
    } catch (error) {
      await recordMt5HistoryFailure(connection.id, error instanceof Error ? error.message : "Unable to store historical positions.");
      throw error;
    }
  }
  const shared = {
    ticket: payload.ticket,
    symbol: payload.symbol,
    direction: payload.direction,
    lots: payload.lots,
    openPrice: payload.open_price,
    slPrice: payload.sl_price > 0 ? payload.sl_price : null,
    tpPrice: payload.tp_price > 0 ? payload.tp_price : null,
    riskUsd: payload.risk_usd,
    rewardUsd: payload.reward_usd,
    rrRatio: payload.rr_ratio,
  };
  if (payload.event === "open") {
    await upsertMt5OpenPosition(connection.userId, connection.accountId, { ...shared, floatingPnl: payload.floating_pnl, openTime: payload.open_time });
    return { status: 200, body: { ok: true, event: "open" } };
  }
  await upsertMt5ClosedPosition(connection.userId, connection.accountId, { ...shared, closePrice: payload.close_price, realizedPnl: payload.realized_pnl, result: payload.result, closeTime: payload.close_time, openTime: payload.open_time ?? payload.close_time });
  return { status: 200, body: { ok: true, event: "close" } };
}

export function registerMt5Ingest(app: Express) {
  app.post("/api/mt5", async (req: Request, res: Response) => {
    try {
      const outcome = await processMt5Payload(req.body);
      res.status(outcome.status).json(outcome.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues.slice(0, 4).map(issue => `${issue.path.join(".") || "payload"}: ${issue.message}`);
        const apiKey = typeof req.body?.api_key === "string" ? req.body.api_key : "";
        if (req.body?.event === "history_batch" && apiKey) {
          try {
            const connection = await getActiveMt5Connection(apiKey);
            if (connection) await recordMt5HistoryFailure(connection.id, `Invalid history payload — ${details.join("; ")}`);
          } catch {
            // Keep the original validation response reliable even if diagnostics cannot persist.
          }
        }
        res.status(400).json({ ok: false, code: "INVALID_PAYLOAD", details });
        return;
      }
      console.error("[MT5] ingest failed", error instanceof Error ? error.message : "unknown error");
      res.status(503).json({ ok: false, code: "SYNC_UNAVAILABLE" });
    }
  });
}
