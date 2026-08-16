# Account Isolation and UI Production Audit

## Scope

This audit covered the attached production bug-fix requirements for multiple trading accounts, MT5 connection selection, trade isolation, account switching, interactive controls, hardcoded UI, light/dark themes, responsive behavior, cache invalidation, and regression coverage. Existing architecture and MT5 UTC+5 behavior were preserved.

## Root cause and enforcement

The primary UI-visible isolation gap was that the MT5 workspace connection list was resolved at the user level without restricting the returned connection metadata to the selected trading account. The server already carried account ownership through the MT5 connection and position records, but the workspace response could expose sibling-account connection rows to the selected-account session UI. The dashboard also used scattered invalidation calls, so account creation, rename, removal, and switching did not consistently refresh every account-scoped cache family.

The corrected flow is:

`authenticated user -> owned selected trading account -> MT5 connection belonging to that account -> account-scoped live/history/journal data`

The MT5 workspace query now filters connection metadata by both authenticated user ownership and the selected account. Live and history data remain account-scoped at the server query boundary, and the UI applies the selected-account filter as defense in depth. MT5 ticket identity remains account-scoped, so identical tickets in separate accounts remain separate records.

## Files changed

- `client/src/components/AccountRenameControl.tsx` — account CRUD now uses shared account-scoped cache invalidation.
- `client/src/components/ManusDialog.tsx` — theme-safe semantic surfaces, responsive width, and mobile-safe dialog sizing.
- `client/src/components/Mt5LiveView.tsx` — selected-account-only connection management, account-local link targets, and current EA version copy.
- `client/src/components/Mt5LiveView.test.tsx` — fixtures now include account IDs so selected-account filtering is tested correctly.
- `client/src/index.css` — semantic chart/trading tokens for light and dark themes.
- `client/src/pages/GoldJournal.tsx` — centralized account switching, stale trade placeholder removal, account-creation routing through the same invalidation path, and theme-safe chart colors.
- `client/src/lib/accountScope.ts` — shared invalidation helper for journal, trades, MT5 workspace/history, notifications, and option lists.
- `client/src/lib/accountScope.test.ts` — cache invalidation regression coverage.
- `server/mt5Db.test.ts` — same-ticket-across-accounts isolation regression coverage.

No schema or destructive database migration was required for this patch. Existing composite account/ticket identity and server-side ownership checks were retained.

## Fixed behavior

- A selected account displays only its own MT5 connections, live positions, history, journal data, PnL, balance/equity, and account-scoped settings.
- Multiple MT5 connections can belong to the same selected trading account; connections from sibling accounts are not offered as link targets.
- Identical MT5 tickets in different trading accounts remain independent.
- Account switching invalidates journal, paginated trades, MT5 workspace, MT5 history, notifications, and option-list caches.
- Account creation, rename, and removal use the same account-scoped refresh path.
- MT5 credentials remain masked and are not exposed by the workspace UI.
- Analysis chart colors use semantic theme tokens rather than fixed light-only colors.
- Login dialog surfaces are compatible with light/dark themes and small mobile viewports.
- No product-owned empty click handlers, console-only actions, fake alerts, TODO/FIXME placeholders, or fake loading actions were found in the final scan.

## Tests and verification

- Focused MT5 persistence and UI tests: **8 passed across 2 files**.
- Account-scope, MT5 persistence, and MT5 UI tests after final cache update: **9 passed across 3 files**.
- Full suite: **36 test files, 99 tests passed**.
- TypeScript check: **passed**.
- Production build: **passed**.
- `git diff --check`: **passed**.
- Build continues to emit only the existing informational large-chunk warning; no compilation failure occurred.

## UTC+5 preservation

**MT5 UTC+5 behavior was preserved and not changed.** This patch introduced no UTC conversion, broker timezone detection, DST conversion, timezone offset change, or replacement of the existing `+05:00` / `Asia/Karachi` behavior. The account-isolation and UI changes do not alter MT5 timestamp interpretation.

## Remaining issues

Authenticated browser verification against live OAuth/database credentials was not possible in the sandbox, so the final browser check is limited to the unauthenticated shell and automated component/server coverage. Production operators should still perform a live smoke test with two real trading accounts and two MT5 connections after deployment.

The existing Vite large-chunk warning remains informational; the build succeeds and is unrelated to account isolation.
