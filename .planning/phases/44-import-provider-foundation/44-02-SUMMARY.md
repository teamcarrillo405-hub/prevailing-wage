---
phase: 44-import-provider-foundation
plan: "02"
subsystem: import-pipeline
tags: [gusto, csv-mapper, provider-detection, payroll-import, weekly-totals]
dependency_graph:
  requires:
    - importTypes.ts (ImportProvider union with 'gusto' — Plan 01)
    - importService.ts (detectProvider + parseImportFile — pre-existing)
  provides:
    - gustoMapper.ts (mapGustoRows, GustoAggregated)
    - Gusto detection in detectProvider
    - Gusto dispatch branch in parseImportFile
    - gustoWeeklyTotalsOnly flag on ImportPreviewResult
  affects:
    - src/server/services/importService.ts
    - tests/services/importService.test.ts
tech_stack:
  added: []
  patterns:
    - adpMapper.ts mirror pattern (weekly totals on Monday, emptyBuckets helper)
    - Required-column validation with descriptive error listing missing columns
    - Optional column defaulting (Overtime hours, Double overtime hours absent = 0)
    - parseFloat for hours (no new Date(string) constraint honored)
key_files:
  created:
    - src/server/services/gustoMapper.ts
  modified:
    - src/server/services/importService.ts
    - tests/services/importService.test.ts
decisions:
  - Gusto signature (4 columns) checked after QB and before ADP — more specific than ADP's 2-column signature
  - Overtime hours column is optional (zero-OT Gusto exports omit it entirely) — NOT a required column
  - Double overtime hours lumped into monOt bucket per IMPORT-01 ("if present, add to OT")
  - gustoWeeklyTotalsOnly: true const propagated from mapper to ImportPreviewResult analogously to adpWeeklyTotalsOnly
  - No new Date(string) for Payroll end date — date not needed for bucketing; left for future manual split per qbMapper pattern
metrics:
  duration_minutes: 4
  completed: "2026-04-07T06:33:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 44 Plan 02: Gusto CSV Mapper Summary

**One-liner:** `gustoMapper.ts` following adpMapper.ts pattern — weekly totals on Monday, first+last name concat, optional OT/DOT columns, required-column validation — wired into detectProvider and parseImportFile dispatch.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create gustoMapper.ts + add Gusto tests | 3438dcd | gustoMapper.ts, importService.test.ts |
| 2 | Integrate Gusto into importService.ts pipeline | 281cf19 | importService.ts |

## What Was Built

### gustoMapper.ts (Task 1)

- `GustoAggregated` interface: identical shape to `AdpAggregated` (csvName + 14 day-bucket fields all zeroed).
- `emptyBuckets()`: private helper, same pattern as adpMapper.
- `REQUIRED_COLS`: `['Employee first name', 'Employee last name', 'Regular hours', 'Payroll end date']` — validated against first row's keys (case-insensitive). Throws `Error('Gusto CSV is missing required columns: ...')` listing all missing columns if any are absent.
- `mapGustoRows(rows)`:
  - Skips rows where both first and last name are empty.
  - `csvName = "${firstName} ${lastName}".trim()`, key = `csvName.toLowerCase()`.
  - `Regular hours` -> `monSt` via `parseFloat`.
  - `Overtime hours` (optional column) -> `monOt` via `parseFloat`, defaults to 0 if column absent.
  - `Double overtime hours` (optional column) -> added to `monOt` (per IMPORT-01: "if present, add to OT bucket").
  - Returns `{ entries, gustoWeeklyTotalsOnly: true as const }`.
  - No `new Date(string)` — Payroll end date not needed for bucketing.

### importService.ts (Task 2)

- Added `GUSTO_SIGNATURE = ['Employee first name', 'Employee last name', 'Regular hours', 'Payroll end date']`.
- `detectProvider` return type extended: `'quickbooks' | 'adp' | 'gusto' | 'unknown'`.
- Gusto detection inserted between QB and ADP checks (4-column signature more specific than ADP's 2-column).
- `parseImportFile` mapper switch refactored from `if/else` to `if/else if/else` — explicit QB / Gusto / ADP branches.
- `gustoWeeklyTotalsOnly` declared alongside `adpWeeklyTotalsOnly`, set from `mapped.gustoWeeklyTotalsOnly`, propagated to `previewResult`.
- Import `mapGustoRows` from `./gustoMapper.js` added at top.
- Unknown provider error message updated: "Upload a QuickBooks, ADP, or Gusto payroll export."

### Tests (Task 1)

18 new Gusto tests added to `tests/services/importService.test.ts`:

**`detectProvider - Gusto` (6 tests):**
- Returns `'gusto'` for Gusto Payroll Journal Report headers
- Returns `'gusto'` with extra columns mixed in
- Returns `'gusto'` with only the 4 required signature columns (no overtime column)
- Case-insensitive for Gusto signature columns
- Does not return `'gusto'` for QB headers
- Does not return `'gusto'` for ADP headers

**`mapGustoRows` (12 tests):**
- Name concatenation -> `csvName` as "First Last"
- Keys by lowercase name
- Regular hours -> `monSt`; all other day buckets remain 0
- Overtime hours -> `monOt`
- Double overtime hours added to `monOt` bucket (4 OT + 2 DOT = 6 monOt)
- Aggregates multiple rows for same employee
- Returns `gustoWeeklyTotalsOnly: true`
- Throws descriptive error on missing required column
- Throws error listing ALL missing columns
- Skips rows with empty first AND last name
- Absent Overtime hours column defaults to 0 (not an error)
- Handles multiple different employees in same file

## Verification

- `npx vitest run tests/services/importService.test.ts`: 115/115 tests pass (97 pre-existing + 18 new Gusto)
- `npx tsc --noEmit`: 2 pre-existing errors in audit.ts and projects.ts (unrelated, out of scope). Zero errors in any modified or created file.
- `grep "mapGustoRows" src/server/services/importService.ts`: import and call present.
- `grep "gusto" src/server/services/importService.ts`: detection signature, return value, gustoWeeklyTotalsOnly var, conditional branch, and previewResult assignment all present.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — gustoMapper produces real parsed data from CSV rows. No placeholder values, no hardcoded empty returns, no TODO comments. The `gustoWeeklyTotalsOnly` flag flows through to `ImportPreviewResult` exactly as `adpWeeklyTotalsOnly` does, ready for the commit pipeline.

## Self-Check: PASSED

- `src/server/services/gustoMapper.ts`: FOUND (created)
- `src/server/services/importService.ts` (mapGustoRows import + gusto branch): FOUND (modified)
- `tests/services/importService.test.ts` (18 new Gusto tests): FOUND (modified)
- Commit 3438dcd (Task 1): FOUND
- Commit 281cf19 (Task 2): FOUND
- 115/115 tests pass: VERIFIED
- 0 TypeScript errors in modified files: VERIFIED
