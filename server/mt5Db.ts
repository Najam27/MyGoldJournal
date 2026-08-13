import { and, count, desc, eq } from "drizzle-orm";
import { accounts, mt5Connections, mt5LivePositions, trades } from "../drizzle/schema";
import { getDb } from "./db";
import { getOwnedAccount } from "./goldDb";

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
    connections: connections.map(connection => ({ id: connection.id, accountId: connection.accountId, accountName: accountNames.get(connection.accountId) ?? "Trading account", label: connection.label, apiKey: connection.apiKey, active: connection.active, lastPing: connection.lastPing, mt5Login: connection.mt5Login?.toString() ?? null, brokerServer: connection.brokerServer, currency: connection.currency, balance: connection.balance, equity: connection.equity, margin: connection.margin, freeMargin: connection.freeMargin, floatingPnl: connection.floatingPnl, lastHistorySync: connection.lastHistorySync, historySyncedCount: connection.historySyncedCount, createdAt: connection.createdAt })),
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
  const rows = await db.select().from(mt5Connections).where(and(eq(mt5Connections.apiKey, apiKey), eq(mt5Connections.active, true))).limit(1);
  return rows[0] ?? null;
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
  await db.update(mt5Connections).set({ lastHistorySync: new Date(), historySyncedCount: Number(rows[0]?.total ?? 0) }).where(eq(mt5Connections.id, connectionId));
}

type LiveBase = { ticket: bigint; symbol: string; direction: "BUY" | "SELL"; lots: number; openPrice: number; slPrice: number | null; tpPrice: number | null; riskUsd: number; rewardUsd: number; rrRatio: number; openTime: Date };

export async function upsertMt5OpenPosition(accountId: number, value: LiveBase & { floatingPnl: number }) {
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
}

export async function upsertMt5ClosedPosition(accountId: number, value: LiveBase & { closePrice: number; realizedPnl: number; result: "WIN" | "LOSS" | "BREAK_EVEN"; closeTime: Date }) {
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
}
