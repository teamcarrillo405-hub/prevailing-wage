---
phase: 58
plan: 01
subsystem: reports
tags: [reports, fringe, union, pivot-table, tdd]
status: complete
completed: 2026-04-14

dependency_graph:
  requires: []
  provides: [RPT-03]
  affects: [ReportsPage, reportsService, reports-router]

tech_stack:
  added: []
  patterns:
    - In-memory Map aggregation (matching existing getFringeSummary pattern)
    - TDD: RED stub first, then implementation

key_files:
  created:
    - tests/routes/fringe-breakdown.test.ts
  modified:
    - src/server/services/reportsService.ts
    - src/server/routes/reports.ts
    - src/client/pages/ReportsPage.tsx

decisions:
  - In-memory Map aggregation used instead of Drizzle groupBy (matches codebase pattern, avoids SQLite groupBy complexity)
  - Null unionLocal mapped to 'Unaffiliated' string
  - Zero-amount fund type rows excluded from output (no noise in remittance reports)
  - Optional ?weekId= query param filters to a single payroll week
  - Pivot table built client-side from flat row array (server sorts, client pivots)

metrics:
  duration_minutes: 12
  tasks_completed: 4
  files_modified: 4
  tests_added: 2
  tests_passing: 2
---

# Phase 58 Plan 01: Fringe Benefit Breakdown Summary

**One-liner:** Fringe benefit breakdown by fund type (H&W, Pension, Vacation, Training) grouped by union local and classification level, with pivot table UI and totals row.

## What Was Built

### RPT-03: getFringeBreakdown service function

Added `getFringeBreakdown(projectId, weekId?)` to `src/server/services/reportsService.ts`. The function:

- Joins `payrollEntries` -> `payrollWeeks` -> `workers` -> `workerClassifications`
- Reads four fringe columns: `fringeHealthWelfare`, `fringePension`, `fringeVacation`, `fringeTraining`
- Aggregates in-memory using a `Map` keyed by `${fundType}|${unionLocal}|${classificationLevel}`
- Maps null `unionLocal` to `'Unaffiliated'`
- Excludes rows where fringe amount is null or 0
- Tracks distinct `workerIds` per group to compute `workerCount`
- Sorts output: unionLocal ASC, classificationLevel ASC, fundType ASC
- Exports `FringeBreakdownRow` interface

### GET /api/reports/:projectId/fringe-breakdown route

Added to `src/server/routes/reports.ts`:

- Follows identical pattern to RPT-01 and RPT-02
- `assertProjectAccess(db, projectId, userId)` gates access — returns 403 for non-members
- Optional `?weekId=` query parameter passed through to service
- Returns `{ rows: FringeBreakdownRow[] }`

### Fringe Breakdown tab in ReportsPage.tsx

Added third tab to `src/client/pages/ReportsPage.tsx`:

- Extended tab union type: `'fringe' | 'payHistory' | 'fringeBreakdown'`
- Added `FringeBreakdownRow` interface (client-side mirror of server interface)
- Added `useQuery` for `/api/reports/:projectId/fringe-breakdown`
- Pivot table: rows grouped by Union Local + Classification, columns = H&W / Pension / Vacation / Training
- Loading, error, and empty-state messages
- `<tfoot>` totals row summing each fund type column

## Key Decisions

1. **In-memory aggregation over Drizzle groupBy** — The existing `getFringeSummary` uses this pattern. SQLite groupBy with multi-column keys and computed aggregates requires raw SQL or workarounds; TypeScript Map aggregation is cleaner and testable.

2. **Null unionLocal -> 'Unaffiliated'** — Ensures non-union workers still appear in the breakdown rather than being silently dropped from the pivot.

3. **Zero-amount rows excluded** — Fund types with $0 fringe don't need to appear in remittance reports; skipping them reduces noise.

4. **Client-side pivot** — Server returns a flat sorted array of `FringeBreakdownRow` records. The UI builds the `Map<groupKey, Map<fundType, amount>>` pivot structure. This keeps the API simple and testable.

## Test Results

```
tests/routes/fringe-breakdown.test.ts (2 tests) - PASS
  GET /api/reports/:projectId/fringe-breakdown
    ✓ returns 403 when project is owned by a different user
    ✓ returns 200 with rows having fundType, unionLocal, classificationLevel, totalAmount, workerCount
```

## Commit

`afe9890` — feat(58): fringe benefit breakdown by fund type, union local, classification

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `tests/routes/fringe-breakdown.test.ts` — EXISTS, 2/2 tests GREEN
- `src/server/services/reportsService.ts` — exports `getFringeBreakdown` and `FringeBreakdownRow`
- `src/server/routes/reports.ts` — contains `fringe-breakdown` route
- `src/client/pages/ReportsPage.tsx` — contains `fringeBreakdown` tab
- Commit `afe9890` — EXISTS in git log
