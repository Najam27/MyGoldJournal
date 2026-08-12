// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.classList.remove("dark"); });
  afterEach(() => cleanup());

  it("switches the document theme, persists the user selection, and retains semantic palette tokens", () => {
    const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    expect(styles).toMatch(/:root\s*\{[\s\S]*?--gj-shell:\s*#f6f8fb[\s\S]*?--gj-text:\s*#15202b/);
    expect(styles).toMatch(/\.dark\s*\{[\s\S]*?--gj-shell:\s*#10141a[\s\S]*?--gj-text:\s*#eef1f5/);

    render(<ThemeProvider defaultTheme="dark" switchable><ThemeToggle /></ThemeProvider>);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(screen.getByTitle("Switch to light theme"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
    fireEvent.click(screen.getByTitle("Switch to dark theme"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
