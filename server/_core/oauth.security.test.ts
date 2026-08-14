import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ upsertUser: vi.fn() }));
vi.mock("./sdk", () => ({ sdk: { exchangeCodeForToken: vi.fn(), getUserInfo: vi.fn(), createSessionToken: vi.fn() } }));

import { registerOAuthRoutes } from "./oauth";

describe("managed OAuth callback errors", () => {
  it("does not reveal which callback value is missing", async () => {
    let handler: any;
    const app = { get: vi.fn((_path, next) => { handler = next; }) };
    registerOAuthRoutes(app as any);
    const status = vi.fn();
    const json = vi.fn();
    status.mockReturnValue({ json });
    await handler({ query: {}, headers: {} }, { status });
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "Authentication could not be completed." });
  });
});
