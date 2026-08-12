import { and, count, desc, eq, like, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { accounts, cashMovements, dailyPlans, goals, notificationHistory, notificationSettings, optionLists, skippedTrades, trades } from "../drizzle/schema";
import { getDb } from "./db";
import { ensureAccount, getJournal, getOwnedAccount, ownsTrade } from "./goldDb";
import { protectedProcedure, router } from "./_core/trpc";
import { storageGetSignedUrl, storagePut } from "./storage";

const optionalText = (max = 5000) => z.string().trim().max(max).optional().default("");
const accountIdInput = z.object({ accountId: z.number().int().positive() });

const tradeInput = z.object({
  accountId: z.number().int().positive(),
  tradeDate: z.number().int().positive(),
  session: z.string().min(1).max(40),
  direction: z.enum(["BUY", "SELL"]),
  result: z.enum(["WIN", "LOSS", "BREAK_EVEN", "OPEN"]),
  level: optionalText(100),
  timeframe: optionalText(20),
  setupQuality: optionalText(40),
  executionType: optionalText(80),
  marketCondition: optionalText(40),
  biasAlignment: optionalText(40),
  confirmationType: optionalText(60),
  slPlacement: optionalText(60),
  tpPlacement: optionalText(60),
  mistake: optionalText(80),
  holdQuality: optionalText(60),
  patienceScore: z.number().int().min(1).max(5).nullable(),
  risk: z.number().min(0).nullable(),
  reward: z.number().min(0).nullable(),
  pnl: z.number(),
  notes: optionalText(6000),
  emotionBefore: optionalText(2000),
  emotionDuring: optionalText(2000),
  emotionAfter: optionalText(2000),
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Cloud database is unavailable. Please retry shortly.");
  return db;
}

async function ownGoal(userId: number, goalId: number) {
  const db = await dbOrThrow();
  const found = await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId))).limit(1);
  if (!found[0]) throw new Error("That goal is unavailable.");
  return found[0];
}

export const goldRouter = router({
  journal: router({
    bootstrap: protectedProcedure.query(({ ctx }) => ensureAccount(ctx.user.id)),
    get: protectedProcedure.input(z.object({ accountId: z.number().int().positive().optional() })).query(({ ctx, input }) => getJournal(ctx.user.id, input.accountId)),
  }),
  accounts: router({
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(100), startingBalance: z.number().min(0).default(0) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const inserted = await db.insert(accounts).values({ userId: ctx.user.id, name: input.name, startingBalance: input.startingBalance.toFixed(2) });
      return { id: Number(inserted[0].insertId) };
    }),
    rename: protectedProcedure.input(z.object({ accountId: z.number().int().positive(), name: z.string().trim().min(1).max(100) })).mutation(async ({ ctx, input }) => {
      await getOwnedAccount(ctx.user.id, input.accountId);
      const db = await dbOrThrow();
      await db.update(accounts).set({ name: input.name }).where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)));
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ accountId: z.number().int().positive(), confirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
      await getOwnedAccount(ctx.user.id, input.accountId);
      const db = await dbOrThrow();
      const ownedAccounts = await db.select().from(accounts).where(eq(accounts.userId, ctx.user.id));
      if (ownedAccounts.length < 2) throw new Error("Create another account before removing your only account.");
      const replacement = ownedAccounts.find(account => account.id !== input.accountId);
      if (!replacement) throw new Error("A replacement account could not be selected.");
      await db.delete(notificationHistory).where(and(eq(notificationHistory.userId, ctx.user.id), eq(notificationHistory.accountId, input.accountId)));
      await db.delete(dailyPlans).where(and(eq(dailyPlans.userId, ctx.user.id), eq(dailyPlans.accountId, input.accountId)));
      await db.delete(skippedTrades).where(and(eq(skippedTrades.userId, ctx.user.id), eq(skippedTrades.accountId, input.accountId)));
      await db.delete(cashMovements).where(and(eq(cashMovements.userId, ctx.user.id), eq(cashMovements.accountId, input.accountId)));
      await db.delete(goals).where(and(eq(goals.userId, ctx.user.id), eq(goals.accountId, input.accountId)));
      await db.delete(trades).where(and(eq(trades.userId, ctx.user.id), eq(trades.accountId, input.accountId)));
      await db.delete(accounts).where(and(eq(accounts.userId, ctx.user.id), eq(accounts.id, input.accountId)));
      return { success: true, replacementAccountId: replacement.id };
    }),
  }),
  trades: router({
    list: protectedProcedure.input(z.object({ accountId: z.number().int().positive(), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(50).default(12), search: z.string().trim().max(160).optional().default(""), result: z.enum(["WIN", "LOSS", "BREAK_EVEN", "OPEN"]).optional() })).query(async ({ ctx, input }) => {
      const account = await getOwnedAccount(ctx.user.id, input.accountId);
      const db = await dbOrThrow();
      let where = and(eq(trades.userId, ctx.user.id), eq(trades.accountId, account.id));
      if (input.result) where = and(where, eq(trades.result, input.result));
      if (input.search) {
        const needle = `%${input.search}%`;
        where = and(where, or(like(trades.session, needle), like(trades.level, needle), like(trades.notes, needle)));
      }
      const totalRows = await db.select({ total: count() }).from(trades).where(where);
      const total = Number(totalRows[0]?.total ?? 0);
      const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
      const page = Math.min(input.page, pageCount);
      const rows = await db.select().from(trades).where(where).orderBy(desc(trades.tradeDate), desc(trades.id)).limit(input.pageSize).offset((page - 1) * input.pageSize);
      const hydratedRows = await Promise.all(rows.map(async trade => ({ ...trade, screenshotUrl: trade.screenshotKey ? await storageGetSignedUrl(trade.screenshotKey).catch(() => null) : null })));
      return { trades: hydratedRows, total, page, pageSize: input.pageSize, pageCount };
    }),
    create: protectedProcedure.input(tradeInput).mutation(async ({ ctx, input }) => {
      await getOwnedAccount(ctx.user.id, input.accountId);
      const db = await dbOrThrow();
      const inserted = await db.insert(trades).values({
        userId: ctx.user.id, accountId: input.accountId, tradeDate: new Date(input.tradeDate), session: input.session,
        direction: input.direction, result: input.result, level: input.level, timeframe: input.timeframe,
        setupQuality: input.setupQuality, executionType: input.executionType, marketCondition: input.marketCondition,
        biasAlignment: input.biasAlignment, confirmationType: input.confirmationType, slPlacement: input.slPlacement,
        tpPlacement: input.tpPlacement, mistake: input.mistake, holdQuality: input.holdQuality, patienceScore: input.patienceScore,
        risk: input.risk?.toFixed(2) ?? null, reward: input.reward?.toFixed(2) ?? null, pnl: input.pnl.toFixed(2),
        notes: input.notes, emotionBefore: input.emotionBefore, emotionDuring: input.emotionDuring, emotionAfter: input.emotionAfter,
      });
      return { id: Number(inserted[0].insertId) };
    }),
    update: protectedProcedure.input(tradeInput.extend({ tradeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const current = await ownsTrade(ctx.user.id, input.tradeId);
      const db = await dbOrThrow();
      await db.update(trades).set({
        tradeDate: new Date(input.tradeDate), session: input.session, direction: input.direction, result: input.result,
        level: input.level, timeframe: input.timeframe, setupQuality: input.setupQuality, executionType: input.executionType,
        marketCondition: input.marketCondition, biasAlignment: input.biasAlignment, confirmationType: input.confirmationType,
        slPlacement: input.slPlacement, tpPlacement: input.tpPlacement, mistake: input.mistake, holdQuality: input.holdQuality,
        patienceScore: input.patienceScore, risk: input.risk?.toFixed(2) ?? null, reward: input.reward?.toFixed(2) ?? null,
        pnl: input.pnl.toFixed(2), notes: input.notes, emotionBefore: input.emotionBefore, emotionDuring: input.emotionDuring, emotionAfter: input.emotionAfter,
      }).where(and(eq(trades.id, current.id), eq(trades.userId, ctx.user.id)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ tradeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const current = await ownsTrade(ctx.user.id, input.tradeId);
      const db = await dbOrThrow();
      await db.delete(trades).where(and(eq(trades.id, current.id), eq(trades.userId, ctx.user.id)));
      return { success: true };
    }),
    clearAll: protectedProcedure.input(accountIdInput.extend({ confirmed: z.literal(true) })).mutation(async ({ ctx, input }) => {
      await getOwnedAccount(ctx.user.id, input.accountId);
      const db = await dbOrThrow();
      await db.delete(trades).where(and(eq(trades.userId, ctx.user.id), eq(trades.accountId, input.accountId)));
      return { success: true };
    }),
    uploadScreenshot: protectedProcedure.input(z.object({ tradeId: z.number().int().positive(), fileName: z.string().min(1).max(255), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(40).max(7_000_000) })).mutation(async ({ ctx, input }) => {
      const trade = await ownsTrade(ctx.user.id, input.tradeId);
      const base64 = input.base64.includes(",") ? input.base64.split(",")[1] : input.base64;
      const bytes = Buffer.from(base64, "base64");
      if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Screenshot must be 5MB or smaller.");
      const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
      const stored = await storagePut(`gold-journal/${ctx.user.id}/trades/${trade.id}-${nanoid()}.${extension}`, bytes, input.mimeType);
      const db = await dbOrThrow();
      await db.update(trades).set({ screenshotKey: stored.key, screenshotName: input.fileName }).where(and(eq(trades.id, trade.id), eq(trades.userId, ctx.user.id)));
      return { key: stored.key, url: stored.url };
    }),
  }),
  cash: router({
    create: protectedProcedure.input(z.object({ accountId: z.number().int().positive(), movementDate: z.number().int().positive(), type: z.enum(["DEPOSIT", "WITHDRAW"]), amount: z.number().positive(), note: optionalText(1000) })).mutation(async ({ ctx, input }) => {
      await getOwnedAccount(ctx.user.id, input.accountId);
      const db = await dbOrThrow();
      await db.insert(cashMovements).values({ userId: ctx.user.id, accountId: input.accountId, movementDate: new Date(input.movementDate), type: input.type, amount: input.amount.toFixed(2), note: input.note });
      return { success: true };
    }),
  }),
  goals: router({
    create: protectedProcedure.input(z.object({ accountId: z.number().int().positive(), name: z.string().trim().min(1).max(120), description: optionalText(500), period: z.enum(["DAILY", "WEEKLY", "MONTHLY"]), metric: z.string().trim().min(1).max(80), comparison: z.enum(["GTE", "LTE"]), target: z.number().min(0), notify: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
      await getOwnedAccount(ctx.user.id, input.accountId);
      const db = await dbOrThrow();
      await db.insert(goals).values({ ...input, userId: ctx.user.id, target: input.target.toFixed(2), isCustom: true });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({ goalId: z.number().int().positive(), target: z.number().min(0), notify: z.boolean(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
      await ownGoal(ctx.user.id, input.goalId);
      const db = await dbOrThrow();
      await db.update(goals).set({ target: input.target.toFixed(2), notify: input.notify, active: input.active }).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id)));
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ goalId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const goal = await ownGoal(ctx.user.id, input.goalId);
      if (!goal.isCustom) throw new Error("Default goals cannot be deleted.");
      const db = await dbOrThrow();
      await db.delete(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, ctx.user.id)));
      return { success: true };
    }),
  }),
  optionLists: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await dbOrThrow();
      return db.select().from(optionLists).where(eq(optionLists.userId, ctx.user.id)).orderBy(optionLists.category, optionLists.value);
    }),
    add: protectedProcedure.input(z.object({ category: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(160) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.insert(optionLists).values({ userId: ctx.user.id, category: input.category, value: input.value }).onDuplicateKeyUpdate({ set: { active: true } });
      return { success: true };
    }),
    setActive: protectedProcedure.input(z.object({ optionId: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.update(optionLists).set({ active: input.active }).where(and(eq(optionLists.id, input.optionId), eq(optionLists.userId, ctx.user.id)));
      return { success: true };
    }),
  }),
  notifications: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await dbOrThrow();
      const [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, ctx.user.id)).limit(1);
      const history = await db.select().from(notificationHistory).where(eq(notificationHistory.userId, ctx.user.id)).orderBy(desc(notificationHistory.createdAt)).limit(50);
      return { settings: settings ?? { goalAlerts: true, emailAlerts: false }, history };
    }),
    updateSettings: protectedProcedure.input(z.object({ goalAlerts: z.boolean(), emailAlerts: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.insert(notificationSettings).values({ userId: ctx.user.id, ...input }).onDuplicateKeyUpdate({ set: input });
      return { success: true };
    }),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      await db.update(notificationHistory).set({ readAt: new Date() }).where(and(eq(notificationHistory.id, input.notificationId), eq(notificationHistory.userId, ctx.user.id)));
      return { success: true };
    }),
  }),
  skipped: router({
    create: protectedProcedure.input(z.object({ accountId: z.number().int().positive(), tradeDate: z.number().int().positive(), session: z.string().min(1).max(40), level: optionalText(100), timeframe: optionalText(20), direction: z.enum(["BUY", "SELL"]), skipReason: z.string().min(1).max(120), confidence: z.number().int().min(1).max(5), outcome: z.string().min(1).max(80), estimatedMissed: z.number(), notes: optionalText(3000) })).mutation(async ({ ctx, input }) => {
      await getOwnedAccount(ctx.user.id, input.accountId);
      const db = await dbOrThrow();
      await db.insert(skippedTrades).values({ ...input, userId: ctx.user.id, tradeDate: new Date(input.tradeDate), estimatedMissed: input.estimatedMissed.toFixed(2) });
      return { success: true };
    }),
  }),
  plans: router({
    save: protectedProcedure.input(z.object({ accountId: z.number().int().positive(), planDate: z.number().int().positive(), preBias: optionalText(40), marketContext: optionalText(3000), keyLevels: optionalText(3000), sessionFocus: z.array(z.string()).max(9), eventRisk: optionalText(1500), longScenario: optionalText(3000), shortScenario: optionalText(3000), noTradeCondition: optionalText(2000), invalidationLevel: optionalText(1000), riskLimit: optionalText(40), maxTrades: z.number().int().min(1).max(99).nullable(), sizingPlan: optionalText(2000), planNotes: optionalText(5000), rulesPlanned: z.array(z.object({ id: z.string(), text: z.string(), checked: z.boolean() })), emotionStart: z.array(z.string()), emotionEnd: z.array(z.string()), executionScore: z.number().int().min(1).max(5).nullable(), rulesFollowed: z.array(z.object({ id: z.string(), yes: z.boolean() })), whatWentWell: optionalText(5000), whatWentWrong: optionalText(5000), executionNotes: optionalText(5000), planDeviation: optionalText(5000), lessons: optionalText(2000), tomorrowFocus: optionalText(2000), overallRating: z.number().int().min(1).max(5).nullable() })).mutation(async ({ ctx, input }) => {
      await getOwnedAccount(ctx.user.id, input.accountId);
      const db = await dbOrThrow();
      const record = { userId: ctx.user.id, accountId: input.accountId, planDate: new Date(input.planDate), preBias: input.preBias, marketContext: input.marketContext, keyLevels: input.keyLevels, sessionFocus: input.sessionFocus, eventRisk: input.eventRisk, longScenario: input.longScenario, shortScenario: input.shortScenario, noTradeCondition: input.noTradeCondition, invalidationLevel: input.invalidationLevel, riskLimit: input.riskLimit, maxTrades: input.maxTrades, sizingPlan: input.sizingPlan, planNotes: input.planNotes, rulesPlanned: input.rulesPlanned, emotionStart: input.emotionStart.join("|"), emotionEnd: input.emotionEnd.join("|"), executionScore: input.executionScore, rulesFollowed: input.rulesFollowed, whatWentWell: input.whatWentWell, whatWentWrong: input.whatWentWrong, executionNotes: input.executionNotes, planDeviation: input.planDeviation, lessons: input.lessons, tomorrowFocus: input.tomorrowFocus, overallRating: input.overallRating };
      await db.insert(dailyPlans).values(record).onDuplicateKeyUpdate({ set: record });
      return { success: true };
    }),
  }),
});
