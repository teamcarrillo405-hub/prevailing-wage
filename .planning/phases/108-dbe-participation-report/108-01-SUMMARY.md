---
phase: 108-dbe-participation-report
plan: 01
subsystem: DBE / Payroll
tags: [dbe, schema, migration, import-pipeline]
dependency_graph:
  requires: [107-01]
  provides: [payroll_subcontractor_fk, import_subcontractorId_passthrough]
  affects: [108-02, 109-01]
tech_stack:
  added: []
  patterns: [drizzle-nullable-fk, zod-optional-uuid, set-null-on-delete]
key_files:
  created:
    - src/server/db/migrations/0065_payroll_entry_sub_fk.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/routes/payroll.ts
    - src/server/routes/import.ts
    - src/server/services/payrollService.ts
    - src/server/services/importTypes.ts
decisions:
  - "Added subcontractorId to UpsertPayrollEntryInput and upsertPayrollEntry values/onConflictDoUpdate to handle both create and update paths"
  - "ImportedRow extended in importTypes.ts (shared type) — silent null validation in import.ts commit route (no error thrown)"
metrics:
  duration: "~8 min"
  completed: "2026-04-27"
  tasks_completed: 2
  files_modified: 7
requirements: [DBE-08]
---

# Phase 108 Plan 01: subcontractor_id FK on payroll_entries Summary

Nullable subcontractor FK (subcontractor_id) added to payroll_entries — migration 0065, schema update, payroll route and import pipeline extended to accept and stamp subcontractorId silently.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration 0065 + schema.ts subcontractorId FK | d56391c | 0065_payroll_entry_sub_fk.sql, schema.ts |
| 2 | Payroll route + import pipeline subcontractorId | d56391c | payroll.ts, import.ts, payrollService.ts, importTypes.ts |

## Deviations from Plan

None — plan executed exactly as written. ImportedRow type extended in importTypes.ts (shared contract file) rather than locally per Rule 2 correctness.

## Self-Check: PASSED

- Migration 0065 exists: src/server/db/migrations/0065_payroll_entry_sub_fk.sql — FOUND
- Journal has idx=65 entry — FOUND
- schema.ts payrollEntries exports subcontractorId with FK reference — FOUND
- payroll.ts UpsertEntrySchema includes subcontractorId optional uuid — FOUND
- import.ts commit route validates subcontractorId against project subs and stamps resolvedSubId — FOUND
- TypeScript: 0 errors; 824 tests passing
