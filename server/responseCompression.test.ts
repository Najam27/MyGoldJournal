import { describe, expect, it } from "vitest";
import { canCompressResponsePath } from "./responseCompression";

describe("response compression routing", () => {
  it("allows API and text routes but excludes isolated uploaded-file redirects", () => {
    expect(canCompressResponsePath("/api/trpc/trades.list")).toBe(true);
    expect(canCompressResponsePath("/manus-storage/gold-journal/trade.jpg")).toBe(false);
  });
});
