// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: any) => <input {...props} /> }));
vi.mock("@/components/ui/dialog", () => ({ Dialog: ({ children }: any) => <>{children}</>, DialogContent: ({ children }: any) => <div>{children}</div>, DialogDescription: ({ children }: any) => <p>{children}</p>, DialogHeader: ({ children }: any) => <header>{children}</header>, DialogTitle: ({ children }: any) => <h2>{children}</h2> }));

import { TradeLogWithViewer } from "./TradeLogWithViewer";

afterEach(() => cleanup());

describe("TradeLogWithViewer", () => {
  it("opens a card with trading detail and screenshot evidence without exposing internal metadata", () => {
    const trade = { id: 8, userId: 21, accountId: 3, createdAt: new Date("2026-08-12T12:00:00Z"), updatedAt: new Date("2026-08-12T12:30:00Z"), tradeDate: new Date("2026-08-12T12:00:00Z"), session: "London", direction: "BUY", result: "WIN", level: "RBS/TJL1", timeframe: "15m", setupQuality: "A", confirmationType: "BOS", executionType: "Manual Direct", marketCondition: "Bullish", biasAlignment: "Aligned", slPlacement: "Below swing", tpPlacement: "Prior high", mistake: "None", holdQuality: "Good", patienceScore: 4, risk: "20", reward: "105", pnl: "100", emotionBefore: "Calm", emotionDuring: "Focused", emotionAfter: "Disciplined", notes: "Waited for confirmation", screenshotKey: "gold-journal/21/trades/8.png", screenshotName: "entry.png", screenshotUrl: "https://example.test/trade.png" };
    render(<TradeLogWithViewer stats={{ balance: 100, winRate: 100, wins: 1, losses: 0, pnl: 100, total: 1 }} trades={[trade]} allTrades={[trade]} pagination={{ page: 1, pageSize: 12, total: 1, pageCount: 1 }} listLoading={false} account={{ name: "Primary" }} dangerGoals={[]} search="" resultFilter="ALL" setSearch={vi.fn()} setResultFilter={vi.fn()} onPage={vi.fn()} onNew={vi.fn()} onDuplicate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onCash={vi.fn()} onCsv={vi.fn()} onExcel={vi.fn()} onPdf={vi.fn()} onClear={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/View trade from/i));
    expect(screen.getByText("Trade card")).toBeTruthy();
    expect(screen.getByText("Waited for confirmation")).toBeTruthy();
    expect(screen.getAllByText("Aligned").length).toBeGreaterThan(1);
    expect(screen.getByText("Below swing")).toBeTruthy();
    expect(screen.getByText("Good")).toBeTruthy();
    ["Journal entry ID", "Account ID", "Owner ID", "Screenshot file", "Screenshot key", "Saved", "Last updated", "gold-journal/21/trades/8.png", "entry.png"].forEach(value => expect(screen.queryByText(value)).toBeNull());
    expect(screen.getByAltText(/Trade screenshot/i)).toBeTruthy();
  });
});
