import { describe, expect, it } from "vitest";
import { formatRr, isFuturePktTradeDate, pktDateInput, pktDateInputToTimestamp } from "./gold";

describe("Gold Journal PKT dates and realized R:R", () => {
  it("formats R:R from risk and realized P&L rather than the planned reward", () => {
    expect(formatRr(1, 97.6)).toBe("1 : 97.60");
    expect(formatRr(20, -10)).toBe("1 : -0.50");
  });

  it("keeps the current PKT trade date editable and rejects only later PKT dates", () => {
    const now = new Date("2026-08-14T00:30:00Z");
    expect(pktDateInput(now)).toBe("2026-08-14");
    expect(isFuturePktTradeDate("2026-08-14", now)).toBe(false);
    expect(isFuturePktTradeDate("2026-08-15", now)).toBe(true);
    expect(pktDateInputToTimestamp("2026-08-14")).toBe(new Date("2026-08-14T07:00:00Z").getTime());
  });
});
