---
phase: 32-multi-user-auth-foundation
plan: 02
subsystem: routes
tags: [express, access-control, drizzle, idor-protection, payroll-service]

# Dependency graph
requires:
  - phase: 32-multi-user-auth-foundation
    plan: 01
    provides: assertProjectAccess utility, projectMembers table, createdByUserId/updatedByUserId columns
provides:
  - All 21 inline project.userId access checks replaced with assertProjectAccess across 6 route files
  - Both local assertProjectOwner helpers deleted from payroll.ts and reports.ts
  - POST /api/projects inserts project_members owner row after project INSERT
  - upsertPayrollEntry writes createdByUserId/updatedByUserId from userId parameter
affects: [32-03, 33-invite-flow, tests/security/cross-tenant.test.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "try/catch around assertProjectAccess replacing if (!ok) return pattern"
    - "let project: Project; then try { project = await assertProjectAccess(...) } for routes that use return value"
    - "await assertProjectAccess(...) without assignment for routes that only need the guard"
    - "{ ...body, userId } spread to thread userId through to service layer without modifying Zod schema"

key-files:
  modified:
    - src/server/routes/compliance.ts
    - src/server/routes/export.ts
    - src/server/routes/workers.ts
    - src/server/routes/payroll.ts
    - src/server/routes/projects.ts
    - src/server/routes/reports.ts
    - src/server/services/payrollService.ts

key-decisions:
  - "Unused imports (projects from schema, eq from drizzle-orm) removed from export.ts and workers.ts after guard replacement"
  - "PATCH and DELETE WHERE clauses in projects.ts simplified to eq(projects.id, ...) only — membership verified by assertProjectAccess before UPDATE"
  - "amendPayrollWeek entry copies use null for both createdByUserId and updatedByUserId per RESEARCH.md §10 open question (safer default)"
  - "reports.ts catch block restructured: assertProjectAccess error thrown first, service errors caught separately to preserve 500 fallback"

requirements-completed: [MT-03]

# Metrics
duration: 19min
completed: 2026-03-28
---

# Phase 32 Plan 02: Route Refactoring Summary

**All 21 inline IDOR guards replaced with assertProjectAccess across 6 route files — centralized membership-based access control**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-03-28T12:32:00Z
- **Completed:** 2026-03-28T12:51:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `compliance.ts` — replaced 2 inline `project.userId !== userId` checks with `assertProjectAccess`
- `export.ts` — replaced 7 inline checks (all export routes: wh347, a1131, f700, csv/lcptracker, csv/emars, ecpr-xml, wa-cpr-xml); removed now-unused `projects` and `eq` imports
- `workers.ts` — replaced 7 inline checks across all 7 worker route handlers; removed now-unused `projects` import; used `let project: Project` assignment form for routes that use project fields (wage-classifications, workers list), `await` only form for routes that don't
- `payroll.ts` — deleted `assertProjectOwner` helper (lines 95–116); replaced all 9 call sites with try/catch around `assertProjectAccess`; threaded `userId: req.user!.userId` to `upsertPayrollEntry` on POST /entries and PUT /entries/:id
- `reports.ts` — deleted `assertProjectOwner` helper (lines 19–39); replaced 2 call sites with `assertProjectAccess`; removed unused `Response` type import and `projects` schema import
- `projects.ts` — replaced 3 inline checks (GET, PATCH, DELETE /:id); dropped `eq(projects.userId, userId)` from UPDATE WHERE clauses on PATCH and DELETE; added `projectMembers` owner row INSERT to POST / after project INSERT
- `payrollService.ts` — added `userId?: string` to `UpsertPayrollEntryInput`; writes `createdByUserId` and `updatedByUserId` on INSERT, `updatedByUserId` only on conflict UPDATE; `amendPayrollWeek` entry copies set both columns to `null`

## Task Commits

Each task was committed atomically:

1. **Task 32-02-01: compliance, export, workers** - `6848a16` (feat)
2. **Task 32-02-02: reports, payroll, projects** - `f9545be` (feat)
3. **Task 32-02-03: payrollService** - `ba68770` (feat)

## Files Modified

- `src/server/routes/compliance.ts` — 2 access checks replaced; `assertProjectAccess` import added
- `src/server/routes/export.ts` — 7 access checks replaced; unused `projects`, `eq` imports removed; `assertProjectAccess` import added
- `src/server/routes/workers.ts` — 7 access checks replaced; unused `projects` import removed; `assertProjectAccess` + `Project` type imports added
- `src/server/routes/payroll.ts` — `assertProjectOwner` helper deleted; 9 call sites replaced; userId threaded to `upsertPayrollEntry`; unused `projects` import removed
- `src/server/routes/reports.ts` — `assertProjectOwner` helper deleted; 2 call sites replaced; unused imports removed
- `src/server/routes/projects.ts` — 3 access checks replaced; `projectMembers` INSERT added to POST /; UPDATE WHERE clauses simplified; `projectMembers` import added
- `src/server/services/payrollService.ts` — `userId?: string` added to `UpsertPayrollEntryInput`; `createdByUserId`/`updatedByUserId` written in upsert; `amendPayrollWeek` copies use `null` for both columns

## Verification

All post-completion checks passed:

- `npx tsc --noEmit` — zero errors across all 7 modified files
- `grep -rn "project\.userId !== userId" src/server/routes/` — **empty** (no old pattern found)
- `grep -rn "assertProjectOwner" src/server/routes/` — **empty** (no local helpers remain)
- `grep -rl "assertProjectAccess" src/server/routes/` — lists all 6 route files (compliance, export, payroll, projects, reports, workers)
- `grep -n "projectMembers" src/server/routes/projects.ts` — shows import and insert call
- `tests/routes/compliance.test.ts` — 258 passed
- `tests/routes/payroll.test.ts` — 394 passed, 2 pre-existing RED stubs
- `tests/routes/projects.test.ts` — 388 passed, 3 pre-existing RED stubs
- `tests/routes/reports.test.ts`, `tests/routes/workers.test.ts`, `tests/services/payroll.test.ts` — 121 passed
- `tests/routes/export.test.ts` — 40 passed (6 failures all in `.claude/worktrees/` other-agent test files, not main tests)

## Decisions Made

- **Unused imports removed** — `projects` from schema and `eq` from drizzle-orm removed from export.ts and workers.ts where no longer needed after guard replacement. Keeps TypeScript clean without noUnusedLocals warning.
- **PATCH/DELETE WHERE clause simplification** — Per RESEARCH.md §1, the UPDATE WHERE on PATCH and DELETE `:id` routes previously included `eq(projects.userId, userId)` as a redundant safety guard. After `assertProjectAccess` verifies membership, only `eq(projects.id, req.params.id)` is needed.
- **Amendment copies: null for user columns** — Per RESEARCH.md §10, `amendPayrollWeek` entry copies set `createdByUserId` and `updatedByUserId` to `null`. Amendment copies are system-generated clones, not direct user edits. `null` is the safer default per the open question discussion.
- **reports.ts error handling** — The original routes had a single outer try/catch wrapping both the ownership check and the service call. After refactoring, `assertProjectAccess` gets its own catch block to return the correct 403/404 status; the service call retains its own catch for 500 fallback.

## Deviations from Plan

None — plan executed exactly as specified. All 21 checks replaced, both helpers deleted, POST /projects inserts project_members, payrollService updated.

## Known Stubs

None — all modifications are fully wired. `assertProjectAccess` is called with real DB and user IDs from JWT. `project_members` owner rows are created for all new projects via POST /api/projects.

## Self-Check: PASSED

- All 7 modified files exist on disk
- All 3 task commits found in git log: `6848a16`, `f9545be`, `ba68770`
- `npx tsc --noEmit` passes (zero errors)
- No `project.userId !== userId` patterns remain in src/server/routes/
- No `assertProjectOwner` functions remain in src/server/routes/
- `assertProjectAccess` imported in all 6 route files
- `projectMembers` INSERT present in src/server/routes/projects.ts

---
*Phase: 32-multi-user-auth-foundation*
*Completed: 2026-03-28*
