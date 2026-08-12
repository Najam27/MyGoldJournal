import { buildMt5ImportProfile, type Mt5ImportProfile } from "./mt5Import";

type Mt5Settings = { url?: string; days?: number };
export type Mt5ImportRun = { at: string; imported: number; skipped: number; accountName: string; status: "SUCCESS" | "FAILED"; message?: string };

export function loadMt5Settings(storage: Storage = window.localStorage): Mt5Settings {
  try { return JSON.parse(storage.getItem("gj_mt5_settings") || "{}") || {}; } catch { return {}; }
}

export function saveMt5Settings(settings: Mt5Settings, storage: Storage = window.localStorage) {
  storage.setItem("gj_mt5_settings", JSON.stringify({ url: settings.url?.trim() || "http://localhost:7842", days: settings.days }));
}

export function loadMt5Profile(storage: Storage = window.localStorage): Partial<Mt5ImportProfile> {
  try { return JSON.parse(storage.getItem("gj_mt5_import_profile") || "{}") || {}; } catch { return {}; }
}

export function saveMt5Profile(profile: Mt5ImportProfile, storage: Storage = window.localStorage) {
  const normalized = buildMt5ImportProfile(profile);
  storage.setItem("gj_mt5_import_profile", JSON.stringify(normalized));
  return normalized;
}

export function loadMt5ImportHistory(storage: Storage = window.localStorage): Mt5ImportRun[] {
  try { const parsed = JSON.parse(storage.getItem("gj_mt5_import_history") || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export function saveMt5ImportRun(run: Mt5ImportRun, storage: Storage = window.localStorage) {
  const history = [run, ...loadMt5ImportHistory(storage)].slice(0, 20);
  storage.setItem("gj_mt5_import_history", JSON.stringify(history));
  return history;
}
