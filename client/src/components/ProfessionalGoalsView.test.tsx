// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));

import { ProfessionalGoalsView } from "./ProfessionalGoalsView";

afterEach(() => cleanup());

describe("ProfessionalGoalsView", () => {
  it("surfaces an actual breached loss limit and separates professional goal categories", () => {
    render(<ProfessionalGoalsView goals={[{ id: 1, name: "Max Daily Loss", description: "Protect downside", period: "DAILY", metric: "daily_loss", comparison: "LTE", target: "100", active: true }, { id: 2, name: "Monthly target", description: "Build toward target", period: "MONTHLY", metric: "net_pnl", comparison: "GTE", target: "500", active: true }]} trades={[{ tradeDate: "2026-08-12T12:00:00Z", result: "LOSS", pnl: "-150" }]} plans={[]} onAdd={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/risk guardrail.*breached/i)).toBeTruthy();
    expect(screen.getByText("Capital protection")).toBeTruthy();
    expect(screen.getByText("Measured edge")).toBeTruthy();
    expect(screen.getByText("BREACHED")).toBeTruthy();
  });
});
