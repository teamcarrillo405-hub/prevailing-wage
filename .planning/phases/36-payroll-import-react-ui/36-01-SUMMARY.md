---
phase: 36-payroll-import-react-ui
plan: 01
subsystem: ui
tags: [react, typescript, tanstack-query, formdata, fetch, modal]

# Dependency graph
requires:
  - phase: 35-payroll-import-server-pipeline
    provides: POST /api/payroll/import/preview and /commit routes, importTypes.ts shapes
provides:
  - Import entry button in PayrollWeekDetailPage action buttons row
  - 3-step import modal shell with working Step 1 file picker
  - All import state variables and type declarations (foundation for Plans 02 and 03)
  - Workers query for unmatched worker remap dropdown
  - closeImportModal() and handleImportPreview() functions
  - importSuccessBanner with 4s auto-dismiss useEffect
affects:
  - 36-02-PLAN (Step 2 review entries — uses importPreview, projectWorkers, importStep state)
  - 36-03-PLAN (Step 3 confirm — uses importPreview, closeImportModal, setImportSuccessBanner)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Raw fetch() with FormData for multipart file upload (cannot use api.post which JSON.stringifies)
    - Client-side type re-declaration mirrors server importTypes.ts (Vite client cannot import from server modules)
    - Modal step pattern mirrors ecprStep/waCprStep — useState<1|2|3> with reset on close

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "Use raw fetch() for FormData preview upload — api.post JSON.stringifies body and sets Content-Type: application/json, breaking multipart upload"
  - "Do NOT set Content-Type manually on FormData fetch — browser must set the multipart boundary automatically"
  - "Client-side import types must be re-declared locally — Vite client bundle cannot import from src/server/"
  - "importStep resets to 1 on all modal close paths — prevents stale step on re-open"

patterns-established:
  - "Import modal state: showImportModal + importStep<1|2|3> + importPreview + importFile + importParsing + importError + importSuccessBanner"
  - "closeImportModal() resets all 6 import state variables atomically"
  - "handleImportPreview() handles 400/423/network error cases with inline error display"

requirements-completed: [PI-03]

# Metrics
duration: 15min
completed: 2026-03-31
---

# Phase 36 Plan 01: Payroll Import React UI — Entry Point and Step 1 Summary

**Import from Payroll Provider button, 3-step modal shell, working Step 1 CSV file picker with FormData upload to /api/payroll/import/preview, and all state/type infrastructure for Plans 02-03**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-31T20:27:00Z
- **Completed:** 2026-03-31T20:42:09Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added 7 client-side import type interfaces mirroring importTypes.ts (ImportedRow, UnmatchedRow, ConflictRow, ImportPreviewResult, ImportWorkerClassification, ImportWorker)
- Added 7 import state variables inside PayrollWeekDetailPage component (showImportModal, importStep, importPreview, importFile, importParsing, importError, importSuccessBanner)
- Added workers query keyed by ['workers', projectId] for unmatched worker remap dropdown in Plan 02
- Added closeImportModal() reset helper and handleImportPreview() with raw fetch FormData upload to /api/payroll/import/preview
- Added importSuccessBanner auto-dismiss useEffect (4s timeout via setTimeout)
- Added Import from Payroll Provider button (disabled with tooltip when submittedAt set) in action buttons row
- Added success banner below HelpCallout with status-compliant/30 border and status-compliant/10 background
- Added 3-step modal shell with fully functional Step 1 (CSV file picker, parsing state, inline 400/423/network error display) and placeholder Steps 2/3

## Task Commits

1. **Task 1: Add import types, state variables, workers query, and entry button** - `23e8ceb` (feat)

## Files Created/Modified
- `src/client/pages/PayrollWeekDetailPage.tsx` - Added 248 lines: all import types, state, workers query, modal helpers, entry button, success banner, 3-step modal shell

## Decisions Made
- Raw fetch() required for FormData upload — api.post sets Content-Type: application/json and JSON.stringifies body, which breaks multipart uploads. Browser must set Content-Type with multipart boundary automatically.
- Client-side type declarations copied from server importTypes.ts rather than imported — Vite client bundle cannot reach src/server/ modules at runtime.
- importStep resets to 1 inside closeImportModal() on all close paths (backdrop click, Close Import button) to prevent stale modal state on re-open (follows waCprStep pattern).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in OtScenarioComparison.tsx and projects.ts (unrelated to this plan) — confirmed pre-existing via git stash comparison, not introduced by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 36-02 can proceed immediately: importPreview, projectWorkers, importStep state, and all type declarations are available
- Plan 36-03 can proceed after 36-02: closeImportModal() and setImportSuccessBanner are wired and ready
- TypeScript compiles with zero new errors

---
*Phase: 36-payroll-import-react-ui*
*Completed: 2026-03-31*
