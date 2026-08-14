import { describe, expect, it } from "vitest";
import { isSupportedImageSignature, requiredSafeText } from "./inputValidation";

describe("server input validation", () => {
  it("rejects markup and control characters instead of silently storing them", () => {
    const schema = requiredSafeText(100);
    expect(schema.safeParse("<script>alert(1)</script>").success).toBe(false);
    expect(schema.safeParse("<b>trade note</b>").success).toBe(false);
    expect(schema.safeParse("unsafe\u0000content").success).toBe(false);
    expect(schema.safeParse("Clean trade note").success).toBe(true);
  });

  it("accepts only bytes matching the declared supported image type", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const webp = Buffer.from("RIFFxxxxWEBPVP8 ", "ascii");
    const script = Buffer.from("<script>alert(1)</script>", "utf8");
    expect(isSupportedImageSignature(png, "image/png")).toBe(true);
    expect(isSupportedImageSignature(jpeg, "image/jpeg")).toBe(true);
    expect(isSupportedImageSignature(webp, "image/webp")).toBe(true);
    expect(isSupportedImageSignature(script, "image/jpeg")).toBe(false);
    expect(isSupportedImageSignature(png, "image/webp")).toBe(false);
  });
});
