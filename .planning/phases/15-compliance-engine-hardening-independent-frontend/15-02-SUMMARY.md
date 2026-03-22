---
phase: 15-compliance-engine-hardening-independent-frontend
plan: 02
subsystem: ui
tags: [react, tanstack-query, tailwind, progress-indicator]

# Dependency graph
requires:
  - phase: 14-page-by-page-polish
    provides: ProjectDetailPage with PageHeader + Card layout structure
provides:
  - WorkflowProgress 4-step inline component on ProjectDetailPage
  - workers and payroll-weeks parallel useQuery hooks for step completion
affects: [phase-16-wh347-submission-ux]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline single-use component pattern, parallel useQuery hooks for derived UI state]

key-files:
  created: []
  modified:
    - src/client/pages/ProjectDetailPage.tsx

key-decisions:
  - "WorkflowProgress defined inline in ProjectDetailPage (not a separate file) — it is single-use"
  - "isFinal used as WH-347 download proxy for step 4 — Phase 16 may add proper download tracking"
  - "bg-status-compliant design token used for completed steps (green) — consistent with compliance badge system"
  - "Unicode checkmark U+2713 used (not emoji) — consistent with project no-emoji convention"

patterns-established:
  - "Parallel useQuery hooks: workers and payroll-weeks fetched independently alongside project query"
  - "Step completion derived inline from API data arrays before render — no server-side aggregation needed"

requirements-completed: [UX-04]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 15 Plan 02: WorkflowProgress Indicator Summary

**4-step workflow progress indicator (Create Project, Add Workers, Enter Payroll, Download WH-347) added to ProjectDetailPage, driven by real workers and payroll-weeks API data**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T14:17:00Z
- **Completed:** 2026-03-22T14:22:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added two parallel useQuery hooks (workers, payroll-weeks) alongside existing project query
- Created inline WorkflowProgress component with 4 steps, completed steps show green circle with checkmark, incomplete show numbered gray circle
- Connector lines between steps reflect color of the preceding step (green if complete, gray if not)
- All 181 existing tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add WorkflowProgress component and data queries to ProjectDetailPage** - `bc9f6a1` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/client/pages/ProjectDetailPage.tsx` - Added WorkflowProgress component, 2 new useQuery hooks, step completion derivation

## Decisions Made

- WorkflowProgress defined inline in ProjectDetailPage — single-use component does not warrant a separate file (consistent with WildcardRedirect pattern from Phase 13)
- isFinal proxy for WH-347 step: accurate when contractors mark payroll weeks final; comment added noting Phase 16 may add proper tracking
- Design tokens used: bg-status-compliant (green) for completed state, border-gray-300/text-gray-400 for pending state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WorkflowProgress is live on Project Detail page; contractor can now see at a glance where they are in the 4-step lifecycle
- Phase 16 (WH-347 Submission UX) will benefit from the isFinal proxy for step 4 until proper download tracking is added
- No blockers for remaining Phase 15 plans

---
*Phase: 15-compliance-engine-hardening-independent-frontend*
*Completed: 2026-03-22*

## Self-Check: PASSED

- src/client/pages/ProjectDetailPage.tsx — FOUND
- .planning/phases/15-compliance-engine-hardening-independent-frontend/15-02-SUMMARY.md — FOUND
- Commit bc9f6a1 — FOUND
