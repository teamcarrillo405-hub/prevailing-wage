---
phase: 24-california-dir-a-1-131-form
plan: "01"
subsystem: db-migrations-schema-test-scaffolding
tags: [ca-dir, a1131, migrations, schema, test-stubs, double-time]
dependency_graph:
  requires: []
  provides: [ca-project-fields, dt-hour-columns, a1131-pdf-template, test-scaffolding]
  affects: [schema.ts, payroll-route, projects-route, test-suite]
tech_stack:
  added: []
  patterns: [drizzle-add-only-migration, zod-optional-fields, vitest-red-stubs]
key_files:
  created:
    - assets/a1131-official.pdf
    - src/server/db/migrations/0010_ca_project_fields.sql
    - src/server/db/migrations/0011_payroll_entries_double_time.sql
    - tests/services/a1131.test.ts
    - tests/routes/export.test.ts
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/routes/payroll.ts
    - src/server/routes/projects.ts
    - tests/routes/projects.test.ts
    - tests/routes/payroll.test.ts
decisions:
  - "All DT fields on UpsertEntrySchema are optional() — existing WH-347 payloads do not include them"
  - "CSLB license and WC policy number are nullable text — optional at project creation per CA DIR policy"
  - "Both migrations registered in _journal.json at idx 6 and idx 7 — Drizzle silently skips unregistered SQL migrations"
  - "RED stubs use expect(true).toBe(false) not .todo or .skip — must run and fail for TDD tracking"
metrics:
  duration: 4min
  completed: "2026-03-24"
  tasks: 3
  files: 10
---

# Phase 24 Plan 01: CA Foundation — DB Migrations, Schema, and Test Scaffolding Summary

**One-liner:** Downloaded official DIR A-1-131 PDF, created two SQL migrations (CA project fields + 7 DT hour columns), extended Drizzle schema and Zod validators with optional CA fields, and scaffolded 8 RED test stubs covering CAL-01, CAL-02, and CAL-03.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Download A-1-131 PDF + create DB migrations + update journal | 57134d7 | assets/a1131-official.pdf, 0010_ca_project_fields.sql, 0011_payroll_entries_double_time.sql, _journal.json |
| 2 | Update schema.ts + server Zod schemas + project route insert | df1840e | schema.ts, payroll.ts, projects.ts |
| 3 | Create test stubs for all Phase 24 requirements (RED state) | 166b370 | tests/routes/projects.test.ts, tests/routes/payroll.test.ts, tests/services/a1131.test.ts, tests/routes/export.test.ts |

## Verification Results

- assets/a1131-official.pdf: 162KB, starts with %PDF header
- _journal.json: idx 6 (0010_ca_project_fields) and idx 7 (0011_payroll_entries_double_time) registered
- schema.ts: 2 CA project fields (cslbLicense, wcPolicyNumber) + 7 DT columns (monDt-sunDt)
- Existing tests: 70 passing, 0 regressions
- New RED stubs: 8 failing (3 CAL-01 + 3 CAL-02 + 2 CAL-03) — confirmed RED state

## Decisions Made

1. All DT fields on `UpsertEntrySchema` are `.optional()` — existing WH-347 payloads do not include them; defaults to 0 at the DB level.
2. `cslbLicense` and `wcPolicyNumber` are nullable TEXT columns — optional at project creation per CA DIR policy (not required on all CA projects).
3. Both migrations registered in `_journal.json` at idx 6 and idx 7 — Drizzle silently skips SQL migrations not in the journal (documented failure from Phase 06 decision log).
4. RED stubs use `expect(true).toBe(false)` (not `.todo()` or `.skip()`) — must run and fail so test runner tracks them as failures in TDD cycle.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- assets/a1131-official.pdf: FOUND
- src/server/db/migrations/0010_ca_project_fields.sql: FOUND
- src/server/db/migrations/0011_payroll_entries_double_time.sql: FOUND
- tests/services/a1131.test.ts: FOUND
- tests/routes/export.test.ts: FOUND
- Commit 57134d7: FOUND
- Commit df1840e: FOUND
- Commit 166b370: FOUND
