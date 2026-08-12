// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { loadMt5Profile, loadMt5Settings, saveMt5Profile, saveMt5Settings } from "./mt5Storage";

describe("MT5 workflow persistence", () => {
  beforeEach(() => localStorage.clear());

  it("persists and reloads the bridge URL and selected history window", () => {
    saveMt5Settings({ url: " http://localhost:7842 ", days: 30 });
    expect(loadMt5Settings()).toEqual({ url: "http://localhost:7842", days: 30 });
  });

  it("persists the selected account target used by a later MT5 import", () => {
    saveMt5Profile({ accountId: 24, accountName: "MT5 Funded", url: "http://localhost:7842", days: 31 });
    expect(loadMt5Profile()).toEqual({ accountId: 24, accountName: "MT5 Funded", url: "http://localhost:7842", days: 31 });
  });
});
