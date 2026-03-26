---
phase: 26-contractor-guidance-system
plan: 02
subsystem: ui
tags: [react, tailwindcss, ux, empty-states, tooltips, compliance]

requires:
  - phase: 26-01
    provides: HelpCallout and TermTooltip components created and placed on all 5 major pages

provides:
  - Instructional empty states with specific heading, message, and action button on 4 pages
  - TermTooltip inline on all 5 compliance terms (Davis-Bacon, WH-347, prevailing wage, CWHSSA, WD) across 6+ pages
  - HelpCallout body prop widened to React.ReactNode for JSX embedding
  - EmptyState message prop widened to React.ReactNode for JSX embedding

affects:
  - 27-design-elevation
  - 28-production-deployment

tech-stack:
  added: []
  patterns:
    - "HelpCallout body accepts React.ReactNode — enables TermTooltip embedding without API surface changes"
    - "EmptyState message accepts React.ReactNode — future-proof for inline tooltips in empty-state guidance copy"
    - "TermTooltip definitions extracted as module-level constants in each page file (DB_DEF, WH347_DEF, PW_DEF, CWHSSA_DEF, WD_DEF) — avoids string duplication, keeps JSX readable"
    - "LandingPage HowItWorksSection uses typed steps array React.ReactNode descriptions instead of plain strings to support inline tooltips"

key-files:
  created: []
  modified:
    - src/client/components/ui/HelpCallout.tsx
    - src/client/components/ui/EmptyState.tsx
    - src/client/pages/DashboardPage.tsx
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollEntryPage.tsx
    - src/client/pages/PayrollListPage.tsx
    - src/client/pages/LandingPage.tsx
    - src/client/pages/ProjectDetailPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "HelpCallout body changed from string to React.ReactNode — minimal breaking change (all existing string props still valid), enables TermTooltip embedding without wrapping HelpCallout"
  - "EmptyState message changed from string to React.ReactNode — same rationale as HelpCallout body"
  - "TermTooltip definitions as module-level constants (not inline literals) — avoids identical 150-char strings repeated across JSX, readable at definition site"
  - "WorkersPage Add First Worker CTA uses inline button with focus scroll to name input instead of Link — add worker form is on the same page, not a separate route"
  - "LandingPage TrustSignals array changed from string[] to React.ReactNode[] — enables CWHSSA and WD tooltips inside trust statement list items"

requirements-completed:
  - UX-07
  - UX-08

duration: 15min
completed: 2026-03-26
---

# Phase 26 Plan 02: Contractor Guidance System — Empty States + TermTooltip Placement Summary

**Instructional empty states with action CTAs on 4 pages, and all 5 compliance terms (Davis-Bacon, WH-347, prevailing wage, CWHSSA, WD) wrapped with inline TermTooltip across 6 pages**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-26T22:58:00Z
- **Completed:** 2026-03-26T23:03:46Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Updated DashboardPage empty states: no-projects now shows SAM.gov-specific guidance + "Create Your First Project" button; filter-no-matches now shows "Clear Filters" secondary button
- WorkersPage now has an instructional EmptyState with "Add First Worker" CTA (Davis-Bacon compliance note in message)
- PayrollListPage raw `<div className="text-center py-16 text-gray-500">` replaced with EmptyState component + "Create First Payroll Week" Link button
- PayrollEntryPage empty state action updated to Link navigating to workers page instead of "Try with sample workers"
- TermTooltip placed on all 5 required compliance terms across LandingPage (HowItWorksSection + TrustSignalsSection), WorkersPage (HelpCallout + EmptyState), PayrollEntryPage (HelpCallout), PayrollListPage (HelpCallout), ProjectDetailPage (HelpCallout), PayrollWeekDetailPage (HelpCallout)
- HelpCallout body and EmptyState message props widened to React.ReactNode — no breaking changes to existing callers

## Task Commits

1. **Task 1: Update empty states with next-step instructions and action buttons** - `ada48ff` (feat)
2. **Task 2: Place TermTooltip inline after compliance terms across all pages** - `64ef736` (feat)

## Files Created/Modified

- `src/client/components/ui/HelpCallout.tsx` - body prop changed from `string` to `React.ReactNode`
- `src/client/components/ui/EmptyState.tsx` - message prop changed from `string` to `React.ReactNode`
- `src/client/pages/DashboardPage.tsx` - two empty states updated with spec copy and action buttons
- `src/client/pages/WorkersPage.tsx` - added EmptyState import + empty state + TermTooltip (Davis-Bacon)
- `src/client/pages/PayrollEntryPage.tsx` - added Link import + updated empty state action + TermTooltip (prevailing wage, WH-347)
- `src/client/pages/PayrollListPage.tsx` - added EmptyState + TermTooltip imports, replaced raw empty div with EmptyState
- `src/client/pages/LandingPage.tsx` - added TermTooltip with all 5 terms in HowItWorksSection and TrustSignalsSection
- `src/client/pages/ProjectDetailPage.tsx` - TermTooltip on WH-347 in HelpCallout body
- `src/client/pages/PayrollWeekDetailPage.tsx` - TermTooltip on WH-347 in HelpCallout body

## Decisions Made

- HelpCallout body and EmptyState message changed to React.ReactNode — existing string callers continue to compile; only widening the type, not breaking it
- Module-level definition constants (DB_DEF, WH347_DEF, PW_DEF, CWHSSA_DEF, WD_DEF) defined at top of each page file rather than passing inline strings — keeps JSX readable
- PayrollEntryPage "no workers" empty state: condition is `workerRows.length === 0` which means no workers assigned to project. Heading kept as "No workers assigned yet" (accurate to condition). Action navigates to workers page rather than "Try with sample workers" (spec-aligned)
- WorkersPage Add First Worker CTA scrolls focus to name input — add worker form is on the same page, no separate route exists

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] LandingPage TrustSignals section updated to support ReactNode**
- **Found during:** Task 2 (TermTooltip placement)
- **Issue:** `trustStatements` was `string[]` rendered as `{statement}` in JSX — CWHSSA and WD terms in TrustSignals needed tooltip but array was typed as strings
- **Fix:** Changed array type to `React.ReactNode[]` and converted three statements to JSX fragments with inline TermTooltip; updated `key` prop to array index since ReactNode can't be used as map key
- **Files modified:** src/client/pages/LandingPage.tsx
- **Verification:** Build passes (tsc + vite)
- **Committed in:** 64ef736 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)
**Impact on plan:** Necessary to meet acceptance criteria of all 5 terms covered. No scope creep.

## Issues Encountered

Pre-existing RED test stubs in `.claude/worktrees/` subdirectories (from prior agent work) cause 17 test failures — these are intentional TDD stubs (`expect(true).toBe(false)`) unrelated to this plan's changes. Main test suite: 3,301 passing.

## Known Stubs

None. All empty states render actual guidance copy. All TermTooltips use verbatim definitions from UI-SPEC.md. No placeholder text.

## Next Phase Readiness

- Contractor guidance system complete (Plan 01 + Plan 02)
- Phase 26 done: HelpCallout, TermTooltip, instructional empty states, inline compliance tooltips all shipped
- Ready for Phase 27: Design Elevation (construction photography, dark gold gradients, card depth)

---
*Phase: 26-contractor-guidance-system*
*Completed: 2026-03-26*
