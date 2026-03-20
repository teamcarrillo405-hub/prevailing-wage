---
phase: 08-dashboard-ux-polish
plan: "02"
subsystem: compliance-api
tags: [compliance, api, routes, tdd]
dependency_graph:
  requires: [08-01]
  provides: [DASH-01, DASH-02]
  affects: [compliance.ts, compliance.test.ts]
tech_stack:
  added: []
  patterns: [route-ordering, project-aggregation]
key_files:
  created: []
  modified:
    - src/server/routes/compliance.ts
    - tests/routes/compliance.test.ts
key_decisions:
  - "Route /project/:projectId registered before /:weekId to prevent wildcard capture"
  - "seedProjectWithViolation fixture corrected to use payrollWeekId, classificationId, and daily hour fields"
metrics:
  duration: "3m 24s"
  completed: "2026-03-20"
  tasks: 1
  files: 2
---

# Phase 08 Plan 02: Project Compliance Aggregation Endpoint Summary

**One-liner:** Project-level compliance badge aggregation via `GET /api/compliance/project/:projectId` — loops all weeks through `computeCompliance`, returns `{ badge, weekCount, lastWeekNumber }`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GET /api/compliance/project/:projectId route | 57dd7c5 | src/server/routes/compliance.ts, tests/routes/compliance.test.ts |

## What Was Built

Added `GET /api/compliance/project/:projectId` to `compliance.ts` as the first route on `complianceRouter` (before `/:weekId`). The route:

1. Loads the project and checks ownership (404 / 403)
2. Calls `listPayrollWeeks(projectId)` to get all weeks sorted DESC
3. Loops through each week calling `computeCompliance(db, week.id)`
4. Sets `badge = 'violations'` on first violation found (short-circuits)
5. Returns `{ badge, weekCount, lastWeekNumber }` — data source for dashboard DASH-01 and DASH-02

All 9 compliance tests pass: 4 pre-existing `/:weekId` tests + 5 new `/project/:projectId` tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed seedProjectWithViolation fixture field name mismatch**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** The test helper `seedProjectWithViolation` sent `weekId` instead of `payrollWeekId`, `straightTimeHours` instead of daily column `monSt`, missing `classificationId`, and an extraneous `tradeCode` field. The Zod validation middleware rejected the request silently (422), so the payroll entry was never created and compliance always returned "clean".
- **Fix:** Updated fixture to use correct field names: `payrollWeekId`, `classificationId` (fetched from workers[0].classifications[0].id), `monSt: 8` for 8 hours ST on Monday.
- **Files modified:** tests/routes/compliance.test.ts
- **Commit:** 57dd7c5

## Self-Check: PASSED

- src/server/routes/compliance.ts: FOUND
- tests/routes/compliance.test.ts: FOUND
- Commit 57dd7c5: FOUND
- All 9 tests passing: CONFIRMED
