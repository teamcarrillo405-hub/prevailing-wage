---
phase: 08-dashboard-ux-polish
plan: "04"
subsystem: frontend/compliance-dashboard
tags: [compliance, badges, project-card, tanstack-query, dashboard]
dependency_graph:
  requires: [08-02, 08-03]
  provides: [DASH-01, DASH-02]
  affects: [ProjectCard, DashboardPage]
tech_stack:
  added: []
  patterns: [per-card useQuery with staleTime, compliance badge rendering]
key_files:
  created: []
  modified:
    - src/client/components/projects/ProjectCard.tsx
decisions:
  - "Compliance query lives inside ProjectCard (not DashboardPage) — each card owns its own fetch, keeps DashboardPage unchanged"
  - "staleTime: 60_000 on compliance-summary query — prevents N re-fetches when navigating back to dashboard"
  - "No payroll badge shows when summary is undefined OR weekCount === 0 — covers both first-load and empty-project states"
metrics:
  duration: "2m"
  completed_date: "2026-03-20"
  tasks_completed: 1
  tasks_total: 2
  files_changed: 1
---

# Phase 08 Plan 04: Compliance Badge + Week Stats on ProjectCard Summary

**One-liner:** Per-card TanStack Query fetches compliance summary and renders green/red/gray badge plus week count on each project card in the dashboard.

## What Was Built

### Task 1: Compliance badge and week stats in ProjectCard (DASH-01 / DASH-02)

Modified `src/client/components/projects/ProjectCard.tsx` to:

- Import `useQuery` from `@tanstack/react-query`
- Add a query fetching `GET /api/compliance/project/:projectId` keyed as `['compliance-summary', project.id]`
- Set `staleTime: 60_000` to prevent redundant re-fetches when navigating back to the dashboard
- Render compliance badge section only after loading completes (no flash):
  - Red "Violations" badge when `summary.badge === 'violations'`
  - Green "Clean" badge when `summary.badge === 'clean'` and `weekCount > 0`
  - Gray "No payroll" badge when summary is absent or `weekCount === 0`
- Render week stat text (e.g., "3 weeks, Week 12") when weeks exist

DashboardPage.tsx required no changes — it already passes `project` to `<ProjectCard />` and the query happens inside the card.

## Verification

- TypeScript: No new errors (pre-existing non-fatal errors in `workers.ts` lines 109/116 unchanged)
- Compliance tests: 9/9 pass
- Full suite: 175/175 pass (18 test files, 7 skipped, 0 failures)

## Deviations from Plan

None - plan executed exactly as written.

## Checkpoint Status

**Task 2 (checkpoint:human-verify) is pending user verification.**

The full Phase 8 feature set is ready for browser verification:
- DASH-01: Compliance badge (green/red/gray) on each project card
- DASH-02: Week count and last week number on each project card
- UX-01: ProjectDetailPage nav with Workers, Payroll Weeks, Variance, Reports (coming soon)
- UX-02: WH-347 download anchor per row on PayrollListPage
- UX-03: Amber missing-data warning on worker cards when address or SSN is null

## Self-Check

- [x] `src/client/components/projects/ProjectCard.tsx` modified and verified
- [x] Commit 1d4ed29 exists and confirmed
- [x] All 175 tests pass
