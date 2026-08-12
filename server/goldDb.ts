import { and, desc, eq } from "drizzle-orm";
import { accounts, cashMovements, dailyPlans, goals, skippedTrades, trades } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetSignedUrl } from "./storage";

const defaultGoals = [
  ["Max Trades Per Day", "Keep selectivity intact", "DAILY", "trade_count", "LTE", "3"],
  ["Max Daily Loss", "Protect your daily downside", "DAILY", "daily_loss", "LTE", "150"],
  ["No Revenge Trade", "Wait 30 minutes after a loss", "DAILY", "revenge_trades", "LTE", "0"],
  ["Minimum Patience Score", "Keep average patience at least 3", "DAILY", "avg_patience", "GTE", "3"],
  ["Win Rate", "Maintain a weekly edge", "WEEKLY", "win_rate", "GTE", "50"],
  ["Min R:R Achieved", "Aim for a minimum planned R:R", "WEEKLY", "avg_rr", "GTE", "1.5"],
  ["Max Weekly Drawdown", "Limit accumulated loss", "WEEKLY", "weekly_drawdown", "LTE", "300"],
  ["Setup Quality", "Take A or A+ setups", "WEEKLY", "quality_setup", "GTE", "80"],
  ["Screenshot Every Trade", "Capture evidence for every trade", "WEEKLY", "screenshot_rate", "GTE", "100"],
  ["Max Consecutive Losses", "Prevent loss spirals", "WEEKLY", "consecutive_losses", "LTE", "2"],
  ["Profit Target", "Reach the planned monthly target", "MONTHLY", "net_pnl", "GTE", "500"],
  ["Monthly Win Rate", "Maintain your monthly edge", "MONTHLY", "win_rate", "GTE", "55"],
  ["Weekly Review Completion", "Complete four weekly reviews", "MONTHLY", "weekly_reviews", "GTE", "4"],
  ["Profit Factor", "Keep gross profit ahead of loss", "MONTHLY", "profit_factor", "GTE", "1.5"],
] as const;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Cloud database is unavailable. Please retry shortly.");
  return db;
}

export async function ensureAccount(userId: number) {
  const db = await requireDb();
  const existing = await db.select().from(accounts).where(eq(accounts.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db.insert(accounts).values({ userId, name: "Primary Account", startingBalance: "0.00" });
  const accountId = Number(inserted[0].insertId);
  await db.insert(goals).values(defaultGoals.map(([name, description, period, metric, comparison, target]) => ({
    userId,
    accountId,
    name,
    description,
    period,
    metric,
    comparison,
    target,
    isCustom: false,
  })));
  const created = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return created[0]!;
}

export async function getOwnedAccount(userId: number, accountId?: number) {
  const fallback = await ensureAccount(userId);
  if (!accountId) return fallback;
  const db = await requireDb();
  const found = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId))).limit(1);
  if (!found[0]) throw new Error("That trading account is unavailable.");
  return found[0];
}

export async function getJournal(userId: number, accountId?: number) {
  const db = await requireDb();
  const activeAccount = await getOwnedAccount(userId, accountId);
  const [accountList, tradeList, movementList, goalList, skippedList, planList] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(desc(accounts.createdAt)),
    db.select().from(trades).where(and(eq(trades.userId, userId), eq(trades.accountId, activeAccount.id))).orderBy(desc(trades.tradeDate)),
    db.select().from(cashMovements).where(and(eq(cashMovements.userId, userId), eq(cashMovements.accountId, activeAccount.id))).orderBy(desc(cashMovements.movementDate)),
    db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.accountId, activeAccount.id))).orderBy(goals.period, goals.createdAt),
    db.select().from(skippedTrades).where(and(eq(skippedTrades.userId, userId), eq(skippedTrades.accountId, activeAccount.id))).orderBy(desc(skippedTrades.tradeDate)),
    db.select().from(dailyPlans).where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.accountId, activeAccount.id))).orderBy(desc(dailyPlans.planDate)),
  ]);
  const ownedTrades = await Promise.all(tradeList.map(async trade => ({
    ...trade,
    screenshotUrl: trade.screenshotKey ? await storageGetSignedUrl(trade.screenshotKey).catch(() => null) : null,
  })));
  return { activeAccount, accounts: accountList, trades: ownedTrades, cashMovements: movementList, goals: goalList, skippedTrades: skippedList, dailyPlans: planList };
}

export async function ownsTrade(userId: number, tradeId: number) {
  const db = await requireDb();
  const result = await db.select().from(trades).where(and(eq(trades.id, tradeId), eq(trades.userId, userId))).limit(1);
  if (!result[0]) throw new Error("That trade is unavailable.");
  return result[0];
}
