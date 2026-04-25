---
phase: 68
plan: 1
subsystem: integrations
tags: [qbo, oauth, encryption, sqlite, drizzle]
requires: [cryptoService, drizzle-orm, express-auth]
provides: [qbo-token-storage, qbo-oauth-flow, integrations-page]
affects: [server-index, schema, layout-nav, app-router]
tech-stack:
  added: []
  patterns: [AES-256-GCM via encryptSsn/decryptSsn, native fetch OAuth, Drizzle upsert pattern]
key-files:
  created:
    - src/server/services/qboService.ts
    - src/server/routes/integrations.ts
    - src/client/pages/IntegrationsPage.tsx
    - src/server/db/migrations/0041_qbo_tokens.sql
  modified:
    - src/server/db/schema.ts
    - src/server/index.ts
    - src/client/App.tsx
    - src/client/components/shared/Layout.tsx
    - src/server/db/migrations/meta/_journal.json
decisions:
  - Used encryptSsn/decryptSsn directly (not a cryptoService class) — cryptoService exports functions, not a class
  - No intuit-oauth SDK installed — implemented OAuth code exchange via native fetch (avoids SDK dependency)
  - Migration numbered 0041 to avoid collision with existing 0037_sub_upload.sql (drizzle-kit generated a bad baseline migration which was removed)
  - Phase 70 columns (apprenticeshipRequirements, isIraIijaProject, apprenticeshipProgramName, rapidsNumber) bundled into migration 0041 to resolve pre-existing typecheck failures in workerService.ts and projects.ts
metrics:
  duration: 35m
  completed: 2026-04-25
  tasks: 6
  files: 9
---

# Phase 68: QuickBooks Online OAuth Foundation Summary

Contractors can connect their QuickBooks Online account via OAuth PKCE flow, see connection status with 7-day expiry warning, and safely disconnect — with all tokens stored AES-256-GCM encrypted using the existing cryptoService.

## What Was Built

**Table:** `qbo_tokens` — one row per user, stores encrypted access/refresh tokens, realmId, and expiry timestamps. Index on `user_id` for fast lookup.

**Migration:** `0041_qbo_tokens.sql` — incremental migration (CREATE TABLE + index). Also includes Phase 70 worker/project columns that were already referenced in working-tree code.

**qboService.ts:** Four exported functions:
- `getQboConnection(userId)` — returns connection status with `nearExpiry` flag (< 7 days)
- `saveQboTokens(userId, params)` — upsert pattern, encrypts tokens via `encryptSsn`
- `deleteQboTokens(userId)` — hard delete
- `getDecryptedTokens(userId)` — for future QB API calls

**integrations.ts router** (mounted at `/api/integrations`):
- `GET /qbo/status` — returns `{ connected, realmId, accessTokenExpiresAt, refreshTokenExpiresAt, nearExpiry }`
- `GET /qbo/connect` — redirects to Intuit OAuth URL with state containing userId
- `GET /qbo/callback` — exchanges code for tokens via native fetch, saves encrypted, redirects to `/settings/integrations?connected=true`
- `DELETE /qbo` — removes tokens, logs security event

**IntegrationsPage.tsx** — React page at `/settings/integrations`:
- Shows connected/disconnected badge
- Displays realm ID when connected
- Shows amber warning banner when `nearExpiry` is true
- Reconnect and Disconnect buttons
- Uses existing `Button`, `Badge`, `Layout`, `PageHeader` UI primitives

**Navigation:** Integrations nav link added to desktop nav and mobile drawer in Layout.tsx.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] cryptoService exports functions, not a class**
- **Found during:** Task 4 (reading cryptoService.ts)
- **Issue:** Plan specified `cryptoService.encrypt()` / `cryptoService.decrypt()` but the actual module exports `encryptSsn()` / `decryptSsn()` standalone functions
- **Fix:** Used `encryptSsn`/`decryptSsn` directly in qboService.ts
- **Files modified:** `src/server/services/qboService.ts`

**2. [Rule 1 - Bug] Drizzle generate created full-baseline migration instead of incremental**
- **Found during:** Task 3 (running db:generate)
- **Issue:** `drizzle-kit generate` produced `0037_strong_reavers.sql` — a full CREATE TABLE baseline — because the Drizzle snapshot was out of sync with the journal. This would fail on any existing DB.
- **Fix:** Removed bad file, created `0041_qbo_tokens.sql` with only the incremental change, manually updated `_journal.json`
- **Files modified:** `src/server/db/migrations/meta/_journal.json`
- **Commit:** 6441f11

**3. [Rule 2 - Missing] Phase 70 pre-existing schema references broke typecheck**
- **Found during:** Task 7 (typecheck)
- **Issue:** `workerService.ts` and `projects.ts` already referenced Phase 70 fields (`apprenticeshipProgramName`, `rapidsNumber`, `apprenticeshipRequirements`, `isIraIijaProject`) that existed in the working tree but had no migration. Test DB ran migrations and lacked those columns, causing 248 test failures.
- **Fix:** Added Phase 70 ALTER TABLE statements to `0041_qbo_tokens.sql` and restored Phase 70 fields in `schema.ts` — bringing schema, migrations, and service code into sync
- **Files modified:** `0041_qbo_tokens.sql`, `schema.ts`

**4. [Rule 4 - Not needed] intuit-oauth SDK**
- **Found during:** Task 2 (package.json grep)
- **Issue:** SDK not installed; plan specified it as optional
- **Decision:** Implemented OAuth code exchange via native `fetch` — no SDK needed for this phase

## Known Stubs

- `/api/integrations/qbo/connect` requires `QBO_CLIENT_ID`, `QBO_REDIRECT_URI`, and `QBO_CLIENT_SECRET` env vars — returns 503 if missing. These are auth credentials the user must supply.
- No token auto-refresh on expiry — `getDecryptedTokens` exists for future QB API call phases.

## Test Results

- **56 test files passed** (55 pre-existing + 1 new integration)
- **0 test failures**
- **0 TypeScript errors** (server + client)

## Self-Check: PASSED

Files confirmed present:
- `src/server/services/qboService.ts` — FOUND
- `src/server/routes/integrations.ts` — FOUND
- `src/client/pages/IntegrationsPage.tsx` — FOUND
- `src/server/db/migrations/0041_qbo_tokens.sql` — FOUND

Commit confirmed: `6441f11` in git log.
