/** @vitest-environment jsdom */
import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

function Fixture() { const [value, setValue] = useState(""); const debounced = useDebouncedValue(value, 300); return <><input aria-label="search" value={value} onChange={event => setValue(event.target.value)} /><output>{debounced}</output></>; }

describe("useDebouncedValue", () => {
  afterEach(() => vi.useRealTimers());
  it("waits 300 ms before exposing a changed search value", async () => {
    vi.useFakeTimers();
    render(<Fixture />);
    fireEvent.change(screen.getByLabelText("search"), { target: { value: "London" } });
    expect(screen.getByRole("status").textContent).toBe("");
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole("status").textContent).toBe("London");
  });
});
