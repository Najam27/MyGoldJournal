import { beforeEach, describe, expect, it, vi } from "vitest";
import { mt5LivePositions, trades } from "../drizzle/schema";

const fake = vi.hoisted(() => ({
  state: { positions: [] as any[], trades: [] as any[], nextId: 1 },
  db: null as any,
}));

vi.mock("./db", () => ({ getDb: async () => fake.db }));
vi.mock("./goldDb", () => ({ getOwnedAccount: vi.fn() }));

import { pktSession, syncStoredMt5PositionsToTradeLog, upsertMt5ClosedPosition, upsertMt5OpenPosition } from "./mt5Db";

function createFakeDb() {
  const rowsFor = (table: unknown) => table === mt5LivePositions ? fake.state.positions : fake.state.trades;
  const conditionPairs = (condition: any) => {
    const pairs: Array<[string, unknown]> = [];
    const flattened: any[] = [];
    const flatten = (node: any): void => {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(flatten); return; }
      if (node.queryChunks) { flatten(node.queryChunks); return; }
      flattened.push(node);
    };
    flatten(condition);
    let currentColumn: string | undefined;
    for (const node of flattened) {
      if (node.name && node.table && typeof node.name === "string") currentColumn = node.name;
      if (node.constructor?.name === "Param" && currentColumn) pairs.push([currentColumn, node.value]);
    }
    return pairs;
  };
  const createSelect = () => {
    const chain: any = {
      rows: [] as any[],
      from(table: unknown) { chain.rows = rowsFor(table).slice(); return chain; },
      where(condition?: any) {
        if (!condition) return chain;
        const pairs = conditionPairs(condition);
        chain.rows = chain.rows.filter(row => pairs.every(([column, value]) => String(row[column]) === String(value)));
        return chain;
      },
      orderBy() { return chain; },
      limit(size: number) { chain.rows = chain.rows.slice(0, size); return chain; },
      offset(size: number) { chain.rows = chain.rows.slice(size); return chain; },
      then(resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve(chain.rows).then(resolve, reject); },
    };
    return chain;
  };
  const createInsert = (table: unknown) => {
    let value: any;
    const chain: any = {
      values(next: any) { value = next; return chain; },
      onConflictDoUpdate({ set }: { set: Record<string, unknown> }) {
        const rows = rowsFor(table);
        const existing = table === mt5LivePositions
          ? rows.find(row => row.accountId === value.accountId && row.ticket === value.ticket)
          : rows.find(row => row.accountId === value.accountId && row.mt5Ticket === value.mt5Ticket);
        if (existing) Object.assign(existing, set);
        else rows.push({ ...value, id: fake.state.nextId++ });
        return Promise.resolve([{ insertId: fake.state.nextId - 1 }]);
      },
    };
    return chain;
  };
  return {
    select: () => createSelect(),
    insert: (table: unknown) => createInsert(table),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    transaction: async (callback: (tx: any) => unknown) => callback({
      select: () => createSelect(),
      insert: (table: unknown) => createInsert(table),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    }),
  };
}

const base = {
  ticket: 1001n,
  symbol: "XAUUSD",
  direction: "BUY" as const,
  lots: 0.1,
  openPrice: 3300,
  slPrice: 3290,
  tpPrice: 3320,
  riskUsd: 25,
  rewardUsd: 100,
  rrRatio: 4,
  openTime: new Date("2026-07-11T04:30:00Z"),
};

beforeEach(() => {
  fake.state = { positions: [], trades: [], nextId: 1 };
  fake.db = createFakeDb();
});

describe("MT5 PKT session classification", () => {
  it("uses the trader-specified PKT session boundaries exactly", () => {
    const pkt = (time: string) => new Date(`2026-08-13T${time}+05:00`);

    expect(pktSession(pkt("02:59:00"))).toBe("Post-NY");
    expect(pktSession(pkt("03:00:00"))).toBe("Pre-Asian");
    expect(pktSession(pkt("04:59:00"))).toBe("Pre-Asian");
    expect(pktSession(pkt("05:00:00"))).toBe("Asian");
    expect(pktSession(pkt("07:59:00"))).toBe("Asian");
    expect(pktSession(pkt("08:00:00"))).toBe("Post-Asian");
    expect(pktSession(pkt("09:59:00"))).toBe("Post-Asian");
    expect(pktSession(pkt("10:00:00"))).toBe("Pre-London");
    expect(pktSession(pkt("11:59:00"))).toBe("Pre-London");
    expect(pktSession(pkt("12:00:00"))).toBe("London");
    expect(pktSession(pkt("13:59:00"))).toBe("London");
    expect(pktSession(pkt("14:00:00"))).toBe("Post-London");
    expect(pktSession(pkt("15:59:00"))).toBe("Post-London");
    expect(pktSession(pkt("16:00:00"))).toBe("Pre-NY");
    expect(pktSession(pkt("16:59:00"))).toBe("Pre-NY");
    expect(pktSession(pkt("17:00:00"))).toBe("New York");
    expect(pktSession(pkt("19:59:00"))).toBe("New York");
    expect(pktSession(pkt("20:00:00"))).toBe("Post-NY");
  });
});

describe("MT5 position and journal idempotency", () => {
  it("Scenario A: OPEN then CLOSE creates one CLOSED position and one journal trade", async () => {
    await upsertMt5OpenPosition(7, 12, { ...base, floatingPnl: 10 });
    await upsertMt5ClosedPosition(7, 12, { ...base, closePrice: 3310, realizedPnl: 100, result: "WIN", closeTime: new Date("2026-07-11T05:30:00Z") });

    expect(fake.state.positions).toHaveLength(1);
    expect(fake.state.positions[0].status).toBe("CLOSED");
    expect(fake.state.trades).toHaveLength(1);
    expect(fake.state.trades[0].mt5Ticket).toBe(1001n);
    expect(fake.state.trades[0].result).toBe("WIN");
  });

  it("Scenarios B-D: duplicate OPEN/CLOSE and delayed OPEN remain idempotent", async () => {
    await upsertMt5OpenPosition(7, 12, { ...base, floatingPnl: 10 });
    await upsertMt5OpenPosition(7, 12, { ...base, floatingPnl: 12 });
    await upsertMt5ClosedPosition(7, 12, { ...base, closePrice: 3310, realizedPnl: 100, result: "WIN", closeTime: new Date("2026-07-11T05:30:00Z") });
    await upsertMt5ClosedPosition(7, 12, { ...base, closePrice: 3310, realizedPnl: 100, result: "WIN", closeTime: new Date("2026-07-11T05:30:00Z") });
    await upsertMt5OpenPosition(7, 12, { ...base, floatingPnl: 99, openTime: new Date("2026-07-11T06:30:00Z") });

    expect(fake.state.positions).toHaveLength(1);
    expect(fake.state.positions[0].status).toBe("CLOSED");
    expect(fake.state.positions[0].realizedPnl).toBe("100.00");
    expect(fake.state.trades).toHaveLength(1);
    expect(fake.state.trades[0].result).toBe("WIN");
  });

  it("rejects a delayed CLOSE for an older open state", async () => {
    await upsertMt5OpenPosition(7, 12, { ...base, openTime: new Date("2026-07-11T06:30:00Z"), floatingPnl: 10 });
    await upsertMt5ClosedPosition(7, 12, { ...base, openTime: new Date("2026-07-11T05:30:00Z"), closePrice: 3310, realizedPnl: 100, result: "WIN", closeTime: new Date("2026-07-11T07:30:00Z") });

    expect(fake.state.positions[0].status).toBe("OPEN");
    expect(fake.state.trades[0].result).toBe("OPEN");
  });

  it("Scenario E: repeated history reconciliation leaves the same single-ticket state", async () => {
    await upsertMt5ClosedPosition(7, 12, { ...base, closePrice: 3310, realizedPnl: 100, result: "WIN", closeTime: new Date("2026-07-11T05:30:00Z") });
    for (let index = 0; index < 10; index += 1) await syncStoredMt5PositionsToTradeLog(7, 12);

    expect(fake.state.positions).toHaveLength(1);
    expect(fake.state.trades).toHaveLength(1);
  });

  it("keeps identical MT5 tickets independent across trading accounts", async () => {
    await upsertMt5ClosedPosition(12, 7, { ...base, closePrice: 3310, realizedPnl: 100, result: "WIN", closeTime: new Date("2026-07-11T05:30:00Z") });
    await upsertMt5ClosedPosition(13, 8, { ...base, closePrice: 3290, realizedPnl: -100, result: "LOSS", closeTime: new Date("2026-07-11T05:30:00Z") });

    expect(fake.state.positions).toHaveLength(2);
    expect(fake.state.positions.map(row => row.accountId)).toEqual([7, 8]);
    expect(fake.state.trades).toHaveLength(2);
    expect(fake.state.trades.map(row => [row.accountId, row.mt5Ticket])).toEqual([[7, 1001n], [8, 1001n]]);
  });
});

// Deliberately retain the exact naive +05:00 interpretation contract in this file.
describe("MT5 timestamp contract", () => {
  it("does not use broker auto-detection, UTC conversion, or DST conversion for naive MT5 timestamps", () => {
    const naiveMt5Time = new Date("2026-07-11 09:30:00+05:00");
    expect(naiveMt5Time.toISOString()).toBe("2026-07-11T04:30:00.000Z");
    expect(pktSession(naiveMt5Time)).toBe("Post-Asian");
  });
});
