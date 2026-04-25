---
phase: 64-soc2-logging-page-polish
plan: 01
subsystem: database
tags: [soc2, security, sqlite, drizzle, migration]
dependency_graph:
  requires: []
  provides: [security_events table, login_attempts table]
  affects: [src/server/routes/auth.ts, Plan 64-02 auth wiring]
tech_stack:
  added: []
  patterns: [drizzle sqliteTable, composite index on (col, created_at)]
key_files:
  created:
    - src/server/db/migrations/0040_security_events_login_attempts.sql
  modified:
    - src/server/db/schema.ts
    - src/server/db/migrations/meta/_journal.json
decisions:
  - Use single-space statement-breakpoint separator (Drizzle runtime migrator requires `--> statement-breakpoint`, not two-space variant)
  - Apply migration directly to DB after drizzle-kit migrate silently skipped due to stale snapshot meta
metrics:
  duration: ~25 minutes
  completed: 2026-04-25
  tasks: 3
  files: 3
---

# Phase 64 Plan 01: SOC 2 Security Audit Tables Summary

Added two SOC 2-required SQLite tables (`security_events`, `login_attempts`) via Drizzle migration with composite indexes, fully queryable via named exports in schema.ts.

## Tables Created

### security_events
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| user_id | TEXT | NULLABLE, REFERENCES users(id) |
| event_type | TEXT | NOT NULL |
| ip_address | TEXT | nullable |
| user_agent | TEXT | nullable |
| metadata | TEXT | nullable |
| created_at | TEXT | NOT NULL |

Index: `idx_sec_events_user_time` ON (user_id, created_at DESC)

### login_attempts
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| email | TEXT | NOT NULL |
| success | INTEGER | NOT NULL DEFAULT 0 (boolean mode in Drizzle) |
| ip_address | TEXT | nullable |
| created_at | TEXT | NOT NULL |
| failure_reason | TEXT | nullable |

Index: `idx_login_attempts_email_time` ON (email, created_at DESC)

## Migration File

`src/server/db/migrations/0040_security_events_login_attempts.sql` — registered as idx 36 in `_journal.json`.

## Verification Results

- `grep "export const securityEvents\|export const loginAttempts" src/server/db/schema.ts` — 2 matches (lines 470, 482)
- `pnpm tsc --noEmit` — zero errors
- Both tables + indexes confirmed in `data/prevailing-wage.db` via SQLite query
- `pnpm test` — 55 passed | 711 tests passing | 0 failures (improved from pre-existing 12 failures before our fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed statement-breakpoint separator format**
- **Found during:** Task 3 (test run)
- **Issue:** Plan spec said `-->  statement-breakpoint` (two spaces) but the Drizzle runtime migrator (`drizzle-orm/better-sqlite3/migrator`) splits on `--> statement-breakpoint` (one space). Using two spaces caused "contains more than one statement" SQLiteError in all 55 test files.
- **Fix:** Rewrote migration file with single-space separator, matching the existing `0039_project_wd_pins.sql` format and the migrator source at `node_modules/drizzle-orm/migrator.js:16`.
- **Files modified:** `src/server/db/migrations/0040_security_events_login_attempts.sql`
- **Commit:** e161934

**2. [Rule 3 - Blocking] Drizzle-kit generate created conflicting migration**
- **Found during:** Task 3 (db:generate run)
- **Issue:** `pnpm db:generate` created `0036_minor_peter_parker.sql` — a comprehensive rebuild migration (because Drizzle's snapshot meta was behind the actual migration history). This file tried to re-create tables/columns already applied and would have corrupted the DB if migrated.
- **Fix:** Deleted the bogus generated file and its snapshot (`0036_snapshot.json`), restored `_journal.json` to only include `0040_` as idx 36, then applied tables directly to the DB using the better-sqlite3 Node.js API and registered the migration hash in `__drizzle_migrations`.
- **Files modified:** `_journal.json` (removed bogus entry), deleted `0036_minor_peter_parker.sql`

## Known Stubs

None — this plan creates tables only. No UI or data rendering.

## Self-Check: PASSED

- `src/server/db/migrations/0040_security_events_login_attempts.sql` — FOUND
- `src/server/db/schema.ts` exports securityEvents and loginAttempts — FOUND (lines 470, 482)
- Commit e161934 — FOUND
- Both tables in SQLite DB — CONFIRMED
- 55 tests passing — CONFIRMED
