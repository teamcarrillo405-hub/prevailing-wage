---
phase: 06-wh-347-2025-compliance-foundation
plan: "04"
subsystem: api, ui
tags: [wh347, certApprentices, programName, export, react, typescript, tdd, vitest]

# Dependency graph
requires:
  - phase: 06-02
    provides: programName column in DB, workers API accepts/returns programName, payrollService includes programName in entries
  - phase: 06-03
    provides: multi-page fillWh347() in wh347Generator.ts

provides:
  - deriveAllApprenticesRegistered() exported helper in export.ts — pure function for certApprentices logic
  - certApprentices boolean in export route now derived from programName presence, not hardcoded
  - programName input on WorkersPage.tsx — visible when laborType is apprentice in Add Worker and Add Another Trade panels
  - programName flows from UI form to classification POST API payload
  - 6 TDD unit tests covering all certApprentices derivation scenarios

affects: [phase-07-compliance-engine, phase-09-fringe-benefits]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extract testable pure functions from route handlers and export them for TDD coverage"
    - "Conditional form fields gated on laborType state — programName only shown/submitted when apprentice"

key-files:
  created: []
  modified:
    - src/server/routes/export.ts
    - src/client/pages/WorkersPage.tsx
    - tests/services/wh347.test.ts

key-decisions:
  - "deriveAllApprenticesRegistered() exported from export.ts so it can be unit tested without mocking the entire route"
  - "programName field is col-span-2 in both forms to give it full width inline with existing inputs"
  - "programName only included in POST payload when non-empty (conditional spread) — server already accepts null"

patterns-established:
  - "Pattern: certApprentices derivation — false when any apprentice has null/empty programName, true otherwise"

requirements-completed: [WH347-01, WH347-02]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 06 Plan 04: Wire certApprentices Fix + programName UI Summary

**certApprentices boolean in export.ts now derived from programName presence on apprentice entries, and Workers UI shows a programName input field when labor type is apprentice**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-20T08:55:04Z
- **Completed:** 2026-03-20T09:03:00Z
- **Tasks:** 2 of 3 (Task 3 is a human-verify checkpoint — awaiting user verification)
- **Files modified:** 3

## Accomplishments

- Exported `deriveAllApprenticesRegistered()` pure helper from export.ts — testable without route mocking
- Fixed `certApprentices` in WH-347 Statement of Compliance: false when any apprentice lacks a programName, true when no apprentices exist or all have programName
- Added TODO Phase 7 comments on certProperPayment and certAccuratePayroll
- Added programName input to Workers page Add Worker and Add Another Trade panels, conditionally visible when laborType = apprentice
- 6 TDD unit tests green covering all boundary conditions for the derivation logic

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix certApprentices boolean in export.ts** - `fc690ea` (feat + test — TDD)
2. **Task 2: Add programName field to WorkersPage.tsx** - `2036c93` (feat)
3. **Task 3: Verify Phase 6 end-to-end** - awaiting human checkpoint

## Files Created/Modified

- `src/server/routes/export.ts` — Added deriveAllApprenticesRegistered() export, allApprenticesRegistered derivation, fixed certApprentices, added TODO comments
- `src/client/pages/WorkersPage.tsx` — Added programName to Classification interface, blankWorkerForm, extraClass state, mutation payloads, and UI inputs
- `tests/services/wh347.test.ts` — Added 6 TDD unit tests for deriveAllApprenticesRegistered()

## Decisions Made

- `deriveAllApprenticesRegistered()` is exported from the route file rather than a separate utils module — keeps the logic co-located with where it's used and avoids circular imports
- programName input placed as `col-span-2` below apprenticePercent in both forms for consistent full-width layout
- programName only included in the POST payload when it has content — server is permissive (accepts null) per Plan 02 decision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Reset programName when opening + Trade panel**
- **Found during:** Task 2 (WorkersPage.tsx changes)
- **Issue:** The plan specified adding programName to state and mutation payloads but did not mention resetting it in the `+ Trade` button onClick handler or in `onSuccess`. Without this, programName from a previous classification would bleed into the next.
- **Fix:** Added `programName: ''` to all three reset locations: `onSuccess`, `+ Trade` button onClick, and `setExtraClass` reset call
- **Files modified:** src/client/pages/WorkersPage.tsx
- **Verification:** TypeScript compiles, all 160 tests pass
- **Committed in:** 2036c93

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential correctness fix — programName state was correctly reset. No scope creep.

## Issues Encountered

None — pre-existing TypeScript errors in workers.ts (lines 109/116 implicit any) were known per STATE.md and did not block compilation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 6 is functionally complete pending human verification (Task 3 checkpoint)
- After checkpoint approval: export.ts and WorkersPage.tsx are production-ready for programName
- Phase 7 compliance engine can reference deriveAllApprenticesRegistered() contract tests as specification
- DB migration `0008_program_name.sql` must be applied to live DB before testing (per Plan 02)

---
*Phase: 06-wh-347-2025-compliance-foundation*
*Completed: 2026-03-20*
