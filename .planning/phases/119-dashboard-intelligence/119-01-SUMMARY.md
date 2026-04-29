---
phase: 119-dashboard-intelligence
plan: "01"
subsystem: server/routes
tags: [dashboard, api, compliance, tdd]
dependency_graph:
  requires: []
  provides: [GET /api/dashboard/stats, GET /api/dashboard/compliance-trend, GET /api/dashboard/at-risk]
  affects: [src/server/routes/dashboard.ts, tests/routes/dashboard.test.ts]
tech_stack:
  added: []
  patterns: [getBatchProjectCompliance reuse, requireAuth middleware, oldest-first 12-week bucket, top-5 DESC sort]
key_files:
  created:
    - tests/routes/dashboard.test.ts
  modified:
    - src/server/routes/dashboard.ts
decisions:
  - "getBatchProjectCompliance reused for /stats and /compliance-trend — avoids duplicate batch traversal per RESEARCH.md Pitfall 3"
  - "at-risk uses raw payrollWeeks query (not getBatchProjectCompliance) because it needs per-project past-due count + oldest date, not aggregate violationCount"
  - "Pitfall 2 resolved: at-risk 'violations > 7 days old' = past-due unsubmitted payroll week whose weekEndingDate < today-7d, matching existing /violations route semantics exactly"
  - "weekEnd internal field stripped from compliance-trend response via .map() — public shape is weekLabel + violationCount only"
metrics:
  duration_seconds: 196
  completed_date: "2026-04-29"
  tasks_completed: 4
  files_changed: 2
---

# Phase 119 Plan 01: Dashboard Intelligence Endpoints Summary

**One-liner:** Three new GET routes (/stats, /compliance-trend, /at-risk) add server-side dashboard intelligence, reusing getBatchProjectCompliance and locking shapes behind 9 Vitest route tests.

## What Was Built

### Endpoint Contracts (locked for Plan 02 UI wiring)

**GET /api/dashboard/stats**
```
{ activeProjects: number, openViolations: number, weeksDueThisWeek: number }
```
- activeProjects = count of non-archived projects (status !== 'archived' from BatchProjectSummary)
- openViolations = sum of violationCount across all user projects
- weeksDueThisWeek = count of projects with at least one unsubmitted weekEndingDate in [today, today+7]
- Reuses getBatchProjectCompliance — single batch call, no duplicate DB traversal

**GET /api/dashboard/compliance-trend**
```
{ weeks: Array<{ weekLabel: string, violationCount: number }> }  // exactly 12 entries, oldest-first
```
- weekLabel format: `toLocaleDateString('en-US', { month: 'short', day: 'numeric' })` (e.g., "Apr 29")
- Bucket logic mirrors legacy DashboardPage trendData useMemo — visual parity preserved for Plan 02 swap
- weekEnd internal field stripped from response via .map()

**GET /api/dashboard/at-risk**
```
{ projects: Array<{ id: string, name: string, openViolationCount: number, oldestViolationDays: number }> }
```
- "At risk" = project with at least one unsubmitted payroll week where weekEndingDate < today-7d
- Sorted by openViolationCount DESC, limited to top 5
- Empty array when no qualifying projects

### Test Coverage

`tests/routes/dashboard.test.ts` — 9 tests, 3 describe blocks:
- /stats: auth 401, shape (typeof numbers), zero-state exact equality
- /compliance-trend: auth 401, weeks array length 12 + element shape, oldest-first ordering
- /at-risk: auth 401, empty array exact equality, length <= 5 + DESC sort order

### File Changes

- `src/server/routes/dashboard.ts`: +166 lines (import + 3 new routes before /economic-impact)
- `tests/routes/dashboard.test.ts`: +150 lines (new file)

## Deviations from Plan

### Implementation Consolidation

All three routes (Tasks 2, 3, 4) were implemented in a single edit pass since they are co-located in dashboard.ts and committed together. The TDD RED (Task 1) was committed separately as required. No behavioral changes from the plan spec.

### Auto-fixed Issues

None.

## Known Stubs

None — all three routes return live data from the database.

## Pitfall 2 Resolution (at-risk semantics)

RESEARCH.md noted ambiguity in the definition of "violations > 7 days old." Resolved as: a project is "at risk" when it has at least one unsubmitted payroll week whose `weekEndingDate < today - 7 days`. This matches the existing `/violations` route semantics exactly — using the past-due payroll-week definition, NOT the broader `BatchProjectSummary.violationCount` which includes daily/weekly compliance engine flags.

## Self-Check: PASSED
