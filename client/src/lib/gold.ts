export const sessions = ["Pre-Asian", "Asian", "Post-Asian", "Pre-London", "London", "Post-London", "Pre-NY", "New York", "Post-NY"];
export const levels = ["SBR/TJL1", "RBS/TJL1", "TJL2", "QML", "FIB", "LVL4", "LVL2"];
export const executionTypes = ["Manual Direct", "Limit Order", "Stop Order", "Manual After Confirmation"];
export const results = ["WIN", "LOSS", "BREAK_EVEN", "OPEN"] as const;

export function formatDate(value: Date | string | number | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatMoney(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(numeric);
}

export function formatRr(risk: number | string | null | undefined, realizedPnl: number | string | null | undefined) {
  const riskValue = Number(risk);
  const pnlValue = Number(realizedPnl);
  if (!Number.isFinite(riskValue) || !Number.isFinite(pnlValue) || riskValue <= 0) return "—";
  return `1 : ${(pnlValue / riskValue).toFixed(2)}`;
}

export function pktDateInput(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (part: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === part)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function pktDateInputToTimestamp(value: string) {
  return new Date(`${value}T12:00:00+05:00`).getTime();
}

export function isFuturePktTradeDate(value: string, now = new Date()) {
  return value > pktDateInput(now);
}

export function getPktSession(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", hour: "2-digit", hour12: false }).format(date));
  if (hour >= 3 && hour < 5) return "Pre-Asian";
  if (hour < 8) return "Asian";
  if (hour < 10) return "Post-Asian";
  if (hour < 12) return "Pre-London";
  if (hour < 14) return "London";
  if (hour < 16) return "Post-London";
  if (hour < 17) return "Pre-NY";
  if (hour < 20) return "New York";
  return "Post-NY";
}

export function toNumber(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}
