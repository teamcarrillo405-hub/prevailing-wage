---
phase: 44-import-provider-foundation
plan: "01"
subsystem: import-pipeline
tags: [migration, schema, types, payroll-import, provider]
dependency_graph:
  requires: []
  provides:
    - payroll_provider_mappings table (SQL + Drizzle)
    - ImportProvider named type
    - expanded provider union across server types
  affects:
    - src/server/db/schema.ts
    - src/server/services/importTypes.ts
    - src/server/routes/import.ts
tech_stack:
  added: []
  patterns:
    - Drizzle sqliteTable with uniqueIndex callback
    - inline SQL UNIQUE constraint (no statement-breakpoint)
    - named union type for shared provider values
key_files:
  created:
    - src/server/db/migrations/0027_payroll_provider_mappings.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/services/importTypes.ts
    - src/server/routes/import.ts
decisions:
  - Used inline UNIQUE constraint in SQL (not separate CREATE UNIQUE INDEX) — single statement, NFR-01 compliant, no statement-breakpoint needed
  - Lowercase provider string values (gusto, paychex, sage_300) consistent with existing quickbooks/adp pattern
  - gustoWeeklyTotalsOnly flag added as separate field (not reusing adpWeeklyTotalsOnly) per research anti-patterns
metrics:
  duration_minutes: 10
  completed: "2026-04-07T06:25:37Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 4
---

# Phase 44 Plan 01: Import Provider Foundation Summary

**One-liner:** SQL migration + Drizzle schema for `payroll_provider_mappings` table, plus `ImportProvider` named union type (5 providers) wired through importTypes, schema, and import route.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create migration SQL + update journal | 318469d | 0027_payroll_provider_mappings.sql, meta/_journal.json |
| 2 | Update schema.ts + importTypes.ts + import route types | c5c351b | schema.ts, importTypes.ts, import.ts |

## What Was Built

### Migration (Task 1)

- `src/server/db/migrations/0027_payroll_provider_mappings.sql`: single `CREATE TABLE` statement with inline `UNIQUE (project_id, provider, provider_worker_id)` constraint. No `statement-breakpoint` needed (single statement, NFR-01 compliant).
- `meta/_journal.json`: idx 23 entry registered (`tag: "0027_payroll_provider_mappings"`, `breakpoints: true`).

### Type System + Schema (Task 2)

- **`src/server/services/importTypes.ts`**: Added `export type ImportProvider = 'quickbooks' | 'adp' | 'gusto' | 'paychex' | 'sage_300'`. Updated `ImportPreviewResult.provider` to use `ImportProvider`. Added `gustoWeeklyTotalsOnly?: boolean` field (analogous to `adpWeeklyTotalsOnly`).
- **`src/server/db/schema.ts`**: Added `payrollProviderMappings` Drizzle table following `payrollWeekClassifications` pattern with `uniqueIndex('provider_mapping_unique').on(projectId, provider, providerWorkerId)`. Updated `payrollImports.provider.$type<>()` to include all 5 providers.
- **`src/server/routes/import.ts`**: Added `ImportProvider` to the import from `importTypes.js`. Updated `CommitBody.provider` from inline union to `ImportProvider`.

## Verification

- `npx tsc --noEmit`: 2 pre-existing errors in `audit.ts` and `projects.ts` (unrelated, out of scope). Zero errors in any modified files.
- `grep "payrollProviderMappings" src/server/db/schema.ts`: found export.
- `grep "ImportProvider" src/server/services/importTypes.ts`: found type definition and usage.
- `grep "ImportProvider" src/server/routes/import.ts`: found import and CommitBody usage.
- Migration file: 1 CREATE TABLE statement, 0 statement-breakpoints.
- Journal: idx 23 registered.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is infrastructure only (migration + types). No UI rendering or data flow depends on stubs; `paychex` and `sage_300` parser implementations are intentionally deferred to Phase 45, as documented in the research and plan.

## Self-Check: PASSED

- `src/server/db/migrations/0027_payroll_provider_mappings.sql`: FOUND
- `src/server/db/migrations/meta/_journal.json` (idx 23): FOUND
- `src/server/db/schema.ts` (payrollProviderMappings): FOUND
- `src/server/services/importTypes.ts` (ImportProvider): FOUND
- `src/server/routes/import.ts` (ImportProvider usage): FOUND
- Commit 318469d: Task 1
- Commit c5c351b: Task 2
