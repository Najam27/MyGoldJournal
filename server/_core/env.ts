const required = (name: string, value: string) => {
  if (!value && process.env.NODE_ENV === "production") throw new Error(`${name} is required in production.`);
  return value;
};

const asBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
};

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: required("JWT_SECRET", process.env.JWT_SECRET ?? ""),
  databaseUrl: required("DATABASE_URL", process.env.DATABASE_URL ?? ""),
  databaseSsl: asBoolean(process.env.DATABASE_SSL, /supabase\.com/i.test(process.env.DATABASE_URL ?? "")),
  oAuthServerUrl: required("OAUTH_SERVER_URL", process.env.OAUTH_SERVER_URL ?? ""),
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  mt5EncryptionKey: required("MT5_ENCRYPTION_KEY", process.env.MT5_ENCRYPTION_KEY ?? ""),
};

export function assertProductionConfiguration() {
  if (!ENV.isProduction) return;
  if (ENV.cookieSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters in production.");
  if (ENV.mt5EncryptionKey.length < 32) throw new Error("MT5_ENCRYPTION_KEY must be at least 32 characters in production.");
  if (!/^postgres(?:ql)?:\/\//i.test(ENV.databaseUrl)) {
    throw new Error("DATABASE_URL must be a PostgreSQL/Supabase connection string in production.");
  }
}
