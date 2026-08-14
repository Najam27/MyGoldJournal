import { describe, expect, it, vi } from "vitest";
import { fetchWithDeadline } from "./storage";

describe("storage request deadline", () => {
  it("aborts a stalled storage request with a bounded generic error", async () => {
    const stalled = vi.fn((_url: string | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    await expect(fetchWithDeadline("https://storage.example", {}, 5, stalled as typeof fetch)).rejects.toThrow("Storage request timed out.");
  });
});
