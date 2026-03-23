---
phase: 20-copy-previous-payroll-week
plan: "02"
subsystem: ui
tags: [payroll, copy-week, modal, react, compliance]

dependency_graph:
  requires:
    - phase: 20-01
      provides: POST /api/payroll/weeks/copy endpoint with preview + commit modes
  provides:
    - copy-previous-week modal UI in PayrollListPage
    - three-step modal flow (choose / configure / preview)
  affects: [PayrollListPage.tsx]

tech-stack:
  added: []
  patterns: [preview-commit-two-phase-UI, useRef-double-click-guard, three-step-modal-flow]

key-files:
  created: []
  modified:
    - src/client/pages/PayrollListPage.tsx

key-decisions:
  - "weeks[0] used as default source (weeks are already sorted DESC by weekEndingDate from the query) — no additional sort needed"
  - "weekEndingDate pre-populated as source + 7 days using Date arithmetic in the choose -> configure transition"
  - "copyingRef (useRef) used as synchronous double-click guard on both Preview and Confirm — not useState (async/batched)"
  - "Direct navigate (no modal) when weeks.length === 0 — consistent with prior UX when there is nothing to copy from"

patterns-established:
  - "Three-step modal pattern: choose -> configure -> preview -> navigate. Reusable for amendment workflow in Phase 21."
  - "Preview-commit API pattern in UI: POST with preview:true, show results, POST with preview:false on confirm."

requirements-completed: [PAY-01, PAY-02]

duration: 15min
completed: "2026-03-23"
---

# Phase 20 Plan 02: Copy Previous Payroll Week — UI Summary

**Three-step modal on PayrollListPage (choose / configure / preview-with-skip-warnings) calling POST /api/payroll/weeks/copy and navigating to the new week on confirm.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-23
- **Completed:** 2026-03-23
- **Tasks:** 2 (1 code task + 1 browser verification checkpoint)
- **Files modified:** 1

## Accomplishments

- "+ New Week" button replaced the Link — opens modal when weeks exist, navigates directly when no weeks exist
- Three-step modal: "Start Fresh" vs "Copy Previous Week" choice, source week selector with auto-suggested payrollNumber (max+1) and weekEndingDate (+7 days), preview step with copied-count and skipped-entries warning list
- Preview step renders skipped entries with human-readable reasons (worker-inactive, rate-lookup-failed, no-wd-found) in amber warning box; Confirm button disabled when copied.length === 0
- Confirmed copy navigates directly to the new week's detail page
- useRef double-click guard on both Preview and Confirm buttons
- Full test suite green: 621 tests passing, 0 failures

## Task Commits

1. **Task 1: Replace Link with modal-driven "+ New Week" button and build copy flow** - `415e0ce` (feat)
2. **Task 1 merge:** - `7336f90` (feat)
3. **Task 2: Browser verification checkpoint** - approved by user (no commit — verification only)

## Files Created/Modified

- `src/client/pages/PayrollListPage.tsx` — Added CopiedEntry/SkippedEntry/CopyPreviewResult interfaces; modal state (showModal, modalStep, sourceWeekId, weekEndingDate, payrollNumber, previewResult, copyError, isCopying, copyingRef); three-step modal JSX with fixed overlay, Escape/backdrop dismiss, all three steps; handlePreview and handleConfirmCopy with useRef guard

## Decisions Made

- `weeks[0]` used as default source since the query already returns weeks sorted DESC by weekEndingDate — no additional sort needed
- `weekEndingDate` pre-populated as source date + 7 days in the choose -> configure transition
- `copyingRef` (useRef) used as synchronous double-click guard on both Preview and Confirm — useState is async/batched and cannot prevent rapid duplicate requests
- Direct navigate (no modal) when `weeks.length === 0` — nothing to copy from, modal would only offer "Start Fresh"

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PAY-01 and PAY-02 are complete. The copy-previous-payroll-week feature ships end-to-end (server + UI).
- Phase 21 (Payroll Amendment Workflow) can proceed. The three-step modal pattern established here (choose / configure / preview) is directly reusable for the amendment flow.
- No blockers.

## Self-Check

Files verified:
- `src/client/pages/PayrollListPage.tsx` — contains showModal, copyingRef, "Copy Previous Week", "Start Fresh", preview:true, preview:false, skipped, worker-inactive|rate-lookup-failed|no-wd-found, weeks.length === 0

Commits verified:
- 415e0ce — feat(20-02): add copy-previous-week modal to PayrollListPage
- 7336f90 — feat(20-02): merge copy-previous-week modal UI

Test suite verified:
- 621 tests passing, 0 failures

## Self-Check: PASSED

---
*Phase: 20-copy-previous-payroll-week*
*Completed: 2026-03-23*
