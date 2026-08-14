import { describe, expect, it } from "vitest";
import { createExcelXml } from "./excelExport";

describe("Excel XML export", () => {
  it("escapes XML and neutralizes formula-looking journal text", () => {
    const xml = createExcelXml([{ Notes: "=HYPERLINK(\"https://bad.example\")", Level: "<script>" }]);
    expect(xml).toContain("&apos;=HYPERLINK(&quot;https://bad.example&quot;)");
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).not.toContain("<script>");
  });
});
