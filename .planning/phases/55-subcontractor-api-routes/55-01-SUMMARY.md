---
phase: 55-subcontractor-api-routes
plan: 01
subsystem: api
tags: [express, drizzle, sqlite, zod, vitest, supertest]

# Dependency graph
requires:
  - phase: 54-subcontractor-schema-migrations
    provides: subcontractors and subcontractorCprWeeks Drizzle tables
provides:
  - 7 HTTP route handlers for subcontractor CRUD and CPR-week tracking
  - Integration test suite (16 tests) covering SUB-03, SUB-04, NFR-03
  - Mount point in src/server/index.ts
affects: [56-subcontractor-ui, 59-compliance-pdf]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN: failing tests committed first, implementation second"
    - "assertProjectAccess(db, projectId, userId) as first call in every handler (NFR-03)"
    - "Dynamic audit import inside try/catch to avoid circular dependency risk"
    - "Second-level ownership check: sub must belong to :id before CPR-week operations"
    - "z.union([z.literal(0), z.literal(1)]).optional().nullable() for three-state isCompliant"

key-files:
  created:
    - src/server/routes/subcontractors.ts
    - tests/routes/subcontractors.test.ts
  modified:
    - src/server/index.ts

key-decisions:
  - "isCompliant uses z.union([z.literal(0), z.literal(1)]) not z.boolean() — preserves null=unassessed, 0=non-compliant, 1=compliant three-state semantics"
  - "Audit logs only on subcontractor.created (POST) and subcontractor.removed (DELETE) — no audit on PATCH or any CPR-week operation"
  - "Second-level ownership check via and(eq(subs.id, subId), eq(subs.projectId, projectId)) before any CPR-week query"
  - "409 returned from application-level duplicate check (not DB constraint) for (subcontractorId, weekEndingDate)"

patterns-established:
  - "CPR-week routes pattern: assertProjectAccess first, then sub ownership query, then operation"
  - "undefined-fallback pattern for PATCH: body.field !== undefined ? body.field : existing.field"

requirements-completed: [SUB-03, SUB-04, NFR-03]

# Metrics
duration: 12min
completed: 2026-04-13
---

# Phase 55 Plan 01: Subcontractor API Routes Summary

**7 Express route handlers for subcontractor CRUD and CPR-week tracking, with integration tests (16 tests GREEN) covering NFR-03 access control and second-level ownership validation**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-13T02:19:00Z
- **Completed:** 2026-04-13T02:22:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Wrote 16-test RED integration suite covering all 7 routes, 403 non-member cases, 409 duplicate CPR week, and cross-project 404
- Implemented `src/server/routes/subcontractors.ts` with all 7 handlers following workers.ts structural pattern
- Mounted `subcontractorsRouter` in `src/server/index.ts`; full 612-test suite passes with no regressions

## Task Commits

1. **Task 1: Write RED integration test scaffold** - `e0b6d9f` (test)
2. **Task 2: Implement subcontractors.ts route file** - `fc82523` (feat)
3. **Task 3: Mount subcontractorsRouter in index.ts** - `07d643a` (chore)

## Files Created/Modified

- `src/server/routes/subcontractors.ts` - 7 route handlers: GET/POST/PATCH/DELETE subcontractors + GET/POST/PATCH cpr-weeks
- `tests/routes/subcontractors.test.ts` - 16 integration tests covering SUB-03, SUB-04, NFR-03
- `src/server/index.ts` - Added import and `app.use('/api/projects', subcontractorsRouter)`

## Decisions Made

- `isCompliant` uses `z.union([z.literal(0), z.literal(1)]).optional().nullable()` — matches Phase 54 schema decision that null=unassessed, 0=non-compliant, 1=compliant; `z.boolean()` would collapse the three-state to two
- Audit log fires only on `subcontractor.created` and `subcontractor.removed` — not on PATCH or CPR-week operations, per plan spec
- 409 returned via application-level existence check before insert (not relying on DB UNIQUE constraint error propagation), making error handling explicit and testable
- Cross-project 404 test uses two distinct user accounts each with their own project to fully exercise the second-level ownership boundary

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 subcontractor API routes live and tested; Phase 56 (SubcontractorPanel UI) can begin immediately
- Phase 59 (compliance PDF) can query subcontractors and CPR weeks for overdue counts
- No blockers or concerns

---
*Phase: 55-subcontractor-api-routes*
*Completed: 2026-04-13*
