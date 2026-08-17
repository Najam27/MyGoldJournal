import { describe, expect, it } from "vitest";

describe("Supabase environment", () => {
  it("accepts a lightweight anonymous settings request", async () => {
    const projectUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    expect(projectUrl, "VITE_SUPABASE_URL must be configured").toMatch(/^https:\/\/.+/);
    expect(anonKey, "VITE_SUPABASE_ANON_KEY must be configured").toBeTruthy();

    const response = await fetch(`${projectUrl!.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: anonKey! },
    });

    expect(response.ok, `Supabase settings request returned ${response.status}`).toBe(true);
  });
});
