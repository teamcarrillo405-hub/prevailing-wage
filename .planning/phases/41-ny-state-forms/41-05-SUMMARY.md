---
phase: 41-ny-state-forms
plan: "05"
slug: ny-mpwr-modal-ui
subsystem: client
tags: [ny-state, modal, ui, mpwr, submission-tracking]

# Dependency graph
requires:
  - phase: 41-ny-state-forms plan 04
    provides: GET /api/export/pw12/:weekId, GET /api/export/ny-mpwr-xml/:weekId, PATCH /api/payroll/weeks/:id/ny-submit

provides:
  - NY MPWR 3-step submission modal on PayrollWeekDetailPage
  - isNY state gate (project.state.toUpperCase() === 'NY')
  - Step 1: PRC Number + Contractor Reg collection and persistence
  - Step 2: PW-12 PDF and MPWR XML download via fetch+blob+anchor
  - Step 3: submission checklist + Mark as Submitted tracking
  - nyMpwrSubmittedAt badge in Submission Status panel

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - NY state gate: project.state?.toUpperCase() === 'NY' (case-insensitive, matches isCA/isWA pattern)
    - Modal step machine: useState<1 | 2 | 3> (extends existing ecprStep/waCprStep pattern)
    - fetch+blob+anchor download: handleNyDownload() centralizes both PW-12 PDF and MPWR XML
    - closeNyModal() resets step to 1 on every close (prevents stale state, Research Pitfall 5)
    - useEffect seeds PRC/reg fields from project data on load (mirrors CA eCPR pre-fill pattern)
    - Badge variant="compliant" for submitted state (no "success" variant in design system)

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "Badge variant corrected from 'success' to 'compliant' — no 'success' variant exists in BadgeVariant type"
  - "Centralized fetch+blob+anchor into handleNyDownload() helper rather than duplicating for each button"
  - "handleNyStep1Save advances to Step 2 even on PATCH failure — non-blocking, user can re-enter if needed"

requirements-completed: [STATE-05]

# Metrics
duration: 20min
completed: 2026-04-06
---

# Phase 41 Plan 05: NY MPWR Modal UI Summary

**NY MPWR 3-step submission modal added to PayrollWeekDetailPage: isNY gate, PRC/reg number persistence (Step 1), PW-12 PDF and MPWR XML downloads (Step 2), 30-day deadline checklist and submit tracking (Step 3).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-06T19:56:00Z
- **Completed:** 2026-04-06T20:16:00Z
- **Tasks:** 1 auto + 1 human-verify
- **Files modified:** 1

## Accomplishments

- `isNY = projectData?.data?.project?.state?.toUpperCase() === 'NY'` gating constant added alongside isCA/isWA
- "NY MPWR Submission" button in action bar — only visible when `isNY && weekId`
- `nyMpwrSubmittedAt` field added to `PayrollWeek` interface; `nyprcNumber` and `nysContractorRegNumber` added to `ProjectData` interface
- State machine: `showNyMpwrModal`, `nyMpwrStep` (1|2|3), `nyPrcNumber`, `nysContractorRegNumber`, `nyMpwrSubmitting`
- `useEffect` seeds PRC/reg numbers from project data on load
- `closeNyModal()` resets step to 1 on every close
- `handleNyStep1Save()` — PATCHes project to persist values, advances to Step 2
- `handleNyDownload(url, filename)` — reusable fetch+blob+anchor helper for both PW-12 PDF and MPWR XML
- `handleNyMarkSubmitted()` — PATCH `/api/payroll/weeks/:weekId/ny-submit`, invalidates TanStack Query, closes modal
- Step 3 checklist: 4 bullet items including 30-day deadline reminder and dol.ny.gov link
- "NY MPWR Submitted" `Badge variant="compliant"` in Submission Status panel when `nyMpwrSubmittedAt` is set
- Human verified end-to-end: all 3 steps complete, files download, badge appears on submit

## Task Commits

1. **Task 1: Add NY MPWR 3-step submission modal** — `8c00b91`

## Files Created/Modified

- `src/client/pages/PayrollWeekDetailPage.tsx` — added isNY, state vars, useEffect seed, 3 handlers, button, modal JSX, submission badge row

## Decisions Made

- Badge variant `"compliant"` used for NY MPWR submitted state (no `"success"` variant in `BadgeVariant` type — auto-fixed Rule 1)
- `handleNyDownload()` helper centralizes fetch+blob+anchor for both download buttons rather than duplicating
- Step 1 PATCH failure is non-blocking — modal still advances to Step 2 (UX resilience; numbers can be corrected before final submission)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Badge variant "success" does not exist in design system**
- **Found during:** Task 1 verification (TypeScript compile)
- **Issue:** Plan specified `Badge variant="success"` but `BadgeVariant` type is `'compliant' | 'violation' | 'warning' | 'neutral'` — "success" would cause a type error
- **Fix:** Used `variant="compliant"` which is the existing green badge used for all "submitted" states in the file
- **Files modified:** src/client/pages/PayrollWeekDetailPage.tsx (both badge locations)
- **Commit:** 8c00b91

## Known Stubs

None — all three steps wire to real backend routes from Plan 04. Button gating, PATCH persist, download fetch, and submit PATCH all call live endpoints.

## Self-Check: PASSED

- `src/client/pages/PayrollWeekDetailPage.tsx` — FOUND (contains showNyMpwrModal, nyMpwrStep, isNY, handleNyMarkSubmitted)
- Commit 8c00b91 — present in git log
- TypeScript: clean for PayrollWeekDetailPage.tsx (only pre-existing unrelated errors in audit.ts, projects.ts)
- Human verified: approved

---
*Phase: 41-ny-state-forms*
*Completed: 2026-04-06*
