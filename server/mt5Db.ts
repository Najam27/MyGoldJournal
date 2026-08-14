import { and, count, desc, eq } from "drizzle-orm";
import { accounts, mt5Connections, mt5LivePositions, trades } from "../drizzle/schema";
import { createHash } from "crypto";
import { getDb } from "./db";
import { getOwnedAccount } from "./goldDb";

export const hashMt5ApiKey = (value: string) => createHash("sha256").update(value).digest("base64url");

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Cloud database is unavailable. Please retry shortly.");
  return db;
}

function safePosition(position: typeof mt5LivePositions.$inferSelect, journaledTickets: Set<string>) {
  return {
    id: position.id,
    accountId: position.accountId,
    ticket: position.ticket.toString(),
    symbol: position.symbol,
    direction: position.direction,
    lots: position.lots,
    openPrice: position.openPrice,
    closePrice: position.closePrice,
    slPrice: position.slPrice,
    tpPrice: position.tpPrice,
    riskUsd: position.riskUsd,
    rewardUsd: position.rewardUsd,
    rrRatio: position.rrRatio,
    floatingPnl: position.floatingPnl,
    realizedPnl: position.realizedPnl,
    result: position.result,
    openTime: position.openTime,
    closeTime: position.closeTime,
    status: position.status,
    updatedAt: position.updatedAt,
    journaled: journaledTickets.has(position.ticket.toString()),
  };
}

export function pktSession(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const hour = Number(parts.find(part => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find(part => part.type === "minute")?.value ?? "0");
  const pktMinute = hour * 60 + minute;
  if (pktMinute < 3 * 60) return "Post-NY";
  if (pktMinute >= 3 * 60 && pktMinute < 5 * 60) return "Pre-Asian";
  if (pktMinute < 8 * 60) return "Asian";
  if (pktMinute < 10 * 60) return "Post-Asian";
  if (pktMinute < 12 * 60) return "Pre-London";
  if (pktMinute < 14 * 60) return "London";
  if (pktMinute < 16 * 60) return "Post-London";
  if (pktMinute < 17 * 60) return "Pre-NY";
  if (pktMinute < 20 * 60) return "New York";
  return "Post-NY";
}

export async function getMt5Workspace(userId: number, accountId: number) {
  await getOwnedAccount(userId, accountId);
  const db = await requireDb();
  const [connections, accountRows, openPositions, closedPositions, journalRows] = await Promise.all([
    db.select().from(mt5Connections).where(eq(mt5Connections.userId, userId)).orderBy(desc(mt5Connections.createdAt)),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(mt5LivePositions).where(and(eq(mt5LivePositions.accountId, accountId), eq(mt5LivePositions.status, "OPEN"))).orderBy(desc(mt5LivePositions.updatedAt)),
    db.select().from(mt5LivePositions).where(and(eq(mt5LivePositions.accountId, accountId), eq(mt5LivePositions.status, "CLOSED"))).orderBy(desc(mt5LivePositions.closeTime)).limit(10),
    db.select({ mt5Ticket: trades.mt5Ticket }).from(trades).where(and(eq(trades.userId, userId), eq(trades.accountId, accountId))),
  ]);
  const accountNames = new Map(accountRows.map(account => [account.id, account.name]));
  const journaledTickets = new Set(journalRows.flatMap(row => row.mt5Ticket == null ? [] : [row.mt5Ticket.toString()]));
  return {
    connections: connections.map(connection => ({ id: connection.id, accountId: connection.accountId, accountName: accountNames.get(connection.accountId) ?? "Trading account", label: connection.label, apiKeyConfigured: Boolean(connection.apiKey), active: connection.active, lastPing: connection.lastPing, mt5Login: connection.mt5Login?.toString() ?? null, brokerServer: connection.brokerServer, currency: connection.currency, balance: connection.balance, equity: connection.equity, margin: connection.margin, freeMargin: connection.freeMargin, floatingPnl: connection.floatingPnl, lastHistorySync: connection.lastHistorySync, historySyncedCount: connection.historySyncedCount, lastHistoryAttempt: connection.lastHistoryAttempt, lastHistoryStatus: connection.lastHistoryStatus, lastHistoryMessage: connection.lastHistoryMessage, lastHistoryBatchSize: connection.lastHistoryBatchSize, createdAt: connection.createdAt })),
    openPositions: openPositions.map(position => safePosition(position, journaledTickets)),
    closedPositions: closedPositions.map(position => safePosition(position, journaledTickets)),
  };
}

export async function getMt5History(userId: number, accountId: number, page: number, pageSize: number) {
  await getOwnedAccount(userId, accountId);
  const db = await requireDb();
  const where = and(eq(mt5LivePositions.accountId, accountId), eq(mt5LivePositions.status, "CLOSED"));
  const totalRows = await db.select({ total: count() }).from(mt5LivePositions).where(where);
  const total = Number(totalRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const [positions, journalRows] = await Promise.all([
    db.select().from(mt5LivePositions).where(where).orderBy(desc(mt5LivePositions.closeTime)).limit(pageSize).offset((safePage - 1) * pageSize),
    db.select({ mt5Ticket: trades.mt5Ticket }).from(trades).where(and(eq(trades.userId, userId), eq(trades.accountId, accountId))),
  ]);
  const journaledTickets = new Set(journalRows.flatMap(row => row.mt5Ticket == null ? [] : [row.mt5Ticket.toString()]));
  return { positions: positions.map(position => safePosition(position, journaledTickets)), total, page: safePage, pageSize, pageCount };
}

export async function getActiveMt5Connection(apiKey: string) {
  const db = await requireDb();
  const hashedKey = hashMt5ApiKey(apiKey);
  const hashedRows = await db.select().from(mt5Connections).where(and(eq(mt5Connections.apiKey, hashedKey), eq(mt5Connections.active, true))).limit(1);
  if (hashedRows[0]) return hashedRows[0];

  // Existing connections were stored before browser-secret hardening. Accept
  // their current EA request once, then replace the stored raw token with its
  // verifier so no browser route can return a usable secret thereafter.
  const legacyRows = await db.select().from(mt5Connections).where(and(eq(mt5Connections.apiKey, apiKey), eq(mt5Connections.active, true))).limit(1);
  if (!legacyRows[0]) return null;
  await db.update(mt5Connections).set({ apiKey: hashedKey }).where(eq(mt5Connections.id, legacyRows[0].id));
  return { ...legacyRows[0], apiKey: hashedKey };
}

export async function touchMt5Connection(connectionId: number) {
  const db = await requireDb();
  await db.update(mt5Connections).set({ lastPing: new Date() }).where(eq(mt5Connections.id, connectionId));
}

type AccountSummary = { mt5Login: bigint; brokerServer: string; currency: string; balance: number; equity: number; margin: number; freeMargin: number; floatingPnl: number };

export async function updateMt5AccountSummary(connectionId: number, value: AccountSummary) {
  const db = await requireDb();
  await db.update(mt5Connections).set({ mt5Login: value.mt5Login, brokerServer: value.brokerServer, currency: value.currency, balance: value.balance.toFixed(2), equity: value.equity.toFixed(2), margin: value.margin.toFixed(2), freeMargin: value.freeMargin.toFixed(2), floatingPnl: value.floatingPnl.toFixed(2), lastPing: new Date() }).where(eq(mt5Connections.id, connectionId));
}

export async function completeMt5HistorySync(connectionId: number, accountId: number) {
  const db = await requireDb();
  const rows = await db.select({ total: count() }).from(mt5LivePositions).where(and(eq(mt5LivePositions.accountId, accountId), eq(mt5LivePositions.status, "CLOSED")));
  await db.update(mt5Connections).set({ lastHistorySync: new Date(), historySyncedCount: Number(rows[0]?.total ?? 0), lastHistoryAttempt: new Date(), lastHistoryStatus: "COMPLETED", lastHistoryMessage: "Historical position scan completed.", lastHistoryBatchSize: 0 }).where(eq(mt5Connections.id, connectionId));
}

export async function recordMt5HistoryAttempt(connectionId: number, batchSize: number) {
  const db = await requireDb();
  await db.update(mt5Connections).set({ lastHistoryAttempt: new Date(), lastHistoryStatus: "RECEIVED", lastHistoryMessage: `Received ${batchSize} historical position${batchSize === 1 ? "" : "s"}.`, lastHistoryBatchSize: batchSize }).where(eq(mt5Connections.id, connectionId));
}

export async function recordMt5HistoryAccepted(connectionId: number, batchSize: number, complete: boolean) {
  const db = await requireDb();
  await db.update(mt5Connections).set({ lastHistoryAttempt: new Date(), lastHistoryStatus: complete ? "COMPLETING" : "ACCEPTED", lastHistoryMessage: complete ? `Accepted final batch of ${batchSize} historical position${batchSize === 1 ? "" : "s"}.` : `Accepted ${batchSize} historical position${batchSize === 1 ? "" : "s"}.`, lastHistoryBatchSize: batchSize }).where(eq(mt5Connections.id, connectionId));
}

export async function recordMt5HistoryFailure(connectionId: number, message: string) {
  const db = await requireDb();
  await db.update(mt5Connections).set({ lastHistoryAttempt: new Date(), lastHistoryStatus: "FAILED", lastHistoryMessage: message.slice(0, 255) }).where(eq(mt5Connections.id, connectionId));
}

type LiveBase = { ticket: bigint; symbol: string; direction: "BUY" | "SELL"; lots: number; openPrice: number; slPrice: number | null; tpPrice: number | null; riskUsd: number; rewardUsd: number; rrRatio: number; openTime: Date };

type SyncedMt5Position = LiveBase & { pnl: number; result: "WIN" | "LOSS" | "BREAK_EVEN" | "OPEN"; tradeTime: Date };

async function syncMt5PositionToTradeLog(userId: number, accountId: number, position: SyncedMt5Position) {
  const db = await requireDb();
  const record = {
    userId,
    accountId,
    tradeDate: position.tradeTime,
    session: pktSession(position.tradeTime),
    direction: position.direction,
    result: position.result,
    level: "",
    timeframe: "",
    setupQuality: "",
    executionType: "",
    marketCondition: "",
    biasAlignment: "",
    confirmationType: "",
    slPlacement: "",
    tpPlacement: "",
    mistake: "",
    holdQuality: "",
    patienceScore: null,
    risk: position.riskUsd.toFixed(2),
    reward: position.rewardUsd.toFixed(2),
    pnl: position.pnl.toFixed(2),
    notes: "",
    emotionBefore: "",
    emotionDuring: "",
    emotionAfter: "",
    mt5Ticket: position.ticket,
  };
  await db.insert(trades).values(record).onDuplicateKeyUpdate({
    set: {
      tradeDate: record.tradeDate,
      session: record.session,
      direction: record.direction,
      result: record.result,
      risk: record.risk,
      reward: record.reward,
      pnl: record.pnl,
    },
  });
}

export async function syncStoredMt5PositionsToTradeLog(userId: number, accountId: number) {
  const db = await requireDb();
  const positions = await db.select().from(mt5LivePositions).where(eq(mt5LivePositions.accountId, accountId));
  for (const position of positions) {
    const closed = position.status === "CLOSED";
    await syncMt5PositionToTradeLog(userId, accountId, {
      ticket: position.ticket,
      symbol: position.symbol,
      direction: position.direction,
      lots: Number(position.lots),
      openPrice: Number(position.openPrice),
      slPrice: position.slPrice == null ? null : Number(position.slPrice),
      tpPrice: position.tpPrice == null ? null : Number(position.tpPrice),
      riskUsd: Number(position.riskUsd),
      rewardUsd: Number(position.rewardUsd),
      rrRatio: Number(position.rrRatio),
      openTime: position.openTime,
      pnl: Number(closed ? position.realizedPnl : position.floatingPnl),
      result: closed ? (position.result ?? "BREAK_EVEN") : "OPEN",
      tradeTime: closed ? (position.closeTime ?? position.openTime) : position.openTime,
    });
  }
  return positions.length;
}

export async function upsertMt5OpenPosition(userId: number, accountId: number, value: LiveBase & { floatingPnl: number }) {
  const db = await requireDb();
  const record = {
    accountId,
    ticket: value.ticket,
    symbol: value.symbol,
    direction: value.direction,
    lots: value.lots.toFixed(2),
    openPrice: value.openPrice.toFixed(6),
    slPrice: value.slPrice?.toFixed(6) ?? null,
    tpPrice: value.tpPrice?.toFixed(6) ?? null,
    riskUsd: value.riskUsd.toFixed(2),
    rewardUsd: value.rewardUsd.toFixed(2),
    rrRatio: value.rrRatio.toFixed(2),
    floatingPnl: value.floatingPnl.toFixed(2),
    openTime: value.openTime,
    status: "OPEN" as const,
    updatedAt: new Date(),
  };
  await db.insert(mt5LivePositions).values(record).onDuplicateKeyUpdate({ set: record });
  await syncMt5PositionToTradeLog(userId, accountId, { ...value, pnl: value.floatingPnl, result: "OPEN", tradeTime: value.openTime });
}

export async function upsertMt5ClosedPosition(userId: number, accountId: number, value: LiveBase & { closePrice: number; realizedPnl: number; result: "WIN" | "LOSS" | "BREAK_EVEN"; closeTime: Date }) {
  const db = await requireDb();
  const existing = await db.select({ openTime: mt5LivePositions.openTime }).from(mt5LivePositions).where(and(eq(mt5LivePositions.accountId, accountId), eq(mt5LivePositions.ticket, value.ticket))).limit(1);
  const record = {
    accountId,
    ticket: value.ticket,
    symbol: value.symbol,
    direction: value.direction,
    lots: value.lots.toFixed(2),
    openPrice: value.openPrice.toFixed(6),
    closePrice: value.closePrice.toFixed(6),
    slPrice: value.slPrice?.toFixed(6) ?? null,
    tpPrice: value.tpPrice?.toFixed(6) ?? null,
    riskUsd: value.riskUsd.toFixed(2),
    rewardUsd: value.rewardUsd.toFixed(2),
    rrRatio: value.rrRatio.toFixed(2),
    floatingPnl: "0.00",
    realizedPnl: value.realizedPnl.toFixed(2),
    result: value.result,
    openTime: existing[0]?.openTime ?? value.openTime,
    closeTime: value.closeTime,
    status: "CLOSED" as const,
    updatedAt: new Date(),
  };
  await db.insert(mt5LivePositions).values(record).onDuplicateKeyUpdate({ set: record });
  await syncMt5PositionToTradeLog(userId, accountId, { ...value, pnl: value.realizedPnl, result: value.result, tradeTime: value.closeTime });
}
