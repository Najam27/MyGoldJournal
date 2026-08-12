import { describe, expect, it } from "vitest";
import { assessTraderGoal } from "./traderGoals";

const now = new Date("2026-08-12T12:00:00Z");
const rows = [{ id: 1, tradeDate: "2026-08-12T08:00:00Z", result: "LOSS", pnl: "-120", risk: "60", reward: "120", patienceScore: 2, setupQuality: "B", mistake: "Revenge trade" }, { id: 2, tradeDate: "2026-08-12T10:00:00Z", result: "LOSS", pnl: "-60", risk: "60", reward: "120", patienceScore: 3, setupQuality: "A" }];
describe("professional trader goal assessment", () => {
  it("uses PKT-period net loss and escalates an over-limit guardrail to breached", () => { const value = assessTraderGoal({ id: 1, name: "Loss", period: "DAILY", metric: "daily_loss", comparison: "LTE", target: "150", active: true }, rows, [], now); expect(value).toMatchObject({ value: 180, status: "BREACHED", rows: 2 }); });
  it("derives consecutive losses and revenge-tag count from actual saved execution data", () => { expect(assessTraderGoal({ id: 2, name: "Streak", period: "DAILY", metric: "consecutive_losses", comparison: "LTE", target: "2", active: true }, rows, [], now).value).toBe(2); expect(assessTraderGoal({ id: 3, name: "Revenge", period: "DAILY", metric: "revenge_trades", comparison: "LTE", target: "0", active: true }, rows, [], now).status).toBe("BREACHED"); });
  it("marks active performance targets as in progress instead of falsely pending", () => { expect(assessTraderGoal({ id: 4, name: "Profit", period: "MONTHLY", metric: "net_pnl", comparison: "GTE", target: "500", active: true }, rows, [], now).status).toBe("IN_PROGRESS"); });
  it("excludes open positions from goal progress, risk guardrails, and activity", () => {
    const openOnly = [{ id: 8, tradeDate: "2026-08-12T10:00:00Z", result: "OPEN", pnl: "-500", risk: "100", reward: "300", patienceScore: 1, setupQuality: "A", mistake: "Revenge trade" }];
    expect(assessTraderGoal({ id: 8, name: "Loss cap", period: "DAILY", metric: "daily_loss", comparison: "LTE", target: "100", active: true }, openOnly, [], now)).toMatchObject({ value: 0, rows: 0, hasActivity: false, status: "PENDING" });
  });
});
