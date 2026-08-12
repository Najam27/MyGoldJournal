export type Mt5ImportProfile = { accountId?: number; accountName: string; url: string; days: number };

export function normalizeMt5Days(value: unknown) {
  return Math.min(90, Math.max(1, Number(value) || 30));
}

export function buildMt5ImportProfile(input: Mt5ImportProfile): Mt5ImportProfile {
  return { accountId: input.accountId, accountName: input.accountName.trim() || "Selected MT5 account", url: input.url.trim() || "http://localhost:7842", days: normalizeMt5Days(input.days) };
}

export function summarizeMt5Outcome(input: { ok: boolean; imported?: number; skipped?: number; message?: string }, accountName: string) {
  if (!input.ok) return { status: `Bridge import failed — ${input.message || "check mt5_sync and retry."}`, imported: 0, skipped: 0, accountName };
  const imported = input.imported ?? 0;
  return { status: `Bridge connected — ${imported} new trade${imported === 1 ? "" : "s"} imported.`, imported, skipped: input.skipped ?? 0, accountName };
}
