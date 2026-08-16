# Supabase PostgreSQL and Netlify Migration Runbook

## Scope and outcome

This runbook describes the production migration of MyGoldJournal1 from MySQL/TiDB to Supabase PostgreSQL and the deployment of the frontend and API through Netlify. The migration preserves the existing React 19 user interface, Express/tRPC API, Manus OAuth session model, Manus Forge/S3-compatible storage, trading calculations, MT5 account isolation, and PKT UTC+5 timestamp semantics.

The application now uses Drizzle ORM with `drizzle-orm/node-postgres` and the `pg` driver. The legacy MySQL driver is retained only as a development dependency for the one-time export utility; the deployed application has no MySQL runtime dependency.

## Target architecture

| Layer | Production implementation | Important constraint |
|---|---|---|
| Frontend | Vite build published from `dist/public` on Netlify | No server secrets are exposed through `VITE_*` variables. |
| API | Existing Express middleware and routes wrapped by `netlify/functions/api.ts` | `/api/*` is rewritten to the function before the SPA fallback. |
| RPC | tRPC under `/api/trpc` | Manus OAuth remains the authentication provider. |
| MT5 ingest | Existing `/api/mt5` flow, including authentication, validation, ordering, idempotency, and atomic writes | The established PKT UTC+5 interpretation is unchanged. |
| Database | Supabase PostgreSQL through `pg` and Drizzle | Use the transaction pooler on port 6543 for functions and the session pooler on port 5432 for migrations/imports. |
| Storage | Existing Manus Forge/S3-compatible storage | No storage migration is required. |
| Security boundary | All database access remains server-side; Supabase Auth and RLS are not introduced | Keep `DATABASE_URL`, `JWT_SECRET`, `MT5_ENCRYPTION_KEY`, and Forge server keys out of `VITE_*`. |

## Repository changes

The PostgreSQL schema in `drizzle/schema.ts` preserves the twelve existing tables and names while converting MySQL constructs to PostgreSQL equivalents: `pgTable`, `pgEnum`, `serial`, `integer`, `jsonb`, and timezone-aware timestamps. MySQL duplicate-key operations were converted to PostgreSQL `onConflictDoUpdate` operations with explicit conflict targets. Insert mutations now use PostgreSQL `returning` clauses rather than MySQL `insertId` values.

The Express bootstrap now exports `createApp`, allowing the same middleware and route registration to be reused by Netlify Functions. The long-running local/server deployment path remains available through `startServer`; the Netlify wrapper disables frontend serving because Netlify serves the static build separately.

The migration utilities are intentionally non-destructive. `scripts/export-mysql-data.ts` writes a JSON export with row counts and safe serialization for bigint, date, buffer, and JSON values. `scripts/import-postgres-data.ts` imports in dependency-safe table order inside a transaction, uses `ON CONFLICT DO NOTHING` for safe reruns, and repairs serial sequences. `scripts/verify-supabase-migration.ts` compares row counts when an export is supplied and checks MT5/account-isolation invariants, including duplicate account/ticket states, orphan records, and cross-user MT5 connections.

## Operator migration procedure

First, create a Supabase project and obtain both pooler URLs. Configure the session pooler URL temporarily for schema migration and import operations. Apply the generated Drizzle migration with `pnpm db:migrate`. The generated SQL is stored in `drizzle/migrations/0000_high_zaran.sql`.

Next, export the legacy database without changing it:

```bash
MYSQL_DATABASE_URL='mysql://...' pnpm db:export:mysql ./migration/mysql-export.json
```

Import the export into the new Supabase database using the session pooler URL:

```bash
DATABASE_URL='postgresql://...:5432/postgres?sslmode=require' \
pnpm db:import:postgres ./migration/mysql-export.json
```

Run verification before switching application traffic:

```bash
DATABASE_URL='postgresql://...:5432/postgres?sslmode=require' \
pnpm db:verify ./migration/mysql-export.json
```

The verifier must report matching row counts and zero failures for duplicate MT5 live account/ticket values, duplicate MT5 journal account/ticket values, orphan MT5 records, and cross-user MT5 connections. If verification fails, do not cut over the application.

After verification, configure the Netlify Function with the transaction pooler URL on port 6543. Netlify environment variables must include the server-side values listed below. Deploy the repository using the Netlify build command already committed in `netlify.toml`, then perform an authenticated browser smoke test and an MT5 OPEN/CLOSE smoke test against the production domain.

## Required environment variables

| Variable | Where it is used | Exposure rule |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection | Server-only; use the transaction pooler for Netlify. |
| `JWT_SECRET` | Manus OAuth session cookies | Server-only. |
| `MT5_ENCRYPTION_KEY` | Encrypted MT5 API-key storage | Server-only and at least 32 characters. |
| `VITE_APP_ID` | Manus OAuth application identifier | Client-visible by design. |
| `OAUTH_SERVER_URL` | Manus OAuth server-side flow | Server-only. |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL | Client-visible by design. |
| `OWNER_OPEN_ID`, `OWNER_NAME` | Existing owner/admin configuration | Server-side configuration. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Server-side storage and Manus Forge operations | Server-only. |
| `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` | Existing browser-safe Forge integration | Only use the existing browser-safe key; never put database, JWT, or MT5 secrets here. |

The legacy `MYSQL_DATABASE_URL` and `MYSQL_EXPORT_FILE` variables are needed only while running the migration scripts and should not be configured in the deployed Netlify environment.

## Netlify behavior and known limitation

The redirect order in `netlify.toml` sends `/api/*` to `/.netlify/functions/api/api/:splat` before the catch-all SPA rewrite sends browser routes to `/index.html`. The function uses the existing Express API rather than a second implementation, so Manus OAuth callbacks, tRPC, storage proxying, MT5 authentication, payload validation, and the existing error handling remain in one code path.

The MT5 rate limiter remains an in-memory bounded map. Its state is bounded within an individual warm function instance and invalid keys cannot grow it without limit, but serverless instances do not share memory and their state can reset on cold starts. This is a documented limitation of the Netlify deployment mode. If MT5 polling volume or abuse protection requires cross-instance enforcement, move the API to an always-on service or replace the limiter store with a shared Redis/Supabase-backed mechanism. The current function path should be kept within Netlify’s function timeout by retaining the existing bounded MT5 batch size and request limits.

## MT5 and timezone preservation

No broker timezone auto-detection, UTC conversion, DST conversion, or timezone redesign was introduced. The existing `Asia/Karachi`/UTC+5 session-classification contract and the established interpretation of MT5 timestamps remain in place. PostgreSQL stores the migrated instant fields as timezone-aware timestamps, while the application continues to classify MT5 timestamps through the existing PKT logic.

The existing MT5 safeguards remain intact: account ownership is checked before data access, API keys are encrypted and hashed, raw keys are not returned after setup, MT5 writes use account/ticket conflict keys, repeated OPEN/CLOSE/history events remain idempotent, stale OPEN/CLOSE events are rejected according to the existing ordering checks, and MT5 transactions update the live position and journal synchronization atomically.

## Rollback procedure

If production smoke tests fail, pause the MT5 EA polling and prevent new writes while preserving the Supabase database for investigation. In Netlify, restore the previous successful deploy or point the site back to the last known-good application commit. If the prior application is still running on the old backend, restore its original MySQL/TiDB `DATABASE_URL` and server environment variables rather than pointing the pre-migration code at PostgreSQL.

Do not delete or truncate Supabase data as part of an initial rollback. Preserve the export file, Supabase snapshot, and post-cutover audit window. Any writes accepted after cutover must be reconciled before a second cutover; the import utility’s `ON CONFLICT DO NOTHING` behavior is intentionally safe for reruns but does not overwrite divergent destination rows. After the root cause is fixed, repeat schema verification and the MT5 OPEN/CLOSE/idempotency smoke tests before attempting cutover again.

## Validation completed in this repository

The final validation completed locally with the following results:

| Check | Result |
|---|---:|
| TypeScript check (`pnpm check`) | Passed |
| Vitest files | 36 passed |
| Vitest tests | 99 passed |
| Production build (`pnpm build`) | Passed |
| Netlify Function bundle | Passed |
| MySQL export utility bundle | Passed |
| PostgreSQL import utility bundle | Passed |
| Supabase verification utility bundle | Passed |

The successful local checks validate code and packaging. They do not replace operator verification against the actual Supabase project, legacy database export, Netlify environment, Manus OAuth callback configuration, or production MT5 account.
