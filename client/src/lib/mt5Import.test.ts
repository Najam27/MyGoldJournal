import { describe, expect, it } from "vitest";
import { buildMt5ImportProfile, normalizeMt5Days, summarizeMt5Outcome } from "./mt5Import";

describe("MT5 import preparation", () => {
  it("persists a selected target account with a bounded history window", () => {
    expect(buildMt5ImportProfile({ accountId: 24, accountName: "  FTMO 100K  ", url: " http://localhost:7842 ", days: 200 })).toEqual({ accountId: 24, accountName: "FTMO 100K", url: "http://localhost:7842", days: 90 });
    expect(normalizeMt5Days(0)).toBe(30);
  });

  it("provides explicit success and failure feedback for a bridge import", () => {
    expect(summarizeMt5Outcome({ ok: true, imported: 2, skipped: 1 }, "FTMO 100K")).toMatchObject({ imported: 2, skipped: 1, accountName: "FTMO 100K" });
    expect(summarizeMt5Outcome({ ok: false, message: "bridge unavailable" }, "FTMO 100K").status).toContain("failed");
  });
});
