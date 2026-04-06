---
phase: 40-ny-schema-compliance-rule
plan: "01"
subsystem: database
tags: [migration, schema, drizzle, sqlite, new-york, ny-compliance]
dependency_graph:
  requires: []
  provides: [ny-db-columns, migration-0023]
  affects: [projects-table, workers-table]
tech_stack:
  added: []
  patterns: [add-only-migration, drizzle-integer-boolean]
key_files:
  created:
    - src/server/db/migrations/0023_ny_schema.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
decisions:
  - projectSettings stored as text (not json() type) — consistent with auditLogs.diff/snapshot/meta pattern
  - nysRegisteredApprentice uses integer({ mode: 'boolean' }) — standard Drizzle SQLite boolean pattern, same as isActive
  - nys_registered_apprentice uses INTEGER NOT NULL DEFAULT 0 in SQL — Drizzle SQLite stores booleans as 0/1
metrics:
  duration_minutes: 8
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
requirements:
  - STATE-06
  - NFR-01
  - NFR-05
---

# Phase 40 Plan 01: NY Schema Migration Summary

**One-liner:** SQLite migration adding 4 NY-specific columns (PRC number, contractor reg, project settings, NYS apprentice flag) with matching Drizzle ORM definitions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write migration 0023_ny_schema.sql and register in journal | 77b2c0a | src/server/db/migrations/0023_ny_schema.sql, src/server/db/migrations/meta/_journal.json |
| 2 | Add NY columns to Drizzle schema.ts | 76c9825 | src/server/db/schema.ts |

## What Was Built

### Migration: 0023_ny_schema.sql

Four `ALTER TABLE ADD COLUMN` statements separated by `--> statement-breakpoint`:

- `ALTER TABLE projects ADD COLUMN nyp_rc_number TEXT` — NY PRC number (nullable)
- `ALTER TABLE projects ADD COLUMN nys_contractor_reg_number TEXT` — NY contractor registration number (nullable)
- `ALTER TABLE projects ADD COLUMN project_settings TEXT` — JSON-as-text project settings (nullable)
- `ALTER TABLE workers ADD COLUMN nys_registered_apprentice INTEGER NOT NULL DEFAULT 0` — NYS registered apprentice flag (boolean stored as integer)

Journal registered at idx 19, version "7", breakpoints: true, when: 1743724800000 (after 0022 entry).

### Schema: schema.ts

Projects table additions (after `pwiaIntentId`):
- `nyprcNumber: text('nyp_rc_number')` — nullable
- `nysContractorRegNumber: text('nys_contractor_reg_number')` — nullable
- `projectSettings: text('project_settings')` — nullable text (not json type)

Workers table addition (after `apprenticeshipRegNumber`):
- `nysRegisteredApprentice: integer('nys_registered_apprentice', { mode: 'boolean' }).notNull().default(false)`

## Decisions Made

- **projectSettings as text:** Stores JSON as a text string per the same pattern as `auditLogs.diff`, `auditLogs.snapshot`, and `auditLogs.meta` — no Drizzle `json()` type used.
- **integer boolean pattern:** `nysRegisteredApprentice` uses `integer({ mode: 'boolean' })` consistent with all other boolean columns in the schema (`isActive`, `isFinal`, etc.).
- **SQL uses INTEGER NOT NULL DEFAULT 0:** Drizzle SQLite maps `.notNull().default(false)` to `INTEGER NOT NULL DEFAULT 0` — the SQL migration explicitly matches this.

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing TypeScript errors in `src/server/routes/audit.ts` (line 56) and `src/server/routes/projects.ts` (line 110) are implicit-any errors that existed before this plan. Verified via `git stash` + `npx tsc --noEmit`. Out of scope per CLAUDE.md deviation rules (not caused by current task changes).

## Known Stubs

None. Migration and schema definitions are complete and functional. Plan 02 (routes + forms) and Plan 03 (compliance engine) will consume these columns.

## Self-Check: PASSED

- `src/server/db/migrations/0023_ny_schema.sql` — EXISTS
- `src/server/db/migrations/meta/_journal.json` — idx 19 entry — EXISTS
- `src/server/db/schema.ts` — all 4 columns — VERIFIED
- Commit 77b2c0a — FOUND
- Commit 76c9825 — FOUND
