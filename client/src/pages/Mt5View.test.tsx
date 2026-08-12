// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveMt5Profile, saveMt5Settings } from "@/lib/mt5Storage";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  refetch: vi.fn(),
  fetch: vi.fn(),
}));

vi.stubGlobal("fetch", mocks.fetch);
vi.mock("@/lib/trpc", () => ({
  trpc: {
    journal: { get: { useQuery: () => ({ data: { accounts: [{ id: 12, name: "MT5 Funded" }, { id: 24, name: "Personal MT5" }] }, refetch: mocks.refetch }) } },
    accounts: { create: { useMutation: () => ({ mutateAsync: mocks.create, isPending: false }) } },
  },
}));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: any) => <input {...props} /> }));

import { Mt5View } from "./GoldJournal";

describe("MT5 view integration", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    localStorage.clear();
    mocks.fetch.mockReset();
    saveMt5Settings({ url: "http://127.0.0.1:7900", days: 14 });
    saveMt5Profile({ accountId: 12, accountName: "MT5 Funded", url: "http://127.0.0.1:7900", days: 14 });
  });

  it("loads the persisted bridge settings and target account into the page", () => {
    render(<Mt5View />);
    expect(screen.getByDisplayValue("http://127.0.0.1:7900")).toBeTruthy();
    expect(screen.getByDisplayValue("14")).toBeTruthy();
    expect(screen.getByDisplayValue("MT5 Funded")).toBeTruthy();
    expect(screen.getByText(/Selected: MT5 Funded/)).toBeTruthy();
  });

  it("uses the newly selected account and renders bridge failure guidance", async () => {
    mocks.fetch.mockResolvedValue({ ok: false });
    render(<Mt5View />);
    const accountSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(accountSelect, { target: { value: "24" } });
    expect(screen.getByText(/Selected: Personal MT5/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Import Trades from MT5/i }));
    await waitFor(() => expect(screen.getByText(/Bridge offline or unavailable/)).toBeTruthy());
    expect(JSON.parse(localStorage.getItem("gj_mt5_import_profile") || "{}").accountId).toBe(24);
  });

  it("renders successful bridge import feedback with the target account and result counts", async () => {
    mocks.fetch
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, imported: 2, skipped: 1 }) });
    render(<Mt5View />);
    fireEvent.click(screen.getByRole("button", { name: /Import Trades from MT5/i }));
    await waitFor(() => expect(screen.getByText(/Bridge connected — 2 new trades imported/)).toBeTruthy());
    expect(screen.getByText(/2 trades added to MT5 Funded/)).toBeTruthy();
    expect(screen.getByText(/1 existing record was skipped/)).toBeTruthy();
  });
});
