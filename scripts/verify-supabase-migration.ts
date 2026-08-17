import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const TABLES = [
  "users",
  "gj_accounts",
  "gj_trades",
  "gj_cash_movements",
  "gj_goals",
  "gj_skipped_trades",
  "gj_daily_plans",
  "gj_option_lists",
  "gj_notification_settings",
  "gj_notification_history",
  "gj_mt5_connections",
  "gj_mt5_live_positions",
] as const;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for migration verification.");
const expectedPath = path.resolve(process.argv[2] || process.env.MYSQL_EXPORT_FILE || "./migration/mysql-export.json");

function qi(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) throw new Error(`Unsafe SQL identifier: ${identifier}`);
  return `"${identifier}"`;
}

async function expectedCounts() {
  try {
    const parsed = JSON.parse(await fs.readFile(expectedPath, "utf8")) as { tables?: Array<{ table: string; rowCount: number }> };
    return new Map((parsed.tables ?? []).map(table => [table.table, table.rowCount]));
  } catch {
    return undefined;
  }
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: /supabase\.(co|com)/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
let failures = 0;
try {
  const expected = await expectedCounts();
  console.log(`Supabase verification target: ${databaseUrl.replace(/:[^:@/]+@/, ":***@")}`);
  for (const table of TABLES) {
    const result = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${qi(table)}`);
    const actual = Number(result.rows[0]?.count ?? 0);
    const expectedCount = expected?.get(table);
    const status = expectedCount === undefined ? "observed" : actual === expectedCount ? "ok" : "MISMATCH";
    if (status === "MISMATCH") failures += 1;
    console.log(`${status.padEnd(8)} ${table.padEnd(30)} actual=${actual}${expectedCount === undefined ? "" : ` expected=${expectedCount}`}`);
  }

  const invariants: Array<[string, string]> = [
    ["duplicate MT5 live account/ticket", `SELECT COUNT(*)::text AS count FROM (SELECT "accountId", "ticket" FROM "gj_mt5_live_positions" GROUP BY "accountId", "ticket" HAVING COUNT(*) > 1) duplicates`],
    ["duplicate MT5 journal account/ticket", `SELECT COUNT(*)::text AS count FROM (SELECT "accountId", "mt5Ticket" FROM "gj_trades" WHERE "mt5Ticket" IS NOT NULL GROUP BY "accountId", "mt5Ticket" HAVING COUNT(*) > 1) duplicates`],
    ["orphan MT5 connections", `SELECT COUNT(*)::text AS count FROM "gj_mt5_connections" c LEFT JOIN "gj_accounts" a ON a."id" = c."accountId" WHERE a."id" IS NULL`],
    ["orphan MT5 live positions", `SELECT COUNT(*)::text AS count FROM "gj_mt5_live_positions" p LEFT JOIN "gj_accounts" a ON a."id" = p."accountId" WHERE a."id" IS NULL`],
    ["orphan MT5 journal trades", `SELECT COUNT(*)::text AS count FROM "gj_trades" t LEFT JOIN "gj_accounts" a ON a."id" = t."accountId" WHERE t."mt5Ticket" IS NOT NULL AND a."id" IS NULL`],
    ["cross-user MT5 connections", `SELECT COUNT(*)::text AS count FROM "gj_mt5_connections" c JOIN "gj_accounts" a ON a."id" = c."accountId" WHERE c."userId" <> a."userId"`],
  ];
  console.log("\nIntegrity invariants:");
  for (const [label, sql] of invariants) {
    const result = await client.query<{ count: string }>(sql);
    const count = Number(result.rows[0]?.count ?? 0);
    if (count !== 0) failures += 1;
    console.log(`${count === 0 ? "ok" : "FAIL"} ${label}: ${count}`);
  }
} finally {
  await client.end();
}
if (failures > 0) {
  console.error(`Verification failed with ${failures} issue(s). Do not cut over traffic.`);
  process.exit(1);
}
console.log("Verification passed. Row counts and MT5/account-isolation invariants are consistent.");
