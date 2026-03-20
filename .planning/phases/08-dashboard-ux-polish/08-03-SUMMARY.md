---
phase: 08-dashboard-ux-polish
plan: "03"
subsystem: client-ux
tags: [navigation, ux, wh347, workers, variance]
dependency_graph:
  requires: [08-01, 08-02]
  provides: [UX-01, UX-02, UX-03]
  affects: [ProjectDetailPage, PayrollListPage, WorkersPage, App]
tech_stack:
  added: []
  patterns: [react-router useParams wrapper, amber inline badge, conditional render]
key_files:
  created:
    - src/client/pages/VarianceReportPageRoute.tsx
  modified:
    - src/client/pages/PayrollListPage.tsx
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/ProjectDetailPage.tsx
    - src/client/App.tsx
decisions:
  - VarianceReportPageRoute is a thin wrapper (3 lines) — preserves VarianceReportPage as reusable component with explicit Props
  - Reports nav link is a span (not Link) with cursor-not-allowed to signal Phase 9 pending without a broken route
  - OT Scenario Planner link retained in ProjectDetailPage nav — not removed, Variance and Reports added after it
metrics:
  duration: "2m"
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 5
---

# Phase 08 Plan 03: UX Navigation and Worker Warnings Summary

All three UX requirements implemented across 4 modified files and 1 new file. Navigation dead ends eliminated — every page now has clear onward routing, and workers page surfaces data gaps before WH-347 generation.

## Tasks Completed

### Task 1: UX-02 + UX-03 — WH-347 anchor and missing-data warning

**PayrollListPage.tsx** — Each payroll week row now renders a "Download WH-347" anchor (`<a href="/api/export/wh347/:weekId">`) alongside the existing "View" link. The anchor uses the same gray-900 button style as PayrollWeekDetailPage for visual consistency.

**WorkersPage.tsx** — Worker card normal view (non-edit) now shows an amber inline badge when `address` or `ssnLast4` is null: "Missing data — WH-347 blocked". Uses `bg-amber-100 text-amber-700` inline span — lighter weight than the WD-missing banner above it.

Commit: `c362e2d`

### Task 2: UX-01 — Variance route + ProjectDetailPage nav

**VarianceReportPageRoute.tsx** (new) — Thin wrapper: `useParams<{ projectId: string }>()` extracts `projectId`, returns null guard, then `<VarianceReportPage projectId={projectId} />`. VarianceReportPage.tsx untouched.

**App.tsx** — Imported `VarianceReportPageRoute` and registered `<Route path="/projects/:projectId/variance" element={<VarianceReportPageRoute />} />` alongside other project routes.

**ProjectDetailPage.tsx** — Added Variance `<Link>` (active, functional route) and Reports `<span>` (greyed, cursor-not-allowed) after existing nav links. Order: Workers | Payroll Weeks | OT Scenario Planner | Variance | Reports (coming soon).

Commit: `429b7b6`

## Verification

- TypeScript: 0 new errors (2 pre-existing implicit-any in workers.ts — known)
- Test suite: 175 passed, 0 failed, 42 todo (no regressions)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/client/pages/VarianceReportPageRoute.tsx` — created
- `src/client/pages/PayrollListPage.tsx` — modified
- `src/client/pages/WorkersPage.tsx` — modified
- `src/client/pages/ProjectDetailPage.tsx` — modified
- `src/client/App.tsx` — modified
- Commits c362e2d and 429b7b6 exist in git log
