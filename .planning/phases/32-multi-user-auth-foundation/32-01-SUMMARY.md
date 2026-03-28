---
phase: 32-multi-user-auth-foundation
plan: 01
subsystem: database
tags: [drizzle, sqlite, migration, auth, access-control]

# Dependency graph
requires:
  - phase: 31-ssn-encryption
    provides: schema.ts with ssnEncrypted column; migration patterns with statement-breakpoint
provides:
  - project_members table (DDL + backfill) via 0017_project_members.sql
  - createdByUserId/updatedByUserId nullable FK columns on payroll_entries
  - projectMembers Drizzle export in schema.ts with unique index
  - assertProjectAccess pure async helper returning Project or throwing 403/404
affects: [32-02, 32-03, 33-invite-flow, all route files with inline ownership checks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle statement-breakpoint separator for multi-statement SQL migrations"
    - "Two-query access guard: JOIN for fast path, existence check for 404 vs 403 distinction"
    - "Throw plain { status, message } objects (not Error subclasses) for route-level catch"
    - "assertProjectAccess returns full Project row to avoid second SELECT in callers"

key-files:
  created:
    - src/server/db/migrations/0017_project_members.sql
    - src/server/utils/assertProjectAccess.ts
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts

key-decisions:
  - "Drizzle better-sqlite3 migrator requires --> statement-breakpoint separators between SQL statements in a single file"
  - "assertProjectAccess throws plain { status, message } objects matching existing route response shape (no app-wide error handler needed)"
  - "Two-query pattern: Step 1 JOIN hits UNIQUE index (fast); Step 2 existence-only query only runs on access denial to distinguish 404 vs 403"
  - "projectMembers placed immediately after projects table in schema.ts (forward reference safe; projects defined above)"
  - "createdByUserId/updatedByUserId placed before createdAt/updatedAt in payrollEntries column list"

patterns-established:
  - "Multi-statement migrations: use --> statement-breakpoint between each SQL statement"
  - "Access guards: call assertProjectAccess(db, projectId, userId) — returns Project row, throw catches 403/404"

requirements-completed: [MT-03]

# Metrics
duration: 15min
completed: 2026-03-28
---

# Phase 32 Plan 01: Schema Foundation Summary

**project_members table + assertProjectAccess utility enabling centralized IDOR-safe access control across all 6 route files**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-28T17:23:00Z
- **Completed:** 2026-03-28T17:38:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- SQL migration `0017_project_members.sql` — creates `project_members` join table, backfills owner rows for all existing projects, adds nullable `created_by_user_id`/`updated_by_user_id` columns to `payroll_entries`
- Drizzle schema updated with `projectMembers` export (unique index on project_id + user_id) and two new nullable FK columns on `payrollEntries`
- `assertProjectAccess` utility created — pure async helper that returns the full `Project` row on membership hit, throws `{ status: 404 }` if project missing, throws `{ status: 403 }` if project exists but user is not a member

## Task Commits

Each task was committed atomically:

1. **Task 32-01-01: SQL migration + journal** - `0f9e2e5` (feat)
2. **Task 32-01-02: schema.ts additions** - `a6115f6` (feat)
3. **Task 32-01-03: assertProjectAccess utility** - `6510442` (feat)

## Files Created/Modified

- `src/server/db/migrations/0017_project_members.sql` — CREATE TABLE project_members + backfill INSERT + 2x ALTER TABLE payroll_entries; uses `-->  statement-breakpoint` separators
- `src/server/db/migrations/meta/_journal.json` — added idx 13 entry (tag: `0017_project_members`, when: `1774960000000`)
- `src/server/db/schema.ts` — added `projectMembers` sqliteTable export; added `createdByUserId` and `updatedByUserId` nullable FK columns to `payrollEntries`
- `src/server/utils/assertProjectAccess.ts` — new file; exports `assertProjectAccess` async function and `Project` type alias

## Decisions Made

- **statement-breakpoint separators required:** Drizzle's better-sqlite3 migrator splits SQL files on `-->  statement-breakpoint` comments. Multi-statement files without these fail with "supplied SQL string contains more than one statement". Fixed inline (Rule 3 — blocking issue auto-fixed).
- **Throw shape:** `{ status, message }` plain objects (not Error subclasses) match the existing route handler catch pattern across the codebase. No app-wide error handler change needed.
- **Two-query pattern:** JOIN query hits the UNIQUE index for membership — O(1) fast path. Second existence query only runs when membership check fails, incurring 2 queries only for denied access (rare path).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added statement-breakpoint separators to SQL migration**
- **Found during:** Task 1 (SQL migration creation)
- **Issue:** Drizzle better-sqlite3 migrator throws "supplied SQL string contains more than one statement" when a migration file has multiple SQL statements without `-->  statement-breakpoint` separators. The plan's SQL block did not include separators.
- **Fix:** Added `-->  statement-breakpoint` after the CREATE TABLE statement, after the INSERT backfill, and between the two ALTER TABLE statements — 3 separators total.
- **Files modified:** `src/server/db/migrations/0017_project_members.sql`
- **Verification:** `npx vitest run tests/routes/projects.test.ts` migration ran cleanly with 0 errors; 388 tests passed.
- **Committed in:** `0f9e2e5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** Required fix for migration to run. No scope change. All plan artifacts delivered exactly as specified.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — all artifacts are fully wired. `assertProjectAccess` is a complete implementation. Migration runs cleanly against in-memory test DB. Schema compiles with zero TypeScript errors.

## Next Phase Readiness

- `assertProjectAccess` ready for use in Phase 32 plan 02 (route refactoring across 6 files)
- `projectMembers` table exists and backfilled — route refactoring can begin immediately
- `createdByUserId`/`updatedByUserId` columns exist on `payroll_entries` — Phase 32 plan 03 (payroll service threading) has schema foundation
- Phase 32 plan 02 must also add `projectMembers` insert to `POST /api/projects` (new project creation) — flagged in RESEARCH.md §6

---
*Phase: 32-multi-user-auth-foundation*
*Completed: 2026-03-28*
