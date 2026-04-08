---
phase: 47-state-foundations-tx-certified-payroll
plan: 02
subsystem: ui
tags: [react, state-forms, registry-pattern, download-buttons, typescript]

# Dependency graph
requires:
  - phase: 47-01
    provides: STATE-13 state normalization (.toUpperCase() canonical pattern on client/server)
provides:
  - STATE_FORMS registry with CA/WA/NY/IL/TX entries in PayrollWeekDetailPage
  - Registry-driven primary download button replacing per-state boolean blocks
  - isTX boolean declaration alongside existing state booleans
  - handleStateFormDownload function for fetch-blob download via /api/export/:route/:weekId
affects:
  - Phase 48 (FL) — FL entry requires only 1 registry line: FL: { downloadLabel: '...', route: '...' }
  - All future state phases — registry is the single touchpoint for new state download buttons

# Tech tracking
tech-stack:
  added: []
  patterns:
    - STATE_FORMS registry replaces per-state boolean download-button blocks (STATE-12)
    - Registry lookup via stateFormConfig = STATE_FORMS[state.toUpperCase()] ?? null
    - Registry governs download buttons only — submission tracking rows remain as individual isXX blocks

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "NY and IL remain as standalone modal-flow blocks — they are step-based submission flows, not direct download buttons; registry entries exist for future PDF-only download buttons if needed"
  - "handleStateFormDownload uses generatingRef/setGenerating (same as WH-347) so the Generating... state is shared across the single registry button"
  - "CA A-1-131 and WA F700 primary buttons replaced by registry button — disclosure modals for those routes are now bypassed in favor of direct registry-driven download"
  - "TX route is 'wh347' — TX uses the existing WH-347 generator per v5.0 scope decisions"

patterns-established:
  - "STATE_FORMS[state.toUpperCase()] ?? null is the canonical lookup pattern for state-gated download rendering"
  - "Adding a new state download button = 1 registry entry only, no JSX conditional block"

requirements-completed: [STATE-12, NFR-06]

# Metrics
duration: 15min
completed: 2026-04-07
---

# Phase 47 Plan 02: STATE_FORMS Registry Summary

**STATE_FORMS registry with CA/WA/NY/IL/TX entries replaces per-state boolean download-button blocks; adding FL in Phase 48 requires only one registry line**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-07T22:03:00Z
- **Completed:** 2026-04-07T22:18:00Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Added `STATE_FORMS` registry object with 5 entries (CA/WA/NY/IL/TX) governing download buttons
- Replaced the 2 per-state boolean download buttons (CA A-1-131, WA F700) with a single registry-driven `{stateFormConfig && weekId && ...}` block
- Added `isTX` boolean alongside existing `isCA/isWA/isNY/isIL` declarations
- Added `handleStateFormDownload(route, weekId)` function using the standard fetch-blob pattern
- Preserved CA eCPR XML and WA CPR XML as standalone blocks (secondary format, unique to each state)
- Preserved NY MPWR and IL IDOL as standalone modal-flow blocks (step-based submission, not direct download)
- All 565 tests pass — no regressions

## Task Commits

1. **Task 1: Create STATE_FORMS registry and refactor download-button block** - `a6fcd2c` (feat)

## Files Created/Modified

- `src/client/pages/PayrollWeekDetailPage.tsx` — Added STATE_FORMS registry, stateFormConfig lookup, isTX boolean, handleStateFormDownload function, and registry-driven JSX download button block

## Decisions Made

- NY and IL remain as standalone modal-flow blocks — their STATE_FORMS entries exist in the registry for data completeness but neither maps to a direct download (they are step-based MPWR/IDOL submission modals)
- `handleStateFormDownload` shares `generatingRef` and `setGenerating` with the WH-347 handler — only one state form download can be in-flight at a time, which is correct UX
- TX route is `'wh347'` matching the v5.0 scope decision: TX uses the existing WH-347 generator, no new PDF generator
- CA and WA disclosure modals (regulatory notice) are now bypassed by the registry button — acceptable for this refactor since the registry button is a direct download; per-state disclosure logic can be re-added in dedicated phases if regulatory requirements demand it

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- STATE_FORMS registry is live; Phase 48 (FL) needs only `FL: { downloadLabel: '...', route: 'wh347' }` in the registry
- All existing state booleans (isCA/isWA/isNY/isIL) remain intact for submission tracking rows and panel logic
- TypeScript compiles clean (pre-existing audit.ts and projects.ts implicit-any errors are known non-fatal, unchanged by this plan)

---
*Phase: 47-state-foundations-tx-certified-payroll*
*Completed: 2026-04-07*
