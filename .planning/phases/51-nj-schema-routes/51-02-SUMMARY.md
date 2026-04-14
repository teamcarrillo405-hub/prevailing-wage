---
phase: 51-nj-schema-routes
plan: 02
subsystem: ui
tags: [react, tailwindcss, nj, state-forms, workers, certified-payroll]

# Dependency graph
requires:
  - phase: 51-01
    provides: njPwcNumber/njContractId columns on projects, workerSex on workers, /api/export/nj-mw562 route
provides:
  - isNJ-gated NJ PWC number and contract ID fields in ProjectForm
  - isNJ-gated workerSex select (M/F/N/Not reported) in WorkersPage edit form
  - NJ entry in STATE_FORMS registry routing to nj-mw562 export endpoint
affects: [51-nj-schema-routes, 52-nj-pdf-generator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - indigo color scheme (border-indigo-200 bg-indigo-50 text-indigo-800) for NJ-specific blocks, distinct from teal (MA)
    - isNJ guard for NJ-only fields; (isMA || isNJ) dual-gate for shared demographics

key-files:
  created: []
  modified:
    - src/client/components/projects/ProjectForm.tsx
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "Indigo color scheme for NJ blocks to visually distinguish from MA (teal) — matches CLAUDE.md design token guidance"
  - "workerSex sent only in isNJ branch of updateWorker mutation — not for non-NJ projects per RESEARCH.md Pitfall 4"
  - "workerSex shown in read-only card view only when isNJ and value is non-null — avoids clutter for other states"

patterns-established:
  - "isNJ-gated UI block pattern follows existing isMA/isCA/isWA conventions"
  - "STATE_FORMS NJ route key 'nj-mw562' matches server route path segment exactly"

requirements-completed:
  - NJ-01
  - NJ-02

# Metrics
duration: 12min
completed: 2026-04-13
---

# Phase 51 Plan 02: NJ Client UI Wiring Summary

**NJ UI gates wired across three client files: indigo-themed PWC/contract ID fields in ProjectForm, workerSex select in WorkersPage, and nj-mw562 entry in STATE_FORMS registry**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-13T00:29:35Z
- **Completed:** 2026-04-13T00:41:38Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 3

## Accomplishments

- ProjectForm.tsx now shows NJ PWC Registration Number and NJ Contract ID fields (indigo-themed block) only when state = NJ; absent for all other states
- WorkersPage.tsx edit form shows NJ EEO Sex select (M/F/N/Not reported) gated behind isNJ; workerSex sent to server only when isNJ; displayed in read-only card view when populated
- PayrollWeekDetailPage.tsx STATE_FORMS registry now includes `NJ: { downloadLabel: 'Download NJ MW-562', route: 'nj-mw562' }` — "Download NJ MW-562" button appears on NJ payroll weeks; returns 501 until Phase 52

## Task Commits

Each task was committed atomically:

1. **Task 1: ProjectForm.tsx — isNJ + NJ project fields block** - `b1ad17b` (feat)
2. **Task 2: WorkersPage.tsx + PayrollWeekDetailPage.tsx** - `169ff33` (feat)
3. **Task 3: Human verification checkpoint** - auto-approved per continuous execution authorization

## Files Created/Modified

- `src/client/components/projects/ProjectForm.tsx` — Added njPwcNumber/njContractId to Zod schema; added isNJ variable; added indigo-themed NJ field block after MA block
- `src/client/pages/WorkersPage.tsx` — Added workerSex to Worker interface, editForm state, workerToEditForm; added isNJ-gated select in edit UI; added workerSex to updateWorker mutation (isNJ only); added read-only display
- `src/client/pages/PayrollWeekDetailPage.tsx` — Added NJ entry to STATE_FORMS registry with route 'nj-mw562'

## Decisions Made

- Indigo color scheme for NJ blocks (border-indigo-200, bg-indigo-50, text-indigo-800) to visually distinguish from MA's teal — matches CLAUDE.md design token guidance
- workerSex sent only in isNJ branch of updateWorker mutation (not the isMA || isNJ dual-gate) — per plan's Pitfall 4 note, non-NJ projects must not receive workerSex
- Read-only card view shows workerSex only when isNJ and value is truthy — avoids null clutter

## Deviations from Plan

None — plan executed exactly as written.

## Checkpoint Auto-Approval

**Task 3 (human-verify checkpoint)** was auto-approved per the user's continuous autonomous execution authorization in the prompt (`<auto_checkpoint>`). The checkpoint would have verified:
- NJ PWC/contract ID fields visible only for NJ projects in ProjectForm
- workerSex select visible only on NJ project workers
- "Download NJ MW-562" button visible on NJ payroll weeks
- Button returns 501 as expected (Phase 52 fills in the PDF generator)

## Issues Encountered

None. Pre-existing TypeScript errors (audit.ts line 56, projects.ts line 148 implicit any) are unrelated to this plan's changes and pre-date this phase.

## Known Stubs

- `/api/export/nj-mw562/:weekId` returns 501 — this is intentional; Phase 52 implements the NJ MW-562 PDF generator. The "Download NJ MW-562" button will show a 501 error toast until Phase 52 ships.

## Next Phase Readiness

- Phase 52 (NJ PDF generator) can now build the MW-562 generator — the route stub exists, the STATE_FORMS entry is wired, and worker sex data is captured via the WorkersPage form
- No blockers

---
*Phase: 51-nj-schema-routes*
*Completed: 2026-04-13*
