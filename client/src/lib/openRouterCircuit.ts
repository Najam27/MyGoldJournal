const TIMEOUT_MS = 30_000;
const FAILURE_THRESHOLD = 2;
const COOLDOWN_MS = 60_000;

let consecutiveFailures = 0;
let openUntil = 0;

export class MentorRequestError extends Error {
  constructor(public readonly reason: "timeout" | "unavailable" | "circuit_open") {
    super(reason === "timeout" ? "AI Mentor timed out after 30 seconds." : reason === "circuit_open" ? "AI Mentor is temporarily cooling down after repeated failures." : "AI Mentor is currently unavailable.");
  }
}

export async function requestMentorAnalysis(key: string, payload: unknown, fetchImpl: typeof fetch = fetch) {
  if (Date.now() < openUntil) throw new MentorRequestError("circuit_open");
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new MentorRequestError("unavailable");
    const result = await response.json();
    consecutiveFailures = 0;
    openUntil = 0;
    return result;
  } catch (error) {
    const reason = controller.signal.aborted ? "timeout" : error instanceof MentorRequestError ? error.reason : "unavailable";
    consecutiveFailures += 1;
    if (consecutiveFailures >= FAILURE_THRESHOLD) openUntil = Date.now() + COOLDOWN_MS;
    throw new MentorRequestError(reason);
  } finally {
    window.clearTimeout(timer);
  }
}

export function resetMentorCircuitForTest() {
  consecutiveFailures = 0;
  openUntil = 0;
}
