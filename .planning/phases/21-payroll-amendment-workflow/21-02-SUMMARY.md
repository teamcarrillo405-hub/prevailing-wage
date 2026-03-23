---
phase: 21-payroll-amendment-workflow
plan: 02
subsystem: ui
tags: [amendment, payroll, react, badge, button, useRef]

requires:
  - phase: 21-01
    provides: POST /api/payroll/weeks/amend route returning { weekId, amendmentNumber, copiedCount }
provides:
  - Amend This Week button on PayrollWeekDetailPage (submitted weeks)
  - Amendment N badge in PayrollWeekDetailPage header
  - Amendment N badge on PayrollListPage list rows
  - amendingRef double-click guard for amendment creation
affects:
  - Phase 22: Per-Worker Compliance History (may render amendment weeks in history view)

tech-stack:
  added: []
  patterns:
    - useRef double-click guard (amendingRef) — same pattern as generatingRef and copyingRef
    - Badge variant="warning" for amendment status — consistent with warning semantic in Badge component

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/client/pages/PayrollListPage.tsx

key-decisions:
  - "Amend This Week button shown for any submitted week (submittedAt !== null) — service resolves root week automatically, UI does not need to distinguish amendment vs. original"
  - "Amendment badge in h1 uses flex-wrap gap-2 to prevent layout break on narrow viewports"
  - "Amend button placed before Un-submit button in submission panel — amendment is the primary action for submitted weeks"

patterns-established:
  - "Amendment badge: Badge variant='warning' with 'Amendment N' text — same pattern used on both detail and list pages"

requirements-completed: [AMD-01, AMD-03]

duration: 5min
completed: 2026-03-23
---

# Phase 21 Plan 02: Amendment UI (Client-Side) Summary

**"Amend This Week" button with double-click guard on PayrollWeekDetailPage plus "Amendment N" warning badges on both the detail page header and PayrollListPage list rows.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-23T23:25:00Z
- **Completed:** 2026-03-23T23:31:40Z
- **Tasks:** 2 auto tasks completed (Task 3 is a checkpoint)
- **Files modified:** 2

## Accomplishments

- "Amend This Week" button wired to `POST /api/payroll/weeks/amend` with `amendingRef` double-click guard, navigates to new amendment week on success
- "Amendment N" badge rendered in the `PayrollWeekDetailPage` h1 header when `week.amendmentNumber != null`
- "Amendment N" badge rendered on each row in `PayrollListPage` when `week.amendmentNumber != null`
- Both `PayrollWeek` interfaces extended with `amendmentNumber: number | null` and `originalWeekId: string | null`
- Full 218-test suite remains GREEN after both changes

## Task Commits

Each task was committed atomically:

1. **Task 1: PayrollWeekDetailPage — Amend button + amendment badge** - `2685441` (feat)
2. **Task 2: PayrollListPage — amendment badge on list rows** - `875fea7` (feat)

## Files Created/Modified

- `src/client/pages/PayrollWeekDetailPage.tsx` — Extended PayrollWeek interface; added amendingRef, handleAmendClick, Amendment badge in header, Amend This Week button in submission panel
- `src/client/pages/PayrollListPage.tsx` — Extended PayrollWeek interface; added Amendment N badge on list rows

## Decisions Made

- Amend This Week button shown for any submitted week (`submittedAt !== null`) — service resolves the root week automatically so the UI does not need to distinguish whether the current week is itself an amendment
- Amendment badge in `h1` uses `flex items-center flex-wrap gap-2` to accommodate badge without layout breakage
- Amend button placed before Un-submit button — amendment is the more common action on a submitted week

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Task 3 (browser verification) is a `checkpoint:human-verify` — requires manual testing in the browser
- Server must be started (`npm run dev`, port 4099) before verification
- All automated preconditions are met: both auto tasks committed, 218 tests passing

---
*Phase: 21-payroll-amendment-workflow*
*Completed: 2026-03-23*
