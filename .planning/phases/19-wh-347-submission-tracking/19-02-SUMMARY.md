---
phase: 19-wh-347-submission-tracking
plan: 02
subsystem: ui
tags: [payroll, submission, react, badge, tanstack-query]

# Dependency graph
requires:
  - phase: 19-01
    provides: PATCH/DELETE /api/payroll/weeks/:id/submit routes + server-side edit lock
provides:
  - PayrollListPage shows Submitted badge per week with submittedAt date
  - PayrollWeekDetailPage shows Submission Status panel with submit form + un-submit button
  - Read-only lock UI on submitted weeks (entry fields disabled)
  - WorkflowProgress step 4 unlocked when submittedAt set
affects: [PayrollListPage, PayrollWeekDetailPage, ProjectDetailPage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Badge variant=compliant for submitted weeks in list view
    - Submit form with date + agency text fields, POST to PATCH endpoint
    - Un-submit clears submission state via DELETE /submit

key-files:
  created: []
  modified:
    - src/client/pages/PayrollListPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "Submission Status panel placed in PayrollWeekDetailPage sidebar — collocated with download/compliance sections"
  - "Read-only state displayed via banner message not field disabling — visual clarity over input attributes"

patterns-established:
  - "Submitted badge on list rows: Badge variant=compliant with formatted submittedAt date"

requirements-completed: [SUB-01, SUB-02, SUB-03]

# Metrics
duration: ~15min
completed: 2026-03-23
---

# Phase 19 Plan 02: WH-347 Submission Tracking UI Summary

**Submit form + read-only lock banner + Submitted badges on PayrollListPage — SUB-01/02/03 browser-verified end-to-end**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-23
- **Completed:** 2026-03-23
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- PayrollListPage shows "Submitted" Badge (variant=compliant) on weeks with `submittedAt` set
- PayrollWeekDetailPage shows Submission Status panel with submit date + agency fields and Mark as Submitted button
- Read-only lock banner displayed on submitted weeks preventing entry edits
- Un-submit button clears submission status via DELETE /api/payroll/weeks/:id/submit
- Browser verified: submit form captures date + agency, read-only bar appears, un-submit restores editing

## Task Commits

Each task was committed atomically:

1. **Task 1: Submission badges on PayrollListPage** - `e82f658` (feat)
2. **Task 2: Submit form + lock UI on PayrollWeekDetailPage** - `0ff48a9` (feat)

## Files Created/Modified

- `src/client/pages/PayrollListPage.tsx` - Submitted badge per week row with formatted submittedAt date
- `src/client/pages/PayrollWeekDetailPage.tsx` - Submission Status panel with submit form, read-only banner, and un-submit button

## Decisions Made

- Submit form fields: date input (YYYY-MM-DD) + agency text field — matches SUB-01 requirement exactly
- Read-only lock displayed as banner ("This payroll week is submitted and cannot be edited") above entry form

## Deviations from Plan

None.

## Issues Encountered

None — dev server migration tracking issue from earlier in session was already resolved before this plan executed.

## Next Phase Readiness

- Phase 19 fully complete — SUB-01, SUB-02, SUB-03 all browser-verified
- Lock guard active server-side; UI reflects lock state
- Phase 20 (Copy Previous Payroll Week) can proceed

---
*Phase: 19-wh-347-submission-tracking*
*Completed: 2026-03-23*
