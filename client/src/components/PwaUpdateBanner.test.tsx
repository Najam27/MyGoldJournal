/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const serviceWorker = new EventTarget() as EventTarget & { getRegistration: ReturnType<typeof vi.fn> };
serviceWorker.getRegistration = vi.fn();
Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: serviceWorker });
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));

import { PwaUpdateBanner } from "./PwaUpdateBanner";

describe("PwaUpdateBanner", () => {
  afterEach(() => { serviceWorker.getRegistration.mockReset(); });

  it("asks the waiting worker to activate instead of reloading before takeover", async () => {
    const postMessage = vi.fn();
    serviceWorker.getRegistration.mockResolvedValue({ waiting: { postMessage } });
    render(<PwaUpdateBanner />);
    window.dispatchEvent(new Event("gold-journal-update-ready"));
    fireEvent.click(await screen.findByRole("button", { name: "Update now" }));
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" }));
  });
});
