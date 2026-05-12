---
phase: 126-integration-foundation
plan: 01
subsystem: database
tags: [sqlite, drizzle, migrations, erp, integration]

# Dependency graph
requires:
  - phase: 117-apprenticeship-ratio-dashboard
    provides: last completed phase before v9.0 integration work
provides:
  - integration_connections SQLite table (11 cols, user_id FK, 2 indexes)
  - integration_sync_runs SQLite table (9 cols, connection_id FK, 1 index)
  - busy_timeout=5000 pragma in db/index.ts (INTG-03)
  - migration 0070 registered at idx 70 in _journal.json
  - Drizzle schema exports integrationConnections and integrationSyncRuns
affects: [127-procore-sync, 128-sage300-sync, 129-vista-sync, 130-134-erp-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [add-alongside pattern for new tables (D-01), statement-breakpoint SQL migration, $type<> narrowing on Drizzle text columns]

key-files:
  created:
    - src/server/db/migrations/0070_integration_foundation.sql
    - tests/server/integration-foundation-schema.test.ts
  modified:
    - src/server/db/index.ts
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts

key-decisions:
  - "busy_timeout=5000 at line 14 of db/index.ts — after WAL and foreign_keys pragmas, not before"
  - "integrationConnections and integrationSyncRuns placed between procoreTokens block and securityEvents block in schema.ts"
  - "credentials_encrypted and file_path_config are nullable — no notNull() per D-02"
  - "erp_type $type<'procore' | 'sage300' | 'vista'>() on both tables; trigger $type<'cron' | 'manual'>() on sync_runs"
  - "journal timestamp 1778000000000 chosen for determinism (greater than last idx=69 at 1777737000000)"

patterns-established:
  - "Phase 126 pattern: add-alongside new integration tables rather than altering procore_tokens"
  - "In-memory SQLite roundtrip tests: split on --> statement-breakpoint, exec each statement, insert rows, assert values"

requirements-completed: [INTG-02, INTG-03]

# Metrics
duration: 8min
completed: 2026-05-12
---

# Phase 126 Plan 01: Integration Foundation Summary

**SQLite integration foundation: migration 0070 creates integration_connections (11 cols) and integration_sync_runs (9 cols) tables with busy_timeout=5000 pragma enabling non-blocking nightly ERP sync**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-12T15:29:08Z
- **Completed:** 2026-05-12T15:37:00Z
- **Tasks:** 2
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments
- Added `busy_timeout=5000` pragma to `db/index.ts` at line 14, preventing SQLITE_BUSY errors when nightly ERP sync overlaps payroll writes (INTG-03)
- Created migration `0070_integration_foundation.sql` with both tables, 4 statement-breakpoints, 3 indexes, and cascade FK from sync_runs to connections
- Registered migration as idx 70 in `_journal.json` so Drizzle migrator applies it on startup
- Added `integrationConnections` and `integrationSyncRuns` Drizzle schema exports with `$type<>()` narrowing on erp_type, sync_status, and trigger columns
- All 3 tests in `tests/server/integration-foundation-schema.test.ts` pass (pragma assertion + migration roundtrip + journal registration)

## Task Commits

Each task was committed atomically:

1. **Task 1: busy_timeout pragma + test file** - `9b7b4b3` (feat)
2. **Task 2: migration 0070 + journal + Drizzle schema** - `3249b33` (feat)

## Files Created/Modified
- `src/server/db/index.ts` - Added busy_timeout=5000 pragma (line 14)
- `src/server/db/migrations/0070_integration_foundation.sql` - DDL for both new tables with indexes and FK
- `src/server/db/migrations/meta/_journal.json` - Added idx 70 entry for 0070_integration_foundation
- `src/server/db/schema.ts` - Added integrationConnections and integrationSyncRuns exports
- `tests/server/integration-foundation-schema.test.ts` - 3 tests covering pragma, migration roundtrip, and journal registration

## Decisions Made
- `busy_timeout` inserted immediately after `foreign_keys = ON` per plan spec — WAL and foreign_keys pragmas untouched
- Tables inserted between `procoreTokens` and `securityEvents` in schema.ts per add-alongside pattern (D-01)
- Pre-existing TS errors in `CopilotWidget.tsx` confirmed pre-existing (not in git diff) — out of scope per deviation scope boundary rule

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `CopilotWidget.tsx` surfaced in `tsc --noEmit` output — confirmed pre-existing by checking `git diff --name-only` (file not modified by this plan). Treated as out-of-scope per deviation scope boundary rule.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 127-134 (ERP sync phases) can now begin — both dependency tables exist in migration and Drizzle schema
- Drizzle migrator will apply migration 0070 on next server startup in production
- No blockers

---
*Phase: 126-integration-foundation*
*Completed: 2026-05-12*
