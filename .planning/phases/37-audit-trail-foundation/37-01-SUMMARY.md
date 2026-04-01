---
phase: 37
plan: 01
subsystem: database
tags: [audit-trail, schema, migration, drizzle, sqlite]
dependency_graph:
  requires: []
  provides: [audit_logs table, auditLogs Drizzle schema export]
  affects: [src/server/db/schema.ts, src/server/db/migrations/0021_audit_logs.sql, src/server/db/migrations/meta/_journal.json]
tech_stack:
  added: []
  patterns: [sqliteTable with composite indexes, SQL migration with statement-breakpoint separators]
key_files:
  created:
    - src/server/db/migrations/0021_audit_logs.sql
  modified:
    - src/server/db/schema.ts
    - src/server/db/migrations/meta/_journal.json
decisions:
  - "Use Drizzle index() (not uniqueIndex()) for audit log indexes — non-unique, composite"
  - "DESC ordering specified in raw SQL migration only — Drizzle index() builder does not expose .desc() for composite indexes in installed version"
  - "projectId FK uses onDelete: 'set null' so audit rows survive project deletion"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 37 Plan 01: Audit Trail Schema + Migration Summary

**One-liner:** audit_logs SQLite table via Drizzle schema (12 columns, 3 composite indexes with DESC ordering) and 0021 migration registered in journal at idx 17.

## What Was Built

This plan creates the database foundation for the v4.0 audit trail feature. Without this table, `auditService.ts` (Plan 02) cannot write audit records.

### Task 1: Add auditLogs table to Drizzle schema (commit: 52cc6e3)

Updated `src/server/db/schema.ts`:
- Added `index` to the `drizzle-orm/sqlite-core` import (alongside existing `uniqueIndex`)
- Added the `auditLogs` table definition at end of file with section comment
- 12 columns: `id`, `createdAt`, `userId` (FK → users), `userEmail`, `ipAddress`, `projectId` (FK → projects, onDelete: set null), `entityType`, `entityId`, `action`, `diff`, `snapshot`, `meta`
- 3 indexes via `index()`: `idx_audit_project_time`, `idx_audit_entity`, `idx_audit_user`

### Task 2: Create migration file and register in journal (commit: bf851db)

Created `src/server/db/migrations/0021_audit_logs.sql`:
- CREATE TABLE with all 12 columns matching the Drizzle schema
- 3 `CREATE INDEX` statements with `created_at DESC` ordering
- Separated by `--> statement-breakpoint` (one space, per NFR-01)

Updated `src/server/db/migrations/meta/_journal.json`:
- Added entry at idx 17, version "6", tag "0021_audit_logs", breakpoints: true

## Verification Results

- `npx tsc --noEmit` — only pre-existing implicit `any` in projects.ts (documented non-fatal); zero new errors
- `npx vitest run --exclude ".claude/**"` — 387 tests passing, 30 test files, migration runs on in-memory DB
- `grep -c "statement-breakpoint" 0021_audit_logs.sql` — 3 (correct)
- `grep "created_at DESC"` — 3 matches (one per index)
- `grep "0021_audit_logs" _journal.json` — found
- `grep '"idx": 17' _journal.json` — found

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates schema and migration only; no UI rendering paths.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 52cc6e3 | feat(37-01): add auditLogs table to Drizzle schema |
| 2 | bf851db | feat(37-01): create audit_logs migration and register in journal |

## Self-Check: PASSED
