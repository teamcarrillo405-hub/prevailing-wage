---
phase: 16-wh-347-submission-ux
plan: 01
subsystem: ui
tags: [react, fetch, blob, modal, compliance, wh-347]

# Dependency graph
requires:
  - phase: 15-compliance-engine-hardening-independent-frontend
    provides: complianceData with hasViolations, violations[], weekViolations[] from useQuery cache
provides:
  - Preflight compliance modal on WH-347 download when violations exist
  - Fetch-driven Blob download replacing plain anchor href
  - Generating state with double-click guard (useRef synchronous guard)
  - Modal dismiss via Cancel, backdrop click, and Escape key
affects:
  - Any phase adding WH-347 submission tracking or download history

# Tech tracking
tech-stack:
  added: []
  patterns:
    - fetch + Blob URL + hidden anchor pattern for programmatic file downloads
    - useRef synchronous double-click guard (not useState, which is async)
    - setTimeout(100) before URL.revokeObjectURL to let browser initiate download

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "generatingRef (useRef) used as synchronous guard — useState cannot prevent rapid double-clicks because setState is async and batched"
  - "hiddenAnchorRef placed outside the modal JSX so it persists when modal unmounts during download"
  - "Cancel button has autoFocus so Escape key works via event bubbling without needing global keydown listeners"
  - "complianceData?.hasViolations falsy (null/undefined) treats as no violations — consistent with existing ?? true fallback pattern"
  - "Blob URL revoked after 100ms setTimeout — gives browser time to initiate download before freeing the object URL"

patterns-established:
  - "Fetch-driven download: fetch -> res.blob() -> URL.createObjectURL -> hidden anchor click -> setTimeout revokeObjectURL(100ms)"
  - "Preflight modal pattern: check data condition -> setShowModal(true) -> modal renders violations -> Download Anyway calls confirmed handler"

requirements-completed: [WH-01, WH-02]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 16 Plan 01: WH-347 Submission UX Summary

**Fetch-driven WH-347 download with preflight compliance modal (violations list + Download Anyway), generating state label, and synchronous double-click guard via useRef**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T22:26:16Z
- **Completed:** 2026-03-22T22:29:16Z
- **Tasks:** 2 of 2
- **Files modified:** 1

## Accomplishments
- Replaced plain `<a href>` anchor with Button calling fetch-driven download handler
- Preflight modal renders both entry-level violations (under-wage, CWHSSA OT) and week-level violations (apprentice ratio) before any PDF is generated
- Button shows "Generating..." with disabled state during in-flight fetch; double-click guard via `generatingRef.current` prevents duplicate requests
- Modal dismisses on Cancel, backdrop click (`e.target === e.currentTarget`), and Escape key (autoFocus on Cancel button)
- Blob URL revoked via 100ms setTimeout after anchor click (no memory leak)
- All 188 existing tests pass (regression guard)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace anchor with fetch-driven download + preflight modal** - `9d76ada` (feat)
2. **Task 2: Browser verification of preflight modal and generating state** - human-verify passed (user approved all WH-01 and WH-02 checks)

**Plan metadata:** see final docs commit

## Files Created/Modified
- `src/client/pages/PayrollWeekDetailPage.tsx` - Added useRef/useState, handleDownloadClick, handleConfirmedDownload, preflight modal JSX, hidden anchor ref; replaced `<a href>` with `<Button>`

## Decisions Made
- `generatingRef` (useRef) provides synchronous double-click guard — useState is async/batched and cannot prevent rapid duplicate clicks
- `hiddenAnchorRef` placed outside the modal JSX so the anchor element persists when the modal unmounts during download initiation
- `autoFocus` on Cancel button enables Escape key dismiss via event bubbling — simpler than attaching global keydown listeners or focusing the overlay div
- Blob URL revoked after 100ms setTimeout to give browser time to initiate the download before the object URL is freed (per Phase 16 research pitfall)
- `complianceData?.hasViolations` falsy path calls `handleConfirmedDownload()` directly — consistent with existing `?? true` fallback for no-entries state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 16 complete. Both WH-01 and WH-02 requirements satisfied and browser-verified.
- Preflight modal, fetch-driven download, generating state, and double-click guard are production-ready.
- No blockers. v2.2 milestone Phase 16 is done.

---
*Phase: 16-wh-347-submission-ux*
*Completed: 2026-03-22*
