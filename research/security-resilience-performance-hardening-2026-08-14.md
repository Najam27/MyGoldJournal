# Gold Journal Security, Resilience, and Performance Hardening Record

## Scope

This release reviewed the thirteen requested controls against the actual Gold Journal architecture: React client, Express/tRPC API, Manus OAuth, TiDB/Drizzle persistence, S3-backed screenshot evidence, direct MT5 Expert Advisor ingestion, and a browser-local OpenRouter key. The implementation prioritizes strict ownership checks, safe failure behavior, and performance changes that preserve the trader’s existing MT5 and journal data.

| # | Requested control | Implemented outcome |
|---|---|---|
| 1 | Input validation and XSS controls | Server schemas now reject HTML-like markup and unsafe control characters for protected human-text fields, with defined limits. Screenshot uploads enforce declared type, decoded size, and JPEG/PNG/WebP signatures. Client rendering continues to sanitize journal text. |
| 2 | Password and auth hardening | Gold Journal uses managed Manus OAuth and has no password creation, reset, or stored-password route. OAuth callback failures are now generic, preventing parameter-specific disclosure. Managed provider rate limiting and anti-enumeration controls remain at the identity boundary. |
| 3 | Secret handling | A redacted source/build/history scan found no committed application secret. New MT5 API keys are shown once at connection creation; the database stores only a SHA-256 verifier and existing raw keys migrate on the terminal’s next authenticated request. The user-selected OpenRouter key remains browser-local by design. |
| 4 | Dependencies | Compatible dependencies were refreshed, Drizzle ORM was upgraded to `0.45.2`, response compression dependencies were added, and vulnerable SheetJS was removed. The Excel export now uses escaped SpreadsheetML generated only from existing journal rows. |
| 5 | Screenshot handling | Server validation adds magic-byte verification on top of client selection checks. Default journal and table responses no longer generate signed URLs for every screenshot. Evidence URLs are requested only for an opened trade card or selected PDF export batch. A confirmed **Remove screenshot** action unlinks evidence and prevents future signed URL issuance. |
| 6 | External dependencies | AI Mentor uses a browser-local 30-second abort and opens a one-minute circuit after two consecutive failures. Storage presign/upload/download calls use bounded 10–20 second deadlines. MT5 ingest retains its per-key request limiter. |
| 7 | Compression | Express negotiates compression for eligible text and JSON responses at a 1 KiB threshold, while isolated screenshot storage is explicitly excluded and non-compressible responses remain delegated to middleware safeguards. |
| 8 | Error handling and monitoring | Rejected tRPC validation payloads return a generic client message and log only route/code metadata. OAuth failures are generic. Storage and AI failures have bounded, trader-readable recovery messages rather than raw provider responses. |
| 9 | Database and queries | Trade Log server pagination and account-scoped indexes remain active. Search requests are debounced for 300 ms. Routine journal and Trade Log reads no longer re-run MT5 stored-position reconciliation; MT5 ingest performs automatic synchronization and an explicit recovery mutation remains available. |
| 10 | Logging and privacy | Existing safe record projections keep internal ownership IDs, MT5 tickets, storage keys, timestamps, and backend metadata out of browser-facing journal responses. New operational logs deliberately omit input values and secrets. |
| 11 | Optimistic UI | Rules & lists creation and active-state toggles now update the local query cache immediately, roll back on a failed mutation, and then refresh from the authoritative server response. |
| 12 | Image URL lifecycle | Signed screenshot URLs are lazy and limited to the selected trade or selected export chunk. The PDF exporter resolves selected evidence in protected batches of fifty instead of front-loading every journal image URL. |
| 13 | Cache and stale content | Static assets remain network-first with cache fallback; API and storage requests bypass the service-worker cache. The update banner now waits for service-worker control change before reloading, eliminating the prior stale-stylesheet reload race. |

## Dependency residuals

The post-update audit no longer reports SheetJS or Drizzle ORM. It still reports **Vitest 2.1.9** and a nested **Vite 5.4.21** used only by Vitest’s development tooling. Their suggested remediation requires a Vitest 3 major upgrade, which was intentionally not applied automatically because it can alter the test runner contract. Neither package is bundled into the deployed Gold Journal server or client build. The deployed production build uses Vite `7.3.6`.

> The remaining development-tooling advisories should be resolved in a separately reviewed Vitest major-version upgrade. They are tracked rather than suppressed, and production deployment does not run the Vitest UI or a Vite development server.

## Screenshot removal and storage retention

The new removal operation clears the evidence reference from the owned trade and blocks any future application-issued signed URL. It does not claim an unverified provider-side immediate object purge: the configured storage helper exposes put and signed-get operations, not a documented delete operation. A storage lifecycle/purge policy should be configured when organization-wide retention requirements are known.

## Verification

The final validation passed **41 test files / 94 tests**, TypeScript validation, production build, and service-worker syntax validation. Desktop dark and light checks rendered the authenticated Trade Log without application errors; the elevated Manage accounts action remained visible above the bottom overlay.

| Reviewed item | Result |
|---|---|
| Server-side text and image validation | Regression-covered and passing. |
| OAuth generic errors | Regression-covered and passing. |
| Hashed MT5 key UI behavior | Regression-covered and passing. |
| Lazy evidence and selected PDF evidence | Regression-covered and passing. |
| AI Mentor failure isolation | Regression-covered and passing. |
| PWA activation sequence | Regression-covered and passing. |
| Rules & lists optimistic state | Regression-covered and passing. |
| Full project validation | 41 files / 94 tests; TypeScript, build, and service-worker checks passed. |

## Follow-up operations

The production build still reports a JavaScript chunk above the Rollup advisory size threshold. It is already compressed, and the application has functional pagination, lazy screenshot URLs, and bounded calls. For higher traffic, the next capacity work should be measured load testing followed by route-level code splitting of the chart, PDF, and spreadsheet export features, plus server-side aggregate rollups for very large account histories.
