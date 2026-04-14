---
phase: 52-nj-pdf-generator
plan: "01"
subsystem: payroll-data
tags: [nj, db-migration, schema, payroll-service, ui]
dependency_graph:
  requires: [51-02]
  provides: [52-02]
  affects: [payrollService, PayrollWeekForm, PayrollEntryPage]
tech_stack:
  added: []
  patterns: [nullable-real-column, state-gated-ui-section, drizzle-select-extension]
key_files:
  created:
    - src/server/db/migrations/0031_nj_deductions.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/services/payrollService.ts
    - src/client/pages/PayrollEntryPage.tsx
    - src/client/components/PayrollWeekForm.tsx
decisions:
  - ficaTax/federalIncomeTax/stateIncomeTax use nullable real() with no .notNull()/.default() — matches fringeHealthWelfare pattern
  - Amendment clone carries ficaTax/federalIncomeTax/stateIncomeTax verbatim per 29 CFR Part 3 (user-entered data, not computed)
  - NJ deduction fields omitted from onSubmit payload when isNJ=false (|| null guard)
metrics:
  duration_seconds: 256
  completed_date: "2026-04-13"
  tasks_completed: 2
  files_modified: 5
  files_created: 1
---

# Phase 52 Plan 01: NJ Deductions DB + Service + UI Summary

**One-liner:** Three nullable REAL deduction columns (fica_tax, federal_income_tax, state_income_tax) added to payroll_entries via migration 0031, Drizzle schema extended, payrollService query extended with NJ EEO worker fields, and indigo-styled NJ deduction input section added to PayrollWeekForm.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | DB migration + schema.ts for NJ deduction columns | 7bc0e8d | 0031_nj_deductions.sql, _journal.json, schema.ts |
| 2 | payrollService.ts extension + PayrollWeekForm NJ UI | 969669d | payrollService.ts, PayrollEntryPage.tsx, PayrollWeekForm.tsx |

## What Was Built

### Task 1: DB Migration + Schema
- Created `src/server/db/migrations/0031_nj_deductions.sql` with 3 ALTER TABLE statements and 2 `-->statement-breakpoint` separators
- Registered migration as idx 27 (`0031_nj_deductions`) in `meta/_journal.json`
- Added `ficaTax: real('fica_tax')`, `federalIncomeTax: real('federal_income_tax')`, `stateIncomeTax: real('state_income_tax')` to `payrollEntries` table in schema.ts — nullable, no `.notNull()`, no `.default()`

### Task 2: Service Extension + UI
- Extended `getPayrollEntriesWithWorkerDetails` select to include: `workerSex`, `race`, `ethnicity` (Phase 51/42 worker columns for NJ EEO), plus `ficaTax`, `federalIncomeTax`, `stateIncomeTax` from payrollEntries
- Added `ficaTax`, `federalIncomeTax`, `stateIncomeTax` to `UpsertPayrollEntryInput` type, insert values block, onConflictDoUpdate set block, and amendment clone
- Added `isNJ` constant to `PayrollEntryPage.tsx` (pattern: `state?.toUpperCase() === 'NJ'`) and passed as prop to `PayrollWeekForm`
- Added `isNJ?: boolean` to `PayrollWeekFormProps`, three fields to `PayrollWeekFormValues`, defaults in `useForm`, NJ spread in `onSubmit`, and indigo-styled NJ Deductions section in JSX (gated by `isNJ`)

## Verification

- `npx vitest run tests/services/payrollService.test.ts`: 51 tests pass (17 test files)
- `npx vitest run`: 4768 tests pass; 17 pre-existing RED stub failures in worktree directories are not caused by this plan
- `npx tsc --noEmit`: Only 2 pre-existing implicit-any errors in audit.ts and projects.ts (unrelated to Phase 52)

## Deviations from Plan

### Auto-additions (Rule 2: Missing critical functionality)

**1. [Rule 2 - Missing] Added ficaTax/federalIncomeTax/stateIncomeTax to UpsertPayrollEntryInput type**
- Found during: Task 2
- Issue: Plan specified adding to the select query but the input type, insert values, update set, and amendment clone also needed updating for end-to-end data flow
- Fix: Added to all four locations in payrollService.ts
- Files modified: src/server/services/payrollService.ts
- Commits: 969669d

## Known Stubs

None — all wired end-to-end. NJ deduction fields are stored in DB on submit. Phase 52 Plan 02 will consume ficaTax/federalIncomeTax/stateIncomeTax from the query for the NJ MW-562 PDF generator.

## Self-Check: PASSED
