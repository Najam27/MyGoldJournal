# MT5 Production Audit Report

## Scope and timezone invariant

This audit covered the complete MT5 path from the EA through `/api/mt5`, authentication, rate limiting, Zod validation, `mt5Ingest`, `mt5Db`, live positions, trade journal synchronization, and dashboard/history responses.

The existing MT5 timestamp contract was preserved exactly. Naive MT5 timestamps still receive the existing `+05:00` interpretation. Explicit offsets remain respected. No broker timezone auto-detection, UTC normalization policy change, or DST conversion was introduced. The existing `Asia/Karachi` session classifier and PKT boundaries remain unchanged.

## Bugs found and fixed

| Area | Finding | Fix |
|---|---|---|
| Account isolation | `getMt5Workspace(userId, accountId)` loaded all of the user’s MT5 connections, so a workspace for one account could include connection metadata for another account owned by the same user. | Workspace connection query is now constrained by both `userId` and the requested `accountId`. |
| Position atomicity | MT5 live-position writes and journal synchronization were separate database operations. A failure between them could leave a live position and journal trade out of sync. | OPEN and CLOSE upserts now run position state and journal synchronization inside one transaction when available, with the existing lightweight test fallback retained. |
| Delayed CLOSE ordering | A CLOSE for an older open state could overwrite a newer OPEN state for the same account/ticket. | CLOSE events targeting an older `openTime` than the current OPEN state are ignored. Existing CLOSED-state close-time ordering protection remains. |
| Invalid numeric payloads | Zero/negative lots and non-positive open/close prices were accepted by the ingest schema. | Lots, open prices, and close prices must now be strictly positive; financial P&L values remain signed where appropriate. |
| Invalid chronology | A CLOSE could contain a `close_time` earlier than its `open_time`. | Live CLOSE and history-batch positions now reject inverted chronology. |

No defect was found in the existing account-and-ticket uniqueness model for live positions or MT5 journal trades. `mt5LivePositions` is unique on `(accountId, ticket)`, and `trades` is unique on `(accountId, mt5Ticket)`. Manual trade creation only accepts an MT5 ticket when it resolves to an unjournaled CLOSED position in the same owned account.

## Scenario results

| Scenario | Result |
|---|---|
| A. OPEN 1001 then CLOSE 1001 | One CLOSED position and one journal trade. |
| B. Duplicate OPEN 1001 | One live position only. |
| C. OPEN → CLOSE → delayed OPEN | Position remains CLOSED. |
| D. Duplicate CLOSE 1001 | One CLOSED position and one journal trade. |
| E. History sync repeated 10 times | Database state remains one position and one journal trade. |
| F. 10,100 random invalid API keys | Limiter state remains capped at 10,000 hashed buckets. |
| G. Cross-account API access | API key resolves only to its active hashed connection; workspace/history responses are account-scoped and protected procedures verify authenticated ownership. |
| H. Naive timestamp | Existing `+05:00` interpretation remains unchanged and is covered by regression tests. |

## Security and reliability verification

API keys are authenticated by keyed hash lookup, and legacy keys are migrated opportunistically after a successful match. Raw API keys are not returned by workspace/history responses, are delivered only once at connection creation, and are not included in error logs. The limiter hashes keys before storing them, evicts expired buckets, and enforces a hard maximum entry count. JSON and URL-encoded request bodies remain bounded by server middleware, and malformed JSON/Zod payloads return sanitized errors.

The complete MT5-specific suite passes with **20 tests across 3 files**. The full application suite passes with **35 test files and 97 tests**. TypeScript validation passes, the production build passes, and `git diff --check` passes. The build retains the project’s existing informational large-chunk warning but produces the production artifact successfully.

## Files changed

- `server/mt5Db.ts`
- `server/mt5Db.test.ts`
- `server/mt5Ingest.ts`
- `server/mt5Ingest.test.ts`

The report itself is included as `mt5-production-audit-report.md`.

## Conclusion

The audited MT5 flow now has account-scoped workspace reads, transaction-scoped position/journal writes, stale-event protection, stricter payload validation, and explicit regression coverage for the requested idempotency, ordering, limiter, and timezone scenarios. The UTC+5 behavior was preserved exactly as requested.

— Manus AI
