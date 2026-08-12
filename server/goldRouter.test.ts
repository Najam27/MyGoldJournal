import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  ensureAccount: vi.fn(),
  getJournal: vi.fn(),
  getOwnedAccount: vi.fn(),
  ownsTrade: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./goldDb", () => ({
  ensureAccount: mocks.ensureAccount,
  getJournal: mocks.getJournal,
  getOwnedAccount: mocks.getOwnedAccount,
  ownsTrade: mocks.ownsTrade,
}));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

import { goldRouter } from "./goldRouter";

const user = { id: 7, openId: "journal-owner", role: "user" };
const validTrade = { accountId: 12, tradeDate: Date.now(), session: "London", direction: "BUY", result: "WIN", patienceScore: null, risk: null, reward: null, pnl: 0 };

describe("Gold Journal protected server workflows", () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
  });

  it("bootstraps an authenticated user through the account helper", async () => {
    mocks.ensureAccount.mockResolvedValue({ id: 12, name: "Primary Account" });
    const caller = goldRouter.createCaller({ user } as any);
    await expect(caller.journal.bootstrap()).resolves.toMatchObject({ id: 12, name: "Primary Account" });
    expect(mocks.ensureAccount).toHaveBeenCalledWith(7);
  });

  it("blocks anonymous account mutations before a database call", async () => {
    const caller = goldRouter.createCaller({ user: null } as any);
    await expect(caller.accounts.create({ name: "Restricted Account", startingBalance: 0 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("does not allow a non-owned account to be renamed", async () => {
    mocks.getOwnedAccount.mockRejectedValue(new Error("That trading account is unavailable."));
    const caller = goldRouter.createCaller({ user } as any);
    await expect(caller.accounts.rename({ accountId: 99, name: "Other trader account" })).rejects.toThrow("unavailable");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("blocks an anonymous trade mutation before ownership validation", async () => {
    const caller = goldRouter.createCaller({ user: null } as any);
    await expect(caller.trades.delete({ tradeId: 11 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.ownsTrade).not.toHaveBeenCalled();
  });

  it("rejects a non-owned trade update before writing data", async () => {
    mocks.ownsTrade.mockRejectedValue(new Error("That trade is unavailable."));
    const caller = goldRouter.createCaller({ user } as any);
    await expect(caller.trades.update({ ...validTrade, tradeId: 11 })).rejects.toThrow("unavailable");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
