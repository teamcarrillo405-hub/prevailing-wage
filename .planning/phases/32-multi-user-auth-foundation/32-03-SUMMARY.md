---
phase: 32-multi-user-auth-foundation
plan: 03
subsystem: tests
tags: [security, idor, cross-tenant, supertest, vitest]

# Dependency graph
requires:
  - phase: 32-multi-user-auth-foundation
    plan: 01
    provides: assertProjectAccess utility, projectMembers table
  - phase: 32-multi-user-auth-foundation
    plan: 02
    provides: All 21 inline IDOR guards replaced with assertProjectAccess across 6 route files
provides:
  - Cross-tenant IDOR regression suite (11 assertions covering all 6 route files)
  - tests/security/ directory (new)
affects: [phase-33-invite-flow, future route additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HTTP-layer cross-tenant tests via supertest(app) — no direct DB seeding"
    - "beforeAll: register two users + create two projects + create payroll week for week-scoped route"
    - "createPayrollWeek helper added to support export.ts wh347 route test"

key-files:
  created:
    - tests/security/cross-tenant.test.ts

key-decisions:
  - "workers.ts routes are mounted at /api/projects (not /api/workers) — corrected from plan's route prefix comments"
  - "payroll route is GET /api/payroll/projects/:projectId/weeks (not /api/payroll/:projectId/weeks)"
  - "Payroll week created in beforeAll to support export.ts wh347 route test (week-scoped, project resolved via payroll week)"

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 32 Plan 03: Cross-Tenant IDOR Test Suite Summary

**11-assertion cross-tenant security regression suite covering all 6 refactored route files — proves userB cannot access userA's resources across projects, workers, reports, compliance, export, and payroll**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-28T19:53:00Z
- **Completed:** 2026-03-28T19:58:22Z
- **Tasks:** 2/2 completed (human-verify approved 2026-03-28)
- **Files created:** 1

## Accomplishments

- `tests/security/cross-tenant.test.ts` created — 11 assertions across all 6 route files
- All 11 assertions pass (green): 3 projects routes, 2 workers routes, 1 reports route, 1 compliance route, 1 export route, 1 payroll route, 1 symmetric check, 1 positive control
- `tests/security/` directory created (new — did not exist before this plan)

## Task Commits

1. **Task 32-03-01: cross-tenant test suite** - `c114df3` (feat)

## Files Created

- `tests/security/cross-tenant.test.ts` — 11 assertions; covers compliance.ts, export.ts, payroll.ts, projects.ts, reports.ts, workers.ts

## Verification

```
npx vitest run tests/security/cross-tenant --reporter=verbose

 ✓ Cross-tenant IDOR protection > GET /api/projects/:id — userB gets 403 on userA project
 ✓ Cross-tenant IDOR protection > PATCH /api/projects/:id — userB gets 403 on userA project
 ✓ Cross-tenant IDOR protection > DELETE /api/projects/:id — userB gets 403 on userA project
 ✓ Cross-tenant IDOR protection > GET /api/projects/:projectId/workers — userB gets 403 on userA project
 ✓ Cross-tenant IDOR protection > POST /api/projects/:projectId/workers — userB gets 403 on userA project
 ✓ Cross-tenant IDOR protection > GET /api/reports/:projectId/fringe-summary — userB gets 403 on userA project
 ✓ Cross-tenant IDOR protection > GET /api/compliance/project/:projectId — userB gets 403 on userA project
 ✓ Cross-tenant IDOR protection > GET /api/export/wh347/:weekId — userB gets 403 on userA payroll week
 ✓ Cross-tenant IDOR protection > GET /api/payroll/projects/:projectId/weeks — userB gets 403 on userA project
 ✓ Cross-tenant IDOR protection > GET /api/projects/:id — userA gets 403 on userB project (symmetric)
 ✓ Cross-tenant IDOR protection > GET /api/projects/:id — userA gets 200 on their own project

Tests: 11 passed (11)
```

## Decisions Made

- **workers.ts mount point corrected:** The plan's route prefix comment stated `/api/workers/:projectId/workers` but workers.ts is mounted at `/api/projects` in index.ts. The actual URL is `/api/projects/:projectId/workers`. Tests use the correct URL. (Rule 1 - Bug)
- **payroll weeks route corrected:** Actual route is `GET /api/payroll/projects/:projectId/weeks` not `/api/payroll/:projectId/weeks`.
- **createPayrollWeek helper added:** The export.ts wh347 route is week-scoped (takes weekId, resolves project via payroll week). A payroll week must be created in beforeAll so userB can attempt to access userA's week. The plan's template referenced `weekIdA` but did not show a helper — added `createPayrollWeek()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected workers route URL prefix**
- **Found during:** Task 1 (test execution — 2 tests returned 404 instead of 403)
- **Issue:** The plan's `<interfaces>` block listed `<!-- workers: GET /api/workers/:projectId/workers -->` but `workers.ts` is mounted at `/api/projects` in `src/server/index.ts`. Using `/api/workers/...` returns 404 (route not found), not 403.
- **Fix:** Changed test URLs to `/api/projects/:projectId/workers` (GET) and `/api/projects/:projectId/workers` (POST).
- **Files modified:** `tests/security/cross-tenant.test.ts`
- **Verification:** Both tests now return 403. All 11 assertions green.
- **Committed in:** `c114df3`

## Checkpoint State

**Plan 32-03 COMPLETE — human-verify checkpoint approved 2026-03-28.**

Task 1 (cross-tenant test suite, 11 assertions) committed at `c114df3`. Task 2 (human verification) approved by operator: server started, cross-tenant 403 confirmed, project_members row confirmed in SQLite.

## Known Stubs

None — the test file is fully wired and all 11 assertions pass.

## Self-Check: PASSED

- `tests/security/cross-tenant.test.ts` exists on disk
- Task commit `c114df3` found in git log
- All 11 test assertions pass (11/11 green)
- Correct route URLs verified against actual mounted paths in `src/server/index.ts`

---
*Phase: 32-multi-user-auth-foundation*
*Completed: 2026-03-28*
