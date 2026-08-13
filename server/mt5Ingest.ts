import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getActiveMt5Connection, touchMt5Connection, upsertMt5ClosedPosition, upsertMt5OpenPosition } from "./mt5Db";

const numeric = z.coerce.number().finite();
const ticket = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform(value => BigInt(value));
const timestamp = z.string().trim().min(8).max(40).transform(value => {
  const normalized = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid MT5 timestamp");
  return parsed;
});
const direction = z.enum(["Buy", "Sell", "BUY", "SELL"]).transform(value => value.toUpperCase() as "BUY" | "SELL");
const result = z.enum(["Win", "Loss", "Break-even", "WIN", "LOSS", "BREAK_EVEN"]).transform(value => value === "Win" || value === "WIN" ? "WIN" : value === "Loss" || value === "LOSS" ? "LOSS" : "BREAK_EVEN" as const);

const base = z.object({ api_key: z.string().trim().min(24).max(96), ticket, symbol: z.string().trim().min(1).max(32), direction, lots: numeric.min(0), open_price: numeric, sl_price: numeric.optional().default(0), tp_price: numeric.optional().default(0), risk_usd: numeric.min(0), reward_usd: numeric.min(0), rr_ratio: numeric.min(0) });
export const mt5Payload = z.discriminatedUnion("event", [
  z.object({ event: z.literal("ping"), api_key: z.string().trim().min(24).max(96) }),
  base.extend({ event: z.literal("open"), floating_pnl: numeric, open_time: timestamp }),
  base.extend({ event: z.literal("close"), close_price: numeric, realized_pnl: numeric, result, close_time: timestamp, open_time: timestamp.optional() }),
]);

const requests = new Map<string, { startedAt: number; count: number }>();
function canAccept(key: string) {
  const now = Date.now();
  const current = requests.get(key);
  if (!current || now - current.startedAt >= 1_000) { requests.set(key, { startedAt: now, count: 1 }); return true; }
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
    await upsertMt5OpenPosition(connection.accountId, { ...shared, floatingPnl: payload.floating_pnl, openTime: payload.open_time });
    return { status: 200, body: { ok: true, event: "open" } };
  }
  await upsertMt5ClosedPosition(connection.accountId, { ...shared, closePrice: payload.close_price, realizedPnl: payload.realized_pnl, result: payload.result, closeTime: payload.close_time, openTime: payload.open_time ?? payload.close_time });
  return { status: 200, body: { ok: true, event: "close" } };
}

export function registerMt5Ingest(app: Express) {
  app.post("/api/mt5", async (req: Request, res: Response) => {
    try {
      const outcome = await processMt5Payload(req.body);
      res.status(outcome.status).json(outcome.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ ok: false, code: "INVALID_PAYLOAD" });
        return;
      }
      console.error("[MT5] ingest failed", error);
      res.status(503).json({ ok: false, code: "SYNC_UNAVAILABLE" });
    }
  });
}
