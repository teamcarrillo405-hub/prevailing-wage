---
phase: 121-quickbooks-employee-time-import
plan: 01
subsystem: api, ui, testing
tags: [quickbooks, qbo, workers, import, react, vitest, supertest]

# Dependency graph
requires:
  - phase: 119-dashboard-compliance-metrics
    provides: workerService.createWorker + assertProjectAccess utilities already in place
  - phase: 90-procore-integration
    provides: integrations router pattern + requireAuth middleware
provides:
  - POST /api/integrations/qbo/import-employees route with server-side SSN re-fetch, name dedup, IDOR guard
  - EmployeeImportSection React component with preview table, checkboxes, Import Selected action
  - Shared selectedProjectId state in IntegrationsPage for 121-02 to reuse
  - tests/routes/integrations.test.ts with 7 test cases (auth + validation coverage)
affects: [121-02-quickbooks-timesheet-sync, future-qbo-integrations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - qboIds string[] in POST body forces server-side QB re-fetch at import time (client never sends SSN)
    - existingNamesLower Set<string> two-pronged dedup: pre-import DB load + intra-batch add
    - assertProjectAccess before getValidAccessToken ordering per NFR-03 (Phase 38 pattern)

key-files:
  created:
    - tests/routes/integrations.test.ts
  modified:
    - src/server/routes/integrations.ts
    - src/client/pages/IntegrationsPage.tsx

key-decisions:
  - "qboIds: string[] instead of full employee objects forces server-side QB re-fetch for raw SSN at import time — client can never inject or tamper with SSN data"
  - "assertProjectAccess called before getValidAccessToken — NFR-03 authorization ordering (project ownership check before service token validation)"
  - "existingNamesLower.add() after each successful createWorker — prevents intra-batch name duplication when same DisplayName appears under two different qboIds"
  - "errors[] returned alongside created/skipped — UI shows per-row failure reasons without aborting the whole request"
  - "Shared selectedProjectId state added to IntegrationsPage (not EmployeeImportSection) — Plan 121-02 SyncTimesheetSection will share same selector without duplication"
  - "sw.js build error is pre-existing PWA plugin issue unrelated to this plan — does not affect TypeScript correctness or test coverage"

patterns-established:
  - "QB import pattern: POST body with IDs only -> server re-fetches each record from QB API -> createWorker with raw fields"
  - "Client dedup display: fetch /api/projects/:id/workers on projectId change -> populate existingNamesLower for Exists/New badges"

requirements-completed: [QB-02]

# Metrics
duration: 7min
completed: 2026-04-30
---

# Phase 121 Plan 01: QB Employee Import Summary

**POST /api/integrations/qbo/import-employees with server-side SSN re-fetch + name dedup, EmployeeImportSection preview table with Exists/New badges, and 7-test integrations suite covering auth/IDOR/validation paths**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-30T00:00:07Z
- **Completed:** 2026-04-30T00:02:24Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- New `POST /api/integrations/qbo/import-employees` route: accepts `{projectId, qboIds[]}`, re-queries QB per-employee for raw SSN, case-insensitive name dedup (both pre-import and intra-batch), `assertProjectAccess` IDOR guard, returns `{created, skipped, errors[]}`
- New `EmployeeImportSection` React component: preview table with QB name / email / address / masked SSN / Exists|New status badges, checkbox selection, Import Selected button wired to new endpoint, inline result banner
- Shared `selectedProjectId` state in `IntegrationsPage` (from `GET /api/projects` on mount) — drives import section and ready for Plan 121-02 to reuse
- `tests/routes/integrations.test.ts` with 7 test cases covering: 401 auth-guards for /qbo/employees and /qbo/timeactivities, 401/403 for /qbo/import-employees unauthenticated, 400 missing projectId, 403 IDOR guard, 401 no QB connection, 400 missing startDate/endDate

## Route Signature

```
POST /api/integrations/qbo/import-employees
Authorization: requireAuth (httpOnly JWT cookie)

Request body:
{
  projectId: string;     // required — assertProjectAccess called first
  qboIds: string[];      // required — server re-fetches each employee from QB
}

Response 200:
{
  data: {
    created: number;
    skipped: number;
    errors: Array<{ qboId: string; reason: string }>;
  }
}

Error codes:
  400 — missing projectId or empty qboIds
  401 — unauthenticated (requireAuth) or QB not connected
  403 — project access denied (assertProjectAccess)
```

## EmployeeImportSection Props + State

```typescript
// Props
{ projectId: string }  // passed from IntegrationsPage selectedProjectId

// State
employees: QbEmployee[]       // loaded from GET /api/integrations/qbo/employees
selected: Set<string>         // qboIds checked by user
loading: boolean              // Load QB Employees fetch
importing: boolean            // Import Selected fetch
result: ImportResult | null   // {created, skipped, errors} after import
existingNamesLower: Set<string> // from GET /api/projects/:id/workers for client badge display
```

## Dedup Pattern

Two-pronged dedup ensuring no worker is created twice:

1. **Pre-import:** `GET /api/projects/:id/workers` loads all existing worker names → `existingNamesLower` Set
2. **Intra-batch:** After each successful `createWorker()`, `existingNamesLower.add(displayName.toLowerCase())` — prevents duplicates within the same import batch

Client mirrors this with `existingNamesLower` (from same `/workers` endpoint) to show Exists/New badges before import is triggered.

## Test Coverage

**Added in Task 1 (RED then GREEN after Task 2):**
- Test 1: GET /qbo/employees without auth → 401 (GREEN from Task 1)
- Test 2: GET /qbo/timeactivities without auth → 401 (GREEN from Task 1)
- Test 3: POST /qbo/import-employees without auth → 401 (RED in Task 1, GREEN after Task 2)
- Test 4: POST /qbo/import-employees with auth, missing projectId → 400 (RED in Task 1, GREEN after Task 2)
- Test 5: GET /qbo/timeactivities with auth, no startDate → 400 (GREEN from Task 1)

**Added in Task 2:**
- Test C: POST /qbo/import-employees with another user's projectId → 403 (GREEN)
- Test D: POST /qbo/import-employees with valid projectId, no QB tokens → 401 "QuickBooks not connected" (GREEN)

Total: 7 tests, all GREEN after Task 2.

## Task Commits

1. **Task 1: Add tests/routes/integrations.test.ts** - `36e78a9` (test)
2. **Task 2: POST /api/integrations/qbo/import-employees route** - `f483550` (feat)
3. **Task 3: EmployeeImportSection + shared project selector** - `c910b8f` (feat)

## Files Created/Modified

- `/c/Users/glcar/prevailing-wage/tests/routes/integrations.test.ts` — 7 Vitest integration tests for QB routes
- `/c/Users/glcar/prevailing-wage/src/server/routes/integrations.ts` — Added POST /qbo/import-employees handler + 2 new imports
- `/c/Users/glcar/prevailing-wage/src/client/pages/IntegrationsPage.tsx` — Added QbEmployee interface, EmployeeImportSection component, shared project selector state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed implicit `any` TypeScript error on existingNamesLower map callback**
- **Found during:** Task 2 (running tsc after implementing route)
- **Issue:** `existing.map((w) => w.name...)` — Drizzle select return type not inferred, TypeScript emitted TS7006 implicit any
- **Fix:** Added explicit type annotation `(w: { name: string })` on the map callback
- **Files modified:** `src/server/routes/integrations.ts`
- **Verification:** `npx tsc -p tsconfig.server.json --noEmit` exits 0
- **Committed in:** `f483550` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 type bug)
**Impact on plan:** Minimal — single-line annotation fix for TypeScript strictness. No scope creep.

## Known Stubs

None — all data flows wired. The QB API calls in the server route will return QB API errors when no real QB sandbox is connected (expected behavior; not a UI stub).

## Issues Encountered

- `npm run build` hits a pre-existing `sw.js` missing PWA plugin error unrelated to this plan. TypeScript (`tsc --noEmit`) exits 0 for both server and client. All 7 tests pass.

## User Setup Required

None — no new environment variables. QB OAuth connection is handled through the existing `/api/integrations/qbo/connect` flow.

## Next Phase Readiness

- Plan 121-02 (QB Timesheet Sync) can reuse `selectedProjectId` state and the project selector card already rendered inside the QB-connected block
- `EmployeeMappingSection` preserved unchanged — the name mapping localStorage flow used by 121-02's matching path is intact
- `assertProjectAccess` + `getValidAccessToken` ordering pattern established for any future QB routes

## Self-Check: PASSED

- FOUND: tests/routes/integrations.test.ts
- FOUND: src/server/routes/integrations.ts
- FOUND: src/client/pages/IntegrationsPage.tsx
- FOUND: .planning/phases/121-quickbooks-employee-time-import/121-01-SUMMARY.md
- Commit 36e78a9 exists (Task 1)
- Commit f483550 exists (Task 2)
- Commit c910b8f exists (Task 3)

---
*Phase: 121-quickbooks-employee-time-import*
*Completed: 2026-04-30*
