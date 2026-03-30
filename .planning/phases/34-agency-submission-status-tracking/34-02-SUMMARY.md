---
phase: 34-agency-submission-status-tracking
plan: "02"
subsystem: ui
tags: [react, tanstack-query, useMutation, badge, modal, submission-tracking]
dependency_graph:
  requires:
    - phase: 34-01
      provides: "PATCH /api/payroll/weeks/:id/ca-submit and PATCH /api/payroll/weeks/:id/wa-submit routes"
  provides:
    - CA eCPR modal step 2 Mark as Submitted / Un-submit UI
    - WA CPR modal two-step flow with Mark as Submitted / Un-submit UI
    - Per-agency badge rows in Submission Status panel (CA amber, WA gray, WH-347 green)
  affects: [PayrollWeekDetailPage]
tech-stack:
  added: []
  patterns:
    - useMutation with api.patch for boolean toggle (submitted true/false) matching backend AgencySubmitSchema
    - Two-step modal pattern using waCprStep state, reset to 1 on close
    - isCA/isWA state-gating for per-agency UI rows
key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx
key-decisions:
  - "Mark as Submitted action is only available in modal flows (D-12) — detail page shows status and un-submit only"
  - "waCprStep resets to 1 on all close paths (backdrop click, Cancel button, Close button) to prevent stale step state"
  - "Un-submit is direct click with no confirmation modal, matching WH-347 unsubmit pattern (D-14)"
patterns-established:
  - "Agency badge row pattern: divider + px-5 py-3 flex row with Badge + date on left, Un-submit link on right when submitted; neutral badge only when not submitted"
requirements-completed: [AS-01, AS-02]
duration: 12min
completed: "2026-03-30"
---

# Phase 34 Plan 02: Agency Submission Status Tracking (UI) Summary

**"Mark as Submitted to CA DIR / WA L&I" buttons in eCPR and CPR XML modals plus per-agency badge rows in Submission Status panel, independently tracked and state-gated by project.state.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-30T21:30:00Z
- **Completed:** 2026-03-30T21:42:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- CA eCPR modal step 2 now shows "Mark as Submitted to CA DIR" button (or submitted badge + date + Un-submit if already recorded)
- WA CPR modal converted from single-step to two-step flow: step 1 is existing intentId form, step 2 appears after download with "Mark as Submitted to WA L&I" button
- Submission Status panel gains CA DIR badge row (amber, CA projects only) and WA L&I badge row (gray, WA projects only) below the existing WH-347 row — all three independent

## Task Commits

Each task was committed atomically:

1. **Task 1: Week interface + mutations + CA modal step 2 + WA modal step 2** - `a035023` (feat)
2. **Task 2: Agency badge rows in Submission Status panel** - `e283a8a` (feat)

## Files Created/Modified
- `src/client/pages/PayrollWeekDetailPage.tsx` - Added caEcprSubmittedAt/waLniSubmittedAt to PayrollWeek interface; waCprStep state; four CA/WA mutations; CA modal step 2 submit/un-submit UI; WA modal two-step flow; agency badge rows in Submission Status panel

## Decisions Made
- Mark as Submitted action is only available in modal flows (D-12) — detail page shows status and un-submit only. Keeps the download-then-record flow in one context.
- waCprStep resets to 1 on all close paths to prevent stale modal state on re-open.
- Un-submit is a direct click with "Clearing..." pending state, no confirmation modal — matches existing WH-347 unsubmit pattern (D-14).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 34 complete. Both CA eCPR and WA L&I submission tracking are fully wired end-to-end (backend routes from 34-01 + UI from 34-02).
- Ready to proceed to next phase (Phase 35 or 36 — payroll import).

---
*Phase: 34-agency-submission-status-tracking*
*Completed: 2026-03-30*

## Known Stubs

None.

## Self-Check: PASSED
