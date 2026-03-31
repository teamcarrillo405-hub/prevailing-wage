---
phase: 36-payroll-import-react-ui
plan: 02
subsystem: ui
tags: [react, typescript, modal, table, preview, import]

# Dependency graph
requires:
  - phase: 36-payroll-import-react-ui
    plan: 01
    provides: importPreview, projectWorkers, importStep state, all import type declarations
provides:
  - Full Step 2 import preview/resolve UI in PayrollWeekDetailPage
  - Provider badge (QuickBooks/ADP) from importPreview.provider
  - ADP amber banner for weekly-totals-only exports
  - Conflict warning panel listing workers with existing manual entries
  - Matched workers table with QB 14-column day grid or ADP 2-column totals
  - Per-row checkboxes with select-all header checkbox
  - Unmatched workers section with remap dropdowns (value=worker.id)
  - No-classifications inline warning for remapped workers without a trade
  - sumSt/sumOt helper functions for hour aggregation
affects:
  - 36-03-PLAN (Step 3 uses importCheckedRows and importRemaps to build commit payload)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - importCheckedRows initialized via useEffect on importPreview change (mirrors waCprStep reset pattern)
    - sumSt/sumOt helpers accept both ImportedRow and UnmatchedRow.hours via structural typing
    - Step 2 guarded with `importStep === 2 && importPreview &&` — guarantees non-null inside block
    - Unmatched remap dropdown uses worker.id as value (not name) — names are not unique

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "Guard Step 2 with `importStep === 2 && importPreview &&` — eliminates all non-null assertions inside the block"
  - "sumSt/sumOt use structural typing — work on both ImportedRow (flat fields) and UnmatchedRow.hours (nested object)"
  - "Unmatched remap dropdown value=worker.id — worker names are not unique; ID is the correct foreign key"
  - "importCheckedRows initialized in useEffect on importPreview — auto-checks all rows on upload, resets on new file"

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 36 Plan 02: Payroll Import React UI — Step 2 Preview/Resolve Summary

**Full Step 2 import review UI: provider badge, ADP warning banner, conflict panel, matched workers table (QB 14-column or ADP 2-column), row checkboxes, unmatched worker remap dropdowns with no-classifications warning**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T20:46:50Z
- **Completed:** 2026-03-31T20:49:21Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `importCheckedRows` and `importRemaps` state variables (Task 1)
- Updated `closeImportModal()` to reset both new state variables atomically (Task 1)
- Added `useEffect` to auto-initialize all matched rows as checked when `importPreview` loads (Task 1)
- Added `sumSt()` and `sumOt()` helper functions using structural typing (work on both `ImportedRow` and `UnmatchedRow.hours`) (Task 1)
- Replaced Step 2 placeholder with full preview/resolve UI (Task 2):
  - Provider badge showing "QuickBooks" or "ADP" from `importPreview.provider`
  - ADP amber banner shown only when `adpWeeklyTotalsOnly === true`
  - Conflict warning panel listing conflicting worker names (shown only when `conflicts.length > 0`)
  - Matched workers table with select-all header checkbox and per-row checkboxes
  - QB mode: 14 day columns (Mon-Sun ST/OT) using individual day fields
  - ADP mode: 2 total columns using `sumSt(row)` / `sumOt(row)`
  - Empty state: "No importable entries found in this file." when `matched.length === 0`
  - Unmatched workers section with remap dropdowns (`value=worker.id`) populated from `projectWorkers`
  - No-classifications inline violation warning for remapped workers with empty `classifications` array
  - "Workers not remapped will be skipped" instructional text
  - Back / Review Import footer navigation

## Task Commits

1. **Task 1: Add Step 2 state variables and helper functions** - `cf2b6d5` (feat)
2. **Task 2: Replace Step 2 placeholder with full preview/resolve UI** - `9393374` (feat)

## Files Created/Modified

- `src/client/pages/PayrollWeekDetailPage.tsx` - Added 194 lines: Step 2 state variables, closeImportModal resets, auto-init useEffect, sumSt/sumOt helpers, full Step 2 JSX replacing 18-line placeholder

## Decisions Made

- Guarded Step 2 block with `importStep === 2 && importPreview &&` — guarantees `importPreview` is non-null inside the block, eliminating all `!` non-null assertions.
- `sumSt`/`sumOt` use structural typing rather than type guards — both `ImportedRow` (flat fields at top level) and `UnmatchedRow.hours` (nested object) share the same field names, so the helpers work on both without overloading.
- Unmatched remap dropdown `value={w.id}` — worker names are not unique; the foreign key going to the commit route must be worker ID.
- `importCheckedRows` initialized in `useEffect` on `importPreview` change — ensures all rows start checked on upload, and resets cleanly if user uploads a new file from Step 1.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all data paths wired from `importPreview` (server response) and `projectWorkers` (TanStack Query). No placeholder or hardcoded values.

---

## Self-Check

### Files exist
- [x] `src/client/pages/PayrollWeekDetailPage.tsx` — modified (not created)

### Commits exist
- [x] `cf2b6d5` — Task 1 feat commit
- [x] `9393374` — Task 2 feat commit

## Self-Check: PASSED

---
*Phase: 36-payroll-import-react-ui*
*Completed: 2026-03-31*
