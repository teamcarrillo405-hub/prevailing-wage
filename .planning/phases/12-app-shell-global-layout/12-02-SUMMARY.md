---
phase: 12-app-shell-global-layout
plan: 02
subsystem: ui
tags: [react, tailwind, design-system, typography, page-header]

# Dependency graph
requires:
  - phase: 11-ui-primitives
    provides: PageHeader component (title, subtitle, action props) and Button component
provides:
  - DashboardPage using PageHeader primitive for page title and action slot
  - ProjectDetailPage using PageHeader primitive for page title and location subtitle
affects: [14-page-by-page-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [PageHeader primitive adoption pattern for all page-level titles]

key-files:
  created: []
  modified:
    - src/client/pages/DashboardPage.tsx
    - src/client/pages/ProjectDetailPage.tsx

key-decisions:
  - "ProjectDetailPage subtitle: state — county location string passed as subtitle prop to PageHeader (not left as separate p element)"
  - "DashboardPage 'New Project' button migrated to Button primitive inside PageHeader action slot"
  - "PageHeader mb-6 is the correct spec value; replaces old inline mb-8 in DashboardPage"

patterns-established:
  - "Page title pattern: import PageHeader, use <PageHeader title={...} /> at top of page content — no raw h1/h2 for page-level titles"
  - "Action slot pattern: right-aligned page action buttons go in PageHeader action prop using the Button primitive"

requirements-completed: [SHELL-02]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 12 Plan 02: App Shell + Global Layout — PageHeader Adoption Summary

**DashboardPage and ProjectDetailPage migrated from raw h2 elements to PageHeader primitive, establishing h1 semantic hierarchy and design-system typography pattern for all pages.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T17:17:00Z
- **Completed:** 2026-03-20T17:22:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- DashboardPage now renders "Projects" as h1 via PageHeader with Button primitive in action slot
- ProjectDetailPage renders project name as h1 via PageHeader, with state/county as subtitle prop
- Inline flex header div and raw h2 elements fully removed from both pages
- All 181 tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Adopt PageHeader in DashboardPage** - `591a2e5` (feat)
2. **Task 2: Adopt PageHeader in ProjectDetailPage** - `424954a` (feat)

## Files Created/Modified
- `src/client/pages/DashboardPage.tsx` - Added PageHeader and Button imports; replaced inline flex header div with PageHeader primitive
- `src/client/pages/ProjectDetailPage.tsx` - Added PageHeader import; replaced h2 + p subtitle elements with PageHeader title+subtitle props

## Decisions Made
- ProjectDetailPage's adjacent `<p>` subtitle (`{project.state} — {project.county}`) was passed as the `subtitle` prop on PageHeader rather than left as a separate element — consistent with PageHeader's subtitle slot design
- DashboardPage's inline `<button>` with hardcoded brand styles was replaced with the `Button` primitive — removes the last hardcoded `#F5C518` from the page
- mb-6 (PageHeader default) replaces mb-8 (old DashboardPage inline) — design system standard is authoritative

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Typography hierarchy pattern is established: all page-level titles now use PageHeader (h1 via design system)
- Phase 14 (Page-by-Page Polish) can reference this pattern and follow it for any remaining pages
- No blockers

---
*Phase: 12-app-shell-global-layout*
*Completed: 2026-03-20*
