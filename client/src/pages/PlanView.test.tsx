// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@/lib/trpc", () => ({ trpc: { plans: { save: { useMutation: () => ({ mutateAsync: mocks.save, isPending: false }) } } } }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: any) => <input {...props} /> }));
vi.mock("@/components/ui/textarea", () => ({ Textarea: (props: any) => <textarea {...props} /> }));

import { PlanExecutionEditor } from "@/components/PlanExecutionEditor";

describe("PlanExecutionEditor", () => {
  beforeEach(() => { mocks.save.mockReset(); mocks.save.mockResolvedValue({ success: true }); });
  afterEach(() => cleanup());

  it("loads a saved daily entry and writes its complete execution review on update", async () => {
    const today = new Date();
    const saved = { id: 7, planDate: today, preBias: "Bullish", keyLevels: "London high", sessionFocus: ["London"], planNotes: "Wait for sweep", rulesPlanned: [{ id: "0", text: "Maximum 3 trades today. Stop after 3.", checked: true }], emotionStart: "Calm|Focused", emotionEnd: "Disciplined", executionScore: 4, rulesFollowed: [{ id: "0", yes: true }], whatWentWell: "Patience", whatWentWrong: "Late entry", lessons: "Wait for close", overallRating: 4 };
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<PlanExecutionEditor account={{ id: 3 }} plans={[saved]} onSaved={onSaved} />);
    expect(screen.getByText("SAVED ENTRY")).toBeTruthy();
    expect(screen.getByDisplayValue("London high")).toBeTruthy();
    expect(screen.getByDisplayValue("Patience")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Update entry" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ accountId: 3, preBias: "Bullish", keyLevels: "London high", executionScore: 4, overallRating: 4, whatWentWell: "Patience", lessons: "Wait for close" })));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("keeps the entry visible and reports a save failure for retry", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Cloud connection interrupted"));
    render(<PlanExecutionEditor account={{ id: 3 }} plans={[]} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Write your game plan before the session begins…"), { target: { value: "Wait for confirmation" } });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Cloud connection interrupted"));
    expect(screen.getByDisplayValue("Wait for confirmation")).toBeTruthy();
  });
});
