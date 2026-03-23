---
phase: 18-dashboard-search-filter
plan: 01
subsystem: ui
tags: [react, react-router, tanstack-query, url-state, filtering]

# Dependency graph
requires:
  - phase: 17-db-migration-project-archive
    provides: showArchived toggle and GET /api/projects?status= filter that this plan stacks with
provides:
  - Real-time name search on DashboardPage (DASH-03)
  - Funding type dropdown filter on DashboardPage (DASH-04)
  - URL-persisted filter state via useSearchParams (?q=, ?funding=)
  - "No matching projects" EmptyState for zero-match filter results
affects: [19-wh347-submission-tracking, 20-copy-payroll-week]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useSearchParams for URL-persisted UI filter state (back-nav restores filters automatically)
    - Dual-state pattern: inputValue (useState) for controlled input lag-free typing + searchParams for URL sync
    - useMemo for client-side filtered list derived from server data
    - Functional setSearchParams callback (prev => next) to prevent clobbering other params

key-files:
  created: []
  modified:
    - src/client/pages/DashboardPage.tsx

key-decisions:
  - "inputValue useState initialized from searchParams.get('q') — avoids useSearchParams keystroke lag while keeping URL in sync on every change"
  - "Functional setSearchParams(prev => next) used exclusively — direct object form would wipe showArchived and other co-existing params"
  - "filteredProjects derived via useMemo (not a separate query) — all filtering is client-side against the already-fetched projects array"
  - "FUNDING_OPTIONS and FUNDING_LABELS defined as module-level constants — no API call needed, funding type is a closed set of 3 values"

patterns-established:
  - "URL filter pattern: useSearchParams + useState(initializer from searchParams) + functional setter — copy for any page with filterable lists"

requirements-completed: [DASH-03, DASH-04]

# Metrics
duration: ~20min
completed: 2026-03-23
---

# Phase 18 Plan 01: Dashboard Search + Filter Summary

**Real-time name search and funding type filter added to DashboardPage with URL-persisted ?q= and ?funding= params — back navigation restores both inputs automatically**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-23
- **Completed:** 2026-03-23
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments

- Name search input filters project list by substring in real time (DASH-03)
- Funding type dropdown (All / Federal / State / Mixed) filters by project.fundingType (DASH-04)
- Both filter values persist in URL — browser Back restores exact search + dropdown state
- "No matching projects" EmptyState shows descriptive message naming the search term and/or funding type
- Phase 17 showArchived toggle preserved exactly, stacks correctly with new filters
- 193 vitest tests pass, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add search + filter to DashboardPage with URL-persisted state** - `35766c2` (feat)
2. **Task 2: Browser verification checkpoint** - approved by user (no code commit)

## Files Created/Modified

- `src/client/pages/DashboardPage.tsx` — Added useSearchParams, useMemo, FUNDING_OPTIONS constant, inputValue useState, handleSearchChange, handleFundingChange, filteredProjects useMemo, filter bar JSX (input + select), and "No matching projects" EmptyState branch

## Decisions Made

- **inputValue useState vs direct searchParams binding:** useSearchParams has a React render-cycle delay — typing into an input bound directly to searchParams causes visible lag. The dual-state pattern (inputValue for the controlled input, searchParams as the URL source of truth) gives instant visual response while keeping the URL always in sync.
- **Functional setSearchParams callback:** Always uses `setSearchParams(prev => { const next = new URLSearchParams(prev); ... })` — the direct object form (`setSearchParams({ q: val })`) would delete all other params (showArchived, funding, etc.) on each keystroke.
- **Client-side filtering only:** No server changes. useMemo derives filteredProjects from the already-fetched projects array — consistent with the plan spec and avoids adding query complexity.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 18 fully complete. DASH-03 and DASH-04 requirements shipped and browser-verified.
- Phase 19 (WH-347 Submission Tracking: SUB-01, SUB-02, SUB-03) is ready to plan and execute.
- No blockers.

---
*Phase: 18-dashboard-search-filter*
*Completed: 2026-03-23*
