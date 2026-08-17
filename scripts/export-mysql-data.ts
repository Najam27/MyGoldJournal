import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

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

type ExportValue = unknown;
type ExportTable = { table: string; rowCount: number; rows: Record<string, ExportValue>[] };

type ExportDocument = {
  format: "mygoldjournal.mysql-export.v1";
  exportedAt: string;
  source: "mysql";
  tables: ExportTable[];
};

const sourceUrl = process.env.MYSQL_DATABASE_URL || process.env.SOURCE_MYSQL_URL;
if (!sourceUrl) {
  throw new Error("Set MYSQL_DATABASE_URL or SOURCE_MYSQL_URL to the legacy MySQL/TiDB connection string.");
}

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return { __type: "bigint", value: value.toString() };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, serialize(nested)]));
  }
  if (Buffer.isBuffer(value)) return { __type: "buffer", value: value.toString("base64") };
  return value;
}

const outputPath = path.resolve(process.argv[2] || process.env.MYSQL_EXPORT_FILE || "./migration/mysql-export.json");
const connection = await mysql.createConnection(sourceUrl);
try {
  const tables: ExportTable[] = [];
  for (const table of TABLES) {
    const [rows] = await connection.query<Record<string, unknown>[]>(`SELECT * FROM \`${table}\``);
    const serializedRows = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, serialize(value)])));
    tables.push({ table, rowCount: serializedRows.length, rows: serializedRows });
    console.log(`[export] ${table}: ${serializedRows.length} rows`);
  }
  const document: ExportDocument = {
    format: "mygoldjournal.mysql-export.v1",
    exportedAt: new Date().toISOString(),
    source: "mysql",
    tables,
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(document, null, 2), "utf8");
  console.log(`[export] wrote ${outputPath}`);
} finally {
  await connection.end();
}
