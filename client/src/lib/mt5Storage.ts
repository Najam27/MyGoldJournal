import { buildMt5ImportProfile, type Mt5ImportProfile } from "./mt5Import";

type Mt5Settings = { url?: string; days?: number };

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
