---
phase: 10-css-design-token-foundation
plan: 03
subsystem: ui
tags: [tailwindcss, accessibility, focus-ring, design-tokens, tsx]

# Dependency graph
requires:
  - phase: 10-01
    provides: brand-gold token defined in index.css @theme block
provides:
  - focus:outline-hidden migration complete across 9 files (43 instances in this plan)
  - focus:ring-brand-gold token used for all focus rings (no arbitrary #F5C518 ring values)
  - focus:border-brand-gold on WorkersPage programName inputs (lines 442/550)
affects: [phase-11-ui-primitives, phase-14-page-by-page-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [focus:outline-hidden as standard focus-ring suppressor (TailwindCSS v4), focus:ring-brand-gold as standard brand focus ring]

key-files:
  created: []
  modified:
    - src/client/pages/WorkersPage.tsx
    - src/client/components/projects/ProjectForm.tsx
    - src/client/components/SamplePayrollForm.tsx
    - src/client/components/PayrollWeekForm.tsx
    - src/client/components/OtScenarioComparison.tsx
    - src/client/components/OtThresholdForm.tsx
    - src/client/components/auth/RegisterForm.tsx
    - src/client/components/auth/LoginForm.tsx
    - src/client/components/GsaRateForm.tsx

key-decisions:
  - "focus:outline-hidden is the correct TailwindCSS v4 rename of focus:outline-none — preserves accessibility tree awareness in forced-color/high-contrast mode"
  - "WorkersPage programName inputs use focus:border-brand-gold (not focus:ring-brand-gold) because they have no ring companion — border highlight is the sole focus indicator there"

patterns-established:
  - "Standard focus pattern: focus:outline-hidden focus:ring-2 focus:ring-brand-gold (or focus:ring-1 for compact inputs)"
  - "No arbitrary #F5C518 color values in focus ring classes — always use focus:ring-brand-gold token"

requirements-completed: [DESIGN-04]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 10 Plan 03: Focus Ring Token Migration Summary

**Migrated all 43 focus:outline-none instances across 9 TSX files to focus:outline-hidden + focus:ring-brand-gold, eliminating arbitrary color values and fixing forced-color mode compliance**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-20T16:00:00Z
- **Completed:** 2026-03-20T16:03:24Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Replaced 43 `focus:outline-none` instances with `focus:outline-hidden` across 9 TSX files
- Replaced all `focus:ring-[#F5C518]` arbitrary values with `focus:ring-brand-gold` token
- Replaced `focus:border-yellow-400` with `focus:border-brand-gold` on WorkersPage programName inputs (2 instances)
- 181 tests pass — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate focus:outline-none in 8 component files** - `0e28819` (feat)
2. **Task 2: Migrate WorkersPage.tsx — all 16 instances** - `94b82db` (feat)

## Files Created/Modified

- `src/client/pages/WorkersPage.tsx` — 16 instances migrated: 14x outline-none+ring, 2x border-yellow-400 on programName inputs
- `src/client/components/projects/ProjectForm.tsx` — 6 instances migrated
- `src/client/components/SamplePayrollForm.tsx` — 5 instances migrated (3 ring + 2 border-gray/amber)
- `src/client/components/PayrollWeekForm.tsx` — 4 instances migrated (2 ring + 2 border-gray/amber)
- `src/client/components/OtScenarioComparison.tsx` — 4 instances migrated
- `src/client/components/OtThresholdForm.tsx` — 3 instances migrated
- `src/client/components/auth/RegisterForm.tsx` — 2 instances migrated
- `src/client/components/auth/LoginForm.tsx` — 2 instances migrated
- `src/client/components/GsaRateForm.tsx` — 1 instance migrated

## Decisions Made

- `focus:outline-hidden` is the TailwindCSS v4 correct rename — it sets `outline: hidden` which preserves the accessibility tree entry in forced-color mode, unlike `outline-none` which sets `outline: 2px solid transparent` and fails WCAG in high-contrast environments
- WorkersPage programName inputs (the "Add Another Trade" and main "Add Worker" forms) use `focus:border-brand-gold` as the sole focus indicator — no ring is added because these are plain-text optional helper inputs where border-color highlight is sufficient

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SamplePayrollForm and PayrollWeekForm had additional focus:outline-none instances beyond the ring-based ones**
- **Found during:** Task 1 (verification grep after primary replacements)
- **Issue:** The hours-grid inputs (ST and OT day inputs) used `focus:outline-none focus:border-gray-400` and `focus:outline-none focus:border-amber-400` — these were not in the ring pattern so the initial replace_all missed them
- **Fix:** Applied separate `replace_all` for `focus:outline-none focus:border-gray-400` and `focus:outline-none focus:border-amber-400` in both files
- **Files modified:** SamplePayrollForm.tsx, PayrollWeekForm.tsx
- **Verification:** grep returns 0 results for focus:outline-none in components/
- **Committed in:** 0e28819 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/incomplete migration)
**Impact on plan:** Required to complete the mandate. No scope creep — all instances were explicitly in scope, just not covered by the primary pattern.

## Issues Encountered

None — replacements were mechanical and straightforward.

## Next Phase Readiness

- All focus rings now reference `focus:ring-brand-gold` token — consistent brand-color focus indicators sitewide
- ReportsPage.tsx (1 remaining instance) is handled by Plan 02 which owns that file
- Combined with Plan 02, the entire codebase will have zero `focus:outline-none` instances
- Phase 11 (UI Primitives) can safely build on the focus ring pattern established here

---
*Phase: 10-css-design-token-foundation*
*Completed: 2026-03-20*
