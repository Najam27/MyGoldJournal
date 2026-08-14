import { z } from "zod";

const MARKUP_PATTERN = /<\/?\s*[a-z!][^>]*>/i;
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Validates human-entered text at the API boundary. We deliberately reject
 * markup instead of silently modifying it: callers receive a generic invalid
 * submission error and rendered clients continue to sanitize display content.
 */
export const safeText = (max: number, required = false) => {
  const base = z.string().trim().max(max);
  const sized = required ? base.min(1) : base;
  return sized.superRefine((value, ctx) => {
    if (MARKUP_PATTERN.test(value) || CONTROL_PATTERN.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid text content." });
    }
  });
};

export const optionalSafeText = (max = 5_000) => safeText(max).optional().default("");

export const requiredSafeText = (max: number) => safeText(max, true);

export function isSupportedImageSignature(bytes: Buffer, mimeType: "image/jpeg" | "image/png" | "image/webp") {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}
