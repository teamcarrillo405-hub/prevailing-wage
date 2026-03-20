---
phase: 08-dashboard-ux-polish
plan: 01
subsystem: testing
tags: [vitest, supertest, compliance, tdd]

# Dependency graph
requires:
  - phase: 07-compliance-engine
    provides: GET /api/compliance/:weekId route and compliance computation
provides:
  - Failing test stubs for GET /api/compliance/project/:projectId (RED state)
  - seedProjectFixture helper returning { projectId, weekId }
  - seedProjectWithViolation helper for violation badge testing
affects: [08-02-PLAN — implements the route these stubs specify]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD Red — wave-0 stubs with actual assertions that fail 404 before route exists]

key-files:
  created: []
  modified:
    - tests/routes/compliance.test.ts

key-decisions:
  - "seedProjectFixture is a separate helper (not a modification of seedFixture) to preserve existing test isolation"
  - "Test 3 (404 for nonexistent projectId) trivially passes in RED state because route does not exist — this is expected and acceptable"
  - "Wave-0 assertion style used: actual expect() calls, not .todo — stubs fail with clear assertion error"

patterns-established:
  - "Project-level fixture helpers return both projectId and weekId for endpoint-appropriate test seeding"
  - "Under-wage violation seeded via POST /api/payroll/entries with grossWages=1.00 vs baseRateSnapshot=50.00"

requirements-completed: [DASH-01, DASH-02]

# Metrics
duration: 1min
completed: 2026-03-20
---

# Phase 8 Plan 01: Dashboard UX Polish — Compliance Project Endpoint Stubs Summary

**5 failing TDD stubs for GET /api/compliance/project/:projectId appended to compliance.test.ts, establishing RED state before Plan 02 implements the route**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-20T10:36:16Z
- **Completed:** 2026-03-20T10:37:53Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Appended `describe('GET /api/compliance/project/:projectId', ...)` block with 5 stubs to compliance.test.ts
- Added `seedProjectFixture(cookie)` helper returning `{ projectId, weekId }` without modifying existing `seedFixture`
- Added `seedProjectWithViolation(cookie)` helper that posts an under-wage payroll entry to trigger violation badge
- Confirmed RED state: 4 of 5 new stubs fail with 404 (route does not exist); test 3 trivially passes (expects 404, gets 404)
- All 4 existing `GET /api/compliance/:weekId` tests remain green

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing stubs (RED state)** - `d32ca53` (test)

## Files Created/Modified

- `tests/routes/compliance.test.ts` - Appended project fixture helpers and 5-test describe block; existing content untouched

## Decisions Made

- `seedProjectFixture` created as a new local helper, not a modification of `seedFixture`, to avoid disrupting the 4 existing tests
- Test 3 (404 for nonexistent projectId) trivially passes in RED state — this is correct TDD behavior; the test will pass for the right reason once the route implements proper not-found handling
- Wave-0 assertion style (actual assertions, not `.todo`) per Phase 06 decision carried forward

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RED state confirmed: 4 new stubs fail with 404, indicating route does not exist
- Plan 02 can implement `GET /api/compliance/project/:projectId` and these stubs will drive the GREEN state
- seedProjectFixture and seedProjectWithViolation helpers available for reuse in Plan 02 if needed

---
## Self-Check: PASSED

- tests/routes/compliance.test.ts: FOUND
- commit d32ca53: FOUND

*Phase: 08-dashboard-ux-polish*
*Completed: 2026-03-20*
