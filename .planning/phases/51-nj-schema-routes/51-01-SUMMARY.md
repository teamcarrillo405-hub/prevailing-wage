---
phase: 51-nj-schema-routes
plan: "01"
subsystem: database-schema, server-routes, integration-tests
tags: [nj, migration, drizzle-schema, zod-validation, export-stub, tdd]
dependency_graph:
  requires: [Phase 49 MA schema, Phase 50 MA PDF generator]
  provides: [NJ database columns, NJ API fields, NJ export stub at /api/export/nj-mw562/:weekId]
  affects: [Phase 52 NJ PDF generator, Phase 51 Plan 02 NJ UI wiring]
tech_stack:
  added: []
  patterns:
    - SQL migration with --> statement-breakpoint separators (matching 0029 pattern)
    - Drizzle text() nullable columns (no .notNull()/.default())
    - Zod z.enum(['M','F','N']) for workerSex validation
    - assertProjectAccess before state gate (NFR-03 pattern)
    - Export stub returning 501 (Phase 50 MA-CPR pattern)
key_files:
  created:
    - src/server/db/migrations/0030_nj_schema.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/routes/projects.ts
    - src/server/routes/workers.ts
    - src/server/routes/export.ts
    - src/server/services/workerService.ts
    - tests/routes/export.test.ts
    - tests/routes/projects.test.ts
    - tests/routes/workers.test.ts
decisions:
  - workerSex uses text() not integer — EEO sex codes M/F/N are not boolean; Zod enum enforces valid values at route layer
  - No CHECK constraint at DB layer — Zod enum on workerSex is the validation boundary (Phase 42 skillLevel pattern)
  - No NJ state gate on workers route — workerSex is nullable and harmless to store for any project; UI gates behind isNJ
  - export stub returns 501 following assertProjectAccess before NJ state gate (NFR-03 order preserved)
  - createNjProject helper added to workers.test.ts following createMaProject pattern
metrics:
  duration: 9 minutes
  completed: "2026-04-14T07:36:00Z"
  tasks_completed: 3
  files_modified: 9
  files_created: 1
---

# Phase 51 Plan 01: NJ Schema + Routes Summary

NJ DB migration (worker_sex, nj_pwc_number, nj_contract_id), Drizzle schema additions, server route Zod validation, export stub at /api/export/nj-mw562/:weekId, and 10 passing integration tests across 3 test files.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration file + journal + schema additions | b038818 | 0030_nj_schema.sql, _journal.json, schema.ts |
| 2 | Server route extensions — projects, workers, export stub | 516b825 | projects.ts, workers.ts, export.ts, workerService.ts |
| 3 | Integration tests — 10 NJ tests across 3 files | 9fbd323 | export.test.ts, projects.test.ts, workers.test.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

### Targeted suite (after all tasks)

```
npx vitest run tests/routes/workers.test.ts tests/routes/export.test.ts tests/routes/projects.test.ts
```

Result: 656 passing, 9 failing (all pre-existing RED stubs — 3 CA project fields `expect(true).toBe(false)` stubs, 6 a1131 worktree conflicts). No regressions from this plan's changes.

### Migration file check

`src/server/db/migrations/0030_nj_schema.sql` contains:
- 3 ALTER TABLE statements
- 2 `--> statement-breakpoint` separators (arrow format)
- worker_sex on workers table, nj_pwc_number and nj_contract_id on projects table

### New NJ tests (10 total, all green)

**export.test.ts — GET /api/export/nj-mw562/:weekId (4 tests):**
- 404 for unknown weekId
- 400 for non-NJ project (state gate)
- 501 for valid NJ project (stub)
- 403 for cross-tenant access (IDOR)

**projects.test.ts — NJ-specific project fields (2 tests):**
- Creates project with njPwcNumber + njContractId
- PATCH updates njPwcNumber + njContractId

**workers.test.ts — workerSex field (4 tests):**
- Creates worker with workerSex M
- Updates F then null (round-trip)
- Rejects invalid workerSex values (400)
- Null by default when not provided

## Known Stubs

- `GET /api/export/nj-mw562/:weekId` returns 501 — intentional; Phase 52 will implement the PDF generator

## Self-Check: PASSED
