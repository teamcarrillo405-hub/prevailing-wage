---
phase: 19-wh-347-submission-tracking
plan: 01
subsystem: api
tags: [payroll, submission, lock-guard, drizzle, express, vitest, tdd]

# Dependency graph
requires:
  - phase: 17-project-archive
    provides: payrollWeeks schema with submitted_at and submitted_to columns (migration 0009)
provides:
  - assertWeekNotSubmitted() service function — returns { locked, submittedAt } for edit gate
  - updateWeekSubmission() service function — sets submitted_at + submitted_to
  - clearWeekSubmission() service function — nullifies submission fields (idempotent)
  - PATCH /api/payroll/weeks/:id/submit route — marks week as submitted (SUB-01)
  - DELETE /api/payroll/weeks/:id/submit route — clears submission status (SUB-03)
  - Server-side 409 lock guard in POST /entries and PUT /entries/:id (SUB-02)
affects:
  - 19-02 (if further Phase 19 plans exist)
  - Any Phase 20+ plan reading or writing payroll entries

# Tech tracking
tech-stack:
  added: []
  patterns:
    - assertProjectOwner pattern extended: service-level lock check before upsert
    - Idempotent state-clear: clearWeekSubmission is safe to call regardless of current state
    - TDD RED-GREEN: test stubs committed before implementation for federal audit requirements

key-files:
  created: []
  modified:
    - tests/routes/payroll.test.ts
    - src/server/services/payrollService.ts
    - src/server/routes/payroll.ts

key-decisions:
  - "Lock guard placed after assertProjectOwner and before upsertPayrollEntry in both entry write routes — follows existing ownership check pattern"
  - "assertWeekNotSubmitted returns { locked, submittedAt } rather than throwing — routes own the HTTP response, not the service"
  - "clearWeekSubmission is unconditional UPDATE (idempotent) — no pre-check needed, avoids TOCTOU race"
  - "SubmitWeekSchema validates submittedAt as YYYY-MM-DD regex — consistent with existing date field pattern in CreateWeekSchema"

patterns-established:
  - "Service lock functions: return metadata objects, never throw; routes decide HTTP status"
  - "Lock guard injection: after ownership check, before mutation — identical pattern in POST and PUT"

requirements-completed: [SUB-01, SUB-02, SUB-03]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 19 Plan 01: WH-347 Submission Tracking Summary

**PATCH/DELETE submit routes + server-side 409 edit lock guard injected in both entry write routes, driven by TDD (assertWeekNotSubmitted x3 confirmed)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T19:18:26Z
- **Completed:** 2026-03-23T19:22:06Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Three new exported service functions (`assertWeekNotSubmitted`, `updateWeekSubmission`, `clearWeekSubmission`) added to `payrollService.ts`
- PATCH `/api/payroll/weeks/:id/submit` and DELETE `/api/payroll/weeks/:id/submit` routes registered with ownership check
- `assertWeekNotSubmitted()` injected in both `POST /entries` and `PUT /entries/:id` — `grep -c` returns exactly 3 (import + 2 usages), satisfying the federal compliance non-negotiable
- Full suite: 198 tests passing (193 prior + 5 new), zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 failing test stubs (TDD RED)** - `812e262` (test)
2. **Task 2: Service functions** - `0582bcb` (feat)
3. **Task 3: Routes + lock guard** - `f6e1e07` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 1 used TDD RED flow — 5 stubs committed failing, then Task 3 made them GREEN._

## Files Created/Modified

- `tests/routes/payroll.test.ts` - 5 new test cases across 3 describe blocks (SUB-01, SUB-02, SUB-03)
- `src/server/services/payrollService.ts` - 3 new exported submission lifecycle functions
- `src/server/routes/payroll.ts` - Extended import, SubmitWeekSchema, 2 new routes, lock guard in 2 existing routes

## Decisions Made

- Lock guard placed after `assertProjectOwner` and before `upsertPayrollEntry` in both entry write routes — follows existing ownership check pattern exactly
- `assertWeekNotSubmitted` returns `{ locked, submittedAt }` rather than throwing — routes own the HTTP response, service stays pure
- `clearWeekSubmission` uses unconditional UPDATE (idempotent) — no pre-check needed, avoids TOCTOU race
- `SubmitWeekSchema` validates `submittedAt` as YYYY-MM-DD regex — consistent with `CreateWeekSchema` date pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SUB-01, SUB-02, SUB-03 have full server-side test coverage before any UI work
- Lock guard is active immediately — any existing clients that attempt to edit a submitted week will receive 409
- UI submission controls (Phase 19 Plan 02 if exists, or Phase 20+) can now call PATCH/DELETE submit endpoints and rely on the server enforcing the lock

---
*Phase: 19-wh-347-submission-tracking*
*Completed: 2026-03-23*
