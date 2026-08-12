import { describe, expect, it } from "vitest";
import { selectBulkPdfTrades, summarizeBulkPdfTrades } from "./bulkPdf";

describe("bulk PDF report selection", () => {
  const trades = [
    { id: 1, accountId: 3, tradeDate: new Date("2026-08-01T12:00:00Z"), pnl: "15", result: "WIN" },
    { id: 2, accountId: 3, tradeDate: new Date("2026-08-10T12:00:00Z"), pnl: "-5", result: "LOSS" },
    { id: 3, accountId: 9, tradeDate: new Date("2026-08-10T12:00:00Z"), pnl: "200", result: "WIN" },
  ];

  it("keeps the active account isolated while selecting an inclusive date range", () => {
    expect(selectBulkPdfTrades(trades, 3, "2026-08-02", "2026-08-10").map(trade => trade.id)).toEqual([2]);
  });

  it("summarizes the selected period independently of excluded account rows", () => {
    expect(summarizeBulkPdfTrades(selectBulkPdfTrades(trades, 3))).toMatchObject({ total: 2, pnl: 10, wins: 1, losses: 1, winRate: 50 });
  });
});
