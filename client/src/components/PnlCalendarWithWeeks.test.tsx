// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));

import { PnlCalendarWithWeeks } from "./PnlCalendarWithWeeks";

afterEach(() => cleanup());

describe("PnlCalendarWithWeeks", () => {
  it("renders a weekly P&L total after the calendar days", () => {
    render(<PnlCalendarWithWeeks trades={[{ tradeDate: new Date("2026-08-03T12:00:00"), pnl: "100" }, { tradeDate: new Date("2026-08-06T12:00:00"), pnl: "-20" }]} />);
    expect(screen.getAllByText(/Week ending/).length).toBeGreaterThan(0);
    expect(screen.getByText("$80.00")).toBeTruthy();
  });
});
