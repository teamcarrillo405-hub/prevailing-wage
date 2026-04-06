---
phase: 42-il-schema-project-flag
plan: "02"
subsystem: api
tags: [routes, services, zod, illinois, demographics, payroll]
dependency_graph:
  requires: [il-schema-migration, il-drizzle-columns]
  provides: [il-worker-api, il-payroll-api]
  affects: [workers, payrollEntries]
tech_stack:
  added: []
  patterns: [zod-enum-validation, optional-nullable-threading, conditional-update-pattern]
key_files:
  created: []
  modified:
    - src/server/routes/workers.ts
    - src/server/services/workerService.ts
    - src/server/routes/payroll.ts
    - src/server/services/payrollService.ts
decisions:
  - "skillLevel uses z.enum(['journeyman', 'apprentice']) in Zod — not z.string() — per STATE-10 requirement for enum enforcement at API boundary"
  - "updateWorker uses 'field' in input pattern for IL demographics matching existing pattern for other optional nullable fields"
  - "nonPwHours copied verbatim in amendment clone (not reset to null) because it is user-entered data like ST/OT hours, not a computed field"
  - "Pre-existing TS7006 errors in audit.ts and projects.ts confirmed out of scope — no new errors introduced by this plan"
metrics:
  duration: "5 minutes"
  completed: "2026-04-06"
  tasks_completed: 2
  files_modified: 4
---

# Phase 42 Plan 02: IL Route and Service Layer Summary

**One-liner:** Threaded 5 IL demographic fields (race, ethnicity, gender, veteranStatus, skillLevel as enum) through worker Zod schemas and service create/update, and added nonPwHours through payroll entry Zod schema, service interface, upsert values, onConflict set, amendment clone, and getPayrollEntriesWithWorkerDetails select.

## What Was Built

### Task 1 — Workers route and service

**workers.ts — CreateWorkerSchema:** Added `race`, `ethnicity`, `gender`, `veteranStatus` as `z.string().max(100).optional()` and `skillLevel` as `z.enum(['journeyman', 'apprentice']).optional()`.

**workers.ts — UpdateWorkerSchema:** Added same 5 fields with `.nullable()` chained (update schema allows explicit null to clear fields).

**workers.ts — POST route:** Passes all 5 fields from validated body to `createWorker` call.

**workers.ts — PUT route:** Passes all 5 fields from validated body to `updateWorker` call.

**workerService.ts — CreateWorkerInput:** Added `race?`, `ethnicity?`, `gender?`, `veteranStatus?`, `skillLevel?` as `string | null`.

**workerService.ts — UpdateWorkerInput:** Added same 5 fields as `string | null`.

**workerService.ts — createWorker values:** Added all 5 fields with `?? null` fallback.

**workerService.ts — updateWorker updates:** Added conditional `'field' in input` checks for all 5 fields, matching the existing pattern for other optional nullable fields.

### Task 2 — Payroll route and service

**payroll.ts — UpsertEntrySchema:** Added `nonPwHours: z.number().min(0).nullable().optional()`.

**payrollService.ts — UpsertPayrollEntryInput:** Added `nonPwHours?: number | null`.

**payrollService.ts — upsertPayrollEntry values object:** Added `nonPwHours: input.nonPwHours ?? null`.

**payrollService.ts — onConflictDoUpdate set:** Added `nonPwHours: values.nonPwHours`.

**payrollService.ts — amendPayrollWeek clone loop:** Added `nonPwHours: entry.nonPwHours ?? null` (user-entered hours are preserved across amendments, unlike computed grossWages/netPay).

**payrollService.ts — getPayrollEntriesWithWorkerDetails select:** Added `nonPwHours: payrollEntries.nonPwHours` making it available to PayrollWeekDetailPage and all export generators.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add IL demographic fields to workers route and service | 3f2fd5c | src/server/routes/workers.ts, src/server/services/workerService.ts |
| 2 | Add nonPwHours to payroll route and service | 5ba3f4c | src/server/routes/payroll.ts, src/server/services/payrollService.ts |

## Verification Results

- Task 1: `grep -c "skillLevel" src/server/routes/workers.ts` returned `4` (CreateWorkerSchema, UpdateWorkerSchema, POST route body, PUT route body)
- Task 1: `grep -c "veteranStatus" src/server/services/workerService.ts` returned `4` (CreateWorkerInput, UpdateWorkerInput, createWorker values, updateWorker conditionals)
- Task 2: `grep -c "nonPwHours" src/server/routes/payroll.ts` returned `1` (UpsertEntrySchema)
- Task 2: `grep -c "nonPwHours" src/server/services/payrollService.ts` returned `5` (UpsertPayrollEntryInput, values, onConflictDoUpdate, amendment clone, getPayrollEntriesWithWorkerDetails)
- TypeScript: Only pre-existing TS7006 errors in audit.ts and projects.ts — no new errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan connects the schema layer to the API surface. No UI or export generators wired in this plan; those are Plan 03 scope.

## Self-Check: PASSED

- [x] `src/server/routes/workers.ts` — 5 IL demographic fields in both schemas and both route calls
- [x] `src/server/services/workerService.ts` — 5 IL demographic fields in both interfaces, createWorker values, updateWorker conditionals
- [x] `src/server/routes/payroll.ts` — nonPwHours in UpsertEntrySchema
- [x] `src/server/services/payrollService.ts` — nonPwHours in 5 locations
- [x] Commit `3f2fd5c` — exists (Task 1)
- [x] Commit `5ba3f4c` — exists (Task 2)
