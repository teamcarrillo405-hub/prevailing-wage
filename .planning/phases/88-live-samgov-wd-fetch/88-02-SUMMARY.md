---
phase: 88-live-samgov-wd-fetch
plan: "02"
subsystem: client+server
tags: [ui, banner, query, drizzle, tailwind, amber]
dependency_graph:
  requires: [88-01]
  provides: [StaleWdBanner component, extended GET /wage-determinations]
  affects: [ProjectDetailPage.tsx, projectWageDeterminations.ts]
tech_stack:
  added: []
  patterns: [useQuery with staleTime, Tailwind amber design tokens, lucide-react AlertTriangle]
key_files:
  created: []
  modified:
    - src/server/routes/projectWageDeterminations.ts
    - src/client/pages/ProjectDetailPage.tsx
decisions:
  - Used separate useQuery in ProjectDetailPage (not prop-drilling through ProjectWageDeterminationsPanel)
  - Replaced getPinnedWdsForProject() call with inline Drizzle query to JOIN wageDeterminations for lastFetchedAt
  - Banner uses amber Tailwind scale (bg-amber-50/border-amber-400/text-amber-800) — consistent with CA badge amber pattern in codebase
metrics:
  duration: "~8 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  files_changed: 2
---

# Phase 88 Plan 02: Stale-WD Banner on ProjectDetailPage Summary

One-liner: GET /wage-determinations extended with Drizzle JOIN to return lastFetchedAt; StaleWdBanner renders amber alert above WD panel when primary WD is older than 7 days or never synced.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend GET /wage-determinations to return lastFetchedAt per pin | bcb1d3b | projectWageDeterminations.ts |
| 2 | StaleWdBanner in ProjectDetailPage.tsx | bcb1d3b | ProjectDetailPage.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript: 0 new errors (pre-existing stripeService.ts version string mismatch is out-of-scope)
- Tests: 60 passed / 0 failed / 7 skipped (full suite green)
- Visual checkpoint: awaiting human verification (checkpoint:human-verify)

## Known Stubs

None - lastFetchedAt is wired from the real wageDeterminations.lastFetchedAt column (populated by wdolSync.ts). The banner will show correctly once a weekly sync has run or if no sync has occurred yet.

## Self-Check: PASSED
- projectWageDeterminations.ts innerJoin: EXISTS
- ProjectDetailPage.tsx StaleWdBanner: EXISTS
- ProjectDetailPage.tsx AlertTriangle import: EXISTS
- ProjectDetailPage.tsx wd-pins queryKey: EXISTS
- ProjectDetailPage.tsx 'days ago' text: EXISTS
- No hardcoded hex in ProjectDetailPage.tsx: CONFIRMED
- Commit bcb1d3b: EXISTS
