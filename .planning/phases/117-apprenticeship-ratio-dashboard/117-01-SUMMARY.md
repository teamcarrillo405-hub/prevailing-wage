---
phase: 117
plan: 01
subsystem: apprenticeship-dashboard
tags: [apprenticeship, IRA, IIJA, compliance, reporting, sparkline]
dependency_graph:
  requires: [complianceService COMP-04/COMP-05, workerClassifications.laborType, projects.apprenticeshipRequirements, projects.isIraIijaProject]
  provides: [GET /api/apprenticeship/:projectId/apprenticeship-dashboard, ApprenticeshipDashboard component, /projects/:projectId/apprenticeship route]
  affects: [ProjectDetailPage, ReportsPage, App.tsx]
tech_stack:
  added: []
  patterns: [raw SQLite GROUP BY via db.$client.prepare(), SVG sparkline (GrowthDashboardPage pattern), collapsible section (Option B), ReportsPage 5th tab]
key_files:
  created:
    - src/server/routes/apprenticeship.ts
    - src/client/components/ApprenticeshipDashboard.tsx
    - src/client/pages/ApprenticeshipPage.tsx
    - tests/routes/apprenticeship.test.ts
  modified:
    - src/server/index.ts
    - src/client/pages/ProjectDetailPage.tsx
    - src/client/pages/ReportsPage.tsx
    - src/client/App.tsx
decisions:
  - "No week_starting_date column in payroll_weeks — use week_ending_date as weekStartDate in weekly trend (same semantics, avoids schema change)"
  - "Per-trade SQL aggregates apprentice/journey hours in single GROUP BY trade_code query — avoids N+1 joins"
  - "Option B (collapsible section) for ProjectDetailPage — no existing tab structure to add to"
  - "ApprenticeshipSection uses useState for open/close — no external library needed"
  - "SVG stroke hex values (#F5C518 brand-gold, #1B2A4A brand-navy) with inline comments per brand token rule"
  - "HardHat icon for Apprenticeship tab — semantically correct, available in lucide-react"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-27"
  tasks: 3
  files_modified: 8
---

# Phase 117 Plan 01: Apprenticeship Ratio Dashboard Summary

**One-liner:** Per-trade apprenticeship ratio dashboard with IRA/IIJA 15% compliance banner, 12-week SVG sparkline trend, and collapsible ProjectDetailPage section + 5th ReportsPage tab.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | GET /api/apprenticeship-dashboard | 160f339 | apprenticeship.ts, index.ts, tests/routes/apprenticeship.test.ts |
| 2 | ApprenticeshipDashboard component | 99b5b4a | ApprenticeshipDashboard.tsx |
| 3 | Wire into ProjectDetailPage + ReportsPage | a3aea7b | ProjectDetailPage.tsx, ReportsPage.tsx, ApprenticeshipPage.tsx, App.tsx |

## What Was Built

### Server API (Task 1)
- `GET /api/apprenticeship/:projectId/apprenticeship-dashboard` — returns `overall`, `byTrade[]`, `weeklyTrend[]`
- Raw SQLite `prepare().all()` for the per-trade GROUP BY aggregation (same pattern as hours-pivot)
- `parseMaxRatio("1:2")` → compliant check: apprentice fraction must not exceed `1/(1+N)`
- `formatActualRatio` formats as "1:X" string
- `requireAuth` + `assertProjectAccess` IDOR guard
- 5 vitest route tests: auth, IDOR, overall/byTrade/weeklyTrend shapes, IRA flag, numeric types

### React Component (Task 2)
- `ApprenticeshipDashboard({ projectId })` — fully self-contained with `useQuery`
- IRA/IIJA amber/green banner computed from `overall.apprenticePct` vs 15% target
- 3 stat cards: total apprentice hours, apprentice %, IRA status label
- By-trade table: journey hrs, apprentice hrs, worker counts, required ratio, actual ratio, status badge
- SVG sparkline (GrowthDashboardPage pattern): dots colored red when below IRA target; dashed reference line at 15%
- Action card when any trade is non-compliant, links to Workers page

### Wiring (Task 3)
- `ApprenticeshipSection` collapsible in `ProjectDetailPage` after Subcontractors panel (Option B)
- 5th tab "Apprenticeship" added to `ReportsPage` (HardHat icon, grid expanded to `lg:grid-cols-5`)
- `ApprenticeshipPage` deep-linkable wrapper at `/projects/:projectId/apprenticeship`
- Route registered in `App.tsx` under ProtectedRoute

## Test Results

- 838 tests passing (up from 824 before Phase 117)
- 0 TypeScript errors
- All 5 apprenticeship route tests pass

## Deviations from Plan

**1. [Rule 1 - Bug] No week_starting_date column in payroll_weeks**
- **Found during:** Task 1 SQL query writing
- **Issue:** Plan referenced `pw.week_starting_date` but schema only has `week_ending_date`
- **Fix:** Used `week_ending_date` as `weekStartDate` in the weeklyTrend array — semantically the same identifier for a payroll week
- **Files modified:** apprenticeship.ts
- **Commit:** 160f339

## Known Stubs

None. All API data flows through to the UI via real database queries.

## Self-Check: PASSED

- `src/server/routes/apprenticeship.ts` — FOUND
- `src/client/components/ApprenticeshipDashboard.tsx` — FOUND
- `src/client/pages/ApprenticeshipPage.tsx` — FOUND
- `tests/routes/apprenticeship.test.ts` — FOUND
- Commits 160f339, 99b5b4a, a3aea7b — FOUND in git log
