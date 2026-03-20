---
phase: 06
plan: 02
subsystem: database / workers-route / payroll-service
tags: [schema, migration, programName, apprentice, workerClassifications]
dependency_graph:
  requires: [06-01]
  provides: [programName column in DB, programName in API responses, programName in payroll entries]
  affects: [06-04 (certApprentices logic reads row.programName)]
tech_stack:
  added: []
  patterns: [drizzle ALTER TABLE migration, zod optional field, SELECT shape extension]
key_files:
  created:
    - src/server/db/migrations/0008_program_name.sql
    - src/server/db/migrations/0003_workers_address.sql
  modified:
    - src/server/db/schema.ts
    - src/server/routes/workers.ts
    - src/server/services/payrollService.ts
    - src/server/db/migrations/meta/_journal.json
decisions:
  - Migration journal must be updated manually when adding SQL-only migrations outside Drizzle generate workflow
  - programName is optional on all laborTypes (not server-restricted to apprentice) — keeps the API flexible
metrics:
  duration: "~5 minutes"
  completed: "2026-03-20"
  tasks_completed: 3
  files_modified: 6
---

# Phase 6 Plan 02: programName Field — Schema, Migration, Route, Service Summary

**One-liner:** Added nullable `program_name` TEXT column to `worker_classifications` via SQLite ALTER TABLE migration, propagated through Zod schema validation, DB insert, and getPayrollEntries() SELECT join.

## What Was Built

The `programName` field is now stored and retrievable throughout the backend stack:

1. **Schema** (`schema.ts`): `programName: text('program_name')` added between `apprenticePercent` and `isActive` on `workerClassifications`.
2. **Migration** (`0008_program_name.sql`): `ALTER TABLE worker_classifications ADD COLUMN program_name TEXT` — SQLite nullable ADD COLUMN.
3. **Route** (`workers.ts`): `CreateClassificationSchema` accepts `programName: z.string().max(200).optional()`. Insert block stores `programName: body.programName ?? null`.
4. **Service** (`payrollService.ts`): `getPayrollEntries()` SELECT shape includes `programName: workerClassifications.programName`. TypeScript infers the return type with `programName: string | null` per row.

## Live Database Instructions

After deploying these changes, apply the migration to the live SQLite database:

```bash
sqlite3 ./data/prevailing-wage.db < src/server/db/migrations/0008_program_name.sql
```

Also apply the address migration if not already done on the live DB:

```bash
sqlite3 ./data/prevailing-wage.db < src/server/db/migrations/0003_workers_address.sql
```

Verify the columns exist:

```bash
sqlite3 ./data/prevailing-wage.db "PRAGMA table_info(worker_classifications);"
sqlite3 ./data/prevailing-wage.db "PRAGMA table_info(workers);"
```

**Server restart required:** After saving server-side files, restart the server on port 4099:

```bash
# Stop current tsx process, then:
npx tsx src/server/index.ts
```

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Schema + migration SQL | 86f5ffd | schema.ts, 0008_program_name.sql |
| 2 | Accept programName in route | e958dd6 | workers.ts, 0003_workers_address.sql, _journal.json |
| 3 | Add programName to getPayrollEntries | 69a160f | payrollService.ts |

## Verification Results

```
Test Files  1 failed | 15 passed | 7 skipped (23)
Tests       1 failed | 153 passed | 42 todo (196)
```

- workers.test.ts: 2/2 tests green (programName persists, GET returns programName)
- payrollService.test.ts: 3/3 tests green (no regressions)
- wh347.test.ts multi-page stub: 1 still red (expected — Plan 03 not yet run)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing migration for workers.address column**
- **Found during:** Task 2 verification — both workers tests were returning 500 due to `SqliteError: table workers has no column named address`
- **Issue:** The `address` column exists in `schema.ts` and was noted in STATE.md as "added via ALTER TABLE", but no migration file existed. The Drizzle migrator builds the test in-memory DB from migrations only, so tests could never pass.
- **Fix:** Created `0003_workers_address.sql` with `ALTER TABLE workers ADD COLUMN address TEXT` and registered it in `_journal.json` at idx 3.
- **Files modified:** `src/server/db/migrations/0003_workers_address.sql`, `src/server/db/migrations/meta/_journal.json`
- **Commit:** e958dd6

**2. [Rule 3 - Blocking] Migration journal not updated for new SQL files**
- **Found during:** Task 1 verification — after creating 0008_program_name.sql, the test DB still lacked the column
- **Issue:** Drizzle's `migrate()` function reads `meta/_journal.json` to determine which files to run. SQL files not registered in the journal are silently ignored.
- **Fix:** Added entries for `0003_workers_address` (idx 3) and `0008_program_name` (idx 4) to `_journal.json`.
- **Files modified:** `src/server/db/migrations/meta/_journal.json`
- **Commit:** e958dd6

## Self-Check: PASSED

Files exist:
- src/server/db/migrations/0008_program_name.sql: FOUND
- src/server/db/migrations/0003_workers_address.sql: FOUND
- src/server/db/schema.ts: FOUND (programName column added)
- src/server/routes/workers.ts: FOUND (programName in schema and insert)
- src/server/services/payrollService.ts: FOUND (programName in SELECT)

Commits exist:
- 86f5ffd: FOUND
- e958dd6: FOUND
- 69a160f: FOUND
