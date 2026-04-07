---
phase: 43-il-state-forms
plan: 04
subsystem: ui
tags: [il-idol, modal, react, tanstack-query, pdf-download, state-gate, certified-payroll]

requires:
  - phase: 43-03
    provides: "GET /api/export/il-pdf/:weekId and PATCH /api/payroll/weeks/:id/il-submit routes"
provides:
  - "IL IDOL 2-step submission modal in PayrollWeekDetailPage (showIlIdolModal)"
  - "Step 1: Download IL Certified Transcript PDF via fetch+blob+anchor"
  - "Step 2: IDOL portal checklist with 15th-of-month deadline, Excel template note, submit tracking"
  - "ilIdolSubmittedAt badge (compliant variant) in action bar and status panel"
affects: [PayrollWeekDetailPage, 43-il-state-forms]

tech-stack:
  added: []
  patterns:
    - "2-step modal (not 3-step like NY) — no registration field collection step for IL"
    - "Guard against double-submit via submitting state flag (same as handleNyMarkSubmitted)"
    - "closeIlModal resets ilIdolStep to 1 — prevents stale state on reopen"
    - "fetch+blob+anchor download pattern with credentials:include and error alert (mirrors handleNyDownload)"
    - "Badge variant compliant (not success) — consistent with Phase 41 BadgeVariant decision"

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "ilIdolStep typed as <1 | 2> (not <1 | 2 | 3>) — IL is 2-step, no registration field collection needed"
  - "No useRef guard — used ilIdolSubmitting state flag for double-submit protection (same as NY; useRef is only on WA CPR pattern)"
  - "handleIlDownloadPdf mirrors handleNyDownload exactly — includes credentials:include, error alert, document.body.appendChild/removeChild"

patterns-established:
  - "State-gated modal pattern: isIL && weekId in action bar + isIL in status panel"
  - "2-step IL IDOL flow: download PDF first, then IDOL portal checklist + mark submitted"

requirements-completed: [STATE-11]

duration: ~10 minutes
completed: 2026-04-06
---

# Phase 43 Plan 04: IL IDOL Modal UI Summary

**2-step IL IDOL submission modal in PayrollWeekDetailPage replacing Phase 42 placeholder: PDF download (Step 1) + IDOL portal checklist with submit tracking (Step 2), gated to IL projects only**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-06T00:00:00Z
- **Completed:** 2026-04-06T00:10:00Z
- **Tasks:** 1 (Task 2 was human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- `ilIdolSubmittedAt: string | null` added to `PayrollWeek` interface
- Phase 42 disabled placeholder button replaced with functional "IL IDOL Submission" button (gated `isIL && weekId`)
- Phase 42 "Coming in Phase 43" status panel replaced with live compliant-variant badge + "Submit to IL IDOL" button
- 2-step modal added after NY MPWR modal in JSX: Step 1 downloads IL Certified Transcript PDF, Step 2 shows IDOL portal checklist + mark-as-submitted
- Human verification approved — PDF download, checklist, badge, modal reset all confirmed working

## Task Commits

1. **Task 1: Add IL IDOL 2-step submission modal to PayrollWeekDetailPage** - `8018562` (feat)

## Files Created/Modified

- `src/client/pages/PayrollWeekDetailPage.tsx` - Added ilIdolSubmittedAt to interface, IL modal state + handlers, replaced placeholders, added 2-step modal JSX

## Decisions Made

- `ilIdolStep` typed as `<1 | 2>` (not `<1 | 2 | 3>`) — IL workflow is 2-step with no registration number collection, unlike NY MPWR
- Used `ilIdolSubmitting` state flag (not useRef) for double-submit guard — consistent with `nyMpwrSubmitting` pattern; useRef guard is specific to WA CPR generating pattern
- `handleIlDownloadPdf` fully mirrors `handleNyDownload`: includes `credentials: 'include'`, error alert with parsed JSON, `document.body.appendChild/removeChild` anchor lifecycle

## Deviations from Plan

None — plan executed exactly as written. The plan specified a useRef guard option but also noted to check `handleNyMarkSubmitted` for the exact pattern; that function uses a submitting state flag, not useRef, so the state flag approach was used consistently.

## Issues Encountered

None. TypeScript pre-existing errors in `audit.ts` and `projects.ts` unchanged from Plan 03 baseline — no new errors introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- IL IDOL full submission flow (PDF generation → download → IDOL portal submission tracking) is complete end-to-end
- Phase 43 IL state forms milestone is complete: schema migration (Plan 01), IL PDF generator (Plan 02), export/submit routes + tests (Plan 03), IL IDOL modal UI (Plan 04)
- No blockers for next phase

## Self-Check: PASSED

- `src/client/pages/PayrollWeekDetailPage.tsx` — FOUND
- `.planning/phases/43-il-state-forms/43-04-SUMMARY.md` — FOUND
- Commit 8018562 — FOUND

---
*Phase: 43-il-state-forms*
*Completed: 2026-04-06*
