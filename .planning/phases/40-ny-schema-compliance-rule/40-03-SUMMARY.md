---
phase: 40-ny-schema-compliance-rule
plan: 03
subsystem: testing
tags: [compliance, ny-daily-ot, tdd, vitest, supertest, drizzle-orm]

# Dependency graph
requires:
  - phase: 40-ny-schema-compliance-rule
    provides: NY schema columns (nyprcNumber, nysContractorRegNumber, nysRegisteredApprentice, project.state) from plans 01-02
provides:
  - NY daily 8-hour OT compliance rule in computeCompliance (cwhssa-ot violations for (daySt+dayOt) > 8 per day)
  - Route integration tests for NY project fields (nyprcNumber, nysContractorRegNumber)
  - Route integration test for nysRegisteredApprentice worker field
  - TDD cycle documented with RED commit (afcdda6) then GREEN commit (3574d7d)
affects:
  - compliance engine consumers (compliance route, batch compliance, worker history)
  - future NY certified payroll form generation (Phase 41+)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NY state check: project?.state?.toUpperCase() === 'NY' — consistent with isCA/isWA pattern"
    - "getDb() inside service function for project lookup — avoids renaming _db parameter (research Pitfall 2)"
    - "Per-day OT check: iterate Mon-Sun array, compare (daySt ?? 0) + (dayOt ?? 0) > 8 for each independently"
    - "ComplianceViolation for daily OT: expected=8, actual=dayTotal, delta=dayTotal-8"

key-files:
  created: []
  modified:
    - src/server/services/complianceService.ts
    - tests/services/complianceService.test.ts
    - tests/routes/projects.test.ts
    - tests/routes/workers.test.ts

key-decisions:
  - "getDb() called inline inside computeCompliance for project fetch — do NOT rename _db parameter per research Pitfall 2"
  - "NY daily OT check fires before grossWages null check — NY violations emit regardless of recorded wages"
  - "Both NY daily check AND existing weekly CWHSSA check run for NY projects — daily is additive, not a replacement"
  - "Violation expected=8, actual=dayTotal (not grossWages) — daily OT violation shape differs from wage violation shape"
  - "Tests B and C passed RED phase naturally (expected behavior already worked); Test A correctly failed RED"

patterns-established:
  - "TDD RED: write 3 test cases in describe block using same seedProjectAndWorker pattern as existing tests"
  - "TDD GREEN: add project fetch via getDb().select().from(schema.projects).where(eq(...)).limit(1) after week load"
  - "Route tests for state-specific fields follow CA/WA pattern: POST with fields, GET verifies persistence, PATCH updates"

requirements-completed: [STATE-04, STATE-01, STATE-06]

# Metrics
duration: 10min
completed: 2026-04-06
---

# Phase 40 Plan 03: NY Schema Compliance Rule Summary

**NY 8-hour/day OT compliance rule via TDD (RED+GREEN), plus route tests for nyprcNumber, nysContractorRegNumber, and nysRegisteredApprentice field persistence**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-06T18:35:57Z
- **Completed:** 2026-04-06T18:46:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Implemented NY daily OT rule in `computeCompliance`: any day where (daySt + dayOt) > 8 emits a `cwhssa-ot` violation with expected=8, actual=dayTotal — NY-only, non-NY projects unaffected
- TDD cycle complete: RED commit (afcdda6) with 1 intentionally failing test, GREEN commit (3574d7d) with all 16 compliance tests passing
- Route integration tests confirm nyprcNumber, nysContractorRegNumber, and nysRegisteredApprentice persist through the full API path

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Write failing NY daily OT tests** - `afcdda6` (test)
2. **Task 2 (GREEN): Implement NY daily OT check** - `3574d7d` (feat)
3. **Task 3: Route integration tests** - `004cd59` (feat)

## Files Created/Modified
- `src/server/services/complianceService.ts` - Added getDb import; project fetch after week load; NY daily OT check (Mon-Sun per-day loop)
- `tests/services/complianceService.test.ts` - Added `describe('NY daily OT rule')` with 3 tests (Test A/B/C)
- `tests/routes/projects.test.ts` - Added `describe('NY project fields')` with 3 tests (POST, GET fields, PATCH nyprcNumber)
- `tests/routes/workers.test.ts` - Added `describe('nysRegisteredApprentice field')` with 2 tests (true accepted, defaults false)

## Decisions Made
- `getDb()` called inline inside `computeCompliance` for project fetch — avoids renaming `_db` parameter (research Pitfall 2 compliance)
- NY daily OT violation emits before the `grossWages == null` guard so it fires even when wages are not yet recorded
- Both daily (NY) and weekly CWHSSA checks run for NY projects — daily check is additive, not a replacement for federal rule
- Violation shape for daily OT: `expected=8` (daily threshold), `actual=dayTotal`, `delta=dayTotal-8` as specified by critical constraints
- Tests B (exactly 8h) and C (CA non-NY) passed RED phase naturally — only Test A (NY+9h Mon) correctly failed, confirming no false negatives

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing RED stubs in `.claude/worktrees/agent-ae6e6dde/tests/routes/projects.test.ts` cause 3 failures when running the full test runner (worktree is a separate agent context). These are out-of-scope pre-existing issues. Main test suite (`tests/routes/projects.test.ts`, `tests/routes/workers.test.ts`, `tests/services/complianceService.test.ts`) all pass with no regressions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- NY compliance rule is live — any NY project with daily hours > 8 will show violations in the UI
- NY project API fields (nyprcNumber, nysContractorRegNumber) and worker field (nysRegisteredApprentice) are verified end-to-end
- Phase 40 complete — ready for next milestone phase

---
*Phase: 40-ny-schema-compliance-rule*
*Completed: 2026-04-06*

## Self-Check: PASSED

- FOUND: src/server/services/complianceService.ts
- FOUND: tests/services/complianceService.test.ts
- FOUND: tests/routes/projects.test.ts
- FOUND: tests/routes/workers.test.ts
- FOUND: .planning/phases/40-ny-schema-compliance-rule/40-03-SUMMARY.md
- FOUND commit: afcdda6 (RED phase — failing tests)
- FOUND commit: 3574d7d (GREEN phase — implementation)
- FOUND commit: 004cd59 (route integration tests)
