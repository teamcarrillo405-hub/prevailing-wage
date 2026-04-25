---
phase: 73
plan: 01
subsystem: dashboard
tags: [dashboard, compliance, recharts, visualization]
dependency_graph:
  requires: [compliance-service, batch-compliance-endpoint]
  provides: [DASH-01, DASH-02, DASH-03, DASH-04]
  affects: [DashboardPage, ProjectCard, complianceService, compliance-route]
tech_stack:
  added: [recharts (already installed, now imported)]
  patterns: [batch-data-enrichment, client-side-aggregation]
key_files:
  created: []
  modified:
    - src/client/pages/DashboardPage.tsx
    - src/client/components/projects/ProjectCard.tsx
    - src/server/routes/compliance.ts
    - src/server/services/complianceService.ts
decisions:
  - Extended BatchProjectSummary type to carry violationCount + unsubmittedWeekEndingDates rather than adding a second endpoint
  - Trend chart uses client-side approximation bucketing violations into week slots from unsubmitted week dates
  - ProjectCard accepts optional violationCount prop — falls back to per-card fetch when not provided
metrics:
  duration: ~20 minutes
  completed_date: "2026-04-25"
  tasks_completed: 4
  files_modified: 4
---

# Phase 73 Plan 01: Compliance Dashboard — Hero Stats, Trend Chart, At-Risk Panel, Count Badges

One-liner: Dashboard hero stat row + 12-week recharts trend line + at-risk panel + violation count badges via extended batch compliance endpoint returning violationCount per project.

## What Was Built

### DASH-01: Hero Stat Row
Three KPI cards rendered above the project grid (below the getting-started banner):
- **Active Projects** — count of projects with `status === 'active'`
- **Open Violations** — total violation count across all projects (red when >0, emerald when 0)
- **Due This Week** — count of projects with at least one unsubmitted payroll week ending within 7 days (amber when >0)

### DASH-02: 12-Week Violation Trend Chart
Recharts `LineChart` with `ResponsiveContainer` showing weekly violation totals for the last 12 weeks. Data is computed client-side from `summaryItemMap` — violations are bucketed into the nearest week slot based on `unsubmittedWeekEndingDates`. Chart is informational and conditional on `projects.length > 0`.

### DASH-03: Projects-at-Risk Panel
Panel with red border listing up to 5 projects with `violationCount > 0`, sorted descending by violation count. Each row shows project name, violation count, and a "Resolve →" link to the project page.

### DASH-04: Violation Count Badges on Project Cards
`ProjectCard` now accepts optional `violationCount?: number` prop from the parent (supplied from the batch summary). When provided:
- `violationCount > 0` → `<Badge variant="violation">N violation(s)</Badge>`
- `violationCount === 0` → falls back to clean/no-payroll badge from per-card query

When prop is absent, falls back to existing per-card API behavior (backward compatible).

## Server Changes

### `complianceService.ts` — `getBatchProjectCompliance`
- New `BatchProjectSummary` interface: `{ status, violationCount, unsubmittedWeekEndingDates }`
- Return type changed from `Map<string, string>` to `Map<string, BatchProjectSummary>`
- For each project: accumulates `violations.length + weekViolations.length` across all weeks
- Collects `weekEndingDate` strings for weeks where `submittedAt` is null

### `compliance.ts` — `/projects/summary` endpoint
- Now maps the richer `BatchProjectSummary` to expose `violationCount` and `unsubmittedWeekEndingDates` per project
- Backward compatible: `status` field still present

## Deviations from Plan

None — plan executed exactly as written, with one clarification:

The `summaryMap` (Map<string, string>) is preserved alongside the new `summaryItemMap` (Map<string, ProjectSummaryItem>) so the existing `ComplianceOverviewCard` prop interface is not broken.

## Test Results

- **Test files:** 56 passed, 7 skipped
- **Tests:** 724 passed, 42 todo
- **TypeScript:** 0 errors (`tsc --noEmit` clean)
- **Recharts:** already at ^3.8.0 in package.json — no install needed

## Phase B Completion Note

Phase 73 completes **Phase B** of the HCC Prevailing Wage compliance dashboard build. All four DASH requirements are implemented:
- DASH-01: Hero stat row
- DASH-02: 12-week trend chart
- DASH-03: Projects-at-risk panel
- DASH-04: Violation count badges

**Phase B is complete and ready for Watchdog grading.**

## Self-Check

- [x] `src/client/pages/DashboardPage.tsx` — modified, stat row + chart + at-risk panel present
- [x] `src/client/components/projects/ProjectCard.tsx` — violationCount prop + count badge
- [x] `src/server/routes/compliance.ts` — /projects/summary returns violationCount
- [x] `src/server/services/complianceService.ts` — BatchProjectSummary type + extended logic
- [x] Commit `efd22a6` exists

## Self-Check: PASSED
