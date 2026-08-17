CREATE TYPE "public"."cash_movement_type" AS ENUM('DEPOSIT', 'WITHDRAW');--> statement-breakpoint
CREATE TYPE "public"."goal_comparison" AS ENUM('GTE', 'LTE');--> statement-breakpoint
CREATE TYPE "public"."goal_period" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."mt5_position_result" AS ENUM('WIN', 'LOSS', 'BREAK_EVEN');--> statement-breakpoint
CREATE TYPE "public"."mt5_position_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."trade_direction" AS ENUM('BUY', 'SELL');--> statement-breakpoint
CREATE TYPE "public"."trade_result" AS ENUM('WIN', 'LOSS', 'BREAK_EVEN', 'OPEN');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "gj_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"startingBalance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gj_cash_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"accountId" integer NOT NULL,
	"movementDate" timestamp with time zone NOT NULL,
	"type" "cash_movement_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gj_daily_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"accountId" integer NOT NULL,
	"planDate" timestamp with time zone NOT NULL,
	"preBias" varchar(40) DEFAULT '',
	"marketContext" text,
	"keyLevels" text,
	"sessionFocus" jsonb,
	"eventRisk" text,
	"longScenario" text,
	"shortScenario" text,
	"noTradeCondition" text,
	"invalidationLevel" text,
	"riskLimit" varchar(40) DEFAULT '',
	"maxTrades" integer,
	"sizingPlan" text,
	"planNotes" text,
	"rulesPlanned" jsonb,
	"emotionStart" text,
	"emotionEnd" text,
	"executionScore" integer,
	"rulesFollowed" jsonb,
	"whatWentWell" text,
	"whatWentWrong" text,
	"executionNotes" text,
	"planDeviation" text,
	"lessons" text,
	"tomorrowFocus" text,
	"overallRating" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gj_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"accountId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"period" "goal_period" NOT NULL,
	"metric" varchar(80) NOT NULL,
	"comparison" "goal_comparison" NOT NULL,
	"target" numeric(14, 2) NOT NULL,
	"notify" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"isCustom" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gj_mt5_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"accountId" integer NOT NULL,
	"apiKey" varchar(512) NOT NULL,
	"apiKeyHash" varchar(64),
	"label" varchar(120) DEFAULT 'MT5 Connection' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"lastPing" timestamp with time zone,
	"mt5Login" bigint,
	"brokerServer" varchar(160),
	"currency" varchar(16),
	"balance" numeric(14, 2),
	"equity" numeric(14, 2),
	"margin" numeric(14, 2),
	"freeMargin" numeric(14, 2),
	"floatingPnl" numeric(14, 2),
	"lastHistorySync" timestamp with time zone,
	"historySyncedCount" integer DEFAULT 0 NOT NULL,
	"lastHistoryAttempt" timestamp with time zone,
	"lastHistoryStatus" varchar(32),
	"lastHistoryMessage" varchar(255),
	"lastHistoryBatchSize" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gj_mt5_connections_apiKey_unique" UNIQUE("apiKey")
);
--> statement-breakpoint
CREATE TABLE "gj_mt5_live_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"accountId" integer NOT NULL,
	"ticket" bigint NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"direction" "trade_direction" NOT NULL,
	"lots" numeric(14, 2) NOT NULL,
	"openPrice" numeric(18, 6) NOT NULL,
	"closePrice" numeric(18, 6),
	"slPrice" numeric(18, 6),
	"tpPrice" numeric(18, 6),
	"riskUsd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"rewardUsd" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"rrRatio" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"floatingPnl" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"realizedPnl" numeric(14, 2),
	"result" "mt5_position_result",
	"openTime" timestamp with time zone NOT NULL,
	"closeTime" timestamp with time zone,
	"status" "mt5_position_status" DEFAULT 'OPEN' NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gj_notification_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"accountId" integer,
	"type" varchar(60) NOT NULL,
	"message" text NOT NULL,
	"readAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gj_notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"goalAlerts" boolean DEFAULT true NOT NULL,
	"emailAlerts" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gj_notification_settings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "gj_option_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"category" varchar(80) NOT NULL,
	"value" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gj_skipped_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"accountId" integer NOT NULL,
	"tradeDate" timestamp with time zone NOT NULL,
	"session" varchar(40) NOT NULL,
	"level" varchar(100) DEFAULT '',
	"timeframe" varchar(20) DEFAULT '',
	"direction" "trade_direction" NOT NULL,
	"skipReason" varchar(120) NOT NULL,
	"confidence" integer NOT NULL,
	"outcome" varchar(80) NOT NULL,
	"estimatedMissed" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gj_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"accountId" integer NOT NULL,
	"tradeDate" timestamp with time zone NOT NULL,
	"session" varchar(40) NOT NULL,
	"direction" "trade_direction" NOT NULL,
	"result" "trade_result" NOT NULL,
	"level" varchar(100) DEFAULT '',
	"timeframe" varchar(20) DEFAULT '',
	"setupQuality" varchar(40) DEFAULT '',
	"executionType" varchar(80) DEFAULT '',
	"marketCondition" varchar(40) DEFAULT '',
	"biasAlignment" varchar(40) DEFAULT '',
	"confirmationType" varchar(60) DEFAULT '',
	"slPlacement" varchar(60) DEFAULT '',
	"tpPlacement" varchar(60) DEFAULT '',
	"mistake" varchar(80) DEFAULT '',
	"holdQuality" varchar(60) DEFAULT '',
	"patienceScore" integer,
	"risk" numeric(14, 2),
	"reward" numeric(14, 2),
	"pnl" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"emotionBefore" text,
	"emotionDuring" text,
	"emotionAfter" text,
	"screenshotKey" varchar(500),
	"screenshotName" varchar(255),
	"mt5Ticket" bigint,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE INDEX "gj_accounts_user_idx" ON "gj_accounts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "gj_cash_owner_account_idx" ON "gj_cash_movements" USING btree ("userId","accountId");--> statement-breakpoint
CREATE INDEX "gj_cash_owner_account_date_idx" ON "gj_cash_movements" USING btree ("userId","accountId","movementDate");--> statement-breakpoint
CREATE UNIQUE INDEX "gj_daily_plan_unique" ON "gj_daily_plans" USING btree ("userId","accountId","planDate");--> statement-breakpoint
CREATE INDEX "gj_daily_plan_owner_account_idx" ON "gj_daily_plans" USING btree ("userId","accountId");--> statement-breakpoint
CREATE INDEX "gj_goals_owner_account_idx" ON "gj_goals" USING btree ("userId","accountId");--> statement-breakpoint
CREATE UNIQUE INDEX "gj_mt5_connection_account_unique" ON "gj_mt5_connections" USING btree ("accountId");--> statement-breakpoint
CREATE UNIQUE INDEX "gj_mt5_connection_key_hash_unique" ON "gj_mt5_connections" USING btree ("apiKeyHash");--> statement-breakpoint
CREATE INDEX "gj_mt5_connection_owner_idx" ON "gj_mt5_connections" USING btree ("userId","accountId");--> statement-breakpoint
CREATE UNIQUE INDEX "gj_mt5_live_account_ticket_unique" ON "gj_mt5_live_positions" USING btree ("accountId","ticket");--> statement-breakpoint
CREATE INDEX "gj_mt5_live_account_status_idx" ON "gj_mt5_live_positions" USING btree ("accountId","status","updatedAt");--> statement-breakpoint
CREATE INDEX "gj_notification_owner_idx" ON "gj_notification_history" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "gj_notification_owner_account_type_idx" ON "gj_notification_history" USING btree ("userId","accountId","type");--> statement-breakpoint
CREATE UNIQUE INDEX "gj_option_list_unique" ON "gj_option_lists" USING btree ("userId","category","value");--> statement-breakpoint
CREATE INDEX "gj_option_list_owner_idx" ON "gj_option_lists" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "gj_skipped_owner_account_idx" ON "gj_skipped_trades" USING btree ("userId","accountId");--> statement-breakpoint
CREATE INDEX "gj_skipped_owner_account_date_idx" ON "gj_skipped_trades" USING btree ("userId","accountId","tradeDate");--> statement-breakpoint
CREATE INDEX "gj_trades_owner_account_date_idx" ON "gj_trades" USING btree ("userId","accountId","tradeDate");--> statement-breakpoint
CREATE UNIQUE INDEX "gj_trades_mt5_ticket_unique" ON "gj_trades" USING btree ("accountId","mt5Ticket");