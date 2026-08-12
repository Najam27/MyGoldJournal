// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MonthlyTradeOverview } from "./MonthlyTradeOverview";

afterEach(() => cleanup());

describe("MonthlyTradeOverview", () => {
  it("searches recorded months and updates the selected monthly overview", async () => {
    render(<MonthlyTradeOverview trades={[{ tradeDate: "2026-08-12T12:00:00.000Z", result: "WIN", pnl: "100", risk: "20", reward: "100" }, { tradeDate: "2026-07-12T12:00:00.000Z", result: "LOSS", pnl: "-20", risk: "20", reward: "40" }]} />);
    fireEvent.change(screen.getByLabelText("Search overview month"), { target: { value: "July" } });
    await waitFor(() => expect((screen.getByLabelText("Overview month") as HTMLSelectElement).value).toBe("2026-07"));
    expect(screen.getByText("July 2026 overview")).toBeTruthy();
  });
});
