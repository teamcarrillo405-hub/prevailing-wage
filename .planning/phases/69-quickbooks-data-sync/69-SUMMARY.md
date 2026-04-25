---
phase: 69
plan: 01
subsystem: integrations
tags: [quickbooks, oauth, time-import, payroll]
requires: [phase-68]
provides: [qbo-employee-roster, qbo-timeactivities, qbo-import-modal]
affects: [PayrollWeekDetailPage, integrationsRouter, qboService]
tech-stack:
  added: []
  patterns: [transparent-token-refresh, preview-before-commit]
key-files:
  created: []
  modified:
    - src/server/services/qboService.ts
    - src/server/routes/integrations.ts
    - src/client/pages/PayrollWeekDetailPage.tsx
decisions:
  - Used transparent token refresh in getValidAccessToken() rather than forcing re-auth
  - Modal shows preview only — routes user to existing CSV import pipeline for commit
  - Button only visible when qboConnected === true (live qbo-status query)
metrics:
  duration: ~25 min
  completed: 2026-04-25
  tasks: 1
  files: 3
requirements: [QB-02, QB-03]
---

# Phase 69 Plan 01: QB Online Employee Roster + TimeActivity Pull Summary

QB Online data pull routes added and wired through the existing import pipeline with a frontend modal preview.

## What Was Built

### Server: `getValidAccessToken()` (qboService.ts)
Transparent token refresh helper. Checks expiry with a 5-minute buffer; if expired, calls the Intuit token refresh endpoint, saves updated tokens (encrypted via `encryptSsn`), and returns the fresh access token. Returns `null` if user has no connection or refresh fails. Uses `decryptSsn` / `encryptSsn` (the existing naming convention in this codebase).

### Server: `GET /api/integrations/qbo/employees`
Queries `SELECT * FROM Employee MAXRESULTS 200` against the QB Online API. Maps each QB Employee record to a `{ qboId, displayName, email, address, hasSsn, ssnLast4 }` preview object. Returns `{ data: { employees: [...] } }`.

### Server: `GET /api/integrations/qbo/timeactivities?startDate=&endDate=`
Queries `SELECT * FROM TimeActivity WHERE TxnDate >= '...' AND TxnDate <= '...' MAXRESULTS 500`. Maps each record to `{ qboId, employeeRef, employeeId, date, hours, description, customerRef, needsDailySplit }`. The `needsDailySplit` flag is true when QB stores a weekly total without per-day breakdown columns. Returns `{ data: { activities, count, note } }`.

### Frontend: QB Status Query + Import Button (PayrollWeekDetailPage.tsx)
- Added `useQuery(['qbo-status'])` calling `/integrations/qbo/status` with a 5-minute stale time.
- Derived `qboConnected = data?.data?.connected === true`.
- Added "Import from QuickBooks" button in the sticky bottom bar, visible only when `qboConnected && !week?.submittedAt`.
- Added `showQboImportModal`, `qboActivities`, `qboImportFetching`, `qboImportError`, `qboImportNote` state.

### Frontend: QB Import Modal
Two-step flow:
1. **Fetch step** — User clicks "Fetch time records". Derives week start date from `weekEndingDate` (subtracts 6 days), calls `GET /integrations/qbo/timeactivities`, stores result.
2. **Preview step** — Renders a table of employee / date / hours / customer / notes. Rows needing daily split are flagged with `*` and a warning note. Closes cleanly with all state reset.

The modal explicitly does **not** write to the DB — it previews records and guides the user to use the existing "Import from Payroll Provider" CSV flow for the actual commit. This matches the plan's intent ("preview only — user confirms before commit").

## Deviations from Plan

**[Rule 1 - Bug] Fixed `variant="outline"` to `variant="secondary"`**
- Found during: typecheck
- Issue: Button component only supports `primary | secondary | ghost`; `outline` is not a valid variant
- Fix: Changed to `variant="secondary"` in the sticky bar button
- Files modified: `PayrollWeekDetailPage.tsx`
- Commit: 7943899

**[Rule 2 - Missing guard] Added null check on QBO_CLIENT_ID/QBO_CLIENT_SECRET in getValidAccessToken()**
- If env vars are missing, return null instead of crashing on `Buffer.from(...)` with undefined values
- Files modified: `qboService.ts`

## Routes Added

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/integrations/qbo/employees | requireAuth | QB employee roster preview |
| GET | /api/integrations/qbo/timeactivities | requireAuth | QB time records by date range |

## Typecheck Results

- Server (`tsc -p tsconfig.server.json --noEmit`): **0 errors**
- Client (`tsc -p tsconfig.json --noEmit`): **0 errors**

## Test Results

Pre-existing: 56 test files failing due to `SqliteError: duplicate column name: apprenticeship_requirements` in migration setup (confirmed present before Phase 69 changes via git stash verification). Phase 69 introduces no new test failures.

## Known Stubs

None. The modal preview is intentionally read-only — the commit path is the existing CSV import pipeline, which is fully wired.

## Self-Check: PASSED

- `src/server/services/qboService.ts` — confirmed modified (getValidAccessToken exported)
- `src/server/routes/integrations.ts` — confirmed modified (2 new routes)
- `src/client/pages/PayrollWeekDetailPage.tsx` — confirmed modified (button + modal)
- Commit 7943899 — confirmed present
