---
phase: 89-dol-2024-rule-updates
plan: 03
subsystem: project-detail-ui
tags: [civil-penalty, comp-08, dol-2024, 29-cfr-part-5-14, violation-exposure]
dependency_graph:
  requires: []
  provides: [CIVIL_PENALTY_PER_VIOLATION constant, civil penalty card on ProjectDetailPage]
  affects: [src/client/pages/ProjectDetailPage.tsx]
tech_stack:
  added: []
  patterns: [useQuery batch compliance summary, conditional red exposure card]
key_files:
  created: []
  modified:
    - src/client/pages/ProjectDetailPage.tsx
decisions:
  - Used existing /compliance/projects/summary endpoint (batch) to get violationCount without a new API
  - Card conditionally renders only when project.status === 'active' and violationCount > 0
metrics:
  duration: "~12 minutes"
  completed: "2026-04-27"
  tasks: 1
  files: 1
---

# Phase 89 Plan 03: Civil Penalty Exposure Card Summary

**One-liner:** Added `CIVIL_PENALTY_PER_VIOLATION = 13_508` constant and a conditional red card on ProjectDetailPage showing violation count and max DOL civil penalty exposure ($13,508 per violation per 29 CFR Part 5.14).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fetch compliance summary and display civil penalty card | d461293 | ProjectDetailPage.tsx |

## Changes Made

**`src/client/pages/ProjectDetailPage.tsx`**
- Added `CIVIL_PENALTY_PER_VIOLATION = 13_508` constant after `FUNDING_TYPE_LABELS`
- Added `useQuery` for `/compliance/projects/summary` (enabled only when project is active)
- Added computed vars: `projectCompliance`, `violationCount`, `maxCivilPenalty`
- Rendered civil penalty card (red border, `bg-red-50`) after notification panel, before archive modal
- Card shows 2-column grid: Violations count + Max Exposure in dollars
- Card only renders when `project.status === 'active'` and `violationCount > 0`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/client/pages/ProjectDetailPage.tsx` — FOUND
- Commit d461293 — FOUND
- `CIVIL_PENALTY_PER_VIOLATION`, `Civil Penalty Exposure`, `13_508`, `violationCount` all present — CONFIRMED
- TypeScript compiles without new errors — CONFIRMED
