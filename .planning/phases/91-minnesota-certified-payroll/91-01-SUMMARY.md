---
phase: 91-minnesota-certified-payroll
plan: "01"
subsystem: server-pdf, client-ui, db
tags: [certified-payroll, state-forms, minnesota, pdf, tdd]
dependency_graph:
  requires: []
  provides: [mn-dli-pdf-generator, mn-export-route, mn-state-forms-entry]
  affects: [export.ts, PayrollWeekDetailPage, schema.ts]
tech_stack:
  added: []
  patterns: [pdf-lib-programmatic-draw, tdd-red-green, drizzle-schema-column]
key_files:
  created:
    - src/server/services/mnPdfGenerator.ts
    - src/server/db/migrations/0057_phase91_mn_project_fields.sql
    - tests/services/mnPdfGenerator.test.ts
  modified:
    - src/server/routes/export.ts
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/client/pages/PayrollWeekDetailPage.tsx
decisions:
  - "Migration idx 57 used (plan said 0055 but 0055/0056 were already taken by procore phases)"
  - "Monday-first day order (Mo-Tu-We-Th-Fr-Sa-Su) per DLI form requirement"
  - "Compliance page always added unconditionally (no sharing with worker rows)"
  - "grossWages field used instead of projectGross/totalWeekGross (MN form simpler than MA)"
metrics:
  duration: "12m"
  completed: "2026-04-27"
  tasks_completed: 2
  files_modified: 7
---

# Phase 91 Plan 01: Minnesota DLI Certified Payroll Summary

Minnesota DLI Weekly Certified Payroll Report (STATE-14) fully implemented: programmatic PDF generator (mnPdfGenerator.ts), GET /api/export/mn-dli/:weekId export route with MN state gate, DB migration for mn_contract_id column, schema.ts update, STATE_FORMS registry entry, and 5 passing vitest tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (TDD) | mnPdfGenerator.ts — MN DLI PDF service | fb16f8c | src/server/services/mnPdfGenerator.ts, tests/services/mnPdfGenerator.test.ts |
| 2 | Wire export route, migration, schema, STATE_FORMS | fb16f8c | export.ts, 0057_phase91_mn_project_fields.sql, _journal.json, schema.ts, PayrollWeekDetailPage.tsx |

## What Was Built

- `MnPdfInput` type with Monday-first day columns (Mo-Tu-We-Th-Fr-Sa-Su per DLI form)
- `fillMnCertifiedPayroll()` programmatic PDF: letter portrait, header block, worker table with day/fringe/gross columns, always-dedicated Statement of Compliance page citing Minn. Stat. 177.42
- Page overflow: new page at y < 80 with header + table header redrawn
- null optional fields render as blank (not "0.00") — critical correctness requirement
- GET /api/export/mn-dli/:weekId: state gate (MN only → 400 otherwise), audit log, PDF download headers
- Migration 0057_phase91_mn_project_fields.sql: ALTER TABLE projects ADD COLUMN mn_contract_id TEXT
- PayrollWeekDetailPage STATE_FORMS: MN: { downloadLabel: 'Download MN DLI Payroll', route: 'mn-dli' }

## Deviations from Plan

**[Rule 3 - Blocking] Migration numbering adjusted**
- Plan specified 0055 but 0055 and 0056 were already in use by wd_revision_log and procore_connections phases
- Used 0057 (next available idx after 56) — functionally identical, no behavioral change

## Self-Check: PASSED

- src/server/services/mnPdfGenerator.ts: found
- tests/services/mnPdfGenerator.test.ts: found (5 tests, all passing)
- src/server/db/migrations/0057_phase91_mn_project_fields.sql: found
- commit fb16f8c: found
- tsc --noEmit: no new errors
- 789 total vitest tests: all passed
