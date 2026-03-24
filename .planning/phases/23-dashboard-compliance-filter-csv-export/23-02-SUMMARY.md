---
phase: 23-dashboard-compliance-filter-csv-export
plan: "02"
subsystem: ui
tags: [react, tanstack-query, url-params, blob-download, compliance-filter]

requires:
  - phase: 23-01
    provides: [GET /api/compliance/projects/summary, GET /api/compliance/worker/:workerId/history/csv]
provides:
  - Dashboard compliance filter chips (All/Compliant/Has Violations/No Payroll/Archived)
  - Batch summary query with summaryMap for O(1) per-project status lookup
  - URL-persisted compliance filter via ?compliance= param
  - CSV download button on WorkerComplianceHistoryPage with fetch-driven Blob URL pattern
affects: [DashboardPage, WorkerComplianceHistoryPage]

tech-stack:
  added: []
  patterns: [functional-setSearchParams-preserves-params, useRef-double-click-guard, batch-summary-map]

key-files:
  created: []
  modified:
    - src/client/pages/DashboardPage.tsx
    - src/client/pages/WorkerComplianceHistoryPage.tsx

key-decisions:
  - "summaryData?.projects (not summaryData?.data?.projects) — /compliance/projects/summary returns { projects: [] } directly, not wrapped in { data: { projects: [] } } like the projects endpoint"
  - "complianceFilterLabel derived before JSX to avoid repeated COMPLIANCE_FILTER_OPTIONS.find() calls in empty state message"
  - "Download CSV button only renders when data.entries.length > 0 — no point downloading empty CSV for compliant workers"
  - "Button variant=secondary for Download CSV — primary is for primary actions (New Project); secondary distinguishes export from main CTA"

patterns-established:
  - "Compliance chip chips: text-xs px-3 py-1 rounded border + bg-brand-gold/text-white/border-brand-gold (active) vs bg-surface-card/text-text-primary/border-border-default (inactive)"
  - "Batch summary query pattern: single useQuery(['compliance-summary-batch']) + useMemo Map for O(1) per-project lookup in filteredProjects"

requirements-completed: [DASH-05, AUD-03]

duration: 3min
completed: 2026-03-24
---

# Phase 23 Plan 02: Compliance Filter Chips + CSV Download Summary

**Compliance filter chips on the dashboard backed by batch summary Map, and fetch-driven Blob CSV download on the worker compliance history page.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T20:37:04Z
- **Completed:** 2026-03-24T20:39:42Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify — awaiting browser verification)
- **Files modified:** 2

## Accomplishments
- DashboardPage gains 5 compliance filter chips (All/Compliant/Has Violations/No Payroll/Archived) backed by the `/compliance/projects/summary` batch endpoint, eliminating N+1 per-card fetches
- Compliance filter state persists in URL as `?compliance=` and survives back-navigation; functional `setSearchParams` preserves co-existing `?q=` and `?funding=` params
- WorkerComplianceHistoryPage gains a "Download CSV" button wired to the existing CSV route via fetch-driven Blob URL download with synchronous `useRef` double-click guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Add compliance filter chips to DashboardPage** - `09d5abd` (feat)
2. **Task 2: Add CSV download button to WorkerComplianceHistoryPage** - `6b4dbeb` (feat)

_Task 3 is checkpoint:human-verify — browser verification pending._

## Files Created/Modified
- `src/client/pages/DashboardPage.tsx` - COMPLIANCE_FILTER_OPTIONS constant, batch summary query, summaryMap useMemo, complianceFilter URL param, handleComplianceFilterChange, filter chips row in JSX, updated empty state message
- `src/client/pages/WorkerComplianceHistoryPage.tsx` - useRef + Button imports, downloadingRef, handleDownloadCsv (fetch/Blob/createObjectURL/revokeObjectURL), Download CSV button in PageHeader action slot

## Decisions Made
- `summaryData?.projects` (not `summaryData?.data?.projects`) — the compliance summary endpoint returns `{ projects: [] }` directly, not wrapped in `{ data: { ... } }` like the projects list endpoint
- `complianceFilterLabel` derived once before JSX to avoid repeated array `.find()` calls inside the empty state message conditional
- Download CSV button conditional on `data.entries.length > 0` — hides button for workers with zero violations (no point generating empty CSV)
- `Button variant="secondary"` for Download CSV — differentiates export action from primary CTAs (New Project uses default primary variant)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Task 3 (checkpoint:human-verify) requires browser verification of filter chips and CSV download behavior
- After approval, Phase 23 is complete and Phase 24 (CA DIR A-1-131 form) can begin
- No blockers identified

---
*Phase: 23-dashboard-compliance-filter-csv-export*
*Completed: 2026-03-24*
