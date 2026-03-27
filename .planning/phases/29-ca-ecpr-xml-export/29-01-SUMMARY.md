---
phase: 29-ca-ecpr-xml-export
plan: "01"
subsystem: db-schema, payroll-service, payroll-route, project-route, payroll-form
tags: [migration, schema, service, fringe, CA-eCPR, xmlbuilder2]
dependency_graph:
  requires: []
  provides: [fringe-columns-migration, getPayrollEntriesWithWorkerDetails, CA-fringe-form-UI]
  affects: [plan-29-02, plan-29-03]
tech_stack:
  added: [xmlbuilder2@4.0.3]
  patterns: [drizzle-add-only-migration, zod-schema-extension, react-hook-form-watch]
key_files:
  created:
    - src/server/db/migrations/0014_ca_ecpr_fringe_columns.sql
  modified:
    - package.json
    - package-lock.json
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/services/payrollService.ts
    - src/server/routes/projects.ts
    - src/server/routes/payroll.ts
    - src/client/components/PayrollWeekForm.tsx
decisions:
  - "fringe sub-columns are nullable REAL; null = non-CA entry, 0 = explicitly entered zero"
  - "fringeRateSnapshot auto-summed from 4 CA fields via useEffect watch in PayrollWeekForm"
  - "getPayrollEntriesWithWorkerDetails is a new export alongside existing getPayrollEntries — not a replacement"
  - "UpsertEntrySchema extended with optional nullable fringe fields to prevent Zod strip silently dropping them"
metrics:
  duration_seconds: 272
  completed_date: "2026-03-26"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 8
  files_created: 1
---

# Phase 29 Plan 01: CA eCPR Foundation — DB Migration, Schema, Extended Join, Fringe UI Summary

**One-liner:** 8-column DB migration (4 fringe sub-columns on payroll_entries, 4 CA eCPR fields on projects) + xmlbuilder2 install + extended payroll join + CA fringe disaggregation UI with auto-sum.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install xmlbuilder2 + DB migration + schema + route updates | bb89d32 | package.json, 0014_ca_ecpr_fringe_columns.sql, _journal.json, schema.ts, payrollService.ts, projects.ts, payroll.ts |
| 2 | CA fringe disaggregation UI in PayrollWeekForm | 0f973cc | PayrollWeekForm.tsx |

## What Was Built

### DB Migration (0014_ca_ecpr_fringe_columns.sql)
8 `ALTER TABLE` statements adding:
- `payroll_entries`: `fringe_health_welfare`, `fringe_pension`, `fringe_vacation`, `fringe_training` (all REAL nullable)
- `projects`: `contractor_fein`, `dir_project_id`, `awarding_agency`, `contract_number` (all TEXT nullable)

Registered at idx 10 in `_journal.json`.

### Drizzle Schema (schema.ts)
- `payrollEntries` table: 4 new nullable real columns with Phase 29 comment block
- `projects` table: 4 new nullable text columns with Phase 29 comment block

### payrollService.ts
- `UpsertPayrollEntryInput` interface: 4 fringe sub-fields added (`fringeHealthWelfare?: number | null`, etc.)
- `upsertPayrollEntry()`: 4 fields added to `values` object and `onConflictDoUpdate` set
- `getPayrollEntriesWithWorkerDetails(weekId)`: new exported function with extended join selecting worker SSN last 4, address, trade code, WA trade code, labor type, program name

### projects.ts
- `UpdateProjectSchema`: extended with `contractorFein`, `dirProjectId`, `awardingAgency`, `contractNumber` (all optional, with max-length constraints)

### payroll.ts
- `UpsertEntrySchema`: extended with 4 fringe sub-fields (`fringeHealthWelfare: z.number().min(0).nullable().optional()`, etc.) to prevent Zod stripping from req.body

### PayrollWeekForm.tsx
- `PayrollWeekFormValues` interface: 4 fringe fields added
- `defaultValues`: 4 fringe fields initialized to 0
- `useEffect` + `watch`: auto-sums 4 CA fringe fields into `fringeRate` when `isCA` is true
- CA fringe UI block: amber-bordered panel with 4 labeled per-hour inputs — conditionally shown when `isCA`
- Submit body: spreads fringe sub-fields into entry payload when `isCA`
- Non-CA form: unchanged — hidden `fringeRate` input retained for direct value entry

## Verification Results

All automated checks pass:
- `node -e "require('xmlbuilder2')"` succeeds
- Migration file contains exactly 8 ALTER TABLE statements
- Journal contains idx 10 entry with correct tag
- schema.ts contains `fringeHealthWelfare: real('fringe_health_welfare')` in payrollEntries
- schema.ts contains `contractorFein: text('contractor_fein')` in projects
- payrollService.ts exports `getPayrollEntriesWithWorkerDetails` with `workerSsnLast4: workers.ssnLast4`
- `UpsertPayrollEntryInput` contains `fringeHealthWelfare?: number | null`
- projects.ts `UpdateProjectSchema` contains `contractorFein: z.string()`
- payroll.ts `UpsertEntrySchema` contains `fringeHealthWelfare: z.number().min(0).nullable().optional()`
- TypeScript server compile: clean (no errors)

## Deviations from Plan

None — plan executed exactly as written.

The migration SQL format includes Drizzle's `--> statement-breakpoint` separator between each ALTER statement (matching the pattern in 0013_wa_manual_rate.sql) rather than the bare SQL shown in the plan spec. This is correct for Drizzle's migration runner.

## Known Stubs

None — all new fields are properly wired: schema columns exist, service persists them, routes accept them, and the UI submits them.

## Self-Check: PASSED

Files created:
- FOUND: src/server/db/migrations/0014_ca_ecpr_fringe_columns.sql

Commits:
- FOUND: bb89d32 (feat(29-01): install xmlbuilder2, add CA eCPR DB migration and schema updates)
- FOUND: 0f973cc (feat(29-01): CA fringe disaggregation UI in PayrollWeekForm)
