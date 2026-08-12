// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ add: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { optionLists: { list: { useQuery: () => ({ data: [{ id: 1, category: "Level", value: "Saved level", active: true }] }) }, add: { useMutation: () => ({ mutateAsync: mocks.add, isPending: false }) } }, useUtils: () => ({ optionLists: { list: { invalidate: mocks.invalidate } } }) } }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: any) => <input {...props} /> }));
vi.mock("@/components/ui/textarea", () => ({ Textarea: (props: any) => <textarea {...props} /> }));
vi.mock("@/components/ui/dialog", () => ({ Dialog: ({ children }: any) => <>{children}</>, DialogContent: ({ children }: any) => <div>{children}</div>, DialogDescription: ({ children }: any) => <p>{children}</p>, DialogHeader: ({ children }: any) => <header>{children}</header>, DialogTitle: ({ children }: any) => <h2>{children}</h2> }));

import { TradeDialogWithCustomOptions } from "./TradeDialogWithCustomOptions";

describe("TradeDialogWithCustomOptions", () => {
  beforeEach(() => { mocks.add.mockReset(); mocks.invalidate.mockReset(); mocks.add.mockResolvedValue({ success: true }); });
  afterEach(() => cleanup());

  it("saves a custom configurable field value and selects it for the open trade", async () => {
    const form = { tradeDate: "2026-08-12", session: "London", direction: "BUY", result: "WIN", level: "", timeframe: "15m", setupQuality: "A", executionType: "Manual Direct", marketCondition: "", confirmationType: "", patienceScore: "3", risk: "", reward: "", pnl: "", notes: "", emotionBefore: "", emotionDuring: "", emotionAfter: "" };
    const setForm = vi.fn();
    const props = { open: true, setOpen: vi.fn(), setForm, editing: undefined, onSave: vi.fn(), pending: false, screenshot: undefined, setScreenshot: vi.fn(), progress: 0 };
    const { rerender } = render(<TradeDialogWithCustomOptions {...props} form={form} />);
    expect(screen.getByText("Direction vs bias")).toBeTruthy();
    expect(screen.getByText("SL placement")).toBeTruthy();
    expect(screen.getByText("TP placement")).toBeTruthy();
    expect(screen.getByText("Mistake")).toBeTruthy();
    expect(screen.getByText("Hold quality")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Saved level" })).toBeTruthy();
    ["FOMO", "Revenge", "Overtrading", "Oversize"].forEach(tag => expect(screen.getByRole("button", { name: tag })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "FOMO" }));
    expect(setForm).toHaveBeenCalledWith(expect.objectContaining({ mistake: "FOMO" }));
    rerender(<TradeDialogWithCustomOptions {...props} form={{ ...form, mistake: "FOMO" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Revenge" }));
    expect(setForm).toHaveBeenCalledWith(expect.objectContaining({ mistake: "FOMO | Revenge" }));
    fireEvent.change(screen.getByLabelText("Add custom behavior tag"), { target: { value: "Ignored news" } });
    fireEvent.click(screen.getByLabelText("Save custom behavior tag"));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith({ category: "Mistake", value: "Ignored news" }));
    expect(setForm).toHaveBeenCalledWith(expect.objectContaining({ mistake: "FOMO | Ignored news" }));
    fireEvent.change(screen.getByLabelText("Add custom Level"), { target: { value: "Custom zone" } });
    fireEvent.click(screen.getByLabelText("Save custom Level"));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith({ category: "Level", value: "Custom zone" }));
    await waitFor(() => expect(setForm).toHaveBeenCalledWith(expect.objectContaining({ level: "Custom zone" })));
  });
});
