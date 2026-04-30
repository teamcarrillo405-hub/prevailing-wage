---
phase: 121-quickbooks-employee-time-import
verified: 2026-04-29T17:31:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "If needsDailySplit === true, an amber callout requires explicit user confirmation before Commit Import is enabled — fixed by changing taJson.data?.rows to taJson.data?.activities at IntegrationsPage.tsx line 410-411"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "QB Employee Import happy path — with a connected QB Online sandbox, click 'Load QB Employees', check two rows, click 'Import Selected', verify Workers are created with correct name/address and SSN stored encrypted"
    expected: "Preview table populates with Exists/New badges; after import, selected workers appear in the project's Workers list; re-importing the same employees shows created:0, skipped:2"
    why_human: "Requires live QB OAuth connection and real QB sandbox data; cannot mock the QB Employee REST API in automated tests without significant fixture work"
  - test: "QB Timesheet Sync happy path — with a connected QB Online sandbox, select a project + payroll week, click 'Preview from QB', verify the day-by-day table populates; click 'Commit Import', verify payroll entries appear in payroll"
    expected: "Preview table shows worker rows with Mon-Sun ST columns; commit creates payroll entries and shows 'X payroll entries created'"
    why_human: "Requires live QB OAuth connection; sync-time route needs real TimeActivity records to return matched workers"
  - test: "Daily split detection — with a QB Online sandbox where some TimeActivity records have weekly totals (needsDailySplit: true), verify the amber callout appears and Commit Import is disabled until the confirmation checkbox is checked"
    expected: "Amber callout visible; Commit Import button disabled; after checking the confirmation checkbox, Commit Import becomes enabled"
    why_human: "Requires live QB data with weekly-total TimeActivity records to exercise the now-fixed data.activities path end-to-end"
---

# Phase 121: QuickBooks Employee Time Import Verification Report

**Phase Goal:** The QuickBooks Online integration is complete — field workers' employee records import directly from QB into Workers, and timesheet hours from QB TimeActivity records flow through the existing import pipeline into payroll entries, eliminating the CSV download step for QB Online users

**Verified:** 2026-04-29T17:31:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (taJson.data?.rows -> data?.activities fix)

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | User can click 'Load QB Employees' and see a preview table with QB name, email, address, masked SSN, status badge | VERIFIED | EmployeeImportSection at IntegrationsPage.tsx line 60 fetches `/api/integrations/qbo/employees` on Load click; renders table with hasSsn masked display and Exists/New badges via existingNamesLower |
| 2  | User can check rows and click 'Import Selected' to create Workers in a chosen project | VERIFIED | Import Selected handler at line 111 POSTs `{projectId, qboIds: [...selected]}` to `/api/integrations/qbo/import-employees`; result banner renders `created`/`skipped` counts |
| 3  | Server-side dedup blocks duplicate worker creation; UI shows 'X created, Y already exists' | VERIFIED | Route (integrations.ts line 227-281) loads existing worker names into `existingNamesLower` Set before loop; skips on match; intra-batch add after each createWorker; returns `{created, skipped, errors}` |
| 4  | Raw QB SSN is fetched server-side at import time and never round-trips through the client | VERIFIED | POST body accepts only `qboIds[]`; route re-queries QB per employee at line 240-243 to get raw SSN; `ssn` is extracted server-side at line 264 and passed to createWorker |
| 5  | Vitest tests assert auth 401 for unauthenticated calls and 400 for missing projectId on import-employees | VERIFIED | tests/routes/integrations.test.ts — 10 tests, all GREEN (confirmed by re-verification live run: 10 passed, 267ms) |
| 6  | User selects a payroll week + optional date range and clicks 'Preview from QB' to fetch QB TimeActivity records | VERIFIED | SyncTimesheetSection at line 346; payroll-week dropdown populates from GET /api/projects/:id/payroll-weeks; Preview handler at line 394 POSTs to sync-time with weekId+projectId |
| 7  | Preview table shows worker name, day-by-day ST/OT hours (Mon-Sun), total hours per worker, plus unmatched panel | VERIFIED | buildImportRows at line 314 assembles ImportedRow[] with dayKey accumulation; unmatched panel rendered with "X QB employees could not be matched" message; missingClassWorkerIds warning row rendered |
| 8  | If needsDailySplit === true, an amber callout requires explicit user confirmation before Commit Import is enabled | VERIFIED | Gap closed: line 410 now casts to `{ data?: { activities?: Array<{ needsDailySplit: boolean }> } }` and line 411 reads `taJson.data?.activities ?? []`. setNeedsDailySplit(anyNeedsSplit) feeds state at line 351; line 455 gates Commit Import on `!(needsDailySplit && !dailySplitConfirmed)`; amber callout rendered at lines 532-544 |
| 9  | Commit Import sends ImportedRow[] to POST /api/payroll/import/commit with provider:'quickbooks' and shows success toast | VERIFIED | handleCommit at line 421 POSTs to `/api/payroll/import/commit` with `provider: 'quickbooks'`, `matched: rows`, `unmatchedCount`, `sourceFilename: 'QuickBooks TimeActivity'`; success banner renders `entriesCreated` count |

**Score:** 9/9 truths verified

---

## Re-verification: Gap Closure

| Gap (previous) | Fix Applied | Verified |
|----------------|-------------|---------|
| `taJson.data?.rows` reads non-existent field — needsDailySplit always false, amber callout never activated | Line 410: type cast updated to `{ data?: { activities?: Array<{ needsDailySplit: boolean }> } }`; line 411: reads `taJson.data?.activities ?? []` | CONFIRMED — no occurrence of `data?.rows` remains in the timeactivities path; state wiring, gate condition (line 455), and UI callout (lines 532-544) all intact and unmodified |

No regressions detected: all 10 Vitest integration tests pass (live run: 10 passed, 3.09s).

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/routes/integrations.ts` | POST /qbo/import-employees — server-side QB SSN re-fetch, name dedup, createWorker per selected employee, returns {created, skipped} | VERIFIED | Route at line 198; contains `createWorker(db,`, `assertProjectAccess(db, projectId, userId)`, `/v3/company/${realmId}/employee/`, `existingNamesLower.has(displayName.toLowerCase())` |
| `src/client/pages/IntegrationsPage.tsx` | EmployeeImportSection + SyncTimesheetSection + shared project selector + buildImportRows exported | VERIFIED | EmployeeImportSection at line 60; SyncTimesheetSection at line 346; `export function buildImportRows` at line 314; selectedProjectId state at line 774 |
| `tests/routes/integrations.test.ts` | Vitest integration tests — at minimum 401 auth guard tests and 400 projectId-missing test; extended to 10 tests covering all four QB routes | VERIFIED | 10 `it(` invocations; all 10 tests GREEN (re-verification live run confirmed) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| IntegrationsPage EmployeeImportSection | GET /api/integrations/qbo/employees | fetch on Load click | WIRED | Line 92: `fetch('/api/integrations/qbo/employees', { credentials: 'include' })` |
| IntegrationsPage EmployeeImportSection | POST /api/integrations/qbo/import-employees | fetch on Import Selected click | WIRED | Line 111: POSTs `{projectId, qboIds: [...selected]}` |
| integrations.ts import-employees handler | createWorker(db, {...}) from workerService | loop over selected QB employees with assertProjectAccess + dedup | WIRED | Line 267: `await createWorker(db, {...})` |
| integrations.ts import-employees handler | QB Employee REST API (single-employee re-fetch for raw SSN) | GET /v3/company/:realmId/employee/:qboId | WIRED | Line 240-243: fetch with Bearer token |
| IntegrationsPage SyncTimesheetSection | POST /api/integrations/qbo/sync-time | fetch on Preview click | WIRED | Line 398: template literal with weekId+projectId |
| IntegrationsPage SyncTimesheetSection | GET /api/projects/:id/workers | fetch for classificationId resolution | WIRED | Line 373: fetches workers on projectId change |
| IntegrationsPage SyncTimesheetSection | POST /api/payroll/import/commit | fetch on Commit Import click | WIRED | Line 427: `fetch('/api/payroll/import/commit', ...)` |
| IntegrationsPage SyncTimesheetSection | GET /api/integrations/qbo/timeactivities | side-call after preview to detect needsDailySplit | WIRED | Lines 405-412: fetch made, response cast reads `data.activities`, anyNeedsSplit drives setNeedsDailySplit — previously PARTIAL, now fully WIRED after gap fix |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| EmployeeImportSection | employees (QbEmployee[]) | GET /api/integrations/qbo/employees | Real — route queries QB Employee list API | FLOWING |
| EmployeeImportSection | existingNamesLower | GET /api/projects/:id/workers | Real — workers table query via Drizzle | FLOWING |
| SyncTimesheetSection | preview.matched / unmatched | POST /api/integrations/qbo/sync-time | Real — route queries QB TimeActivity API and matches against name-mapping | FLOWING |
| SyncTimesheetSection | workers (classificationId resolution) | GET /api/projects/:id/workers | Real — workers table with classifications inline | FLOWING |
| SyncTimesheetSection | needsDailySplit | GET /api/integrations/qbo/timeactivities | Route returns `data.activities`; client now correctly reads `data.activities` (gap closed) | FLOWING |
| SyncTimesheetSection | weeks (payroll-week picker) | GET /api/projects/:id/payroll-weeks | Real — payroll weeks table | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| GET /qbo/employees returns 401 without auth | `npx vitest run tests/routes/integrations.test.ts` Test 1 | 401, error JSON | PASS |
| POST /qbo/import-employees blocks unauthenticated | Test 3 | 401, error JSON | PASS |
| POST /qbo/import-employees missing projectId → 400 | Test 4 | 400, error contains "projectId" | PASS |
| POST /qbo/import-employees IDOR guard → 403 | Test C | 403, error JSON | PASS |
| POST /qbo/import-employees no QB tokens → 401 "QuickBooks not connected" | Test D | 401, "QuickBooks not connected" | PASS |
| POST /qbo/sync-time missing weekId → 400 | Test F+G | 400, error matches /weekId/i | PASS |
| POST /qbo/sync-time no QB tokens → 401 | Test H | 401, "QuickBooks not connected" | PASS |
| All 10 tests green (re-verification run) | `npx vitest run tests/routes/integrations.test.ts` | 10 passed, 3.09s | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QB-02 | 121-01-PLAN.md | Employee records import from QB into Workers (server-side SSN re-fetch, dedup, IDOR guard) | SATISFIED | POST /qbo/import-employees fully implemented; createWorker called per selected employee; assertProjectAccess + getValidAccessToken guards verified; 7 test cases covering auth/IDOR/validation all GREEN |
| QB-03 | 121-02-PLAN.md | TimeActivity hours flow through payroll import pipeline via /api/payroll/import/commit with provider:'quickbooks' | SATISFIED | SyncTimesheetSection wired to sync-time, classificationId resolved, commit endpoint correctly targeted with provider:'quickbooks'. Daily-split gate now correctly reads data.activities — safety confirmation for weekly-total records is live. |

---

## Anti-Patterns Found

No blockers or warnings. The one previously-flagged blocker (`taJson.data?.rows` silent mismatch) has been resolved.

---

## Human Verification Required

### 1. QB Employee Import happy path

**Test:** With a connected QB Online sandbox account, navigate to IntegrationsPage, confirm QB is connected, select a project, click "Load QB Employees", verify the preview table populates with real employee names and correct Exists/New status badges.

**Expected:** Table shows QB employees with masked SSN display (e.g., "... 4321"), correct email/address columns, Exists badge for workers already imported and New badge for novel workers. After clicking "Import Selected" with two new employees checked, a banner shows "2 workers created, 0 already exist". Re-running the same import shows "0 workers created, 2 already exist".

**Why human:** Requires live QB OAuth token and real QB sandbox employee data. The QB Employee REST API is not mockable in the current test setup without significant fixture infrastructure.

### 2. QB Timesheet Sync happy path

**Test:** With a connected QB Online sandbox, select a project with mapped employees and a payroll week, click "Preview from QB", verify the day-by-day table populates.

**Expected:** Preview table shows one row per matched worker with Mon-Sun ST hour columns populated, total column, and a classification status indicator. An unmatched-employees panel appears if any QB employees could not be matched. Clicking "Commit Import" creates payroll entries and shows a "X payroll entries created" success banner.

**Why human:** Requires live QB OAuth connection and real TimeActivity records in QB sandbox.

### 3. Daily split confirmation gate

**Test:** With a QB Online sandbox where some TimeActivity records have `needsDailySplit: true` (QB stored weekly totals without per-day breakdown), click "Preview from QB" and verify the amber callout appears.

**Expected:** Amber callout "QuickBooks stored weekly totals — hours have been split evenly across days. Confirm before committing." is visible; Commit Import button is disabled; after checking the confirmation checkbox, Commit Import becomes enabled.

**Why human:** Requires QB sandbox data with weekly-total TimeActivity records to exercise the now-correct data.activities path end-to-end. The client-side logic is sound; needs live fixture to confirm the flag propagates from the real QB response.

---

## Summary

All 9 automated truths are now verified. The single gap from the initial verification — the `data.rows` vs `data.activities` field mismatch that silently disabled the daily-split safety gate — has been fixed and confirmed in the source at IntegrationsPage.tsx lines 410-411. No regressions were introduced: all 10 Vitest integration tests remain GREEN on the re-verification run.

Requirements QB-02 and QB-03 are both fully satisfied in code. Phase 121 goal achievement is complete subject to the three human-verification items above, all of which require a live QB Online sandbox connection and cannot be automated without significant QB fixture infrastructure.

---

_Verified: 2026-04-29T17:31:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — gap closure confirmed_
