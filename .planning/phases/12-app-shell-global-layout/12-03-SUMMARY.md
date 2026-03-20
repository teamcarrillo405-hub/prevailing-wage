---
phase: 12-app-shell-global-layout
plan: 03
subsystem: ui
tags: [react, tailwindcss, card-primitive, design-tokens]

# Dependency graph
requires:
  - phase: 11-ui-primitives
    provides: Card primitive with padding variants (default/sm/none)
  - phase: 12-app-shell-global-layout
    plan: 02
    provides: PageHeader adoption complete
provides:
  - Card primitive adopted in ProjectDetailPage, PayrollWeekDetailPage, WorkersPage, PayrollListPage
  - ProjectCard hover border uses brand-gold token (no hardcoded hex)
  - SHELL-03 requirement satisfied
affects:
  - 14-page-by-page-polish

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Card padding="none" for table wrappers and containers with internal padding
    - Card padding="sm" for compact item cards (worker blocks)
    - Card (default) for form containers with p-6 spacing
    - hover:border-brand-gold token replaces hardcoded hover:border-[#F5C518]

key-files:
  created: []
  modified:
    - src/client/pages/ProjectDetailPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollListPage.tsx
    - src/client/components/shared/ProjectCard.tsx

key-decisions:
  - "Card padding=none used for all table wrappers — cells control their own padding, outer card adds no padding"
  - "Card padding=sm (p-4) used for worker blocks — approximates original p-5 while enforcing token system"
  - "ProjectCard button element NOT wrapped in Card — full restructure deferred to Phase 14 (PAGE-01)"

patterns-established:
  - "Pattern 1: All bg-white border border-gray-200 rounded-lg card divs replaced with Card primitive"
  - "Pattern 2: padding=none for table/dense containers, padding=sm for compact item cards, default for form sections"
  - "Pattern 3: Brand color tokens used in all hover states — no hardcoded hex values in component classes"

requirements-completed: [SHELL-03]

# Metrics
duration: ~10min
completed: 2026-03-20
---

# Phase 12 Plan 03: Card Primitive Adoption Summary

**8 inline card div patterns replaced with Card primitive across 5 files, completing SHELL-03 and eliminating all hardcoded card styling in the protected app shell.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-20T18:20:09Z
- **Completed:** 2026-03-20T18:30:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 5

## Accomplishments

- ProjectDetailPage project info section wrapped in Card (max-w-lg preserved via className)
- PayrollWeekDetailPage week summary, empty state, and entries table all wrapped in Card padding="none"
- WorkersPage worker blocks use Card padding="sm", add-worker form uses Card (default)
- PayrollListPage payroll weeks list uses Card padding="none" with divide-y utility class
- ProjectCard hover border changed from hardcoded hover:border-[#F5C518] to hover:border-brand-gold token
- All 181 tests remained green after each task
- Human visual verification approved — consistent card appearance confirmed across all pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Adopt Card in ProjectDetailPage, PayrollWeekDetailPage, and ProjectCard** - `58b12fc` (feat)
2. **Task 2: Adopt Card in WorkersPage and PayrollListPage** - `209d004` (feat)
3. **Task 3: Visual verification of Card adoption and phase sign-off** - checkpoint:human-verify — approved

## Files Created/Modified

- `src/client/pages/ProjectDetailPage.tsx` - Project info section uses Card
- `src/client/pages/PayrollWeekDetailPage.tsx` - Week summary, empty state, entries table use Card padding="none"
- `src/client/pages/WorkersPage.tsx` - Worker blocks use Card padding="sm", add-worker form uses Card
- `src/client/pages/PayrollListPage.tsx` - Payroll weeks list uses Card padding="none" with divide-y
- `src/client/components/shared/ProjectCard.tsx` - hover:border-brand-gold token replaces hardcoded hex

## Decisions Made

- Card padding="none" used for all table wrappers — cells control their own padding, no double-padding
- Card padding="sm" (p-4) used for worker blocks — approximates original p-5 while enforcing the token system
- ProjectCard button element not wrapped in Card — full restructure is Phase 14 (PAGE-01) scope, only hover token fixed here

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SHELL-03 complete — Card primitive is now the standard container across all protected pages in scope
- Phase 13 (Landing Page + Routing) can proceed independently
- Phase 14 (Page-by-Page Polish) has clear foundation — remaining PAGE-01 through PAGE-07 tasks will build on Card + PageHeader + Button primitives established in Phases 11-12

---
*Phase: 12-app-shell-global-layout*
*Completed: 2026-03-20*
