---
phase: 39-worker-profile-depth
plan: 01
subsystem: database, api
tags: [drizzle, sqlite, workers, payroll, classifications, address, union, apprenticeship]

requires:
  - phase: 38-audit-trail-wiring-activity-ui
    provides: assertProjectAccess utility, audit log wiring, base schema

provides:
  - "SQL migration 0022 with 8 new worker columns + payroll_week_classifications table"
  - "Drizzle schema: workers.addressStreet/City/State/Zip, unionLocal, unionBookNumber, apprenticeshipCommittee/RegNumber"
  - "Drizzle schema: payrollWeekClassifications table with unique constraint"
  - "workerService: CreateWorkerInput/UpdateWorkerInput accept 8 new fields; writes structured address"
  - "workers.ts route: Zod schemas accept 8 new fields; handlers pass through to service"
  - "payrollService.getPayrollEntriesWithWorkerDetails: concatenated address + COALESCE override LEFT JOIN"
  - "POST/DELETE /api/projects/:projectId/payroll-week-classifications endpoints"

affects: [39-worker-profile-depth-plan-02, ca-ecpr-xml-export, wa-pwia-export, wh347-generation]

tech-stack:
  added: []
  patterns:
    - "SQL COALESCE concat for structured address fields in payrollService"
    - "Drizzle alias() for self-join override pattern in classification lookup"
    - "DELETE+INSERT upsert pattern for unique-constrained classification overrides"
    - "add-only migration: address column retained in schema but not written for new records"

key-files:
  created:
    - src/server/db/migrations/0022_worker_profile_depth.sql
    - src/server/routes/payrollWeekClassifications.ts
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/services/workerService.ts
    - src/server/routes/workers.ts
    - src/server/services/payrollService.ts
    - src/server/index.ts

key-decisions:
  - "Use randomUUID from crypto (not uuid package) — no @types/uuid in project, consistent with rest of codebase"
  - "LEFT JOIN for payrollWeekClassifications in payrollService — most entries have no override, INNER JOIN would exclude all non-override rows"
  - "DELETE+INSERT upsert pattern for classification override — handles unique constraint on re-override without UPSERT syntax"
  - "Named export (payrollWeekClassificationsRouter) for new route file — consistent with majority of route files in index.ts"
  - "SQL COALESCE concat for workerAddress — downstream XML generators (CA eCPR) consume single string; structured fields concatenated server-side"

patterns-established:
  - "Override classification pattern: alias(workerClassifications, 'override_classifications') + COALESCE fields"
  - "add-only address migration: keep address column in schema/DB, stop writing it for new/updated records"

requirements-completed: [WORKER-01, WORKER-02, WORKER-03, WORKER-04, NFR-01, NFR-05]

duration: 25min
completed: 2026-04-02
---

# Phase 39 Plan 01: Worker Profile Depth (Backend) Summary

**8-column workers migration + payroll_week_classifications table + COALESCE classification override query pattern in getPayrollEntriesWithWorkerDetails**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-02T15:58:00Z
- **Completed:** 2026-04-02T16:06:00Z
- **Tasks:** 6
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- SQL migration 0022 written with 11 statements: 8 ADD COLUMN, 1 UPDATE backfill, CREATE TABLE + CREATE UNIQUE INDEX — registered in journal at idx 18
- Drizzle schema extended: 8 new worker columns (structured address, union card, apprenticeship) + payrollWeekClassifications table with uniqueIndex on (payrollWeekId, workerId)
- Worker service and route layers updated to accept/write all 8 new fields; old `address` column retained but no longer written (add-only policy)
- payrollService.getPayrollEntriesWithWorkerDetails upgraded: concatenated address via SQL COALESCE, COALESCE override classification using Drizzle alias(), LEFT JOIN (not INNER) for override table
- New POST/DELETE endpoints for classification override management, both guarded by assertProjectAccess (NFR-03)

## Task Commits

1. **Task 1: SQL migration + journal** - `881a9c0` (feat)
2. **Task 2: Drizzle schema** - `98f7ca3` (feat)
3. **Task 3: workerService.ts types + functions** - `098fa7d` (feat)
4. **Task 4: workers.ts Zod schemas** - `9472434` (feat)
5. **Task 5: payrollService.ts address concat + override JOIN** - `f9ed890` (feat)
6. **Task 6: payrollWeekClassifications route + index.ts** - `878666f` (feat)

## Files Created/Modified

- `src/server/db/migrations/0022_worker_profile_depth.sql` - 11-statement migration: 8 ADD COLUMN, backfill UPDATE, CREATE TABLE, CREATE UNIQUE INDEX
- `src/server/db/migrations/meta/_journal.json` - Added idx 18 entry for 0022_worker_profile_depth
- `src/server/db/schema.ts` - 8 new worker columns + payrollWeekClassifications table definition
- `src/server/services/workerService.ts` - CreateWorkerInput/UpdateWorkerInput extended; createWorker/updateWorker write new fields; stop writing address
- `src/server/routes/workers.ts` - CreateWorkerSchema/UpdateWorkerSchema with 8 new fields; POST/PUT handlers pass new fields to service
- `src/server/services/payrollService.ts` - workerAddress concat SQL expression; COALESCE classification override via alias; LEFT JOIN payrollWeekClassifications
- `src/server/routes/payrollWeekClassifications.ts` - New route file: POST (upsert) + DELETE endpoints with assertProjectAccess
- `src/server/index.ts` - Import and register payrollWeekClassificationsRouter at /api/projects

## Decisions Made

- **randomUUID from crypto instead of uuid package:** uuid package installed but no @types/uuid — switching to `randomUUID` from Node's built-in `crypto` module is consistent with all other route files in the project.
- **LEFT JOIN for payrollWeekClassifications:** Critical per plan spec — most payroll entries have no classification override. An INNER JOIN would have excluded them from WH-347, CA eCPR, WA PWIA exports.
- **DELETE+INSERT upsert:** SQLite lacks UPSERT ON CONFLICT UPDATE; DELETE+INSERT is simple and correct, handles the unique constraint on re-override atomically within Express middleware.
- **Named export for payrollWeekClassificationsRouter:** Consistent with majority of route files (auditRouter, exportRouter, etc.) that use named exports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced uuid v4 import with randomUUID from crypto**
- **Found during:** Task 6 (payrollWeekClassifications route creation)
- **Issue:** Plan specified `import { v4 as uuidv4 } from 'uuid'` but uuid package lacks TypeScript declarations — `npx tsc --noEmit` produced TS7016 error
- **Fix:** Replaced `uuidv4()` with `randomUUID()` from Node.js built-in `crypto` module — already the pattern used in all other route files
- **Files modified:** src/server/routes/payrollWeekClassifications.ts
- **Verification:** `npx tsc --noEmit` passes with zero new errors after fix
- **Committed in:** 878666f (Task 6 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary for TypeScript compliance. No functional change — randomUUID produces compliant UUID v4. No scope creep.

## Issues Encountered

None beyond the uuid types deviation documented above.

## User Setup Required

None — no external service configuration required. Migration will be applied on next Drizzle migrate run (`npx drizzle-kit migrate`).

## Next Phase Readiness

- All server-side data model and API surface complete for Phase 39 Plan 02 (React UI)
- payrollWeekClassifications POST/DELETE endpoints ready for WH-347 override UI
- getPayrollEntriesWithWorkerDetails returns structured address concat and override classification — downstream CA eCPR XML and WA PWIA XML exports will benefit automatically
- Pre-existing TypeScript errors (audit.ts:56, projects.ts:110 — implicit any) remain unchanged and non-blocking

---
*Phase: 39-worker-profile-depth*
*Completed: 2026-04-02*
