---
phase: 06-wh-347-2025-compliance-foundation
plan: 01
subsystem: testing
tags: [vitest, tdd, wh347, pdf, workers, apprentice, programName]

# Dependency graph
requires: []
provides:
  - Failing test stubs for programName field on worker classifications (Plan 02 must satisfy)
  - Failing test stub for 4-page multi-page WH-347 with 9 workers (Plan 03 must satisfy)
  - Passing contract test: fillWh347 accepts certApprentices:false without error
affects: [06-02, 06-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD red-stub pattern — failing tests define behavioral contract before implementation]

key-files:
  created:
    - tests/routes/workers.test.ts
  modified:
    - tests/services/wh347.test.ts

key-decisions:
  - "Stubs must use actual assertions (not .todo) so they run and fail on missing fields"
  - "certApprentices contract test is green by design — documents API accepts false without error, not a failing stub"
  - "GET /workers 500 failures are pre-existing (missing address column in test DB) — not caused by new stubs"

patterns-established:
  - "Route test pattern: registerAndLogin(suffix) + createProject(cookie) + domain helper in beforeAll"
  - "Multi-page fixture: use Array.from({ length: N }, ...) to generate N workers from base worker shape"

requirements-completed: [WH347-01, WH347-02]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 6 Plan 01: WH-347 2025 Compliance Foundation — TDD Stubs Summary

**Failing red-stub tests in workers.test.ts (programName) and wh347.test.ts (4-page multi-page) define behavioral contracts for Plans 02 and 03**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T08:33:00Z
- **Completed:** 2026-03-20T08:40:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created tests/routes/workers.test.ts with two failing stubs: POST /classifications with programName and GET /workers returning programName field
- Appended multi-page stub to wh347.test.ts: 9-worker fixture expects 4 pages — fails until Plan 03 adds chunking
- Added certApprentices contract test (green): confirms generator accepts false without throwing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workers route test stub with programName cases** - `d9fbc60` (test)
2. **Task 2: Add multi-page and certApprentices stubs to existing wh347.test.ts** - `86a5601` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `tests/routes/workers.test.ts` - New file; route stubs for programName on classification create and list endpoints
- `tests/services/wh347.test.ts` - Appended FIXTURE_9_WORKERS, multi-page describe block, certApprentices contract describe block

## Decisions Made

- Stubs use real assertions without .todo so they actually run and fail — vitest can parse and execute both files with zero syntax errors
- The certApprentices test is intentionally green (documents current API contract, not a failing stub)
- Pre-existing test DB failures (missing address column) noted in STATE.md decisions — out of scope, not fixed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing SqliteError on address column causes 500 errors on workers/payroll route tests in test DB. This is a known issue (v1.0 STATE.md decision) that predates this plan. Our new stubs fail for the correct reason (missing programName field/column), not due to this error.

## Next Phase Readiness

- Plan 02 (programName schema + migration) has explicit verify target: `npx vitest run tests/routes/workers.test.ts` — both stubs must turn green
- Plan 03 (multi-page PDF chunking) has explicit verify target: `npx vitest run tests/services/wh347.test.ts` — 4-page stub must turn green
- All 8 existing wh347Generator tests remain green after appending new describe blocks

## Self-Check: PASSED

- FOUND: tests/routes/workers.test.ts
- FOUND: tests/services/wh347.test.ts
- FOUND: .planning/phases/06-wh-347-2025-compliance-foundation/06-01-SUMMARY.md
- FOUND: d9fbc60 (Task 1 commit)
- FOUND: 86a5601 (Task 2 commit)
- FOUND: 020835c (docs/metadata commit)

---
*Phase: 06-wh-347-2025-compliance-foundation*
*Completed: 2026-03-20*
