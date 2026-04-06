---
phase: 41-ny-state-forms
plan: 01
subsystem: database
tags: [drizzle, sqlite, migration, payroll, ny]

# Dependency graph
requires:
  - phase: 40-ny-schema-compliance-rule
    provides: nysRegisteredApprentice column on workers table and NY compliance rule
provides:
  - ny_mpwr_submitted_at column on payroll_weeks table (migration 0024)
  - nyMpwrSubmittedAt in Drizzle schema for payrollWeeks
  - nysRegisteredApprentice field in getPayrollEntriesWithWorkerDetails query result
affects: [41-02, 41-03, 41-04, 41-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [Single-statement ALTER TABLE migration with no statement-breakpoint needed, Additive select field pattern for getPayrollEntriesWithWorkerDetails]

key-files:
  created:
    - src/server/db/migrations/0024_ny_mpwr_submission.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/services/payrollService.ts

key-decisions:
  - "No statement-breakpoint in 0024 migration — single ALTER TABLE statement needs no separator"
  - "getPayrollWeek uses select * so nyMpwrSubmittedAt automatically available; no change needed there"
  - "nysRegisteredApprentice added to getPayrollEntriesWithWorkerDetails select only — workers table already joined, purely additive"

patterns-established:
  - "NY agency submission timestamp follows caEcprSubmittedAt/waLniSubmittedAt pattern: nullable text column"

requirements-completed: [STATE-03, STATE-05, NFR-01, NFR-05]

# Metrics
duration: 8min
completed: 2026-04-02
---

# Phase 41 Plan 01: Migration + Payroll Query Patch Summary

**SQLite migration 0024 adds ny_mpwr_submitted_at to payroll_weeks; getPayrollEntriesWithWorkerDetails now returns nysRegisteredApprentice per row**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-02T00:05:30Z
- **Completed:** 2026-04-02T00:13:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Migration 0024 created with single `ALTER TABLE payroll_weeks ADD COLUMN ny_mpwr_submitted_at TEXT`
- Journal registered at idx 20, tag `0024_ny_mpwr_submission`, breakpoints true
- `nyMpwrSubmittedAt: text('ny_mpwr_submitted_at')` added to payrollWeeks schema adjacent to CA/WA submission fields
- `nysRegisteredApprentice: workers.nysRegisteredApprentice` added to `getPayrollEntriesWithWorkerDetails` select (workers table already joined)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration 0024 and update Drizzle schema** - `2759a20` (feat)
2. **Task 2: Patch getPayrollEntriesWithWorkerDetails to include nysRegisteredApprentice** - `b06284f` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `src/server/db/migrations/0024_ny_mpwr_submission.sql` - Single ALTER TABLE ADD COLUMN for ny_mpwr_submitted_at
- `src/server/db/migrations/meta/_journal.json` - Entry added at idx 20
- `src/server/db/schema.ts` - nyMpwrSubmittedAt added to payrollWeeks table definition
- `src/server/services/payrollService.ts` - nysRegisteredApprentice added to getPayrollEntriesWithWorkerDetails select

## Decisions Made
- Single-statement migration needs no `statement-breakpoint` separator — only multi-statement migrations require it (as seen in 0023)
- `getPayrollWeek` uses `db.select()` (wildcard) and automatically returns `nyMpwrSubmittedAt` now that the schema is updated — no explicit change needed
- Pre-existing TypeScript errors in `audit.ts` and `projects.ts` are out of scope; confirmed pre-existing via git stash verification

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Two pre-existing TypeScript errors (`audit.ts:56` and `projects.ts:121`) flagged by `tsc --noEmit`; confirmed pre-existing before this plan's changes via `git stash` verification; out of scope per deviation scope boundary rule.

## User Setup Required
None - no external service configuration required. Migration will run automatically at next server start via Drizzle migrate.

## Next Phase Readiness
- `payrollWeeks.nyMpwrSubmittedAt` column available in DB schema and migration
- `getPayrollEntriesWithWorkerDetails` returns `nysRegisteredApprentice` per row
- Plans 02-05 (MPWR XML generator, NY submit route, 3-step modal, PW-12 PDF) can now proceed

---
*Phase: 41-ny-state-forms*
*Completed: 2026-04-02*
