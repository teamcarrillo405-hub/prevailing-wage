---
phase: 54-subcontractor-schema-migrations
plan: 01
subsystem: database
tags: [sqlite, drizzle-orm, migration, schema, subcontractor]

# Dependency graph
requires:
  - phase: 51-nj-schema-routes
    provides: 0031_nj_deductions migration at idx 27 — new journal entry must be idx 28
provides:
  - subcontractors table in SQLite with project-scoped sub registry
  - subcontractor_cpr_weeks table with weekly CPR receipt/compliance tracking
  - Drizzle schema exports subcontractors and subcontractorCprWeeks
affects:
  - 55-subcontractor-routes (depends on these tables for all route queries)
  - 56-subcontractor-ui (depends on routes built in phase 55)
  - 59-multi-project-compliance-pdf (CPR overdue counts from subcontractor_cpr_weeks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-table sub-registry pattern: parent table (subcontractors) + weekly tracking table (subcontractor_cpr_weeks) with UNIQUE on (subcontractor_id, week_ending_date)"
    - "Three-state compliance column: bare INTEGER with no DEFAULT and no NOT NULL — null=unassessed, 0=non-compliant, 1=compliant"
    - "--> statement-breakpoint between two CREATE TABLE statements in one migration file"

key-files:
  created:
    - src/server/db/migrations/0032_subcontractor_schema.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts

key-decisions:
  - "subcontractor_cpr_weeks uses weekEndingDate text (not payrollWeekId FK) — tracking is by calendar week, not internal payroll week record (locked in STATE.md SUB-02)"
  - "isCompliant stored as bare INTEGER with no mode or notNull — null=not assessed, 0=non-compliant, 1=compliant; adding mode:boolean would coerce null to false and destroy three-state semantics"
  - "Subcontractor model is per-project (not global) — subs may have different contacts/licenses per project; assertProjectAccess scopes via projectId"
  - "UNIQUE constraint inline in CREATE TABLE body (not separate CREATE UNIQUE INDEX) — matches payroll_provider_mappings pattern"
  - "No updatedAt on either table — REQUIREMENTS.md SUB-01 and SUB-02 specs do not include it"

patterns-established:
  - "Phase 54 pattern: pure schema phase — no routes, no UI; data foundation only"

requirements-completed: [SUB-01, SUB-02, NFR-01]

# Metrics
duration: 6min
completed: 2026-04-14
---

# Phase 54 Plan 01: Subcontractor Schema Migrations Summary

**Two-table SQLite schema for GC subcontractor CPR tracking: subcontractors (project-scoped registry) and subcontractor_cpr_weeks (weekly CPR receipt with three-state is_compliant INTEGER), migration registered at idx 28**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-14T08:55:50Z
- **Completed:** 2026-04-14T09:01:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created 0032_subcontractor_schema.sql with two CREATE TABLE statements and correct `--> statement-breakpoint` separator
- Registered migration at idx 28 in `_journal.json` (one day after idx 27 `0031_nj_deductions`)
- Appended `subcontractors` and `subcontractorCprWeeks` Drizzle table definitions to schema.ts with all required constraints
- Spot-checked via in-memory SQLite that both tables are created by the migrator
- All 596 main suite tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration SQL and register in journal** - `f7189c5` (feat)
2. **Task 2: Append Drizzle schema table definitions** - `0dea566` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/server/db/migrations/0032_subcontractor_schema.sql` - Two CREATE TABLE statements for subcontractors and subcontractor_cpr_weeks with `--> statement-breakpoint` separator
- `src/server/db/migrations/meta/_journal.json` - Added idx 28 entry with tag `0032_subcontractor_schema`, when 1744416000000
- `src/server/db/schema.ts` - Appended `subcontractors` and `subcontractorCprWeeks` sqliteTable exports after auditLogs definition

## Decisions Made
- `isCompliant` defined as bare `integer('is_compliant')` with no `{ mode: 'boolean' }` and no `.notNull()` — preserves three-state null/0/1 semantics required by SUB-02
- `weekEndingDate` is plain text ISO 8601 date string, not a FK to payrollWeeks — tracking is by calendar week per STATE.md decision lock
- `uniqueIndex` (not `index`) used for `subCprWeekUnique` — uniqueness must be enforced at DB level, not just informational
- No `updatedAt` on either table — not in SUB-01/SUB-02 specs

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Worktree tests (`.claude/worktrees/agent-*`) appeared in vitest output and showed failures — these are pre-existing failures from other agent workstreams, not related to this plan. Main suite (`--exclude "**/.claude/**"`) shows 596 tests passing with no failures.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Both tables exist in SQLite after migration runs; journal registered at idx 28
- Drizzle schema exports `subcontractors` and `subcontractorCprWeeks` ready for Phase 55 route imports
- TypeScript compiles clean for schema.ts (2 pre-existing implicit-any errors in audit.ts and projects.ts are unrelated)
- Phase 55 (subcontractor routes) can now be executed

---
*Phase: 54-subcontractor-schema-migrations*
*Completed: 2026-04-14*
