/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlexibleGoalsView } from "./FlexibleGoalsView";

const handlers = { onCreate: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onClear: vi.fn() };
const baseProps = { account: { id: 1 }, trades: [], plans: [], pending: false, ...handlers };

describe("FlexibleGoalsView", () => {
  beforeEach(() => {
    Object.values(handlers).forEach(handler => handler.mockReset());
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("starts with a blank configurable goal book instead of seeded targets", () => {
    render(<FlexibleGoalsView {...baseProps} goals={[]} />);
    expect(screen.getByText("Your goal book is intentionally blank.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create first goal" }));
    expect(screen.getByText("Build a rule for this account")).toBeTruthy();
    expect(screen.getByText("Notify when status changes")).toBeTruthy();
  });

  it("saves a custom goal with the selected period, metric, target, and notification preference", async () => {
    render(<FlexibleGoalsView {...baseProps} goals={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "New goal" }));
    fireEvent.change(screen.getByLabelText("Goal name"), { target: { value: "London execution review" } });
    fireEvent.change(screen.getByLabelText("Review cadence"), { target: { value: "WEEKLY" } });
    fireEvent.change(screen.getByLabelText("Metric"), { target: { value: "weekly_reviews" } });
    fireEvent.change(screen.getByLabelText("Target"), { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText("Notify when status changes"));
    fireEvent.click(screen.getByRole("button", { name: "Create goal" }));
    await waitFor(() => expect(handlers.onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "London execution review", period: "WEEKLY", metric: "weekly_reviews", target: 2, notify: false, active: true })));
  });

  it("presents real-data period counts and supports pause, alert, delete, and clear controls", async () => {
    render(<FlexibleGoalsView {...baseProps} goals={[
      { id: 9, name: "Loss ceiling", description: "Stop when the limit is reached.", period: "DAILY", metric: "daily_loss", comparison: "LTE", target: 150, notify: true, active: true },
      { id: 10, name: "Weekly review", description: "Review execution.", period: "WEEKLY", metric: "weekly_reviews", comparison: "GTE", target: 1, notify: false, active: true },
      { id: 11, name: "Monthly target", description: "Trade the process.", period: "MONTHLY", metric: "net_pnl", comparison: "GTE", target: 500, notify: true, active: true },
    ]} trades={[{ tradeDate: new Date(), result: "LOSS", pnl: -50 }]} plans={[{ planDate: new Date(), overallRating: 4 }]} />);
    expect(screen.getByText("Loss ceiling")).toBeTruthy();
    expect(screen.getAllByText("rules configured")).toHaveLength(3);
    expect(document.querySelector(".flex-goal-card.safe")).toBeTruthy();
    expect(screen.getAllByTitle("Edit goal")).toHaveLength(3);
    fireEvent.click(screen.getAllByTitle("Pause goal")[0]);
    fireEvent.click(screen.getAllByTitle("Disable notifications")[0]);
    fireEvent.click(screen.getAllByTitle("Delete goal")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Clear goals" }));
    await waitFor(() => {
      expect(handlers.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 9, active: false }));
      expect(handlers.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 9, notify: false }));
      expect(handlers.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
      expect(handlers.onClear).toHaveBeenCalledTimes(1);
    });
  });
});
