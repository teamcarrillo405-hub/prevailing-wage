---
phase: 49-ma-schema-ui
plan: 01
subsystem: db-migration, server-routes, client-ui, tests
tags: [ma, schema, migration, workers, demographics, drizzle]
dependency_graph:
  requires: []
  provides: [ma-db-columns, ma-worker-ui, ma-route-fields]
  affects: [workers-route, workers-page, worker-service, schema]
tech_stack:
  added: []
  patterns: [nullable-boolean-columns, state-gate-ui, drizzle-integer-boolean]
key_files:
  created:
    - src/server/db/migrations/0029_ma_schema.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/routes/workers.ts
    - src/server/services/workerService.ts
    - src/client/pages/WorkersPage.tsx
    - tests/routes/workers.test.ts
decisions:
  - MA nullable booleans use integer({ mode: 'boolean' }) with no .notNull()/.default() — workers may decline to self-identify
  - MA/NJ dual gate (isMA || isNJ) for UI sections — NJ reuses same fields per v5.0 plan
  - Checkboxes default to unchecked (false) in edit form, but persist as null server-side when worker has not set them
  - workerService.ts updated alongside route to keep interface/service in sync
metrics:
  duration: ~20 minutes
  completed: "2026-04-09"
  tasks_completed: 2
  files_changed: 7
---

# Phase 49 Plan 01: MA Schema + UI — Data Foundation Summary

**One-liner:** Added all 8 MA DB columns (migration 0029, journal idx 25, Drizzle schema) and wired isWoman/isMinority/oshaTraining nullable boolean checkboxes into WorkersPage for MA and NJ projects with 4 passing integration tests.

## What Was Built

### Task 1: Migration SQL + journal + Drizzle schema

- `0029_ma_schema.sql`: 8 ALTER TABLE statements with exactly 7 `--> statement-breakpoint` separators
  - `workers`: `is_woman INTEGER`, `is_minority INTEGER`, `osha_training INTEGER`
  - `payroll_entries`: `check_number TEXT`, `all_other_hours REAL`, `total_week_gross_wages REAL`
  - `projects`: `ma_dls_project_id TEXT`, `ma_sic_code TEXT`
- `_journal.json`: Added idx 25 entry `0029_ma_schema` with `when: 1744156800000` (April 9 2026 00:00:00 UTC)
- `schema.ts`: All 8 nullable columns declared with correct Drizzle types (integer boolean mode for booleans, text/real for others), no `.notNull()` or `.default()`

### Task 2: WorkersPage MA/NJ + workers route + tests

- `workers.ts` routes: Added `isWoman`, `isMinority`, `oshaTraining` to `CreateWorkerSchema` (optional) and `UpdateWorkerSchema` (optional + nullable); wired into create and update handlers
- `workerService.ts`: Extended `CreateWorkerInput` and `UpdateWorkerInput` interfaces; added columns to `db.insert(workers)` call and `updateWorker()` partial update handler
- `WorkersPage.tsx`:
  - `isMA` and `isNJ` state gates added after existing `isIL`
  - `Worker` interface extended with 3 new nullable boolean fields
  - `workerToEditForm()` maps `w.isWoman ?? null` etc. for edit population
  - `editForm` useState includes `isWoman: null as boolean | null` etc.
  - Update mutation payload: `...(isMA || isNJ ? { isWoman, isMinority, oshaTraining } : {})`
  - Edit form JSX: `{(isMA || isNJ) && (<details>` section with 3 checkboxes, teal styling, open by default
  - Read-only card: shows `Woman: Yes/No/--`, `Minority: Yes/No/--`, `OSHA 10: Yes/No/--` when MA/NJ
- `workers.test.ts`: Added `createMaProject()` helper + `describe('MA worker demographics (MA-02)')` with 4 tests:
  1. Create with all 3 booleans true — asserts they persist
  2. Create without MA fields — asserts all are null
  3. Update single field (isWoman: true) — asserts selective partial update
  4. Set isWoman back to null — asserts null round-trip

## Verification Results

- `grep -c "statement-breakpoint" 0029_ma_schema.sql` → 7 ✓
- `grep -c "0029_ma_schema" _journal.json` → 1 ✓
- `grep "idx.*25" _journal.json` → matches ✓
- All 8 new columns in `schema.ts` → 8 matches ✓
- `npx tsc --noEmit` → passes (only pre-existing known errors remain) ✓
- `npx vitest run tests/routes/workers.test.ts` → 58 passed, 0 failed ✓
- `grep "isMA || isNJ" WorkersPage.tsx` → 3 matches (payload gate, edit JSX, read-only display) ✓

## Deviations from Plan

None - plan executed exactly as written. The plan indicated adding to the route handler only, but `workerService.ts` (the actual DB layer) required the same changes for correctness — this is a Rule 2 addition (missing critical functionality to wire the columns through to the DB).

**Auto-fix: Updated workerService.ts interfaces + insert/update**
- Found during: Task 2
- Issue: Route handler body fields would be passed to workerService but interfaces and DB insert/update code didn't reference them
- Fix: Added MA fields to `CreateWorkerInput`/`UpdateWorkerInput` interfaces, `db.insert()` call, and `updateWorker()` partial update
- Files modified: `src/server/services/workerService.ts`
- Commit: de6c162

## Known Stubs

None — all columns are properly wired from DB migration through schema → service → route → UI.

## Self-Check: PASSED

Files exist:
- `/c/Users/glcar/prevailing-wage/src/server/db/migrations/0029_ma_schema.sql` ✓
- `/c/Users/glcar/prevailing-wage/src/server/db/migrations/meta/_journal.json` (updated) ✓
- `/c/Users/glcar/prevailing-wage/src/server/db/schema.ts` (updated) ✓
- `/c/Users/glcar/prevailing-wage/src/server/routes/workers.ts` (updated) ✓
- `/c/Users/glcar/prevailing-wage/src/server/services/workerService.ts` (updated) ✓
- `/c/Users/glcar/prevailing-wage/src/client/pages/WorkersPage.tsx` (updated) ✓
- `/c/Users/glcar/prevailing-wage/tests/routes/workers.test.ts` (updated) ✓

Commits exist:
- 2464545 feat(49-01): MA DB migration, journal idx 25, and Drizzle schema columns ✓
- de6c162 feat(49-01): WorkersPage MA/NJ demographics + workers route + integration tests ✓
