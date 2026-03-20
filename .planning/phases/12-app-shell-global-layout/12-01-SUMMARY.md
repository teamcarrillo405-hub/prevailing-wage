---
phase: 12-app-shell-global-layout
plan: 01
subsystem: ui
tags: [tailwindcss, design-tokens, layout, navigation]

# Dependency graph
requires:
  - phase: 10-css-design-token-foundation
    provides: "@theme tokens bg-nav-dark, border-brand-gold, hover:text-brand-gold defined in index.css"
provides:
  - "Layout.tsx nav using brand-correct #1a1a1a dark background and #F5C518 gold accent via design tokens"
  - "All 8 protected pages inherit dark nav and gold accent through shared Layout without per-page changes"
affects: [13-landing-page-routing, 14-page-by-page-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Design token utility classes replace hardcoded hex values — bg-nav-dark, border-brand-gold, hover:text-brand-gold"]

key-files:
  created: []
  modified:
    - src/client/components/shared/Layout.tsx

key-decisions:
  - "[Phase 12-01]: bg-gray-900 (#111827) replaced with bg-nav-dark (#1a1a1a) — nav-dark is brand-correct per HCC spec"

patterns-established:
  - "Token pattern: reference @theme custom tokens in components instead of hardcoded hex values"

requirements-completed: [SHELL-01]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 12 Plan 01: App Shell + Global Layout Summary

**Layout.tsx nav migrated from hardcoded hex (#F5C518, bg-gray-900) to design tokens (bg-nav-dark, border-brand-gold, hover:text-brand-gold), propagating brand-correct dark nav and gold accent to all 8 protected pages**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T18:17:21Z
- **Completed:** 2026-03-20T18:18:46Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced `bg-gray-900` (#111827) with `bg-nav-dark` (#1a1a1a) — now uses brand-correct dark background
- Replaced `border-[#F5C518]` with `border-brand-gold` — nav bottom border uses token
- Replaced `hover:text-[#F5C518]` with `hover:text-brand-gold` — HCC Prevailing Wage link hover uses token
- All 181 tests continue to pass — no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate Layout.tsx nav to design tokens** - `e132005` (feat)

## Files Created/Modified

- `src/client/components/shared/Layout.tsx` - Nav classes migrated to bg-nav-dark, border-brand-gold, hover:text-brand-gold

## Decisions Made

- bg-gray-900 (#111827) replaced with bg-nav-dark (#1a1a1a) — the brand spec calls for #1a1a1a (slightly lighter than gray-900 but brand-correct per HCC design guidelines)
- Log Out button styling (text-gray-300, hover:text-white, border-gray-600) intentionally left unchanged — uses standard Tailwind grays, not brand tokens

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SHELL-01 complete — shared Layout uses design tokens for all brand values
- All 8 protected pages (Dashboard, ProjectDetail, Workers, PayrollEntry, PayrollList, PayrollWeekDetail, OtScenario, Reports) now inherit dark nav (#1a1a1a) and gold accent (#F5C518) via Layout without any per-page changes
- Ready to continue Phase 12 with SHELL-02 and SHELL-03

---
*Phase: 12-app-shell-global-layout*
*Completed: 2026-03-20*
