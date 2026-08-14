/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setData: vi.fn(), getData: vi.fn(() => [{ id: 7, category: "Level", value: "SBR/TJL1", active: true }]), invalidate: vi.fn(), setActive: vi.fn().mockResolvedValue({ success: true }), add: vi.fn().mockResolvedValue({ id: 8 }) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    optionLists: {
      list: { useQuery: () => ({ data: [{ id: 7, category: "Level", value: "SBR/TJL1", active: true }] }) },
      add: { useMutation: () => ({ mutateAsync: mocks.add, isPending: false }) },
      setActive: { useMutation: () => ({ mutateAsync: mocks.setActive, isPending: false }) },
    },
    useUtils: () => ({ optionLists: { list: { getData: mocks.getData, setData: mocks.setData, invalidate: mocks.invalidate } } }),
  },
}));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: any) => <input {...props} /> }));
vi.mock("@/components/ui/dialog", () => ({ Dialog: ({ children }: any) => <>{children}</>, DialogContent: ({ children }: any) => <div>{children}</div>, DialogDescription: ({ children }: any) => <p>{children}</p>, DialogHeader: ({ children }: any) => <header>{children}</header>, DialogTitle: ({ children }: any) => <h2>{children}</h2> }));

import { OptionListManager } from "./OptionListManager";

describe("OptionListManager optimistic updates", () => {
  it("updates the cached option state immediately and refetches after confirmation", async () => {
    render(<OptionListManager />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(mocks.setData).toHaveBeenCalled();
    await waitFor(() => expect(mocks.setActive).toHaveBeenCalledWith({ optionId: 7, active: false }));
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
  });
});
