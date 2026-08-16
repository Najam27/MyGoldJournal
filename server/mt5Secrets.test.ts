import { describe, expect, it } from "vitest";
import { decryptMt5ApiKey, encryptMt5ApiKey, hashMt5ApiKey, maskMt5ApiKey, safeApiKeyEquals } from "./mt5Secrets";

describe("MT5 secret handling", () => {
  it("round-trips encrypted API keys without storing plaintext", () => {
    const apiKey = "mt5_live_key_for_regression_123456789";
    const encrypted = encryptMt5ApiKey(apiKey);
    expect(encrypted).not.toContain(apiKey);
    expect(decryptMt5ApiKey(encrypted)).toBe(apiKey);
  });

  it("produces stable keyed lookup hashes and masks exposed previews", () => {
    const apiKey = "mt5_live_key_for_regression_123456789";
    expect(hashMt5ApiKey(apiKey)).toBe(hashMt5ApiKey(apiKey));
    expect(hashMt5ApiKey(apiKey)).not.toBe(hashMt5ApiKey(`${apiKey}-other`));
    expect(maskMt5ApiKey(apiKey)).toContain("••••••••");
  });

  it("uses constant-time equality semantics for matching keys", () => {
    expect(safeApiKeyEquals("same-secret", "same-secret")).toBe(true);
    expect(safeApiKeyEquals("same-secret", "different-secret")).toBe(false);
  });
});
