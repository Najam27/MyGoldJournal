/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { MentorRequestError, requestMentorAnalysis, resetMentorCircuitForTest } from "./openRouterCircuit";

describe("AI Mentor circuit breaker", () => {
  afterEach(() => resetMentorCircuitForTest());

  it("opens after two upstream failures and fast-fails the third request", async () => {
    const failedFetch = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(requestMentorAnalysis("local-key", {}, failedFetch)).rejects.toBeInstanceOf(MentorRequestError);
    await expect(requestMentorAnalysis("local-key", {}, failedFetch)).rejects.toBeInstanceOf(MentorRequestError);
    await expect(requestMentorAnalysis("local-key", {}, failedFetch)).rejects.toMatchObject({ reason: "circuit_open" });
    expect(failedFetch).toHaveBeenCalledTimes(2);
  });

  it("clears prior failures after a successful request", async () => {
    const failedFetch = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(requestMentorAnalysis("local-key", {}, failedFetch)).rejects.toBeInstanceOf(MentorRequestError);
    const okFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
    await expect(requestMentorAnalysis("local-key", {}, okFetch)).resolves.toEqual({ choices: [] });
    const nextFailure = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(requestMentorAnalysis("local-key", {}, nextFailure)).rejects.toMatchObject({ reason: "unavailable" });
    expect(nextFailure).toHaveBeenCalledTimes(1);
  });
});
