// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { oauthStatusQuery } = vi.hoisted(() => ({ oauthStatusQuery: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      oauthStatus: { useQuery: oauthStatusQuery },
    },
  },
}));

vi.mock("@/const", () => ({ startLogin: vi.fn() }));

import { LoginScreen } from "./GoldJournal";

describe("Gold Journal login availability", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("surfaces an OAuth outage as a recoverable sign-in state", () => {
    const refetch = vi.fn();
    oauthStatusQuery.mockReturnValue({ data: { available: false }, isError: false, isLoading: false, isFetching: false, refetch });

    render(<LoginScreen />);

    expect(screen.getByRole("alert").textContent).toContain("Secure sign-in is temporarily unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Recheck sign-in service" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
