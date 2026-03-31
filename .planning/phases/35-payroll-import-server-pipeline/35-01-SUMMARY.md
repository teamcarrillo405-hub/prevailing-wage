---
phase: 35-payroll-import-server-pipeline
plan: "01"
subsystem: import-pipeline
tags: [payroll-import, csv-parsing, quickbooks, adp, provider-detection, worker-matching, conflict-detection, migration]
dependency_graph:
  requires: []
  provides: [importTypes, qbMapper, adpMapper, importService, payrollImports-migration]
  affects: [schema, payroll-import-route-plan-02]
tech_stack:
  added: []
  patterns: [papaparse-server-parse, drizzle-sync-query, case-insensitive-worker-matching]
key_files:
  created:
    - src/server/db/migrations/0020_payroll_imports.sql
    - src/server/services/importTypes.ts
    - src/server/services/qbMapper.ts
    - src/server/services/adpMapper.ts
    - src/server/services/importService.ts
    - tests/services/importService.test.ts
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
decisions:
  - "QB mapper uses manual MM/DD/YYYY split parse — never raw new Date(string) — to avoid timezone issues"
  - "ADP hours placed on Monday only (weekly totals only — no daily breakdown in ADP Run)"
  - "detectProvider uses two QB signatures: Employee+Duration (Desktop) and Employee Name+Hours (Online)"
  - "Double Time payroll items mapped to OT bucket (no DT column in importTypes per research)"
  - "First active classification per worker used for rate snapshots (D-05 — contractor can adjust in Phase 36)"
  - "Conflict detection queries payrollEntries pre-insert — no reliance on DB unique constraint errors"
metrics:
  duration_seconds: 547
  completed_date: "2026-03-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 2
  tests_added: 24
  tests_passing: 24
---

# Phase 35 Plan 01: Import Service Layer Summary

**One-liner:** Payroll import pipeline with QB time-entry aggregation and ADP weekly-totals-to-Monday mapping, provider detection by column signature, case-insensitive worker matching, and conflict detection against existing payrollEntries.

## What Was Built

### Migration + Schema (Task 1)
- `0020_payroll_imports.sql` — `CREATE TABLE payroll_imports` audit table (one row per import commit)
- `_journal.json` updated with idx 16 entry `0020_payroll_imports`
- `schema.ts` extended with `payrollImports = sqliteTable('payroll_imports', ...)` Drizzle export
- `importTypes.ts` — shared TypeScript interfaces: `ImportedRow`, `UnmatchedRow`, `ConflictRow`, `ImportPreviewResult`

### QB + ADP Mappers + Import Service (Task 2)

**`qbMapper.ts` — `mapQbRows(rows, weekEndingDate)`:**
- Groups CSV rows by employee (case-insensitive key)
- Parses `MM/DD/YYYY` dates manually via `.split('/')` + `new Date(year, month-1, day)` — never `new Date(string)`
- Maps `getDay()` 0–6 to day prefix (sun/mon/tue/wed/thu/fri/sat)
- Detects OT from `Payroll Item` containing "overtime", " ot", or "double time" (case-insensitive)
- Supports QB Desktop (`Employee`/`Duration`/`Payroll Item`) and QB Online (`Employee Name`/`Hours`/`Service Item`)

**`adpMapper.ts` — `mapAdpRows(rows)`:**
- Concatenates `First Name` + `Last Name` with trim
- Places all hours on Monday: `monSt = Reg Hours`, `monOt = O/T Hours`
- Sums hours for duplicate employee rows
- Always returns `adpWeeklyTotalsOnly: true`

**`importService.ts` — `detectProvider(headers)` + `parseImportFile(buffer, weekId, projectId, db)`:**
- `detectProvider`: checks for QB (two signatures) and ADP column sets, case-insensitive
- `parseImportFile`: calls `buffer.toString('utf-8')` before `Papa.parse`; detects provider; maps rows; fetches project workers + wage classification rates; builds name lookup; queries existing `payrollEntries` for conflict set; buckets into `matched`/`unmatched`/`conflicts`

### Unit Tests (Task 3)
24 tests across 3 suites — all green:
- `detectProvider`: 7 tests (QB Desktop, QB Online, ADP, unknown, empty, case-insensitive for both)
- `mapQbRows`: 10 tests (day aggregation, OT detection, date parsing, QB Online variant, double time, Sunday, case-insensitive keys)
- `mapAdpRows`: 7 tests (monSt/monOt placement, adpWeeklyTotalsOnly, name concatenation, duplicate summing, multiple employees, missing O/T Hours)

## Decisions Made

1. **QB manual date parse** — `new Date(string)` with MM/DD/YYYY is unreliable across timezones; manual split-parse is correct and testable.
2. **ADP hours on Monday** — ADP Run has no daily breakdown; Monday placement is the documented decision per research (D-02) and plan critical notes.
3. **Double Time → OT bucket** — `importTypes.ts` has no `monDt` field; DT from QB is lumped into OT for preview purposes.
4. **Two QB signatures** — QB Desktop and QB Online have different column names; both are handled in `detectProvider` and `mapQbRows`.
5. **Conflict pre-check** — Conflict detection queries `payrollEntries` before any insert. DB unique constraint errors are NOT used as the conflict signal, per D-06.

## Deviations from Plan

None — plan executed exactly as written. Pre-existing TypeScript error in `src/server/routes/projects.ts` (implicit any on line 110/115) was present before this plan and is noted in CLAUDE.md as a known non-fatal issue.

## Known Stubs

None. All service functions are fully implemented. `parseImportFile` does live DB queries for workers, classifications, and rates. The `baseRateSnapshot`/`fringeRateSnapshot` fallback to 0 when no wage determination is assigned to the project — this is intentional (projects without a WD attached have no rates to snapshot; the contractor will see 0 in the Phase 36 review and can correct).

## Self-Check: PASSED

All files exist on disk. All commits verified in git log.

| File | Status |
|------|--------|
| src/server/db/migrations/0020_payroll_imports.sql | FOUND |
| src/server/services/importTypes.ts | FOUND |
| src/server/services/qbMapper.ts | FOUND |
| src/server/services/adpMapper.ts | FOUND |
| src/server/services/importService.ts | FOUND |
| tests/services/importService.test.ts | FOUND |

| Commit | Message |
|--------|---------|
| dc4a4a4 | feat(35-01): migration, schema, and shared import types |
| 9e5bf44 | feat(35-01): QB mapper, ADP mapper, and import service orchestrator |
| 746f002 | test(35-01): unit tests for import pipeline — 24 tests all green |
