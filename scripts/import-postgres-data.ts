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

const BOOLEAN_COLUMNS = new Set(["isCustom", "notify", "active", "goalAlerts", "emailAlerts"]);
const JSON_COLUMNS = new Set(["sessionFocus", "rulesPlanned", "rulesFollowed"]);

type ExportTable = { table: string; rowCount: number; rows: Record<string, unknown>[] };
type ExportDocument = { format: string; tables: ExportTable[] };

const inputPath = path.resolve(process.argv[2] || process.env.MYSQL_EXPORT_FILE || "./migration/mysql-export.json");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the PostgreSQL import.");

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) throw new Error(`Unsafe SQL identifier: ${identifier}`);
  return `"${identifier}"`;
}

function deserialize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deserialize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.__type === "bigint") return String(record.value);
    if (record.__type === "buffer") return Buffer.from(String(record.value), "base64");
    return Object.fromEntries(Object.entries(record).map(([key, nested]) => [key, deserialize(nested)]));
  }
  return value;
}

function normalizeColumnValue(column: string, value: unknown) {
  const normalized = deserialize(value);
  if (normalized == null) return null;
  if (BOOLEAN_COLUMNS.has(column)) return normalized === true || normalized === 1 || normalized === "1" || normalized === "true";
  if (JSON_COLUMNS.has(column) && typeof normalized === "string") {
    try { return JSON.parse(normalized); } catch { return normalized; }
  }
  return normalized;
}

function connectionOptions() {
  const isSupabase = /supabase\.(co|com)/i.test(databaseUrl!);
  return { connectionString: databaseUrl, ssl: isSupabase ? { rejectUnauthorized: false } : undefined };
}

const document = JSON.parse(await fs.readFile(inputPath, "utf8")) as ExportDocument;
if (document.format !== "mygoldjournal.mysql-export.v1") throw new Error(`Unsupported export format: ${document.format}`);
const byTable = new Map(document.tables.map(table => [table.table, table]));
const client = new Client(connectionOptions());
await client.connect();
try {
  await client.query("BEGIN");
  for (const table of TABLES) {
    const source = byTable.get(table);
    if (!source || source.rows.length === 0) {
      console.log(`[import] ${table}: 0 rows`);
      continue;
    }
    const columns = [...new Set(source.rows.flatMap(row => Object.keys(row)))];
    const columnSql = columns.map(quoteIdentifier).join(", ");
    const values: unknown[] = [];
    const placeholders = source.rows.map(row => {
      const rowPlaceholders = columns.map(column => {
        values.push(normalizeColumnValue(column, row[column]));
        return `$${values.length}`;
      });
      return `(${rowPlaceholders.join(", ")})`;
    }).join(", ");
    await client.query(`INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES ${placeholders} ON CONFLICT DO NOTHING`, values);
    console.log(`[import] ${table}: ${source.rows.length} exported rows inserted or already present`);
  }
  for (const table of TABLES) {
    await client.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX("id"), 1), MAX("id") IS NOT NULL) FROM ${quoteIdentifier(table)}`, [table]);
  }
  await client.query("COMMIT");
  console.log(`[import] completed from ${inputPath}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
