---
phase: 53-ca-a-1-131-gap-close
plan: 01
subsystem: api, ui
tags: [react, pdf-lib, audit-log, ca-a1131, state-forms]

# Dependency graph
requires:
  - phase: 24-ca-a1131
    provides: CA A-1-131 PDF generator, disclosure modal, STATE_FORMS registry button
  - phase: 38-audit-trail
    provides: insertAuditLog service pattern (dynamic import, best-effort try/catch)
provides:
  - CA A-1-131 download button routes through eCPR disclosure modal (not direct download)
  - GET /api/export/a1131/:weekId emits ca_pdf.downloaded audit log entry (AUDIT-03 parity)
affects: [ca-ecpr, audit-reporting, state-forms-registry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Conditional onClick on STATE_FORMS registry button for state-specific modal routing
    - Best-effort audit log (AUDIT-03) with dynamic import after res.end() in export routes

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/server/routes/export.ts

key-decisions:
  - "Conditional onClick (stateFormConfig.route === 'a1131') routes CA through handleCaDownloadClick(); all other states call handleStateFormDownload() — single expression closes routing gap without duplicating button"
  - "Audit log block placed after res.end() inside route closing }) matching exact NJ/MA/IL pattern — best-effort non-fatal try/catch (AUDIT-03)"

patterns-established:
  - "STATE_FORMS button with state-specific modal routing: stateFormConfig.route === 'X' ? handleXModalClick() : handleStateFormDownload()"

requirements-completed:
  - CA-02

# Metrics
duration: 8min
completed: 2026-04-13
---

# Phase 53 Plan 01: CA A-1-131 Gap Close Summary

**CA button now routes through mandatory eCPR disclosure modal (regulatory fix) and a1131 export route now emits ca_pdf.downloaded audit log (AUDIT-03 parity with all other state export routes)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-13T01:25:00Z
- **Completed:** 2026-04-13T01:33:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed CA A-1-131 button routing: clicking "Download CA A-1-131" now opens the CSLB/WC eCPR disclosure modal instead of triggering a direct download, satisfying the regulatory requirement that was bypassed since Phase 24
- Added ca_pdf.downloaded audit log to GET /api/export/a1131/:weekId — brings it to AUDIT-03 parity with f700, pw12, il-transcript, ma-cpr, and nj-mw562 routes
- TypeScript compiles clean for both changed files; all main project tests pass (worktree failures are pre-existing and out of scope)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix CA button routing bug — route through disclosure modal** - `33ce2f7` (fix)
2. **Task 2: Add missing ca_pdf.downloaded audit log to a1131 export route** - `f1cddd4` (feat)

## Files Created/Modified
- `src/client/pages/PayrollWeekDetailPage.tsx` - STATE_FORMS button onClick changed from unconditional handleStateFormDownload() to conditional: a1131 route calls handleCaDownloadClick(), others call handleStateFormDownload()
- `src/server/routes/export.ts` - Added best-effort AUDIT-03 audit log block after res.end() in a1131 route handler

## Decisions Made
- Used a ternary expression directly in onClick (not a wrapper function) — matches the pattern's simplicity and keeps the change as minimal as possible (single expression instead of new function)
- Placed audit log after res.end() and before the route closing }) — identical placement to NJ, MA, IL routes; headers already sent so audit failure cannot affect the response

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — both changes were surgical single-location edits. Pre-existing TypeScript errors (audit.ts:56, projects.ts:148) and worktree test failures are unrelated to this plan's scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 53 Plan 01 complete; CA A-1-131 gap fully closed
- Phase 53 Plan 02 (if it exists) can proceed immediately
- CA A-1-131 regulatory workflow is now correct end-to-end: button → modal → confirmed download → audit log

---
*Phase: 53-ca-a-1-131-gap-close*
*Completed: 2026-04-13*
