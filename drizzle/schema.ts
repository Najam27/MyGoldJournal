import { bigint, boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const accounts = mysqlTable(
  "gj_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    startingBalance: decimal("startingBalance", { precision: 14, scale: 2 }).default("0.00").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("gj_accounts_user_idx").on(table.userId)],
);

export const trades = mysqlTable(
  "gj_trades",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId").notNull(),
    tradeDate: timestamp("tradeDate").notNull(),
    session: varchar("session", { length: 40 }).notNull(),
    direction: mysqlEnum("direction", ["BUY", "SELL"]).notNull(),
    result: mysqlEnum("result", ["WIN", "LOSS", "BREAK_EVEN", "OPEN"]).notNull(),
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
    patienceScore: int("patienceScore"),
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
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("gj_trades_owner_account_date_idx").on(table.userId, table.accountId, table.tradeDate), uniqueIndex("gj_trades_mt5_ticket_unique").on(table.accountId, table.mt5Ticket)],
);

export const cashMovements = mysqlTable(
  "gj_cash_movements",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId").notNull(),
    movementDate: timestamp("movementDate").notNull(),
    type: mysqlEnum("type", ["DEPOSIT", "WITHDRAW"]).notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("gj_cash_owner_account_idx").on(table.userId, table.accountId)],
);

export const goals = mysqlTable(
  "gj_goals",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    period: mysqlEnum("period", ["DAILY", "WEEKLY", "MONTHLY"]).notNull(),
    metric: varchar("metric", { length: 80 }).notNull(),
    comparison: mysqlEnum("comparison", ["GTE", "LTE"]).notNull(),
    target: decimal("target", { precision: 14, scale: 2 }).notNull(),
    notify: boolean("notify").default(true).notNull(),
    active: boolean("active").default(true).notNull(),
    isCustom: boolean("isCustom").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("gj_goals_owner_account_idx").on(table.userId, table.accountId)],
);

export const skippedTrades = mysqlTable(
  "gj_skipped_trades",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId").notNull(),
    tradeDate: timestamp("tradeDate").notNull(),
    session: varchar("session", { length: 40 }).notNull(),
    level: varchar("level", { length: 100 }).default(""),
    timeframe: varchar("timeframe", { length: 20 }).default(""),
    direction: mysqlEnum("direction", ["BUY", "SELL"]).notNull(),
    skipReason: varchar("skipReason", { length: 120 }).notNull(),
    confidence: int("confidence").notNull(),
    outcome: varchar("outcome", { length: 80 }).notNull(),
    estimatedMissed: decimal("estimatedMissed", { precision: 14, scale: 2 }).default("0.00").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("gj_skipped_owner_account_idx").on(table.userId, table.accountId)],
);

export const dailyPlans = mysqlTable(
  "gj_daily_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId").notNull(),
    planDate: timestamp("planDate").notNull(),
    preBias: varchar("preBias", { length: 40 }).default(""),
    marketContext: text("marketContext"),
    keyLevels: text("keyLevels"),
    sessionFocus: json("sessionFocus"),
    eventRisk: text("eventRisk"),
    longScenario: text("longScenario"),
    shortScenario: text("shortScenario"),
    noTradeCondition: text("noTradeCondition"),
    invalidationLevel: text("invalidationLevel"),
    riskLimit: varchar("riskLimit", { length: 40 }).default(""),
    maxTrades: int("maxTrades"),
    sizingPlan: text("sizingPlan"),
    planNotes: text("planNotes"),
    rulesPlanned: json("rulesPlanned"),
    emotionStart: text("emotionStart"),
    emotionEnd: text("emotionEnd"),
    executionScore: int("executionScore"),
    rulesFollowed: json("rulesFollowed"),
    whatWentWell: text("whatWentWell"),
    whatWentWrong: text("whatWentWrong"),
    executionNotes: text("executionNotes"),
    planDeviation: text("planDeviation"),
    lessons: text("lessons"),
    tomorrowFocus: text("tomorrowFocus"),
    overallRating: int("overallRating"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("gj_daily_plan_unique").on(table.userId, table.accountId, table.planDate),
    index("gj_daily_plan_owner_account_idx").on(table.userId, table.accountId),
  ],
);

export const optionLists = mysqlTable(
  "gj_option_lists",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    value: varchar("value", { length: 160 }).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("gj_option_list_unique").on(table.userId, table.category, table.value), index("gj_option_list_owner_idx").on(table.userId)],
);

export const notificationSettings = mysqlTable(
  "gj_notification_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique(),
    goalAlerts: boolean("goalAlerts").default(true).notNull(),
    emailAlerts: boolean("emailAlerts").default(false).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
);

export const notificationHistory = mysqlTable(
  "gj_notification_history",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId"),
    type: varchar("type", { length: 60 }).notNull(),
    message: text("message").notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("gj_notification_owner_idx").on(table.userId, table.createdAt)],
);

export const mt5Connections = mysqlTable(
  "gj_mt5_connections",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    accountId: int("accountId").notNull(),
    apiKey: varchar("apiKey", { length: 96 }).notNull().unique(),
    label: varchar("label", { length: 120 }).default("MT5 Connection").notNull(),
    active: boolean("active").default(true).notNull(),
    lastPing: timestamp("lastPing"),
    mt5Login: bigint("mt5Login", { mode: "bigint" }),
    brokerServer: varchar("brokerServer", { length: 160 }),
    currency: varchar("currency", { length: 16 }),
    balance: decimal("balance", { precision: 14, scale: 2 }),
    equity: decimal("equity", { precision: 14, scale: 2 }),
    margin: decimal("margin", { precision: 14, scale: 2 }),
    freeMargin: decimal("freeMargin", { precision: 14, scale: 2 }),
    floatingPnl: decimal("floatingPnl", { precision: 14, scale: 2 }),
    lastHistorySync: timestamp("lastHistorySync"),
    historySyncedCount: int("historySyncedCount").default(0).notNull(),
    lastHistoryAttempt: timestamp("lastHistoryAttempt"),
    lastHistoryStatus: varchar("lastHistoryStatus", { length: 32 }),
    lastHistoryMessage: varchar("lastHistoryMessage", { length: 255 }),
    lastHistoryBatchSize: int("lastHistoryBatchSize"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("gj_mt5_connection_account_unique").on(table.accountId), index("gj_mt5_connection_owner_idx").on(table.userId, table.accountId)],
);

export const mt5LivePositions = mysqlTable(
  "gj_mt5_live_positions",
  {
    id: int("id").autoincrement().primaryKey(),
    accountId: int("accountId").notNull(),
    ticket: bigint("ticket", { mode: "bigint" }).notNull(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    direction: mysqlEnum("direction", ["BUY", "SELL"]).notNull(),
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
    result: mysqlEnum("result", ["WIN", "LOSS", "BREAK_EVEN"]),
    openTime: timestamp("openTime").notNull(),
    closeTime: timestamp("closeTime"),
    status: mysqlEnum("status", ["OPEN", "CLOSED"]).default("OPEN").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
