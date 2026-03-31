---
phase: 36-payroll-import-react-ui
plan: 03
subsystem: ui
tags: [react, typescript, tanstack-query, mutation, import, commit]

# Dependency graph
requires:
  - phase: 36-payroll-import-react-ui
    plan: 01
    provides: importPreview, importFile, importSuccessBanner, closeImportModal, all import type declarations
  - phase: 36-payroll-import-react-ui
    plan: 02
    provides: importCheckedRows, importRemaps, projectWorkers, sumSt/sumOt helpers
provides:
  - Full Step 3 confirm/commit UI in PayrollWeekDetailPage
  - importCommitMutation calling POST /api/payroll/import/commit with resolved rows
  - Commit payload builder: checked matched rows + remapped unmatched rows promoted to ImportedRow (D-11/D-15)
  - onSuccess: invalidate payroll-week + payroll-weeks queries, close modal, success banner
  - onError: inline importCommitError in Step 3, modal stays open (D-09)
  - Complete 3-step payroll import modal end-to-end
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - IIFE pattern in JSX for local variable computation without polluting component scope
    - Commit mutation uses api.post with JSON body (not FormData — only preview needs FormData)
    - onError parses error.message string for 409/423 codes (api.ts throws Error with response body.error)

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "IIFE (() => { ... })() used inside JSX to compute checkedMatched/remappedUnmatched/totalToImport/totalSkipped locally without adding to component scope"
  - "api.post (JSON body) correct for commit route — unlike preview which required FormData multipart upload"
  - "onError handler parses error.message string — api.ts line 11 throws new Error(body.error) so message contains the server error text"
  - "worker.classifications[0] per D-15 — first active classification used for remapped unmatched rows promoted to ImportedRow"
  - "closeImportModal() now also resets importCommitError — prevents stale error from previous import attempt showing on re-open"

patterns-established:
  - "Step 3 IIFE pattern: compute display values inside JSX IIFE rather than adding derived state or useMemo"

requirements-completed: [PI-03]

# Metrics
duration: 8min
completed: 2026-03-31
---

# Phase 36 Plan 03: Payroll Import React UI — Step 3 Confirm/Commit Summary

**Step 3 confirm UI with commit mutation: worker names list, skipped count, conflict warning repeat, Confirm Import sends resolved rows to POST /api/payroll/import/commit with success/error handling — completes the full 3-step payroll import flow**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-31T20:47:00Z
- **Completed:** 2026-03-31T20:54:35Z
- **Tasks:** 1 (Task 2 is checkpoint:human-verify, awaiting human)
- **Files modified:** 1

## Accomplishments

- Added `importCommitError` state variable and reset in `closeImportModal()` (prevents stale error on re-open)
- Added `importCommitMutation` after `waUnsubmitMutation`: builds resolvedRows from checked matched rows + remapped unmatched rows promoted to ImportedRow using `worker.classifications[0]` per D-15
- Commit payload includes `weekId`, `provider`, `matched` (resolvedRows), `unmatchedCount` (audit), `sourceFilename`
- `onSuccess`: invalidates `payroll-week` + `payroll-weeks` queries, closes modal, sets success banner with count + provider
- `onError`: sets `importCommitError` inline (409 conflict / 423 submitted / generic), modal stays open per D-09
- Replaced Step 3 placeholder with full confirm UI: summary heading with count + provider, worker names list with classifications, skipped count, conflict warning repeat from Step 2, commit error display
- Confirm Import button disabled when `totalToImport === 0` or mutation pending; shows "Importing..." during pending state

## Task Commits

1. **Task 1: Add commit mutation and replace Step 3 placeholder with confirm UI** - `5283b57` (feat)

## Files Created/Modified

- `src/client/pages/PayrollWeekDetailPage.tsx` — Added 163 net lines: importCommitError state, closeImportModal reset, importCommitMutation with full payload builder, Step 3 IIFE confirm UI replacing 18-line placeholder

## Decisions Made

- IIFE `(() => { ... })()` pattern in JSX: computes `checkedMatched`, `remappedUnmatched`, `totalToImport`, `totalSkipped`, `providerLabel` as local constants inside JSX without polluting component scope or adding derived state.
- `api.post` used for commit (unlike preview which used raw `fetch()` with FormData) — commit route expects JSON body, and `api.post` correctly sets `Content-Type: application/json` and `JSON.stringify`s the body.
- `onError` parses `error.message` string since `api.ts` throws `new Error(body.error || 'HTTP ${res.status}')` — the message contains the server-side error text for pattern matching on 409/423 language.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all data paths wired. `importPreview` comes from server response, `projectWorkers` from TanStack Query, `importCheckedRows`/`importRemaps` from Plan 02 state.

## Issues Encountered

- Pre-existing TypeScript error in `src/server/routes/projects.ts` line 110 (implicit any parameter `r`) — confirmed pre-existing, not introduced by this plan. Reported in Plan 01 issues as well.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The complete 3-step payroll import modal is now functionally complete end-to-end
- Task 2 (checkpoint:human-verify) awaits human verification of the full flow
- After human approval, Phase 36 is complete and the v3.0 milestone payroll import feature is shipped

---

## Self-Check

### Files exist
- [x] `src/client/pages/PayrollWeekDetailPage.tsx` — modified

### Commits exist
- [x] `5283b57` — Task 1 feat commit

## Self-Check: PASSED

---
*Phase: 36-payroll-import-react-ui*
*Completed: 2026-03-31*
