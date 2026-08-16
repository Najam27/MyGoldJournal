import {
  bigint,
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  serial,
} from "drizzle-orm/pg-core";

const updatedAt = () => timestamp("updatedAt", { withTimezone: true, mode: "date" }).defaultNow().notNull().$onUpdate(() => new Date());
const createdAt = () => timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow().notNull();
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const tradeDirection = pgEnum("trade_direction", ["BUY", "SELL"]);
export const tradeResult = pgEnum("trade_result", ["WIN", "LOSS", "BREAK_EVEN", "OPEN"]);
export const cashMovementType = pgEnum("cash_movement_type", ["DEPOSIT", "WITHDRAW"]);
export const goalPeriod = pgEnum("goal_period", ["DAILY", "WEEKLY", "MONTHLY"]);
export const goalComparison = pgEnum("goal_comparison", ["GTE", "LTE"]);
export const mt5PositionStatus = pgEnum("mt5_position_status", ["OPEN", "CLOSED"]);
export const mt5PositionResult = pgEnum("mt5_position_result", ["WIN", "LOSS", "BREAK_EVEN"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  lastSignedIn: instant("lastSignedIn").defaultNow().notNull(),
});

export const accounts = pgTable(
  "gj_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    startingBalance: decimal("startingBalance", { precision: 14, scale: 2 }).default("0.00").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [index("gj_accounts_user_idx").on(table.userId)],
);

export const trades = pgTable(
  "gj_trades",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    accountId: integer("accountId").notNull(),
    tradeDate: instant("tradeDate").notNull(),
    session: varchar("session", { length: 40 }).notNull(),
    direction: tradeDirection("direction").notNull(),
    result: tradeResult("result").notNull(),
    level: varchar("level", { length: 100 }).default(""),
    timeframe: varchar("timeframe", { length: 20 }).default(""),
    setupQuality: varchar("setupQuality", { length: 40 }).default(""),
    executionType: varchar("executionType", { length: 80 }).default(""),
    marketCondition: varchar("marketCondition", { length: 40 }).default(""),
    biasAlignment: varchar("biasAlignment", { length: 40 }).default(""),
    confirmationType: varchar("confirmationType", { length: 60 }).default(""),
    slPlacement: varchar("slPlacement", { length: 60 }).default(""),
    tpPlacement: varchar("tpPlacement", { length: 60 }).default(""),
    mistake: varchar("mistake", { length: 80 }).default(""),
    holdQuality: varchar("holdQuality", { length: 60 }).default(""),
    patienceScore: integer("patienceScore"),
    risk: decimal("risk", { precision: 14, scale: 2 }),
    reward: decimal("reward", { precision: 14, scale: 2 }),
    pnl: decimal("pnl", { precision: 14, scale: 2 }).default("0.00").notNull(),
    notes: text("notes"),
    emotionBefore: text("emotionBefore"),
    emotionDuring: text("emotionDuring"),
    emotionAfter: text("emotionAfter"),
    screenshotKey: varchar("screenshotKey", { length: 500 }),
    screenshotName: varchar("screenshotName", { length: 255 }),
    mt5Ticket: bigint("mt5Ticket", { mode: "bigint" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [index("gj_trades_owner_account_date_idx").on(table.userId, table.accountId, table.tradeDate), uniqueIndex("gj_trades_mt5_ticket_unique").on(table.accountId, table.mt5Ticket)],
);

export const cashMovements = pgTable(
  "gj_cash_movements",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    accountId: integer("accountId").notNull(),
    movementDate: instant("movementDate").notNull(),
    type: cashMovementType("type").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  table => [index("gj_cash_owner_account_idx").on(table.userId, table.accountId), index("gj_cash_owner_account_date_idx").on(table.userId, table.accountId, table.movementDate)],
);

export const goals = pgTable(
  "gj_goals",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    accountId: integer("accountId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    period: goalPeriod("period").notNull(),
    metric: varchar("metric", { length: 80 }).notNull(),
    comparison: goalComparison("comparison").notNull(),
    target: decimal("target", { precision: 14, scale: 2 }).notNull(),
    notify: boolean("notify").default(true).notNull(),
    active: boolean("active").default(true).notNull(),
    isCustom: boolean("isCustom").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [index("gj_goals_owner_account_idx").on(table.userId, table.accountId)],
);

export const skippedTrades = pgTable(
  "gj_skipped_trades",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    accountId: integer("accountId").notNull(),
    tradeDate: instant("tradeDate").notNull(),
    session: varchar("session", { length: 40 }).notNull(),
    level: varchar("level", { length: 100 }).default(""),
    timeframe: varchar("timeframe", { length: 20 }).default(""),
    direction: tradeDirection("direction").notNull(),
    skipReason: varchar("skipReason", { length: 120 }).notNull(),
    confidence: integer("confidence").notNull(),
    outcome: varchar("outcome", { length: 80 }).notNull(),
    estimatedMissed: decimal("estimatedMissed", { precision: 14, scale: 2 }).default("0.00").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  table => [index("gj_skipped_owner_account_idx").on(table.userId, table.accountId), index("gj_skipped_owner_account_date_idx").on(table.userId, table.accountId, table.tradeDate)],
);

export const dailyPlans = pgTable(
  "gj_daily_plans",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    accountId: integer("accountId").notNull(),
    planDate: instant("planDate").notNull(),
    preBias: varchar("preBias", { length: 40 }).default(""),
    marketContext: text("marketContext"),
    keyLevels: text("keyLevels"),
    sessionFocus: jsonb("sessionFocus"),
    eventRisk: text("eventRisk"),
    longScenario: text("longScenario"),
    shortScenario: text("shortScenario"),
    noTradeCondition: text("noTradeCondition"),
    invalidationLevel: text("invalidationLevel"),
    riskLimit: varchar("riskLimit", { length: 40 }).default(""),
    maxTrades: integer("maxTrades"),
    sizingPlan: text("sizingPlan"),
    planNotes: text("planNotes"),
    rulesPlanned: jsonb("rulesPlanned"),
    emotionStart: text("emotionStart"),
    emotionEnd: text("emotionEnd"),
    executionScore: integer("executionScore"),
    rulesFollowed: jsonb("rulesFollowed"),
    whatWentWell: text("whatWentWell"),
    whatWentWrong: text("whatWentWrong"),
    executionNotes: text("executionNotes"),
    planDeviation: text("planDeviation"),
    lessons: text("lessons"),
    tomorrowFocus: text("tomorrowFocus"),
    overallRating: integer("overallRating"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [uniqueIndex("gj_daily_plan_unique").on(table.userId, table.accountId, table.planDate), index("gj_daily_plan_owner_account_idx").on(table.userId, table.accountId)],
);

export const optionLists = pgTable(
  "gj_option_lists",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    value: varchar("value", { length: 160 }).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: createdAt(),
  },
  table => [uniqueIndex("gj_option_list_unique").on(table.userId, table.category, table.value), index("gj_option_list_owner_idx").on(table.userId)],
);

export const notificationSettings = pgTable("gj_notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  goalAlerts: boolean("goalAlerts").default(true).notNull(),
  emailAlerts: boolean("emailAlerts").default(false).notNull(),
  updatedAt: updatedAt(),
});

export const notificationHistory = pgTable(
  "gj_notification_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    accountId: integer("accountId"),
    type: varchar("type", { length: 60 }).notNull(),
    message: text("message").notNull(),
    readAt: instant("readAt"),
    createdAt: createdAt(),
  },
  table => [index("gj_notification_owner_idx").on(table.userId, table.createdAt), index("gj_notification_owner_account_type_idx").on(table.userId, table.accountId, table.type)],
);

export const mt5Connections = pgTable(
  "gj_mt5_connections",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    accountId: integer("accountId").notNull(),
    apiKey: varchar("apiKey", { length: 512 }).notNull().unique(),
    apiKeyHash: varchar("apiKeyHash", { length: 64 }),
    label: varchar("label", { length: 120 }).default("MT5 Connection").notNull(),
    active: boolean("active").default(true).notNull(),
    lastPing: instant("lastPing"),
    mt5Login: bigint("mt5Login", { mode: "bigint" }),
    brokerServer: varchar("brokerServer", { length: 160 }),
    currency: varchar("currency", { length: 16 }),
    balance: decimal("balance", { precision: 14, scale: 2 }),
    equity: decimal("equity", { precision: 14, scale: 2 }),
    margin: decimal("margin", { precision: 14, scale: 2 }),
    freeMargin: decimal("freeMargin", { precision: 14, scale: 2 }),
    floatingPnl: decimal("floatingPnl", { precision: 14, scale: 2 }),
    lastHistorySync: instant("lastHistorySync"),
    historySyncedCount: integer("historySyncedCount").default(0).notNull(),
    lastHistoryAttempt: instant("lastHistoryAttempt"),
    lastHistoryStatus: varchar("lastHistoryStatus", { length: 32 }),
    lastHistoryMessage: varchar("lastHistoryMessage", { length: 255 }),
    lastHistoryBatchSize: integer("lastHistoryBatchSize"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [uniqueIndex("gj_mt5_connection_account_unique").on(table.accountId), uniqueIndex("gj_mt5_connection_key_hash_unique").on(table.apiKeyHash), index("gj_mt5_connection_owner_idx").on(table.userId, table.accountId)],
);

export const mt5LivePositions = pgTable(
  "gj_mt5_live_positions",
  {
    id: serial("id").primaryKey(),
    accountId: integer("accountId").notNull(),
    ticket: bigint("ticket", { mode: "bigint" }).notNull(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    direction: tradeDirection("direction").notNull(),
    lots: decimal("lots", { precision: 14, scale: 2 }).notNull(),
    openPrice: decimal("openPrice", { precision: 18, scale: 6 }).notNull(),
    closePrice: decimal("closePrice", { precision: 18, scale: 6 }),
    slPrice: decimal("slPrice", { precision: 18, scale: 6 }),
    tpPrice: decimal("tpPrice", { precision: 18, scale: 6 }),
    riskUsd: decimal("riskUsd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    rewardUsd: decimal("rewardUsd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    rrRatio: decimal("rrRatio", { precision: 14, scale: 2 }).default("0.00").notNull(),
    floatingPnl: decimal("floatingPnl", { precision: 14, scale: 2 }).default("0.00").notNull(),
    realizedPnl: decimal("realizedPnl", { precision: 14, scale: 2 }),
    result: mt5PositionResult("result"),
    openTime: instant("openTime").notNull(),
    closeTime: instant("closeTime"),
    status: mt5PositionStatus("status").default("OPEN").notNull(),
    updatedAt: updatedAt(),
  },
  table => [uniqueIndex("gj_mt5_live_account_ticket_unique").on(table.accountId, table.ticket), index("gj_mt5_live_account_status_idx").on(table.accountId, table.status, table.updatedAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Mt5Connection = typeof mt5Connections.$inferSelect;
export type Mt5LivePosition = typeof mt5LivePositions.$inferSelect;
