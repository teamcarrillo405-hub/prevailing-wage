---
phase: 17-db-migration-project-archive
plan: 01
subsystem: database
tags: [drizzle, sqlite, migration, api, testing]

# Dependency graph
requires:
  - phase: 16-wh347-submission-ux
    provides: payrollWeeks table and project route infrastructure used as base
provides:
  - SQL migration 0009 adding submitted_at, submitted_to, amendment_number, original_week_id to payroll_weeks
  - Journal entry at idx 5 registering 0009_payroll_week_submission_amendment
  - schema.ts payrollWeeks columns for Phase 19 (submission tracking) and Phase 21 (amendments)
  - GET /api/projects?status= filter (active-only default, all returns both)
affects: [17-02, 19-submission-tracking, 21-amendment-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle multi-statement SQL migrations require --> statement-breakpoint separators between ALTER TABLE statements"
    - "Self-referencing FK (originalWeekId) enforced in SQL migration only, not in schema.ts, to avoid AnySQLiteColumn complexity"
    - "GET /api/projects status filter: active-only default, ?status=all includes closed"

key-files:
  created:
    - src/server/db/migrations/0009_payroll_week_submission_amendment.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/routes/projects.ts
    - tests/routes/projects.test.ts

key-decisions:
  - "No .references() on originalWeekId in schema.ts — FK enforced SQL-only to avoid AnySQLiteColumn import"
  - "Statement-breakpoint separators required between ALTER TABLE statements in Drizzle migrations"
  - "GET /api/projects defaults to active-only; pass ?status=all for archived projects"

patterns-established:
  - "Multi-statement migrations: separate each ALTER TABLE with --> statement-breakpoint"
  - "New nullable migration columns go after isFinal and before createdAt in payrollWeeks"

requirements-completed: [PRJ-01, PRJ-02, PRJ-03]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 17 Plan 01: DB Migration + Status Filter Summary

**SQL migration adds 4 nullable submission/amendment columns to payroll_weeks (idx 5 in journal), and GET /api/projects gains active-only default filter with ?status=all override**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T17:46:46Z
- **Completed:** 2026-03-23T17:50:11Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `0009_payroll_week_submission_amendment.sql` with 4 ALTER TABLE statements and proper statement-breakpoint separators
- Registered migration at idx 5 in `meta/_journal.json` so Drizzle picks it up on test DB init
- Extended `payrollWeeks` in `schema.ts` with `submittedAt`, `submittedTo`, `amendmentNumber`, `originalWeekId` (all nullable)
- Modified GET /api/projects to default to active-only projects, with `?status=all` exposing closed ones
- Added 3 describe blocks (10 new tests) covering status filter, advisory-only DELETE, and PATCH restore — suite grew from 188 to 193 passing

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration — add 4 columns to payrollWeeks + update schema.ts** - `074e43f` (feat)
2. **Task 2: Status-filtered GET /api/projects + archive/restore tests** - `bb4c7de` (feat)

**Plan metadata:** see docs commit below

## Files Created/Modified
- `src/server/db/migrations/0009_payroll_week_submission_amendment.sql` - 4 ALTER TABLE statements with statement-breakpoints
- `src/server/db/migrations/meta/_journal.json` - Journal entry at idx 5 for 0009 migration
- `src/server/db/schema.ts` - 4 nullable columns added to payrollWeeks after isFinal
- `src/server/routes/projects.ts` - GET / handler now filters by status (active-only default)
- `tests/routes/projects.test.ts` - 3 new describe blocks: status filter, advisory DELETE, PATCH restore

## Decisions Made
- No `.references()` on `originalWeekId` in schema.ts — the self-referencing FK is enforced only in the SQL migration to avoid importing `AnySQLiteColumn` from drizzle-orm internals
- Drizzle multi-statement migrations require `--> statement-breakpoint` separators; single-statement files (like `0008_program_name.sql`) do not need them — auto-fixed when first run failed with "more than one statement" error
- Status filter defaults to active-only (not all) to match intended UX: archived projects are hidden unless explicitly requested

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added statement-breakpoint separators to migration SQL**
- **Found during:** Task 1 (migration creation)
- **Issue:** Initial migration file had 4 ALTER TABLE statements without separators; Drizzle's `migrate()` threw `RangeError: The supplied SQL string contains more than one statement` when `breakpoints: true` is set in the journal
- **Fix:** Added `--> statement-breakpoint` between each ALTER TABLE statement (3 separators for 4 statements)
- **Files modified:** `src/server/db/migrations/0009_payroll_week_submission_amendment.sql`
- **Verification:** `npx vitest run` went from 19 failed to 19 passed
- **Committed in:** `074e43f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Required fix — migration would silently fail without breakpoints. No scope creep.

## Issues Encountered
None — single deviation auto-fixed immediately.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- payrollWeeks now has `submitted_at`, `submitted_to`, `amendment_number`, `original_week_id` columns — Phase 19 (submission tracking) and Phase 21 (amendment workflow) can proceed
- GET /api/projects status filter is live — Phase 17-02 can add archive/restore UI knowing the server-side foundation is in place
- 193 tests passing, no regressions

## Self-Check: PASSED

- FOUND: `src/server/db/migrations/0009_payroll_week_submission_amendment.sql`
- FOUND: `src/server/db/migrations/meta/_journal.json` (idx 5 entry present)
- FOUND: `src/server/db/schema.ts` (submittedAt column present)
- FOUND: `src/server/routes/projects.ts` (statusFilter present)
- FOUND: `tests/routes/projects.test.ts` (status=all tests present)
- FOUND: `.planning/phases/17-db-migration-project-archive/17-01-SUMMARY.md`
- Commits `074e43f` and `bb4c7de` confirmed in git log

---
*Phase: 17-db-migration-project-archive*
*Completed: 2026-03-23*
