---
phase: 49-ma-schema-ui
plan: "02"
subsystem: server
tags: [ma, payroll, service, routes, tests]
dependency_graph:
  requires: [49-01]
  provides: [MA payroll entry fields in server stack, 6 MA columns in select]
  affects: [payrollService.ts, payroll.ts route, Phase 50 MA generator]
tech_stack:
  added: []
  patterns: [Drizzle onConflictDoUpdate, Zod nullable optional, supertest integration tests]
key_files:
  created: []
  modified:
    - src/server/services/payrollService.ts
    - src/server/routes/payroll.ts
    - tests/routes/payroll.test.ts
decisions:
  - checkNumber stored as nullable text (max 50 chars) matching schema column type
  - allOtherHours and totalWeekGrossWages stored as nullable real matching schema column type
  - Amendment clone copies MA fields verbatim — same pattern as nonPwHours (user-entered data, not computed)
  - isWoman, isMinority, oshaTraining added to getPayrollEntriesWithWorkerDetails select for Phase 50 generator consumption
metrics:
  duration: 5m
  completed: "2026-04-09T20:17:13Z"
  tasks_completed: 1
  files_modified: 3
---

# Phase 49 Plan 02: MA Payroll Entry Fields Server Stack Summary

MA payroll entry fields (checkNumber, allOtherHours, totalWeekGrossWages) wired end-to-end through Zod validation, service interface, upsert insert/update paths, amendment clone, and select query, with 6 MA columns added to getPayrollEntriesWithWorkerDetails for Phase 50 generator consumption.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Payroll service + route MA fields + select expansion + integration tests | ff93366 | src/server/services/payrollService.ts, src/server/routes/payroll.ts, tests/routes/payroll.test.ts |

## What Was Built

### UpsertEntrySchema (payroll.ts)

Added 3 nullable optional fields after `nonPwHours`:
- `checkNumber: z.string().max(50).nullable().optional()`
- `allOtherHours: z.number().min(0).nullable().optional()`
- `totalWeekGrossWages: z.number().min(0).nullable().optional()`

### UpsertPayrollEntryInput interface (payrollService.ts)

Added 3 nullable optional typed fields after `nonPwHours`:
- `checkNumber?: string | null`
- `allOtherHours?: number | null`
- `totalWeekGrossWages?: number | null`

### upsertPayrollEntry insert values

All 3 MA fields persisted with `?? null` fallback in the insert values object.

### onConflictDoUpdate set block

All 3 MA fields included in the update set so upserts overwrite existing values.

### Amendment clone

All 3 MA fields copied with `?? null` fallback — same pattern as nonPwHours since these are user-entered data fields.

### getPayrollEntriesWithWorkerDetails select

Added 6 new MA columns:
- Worker fields (for Phase 50 generator): `isWoman`, `isMinority`, `oshaTraining`
- Payroll entry fields: `checkNumber`, `allOtherHours`, `totalWeekGrossWages`

### Integration Tests

3 tests in `describe('MA payroll entry fields (MA-03)')`:
1. Create entry with MA fields and verify round-trip
2. Create entry with null MA fields and verify null values stored
3. Update entry and verify MA fields persisted after update

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `grep -c "checkNumber" src/server/services/payrollService.ts` = 5 (interface + insert + update set + select + amendment) ✓
- `grep -c "allOtherHours" src/server/services/payrollService.ts` = 5 ✓
- `grep -c "totalWeekGrossWages" src/server/services/payrollService.ts` = 5 ✓
- `grep -c "checkNumber" src/server/routes/payroll.ts` = 1 ✓
- `grep -c "isWoman" src/server/services/payrollService.ts` = 1 ✓
- `grep -c "MA payroll entry fields" tests/routes/payroll.test.ts` = 3 ✓
- `npx tsc --noEmit` — only pre-existing errors (workers.ts, audit.ts implicit any), 0 new errors ✓
- `npx vitest run tests/routes/payroll.test.ts` — 495 passed, 3 new MA tests pass, 2 pre-existing RED stubs in separate worktree file ✓

## Known Stubs

None.

## Self-Check: PASSED

- `src/server/services/payrollService.ts` — modified ✓
- `src/server/routes/payroll.ts` — modified ✓
- `tests/routes/payroll.test.ts` — modified ✓
- Commit ff93366 exists ✓
