import { describe, expect, it } from "vitest";
import { MT5_BRIDGE_FILENAME, MT5_BRIDGE_PYTHON } from "./mt5BridgeInstaller";

describe("Gold Journal MT5 bridge installer", () => {
  it("provides a Windows MT5 connector with local status, sync, CORS, and deal serialization support", () => {
    expect(MT5_BRIDGE_FILENAME).toBe("gold_journal_mt5_bridge.py");
    expect(MT5_BRIDGE_PYTHON).toContain("import MetaTrader5 as mt5");
    expect(MT5_BRIDGE_PYTHON).toContain('"/status"');
    expect(MT5_BRIDGE_PYTHON).toContain('"/sync"');
    expect(MT5_BRIDGE_PYTHON).toContain('"Access-Control-Allow-Origin", "*"');
    expect(MT5_BRIDGE_PYTHON).toContain('"ticket": str(deal.ticket)');
  });
});
