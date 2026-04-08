---
phase: 47-state-foundations-tx-certified-payroll
plan: 04
subsystem: ui
tags: [react, lucide-react, helpcallout, tx, state-gating]

# Dependency graph
requires:
  - phase: 47-02
    provides: isTX boolean derived from project.state in PayrollWeekDetailPage
  - phase: 47-03
    provides: TX schema columns and WH-347 overlay for TxDOT projects
provides:
  - TX LCPtracker informational callout (HelpCallout) gated on isTX in PayrollWeekDetailPage
  - Links to lcp123.com portal and TxDOT contractor compliance page
  - Texas Chapter 2258 electronic submission guidance for contractors
affects:
  - Phase 48 (FL) — same HelpCallout pattern for state-specific informational callouts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State-gated HelpCallout: {!isLoading && !isError && isTX && <HelpCallout>} placed after WA PWIA panel in state panel section"
    - "ExternalLink icon from lucide-react for callouts referencing external portals"

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "ExternalLink added to lucide-react import (was not previously imported) — preferred icon for external portal references"
  - "TX HelpCallout placed after WA PWIA panel in state-specific section, before CA eCPR modal"

patterns-established:
  - "State-gated informational callout pattern: {!isLoading && !isError && isXX && <HelpCallout icon={ExternalLink} ...>} for new states requiring submission portal guidance"

requirements-completed: [TX-02, NFR-06]

# Metrics
duration: 8min
completed: 2026-04-07
---

# Phase 47 Plan 04: TX LCPtracker HelpCallout Summary

**Texas LCPtracker informational callout added to PayrollWeekDetailPage, gated on isTX, with links to lcp123.com and TxDOT compliance page per Texas Chapter 2258**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-07T22:26:00Z
- **Completed:** 2026-04-07T22:34:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `ExternalLink` to lucide-react import in PayrollWeekDetailPage
- Implemented TX LCPtracker HelpCallout gated on `isTX` boolean (from Plan 47-02)
- Callout explains Texas Chapter 2258 electronic submission requirement
- Provides direct links to LCPtracker portal (lcp123.com) and TxDOT contractor compliance page
- Non-TX projects are unaffected — callout only renders when `isTX` is true
- All 565 tests pass, TypeScript compiles cleanly (no new errors in modified file)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TX LCPtracker HelpCallout to PayrollWeekDetailPage** - `4f18a40` (feat)

## Files Created/Modified
- `src/client/pages/PayrollWeekDetailPage.tsx` - Added ExternalLink import; added TX LCPtracker HelpCallout after WA PWIA panel, gated on isTX

## Decisions Made
- Added `ExternalLink` to lucide-react import — not previously imported; preferred icon per plan instruction for external portal references
- TX callout placed after WA PWIA panel (line ~1652) and before CA eCPR modal, consistent with state-panel ordering pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Pre-existing TypeScript errors in audit.ts and projects.ts (implicit any) are documented non-fatal issues unrelated to this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 47 complete — TX state foundations (schema, routes, form fields, WH-347 overlay, LCPtracker callout) fully shipped
- Phase 48 (FL) can begin immediately — same HelpCallout pattern applies for FL informational callout
- STATE_FORMS registry (Plan 47-02) and isTX gating pattern are confirmed working end-to-end

---
*Phase: 47-state-foundations-tx-certified-payroll*
*Completed: 2026-04-07*
