---
phase: 41-ny-state-forms
plan: 02
subsystem: api
tags: [xml, xmlbuilder2, mpwr, ny-dol, payroll, tdd]

# Dependency graph
requires:
  - phase: 41-ny-state-forms plan 01
    provides: nysRegisteredApprentice field on payroll entries, nyMpwrSubmittedAt on payrollWeeks

provides:
  - generateMpwrXml() function exporting MPWR-compliant XML for NY DOL portal upload
  - MpwrXmlInput type definition

affects: [41-03, 41-04, 41-05, ny-state-forms export routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - workerMap grouping by workerId for multi-classification XML generation
    - SSN placeholder pattern: '000000' + ssnLast4 (STATE-03)
    - Plain (no namespace) XML root element for MPWR portal

key-files:
  created:
    - src/server/services/mpwrXmlGenerator.ts
    - tests/services/mpwrXmlGenerator.test.ts
  modified: []

key-decisions:
  - "MPWR XML uses plain <ProjectRollup> root — no namespace prefix, no xmlns attributes"
  - "SSN placeholder: '000000' + ssnLast4 per STATE-03; never write ssnLast4 directly"
  - "Multi-classification workers: group by workerId into one <employeeWorkWeek> with multiple <workWeek> children"
  - "Supplement rates derived: fringe total amount / total hours for each fringe type"
  - "OT hourly rate = baseRateSnapshot * 1.5"

patterns-established:
  - "MPWR workerMap: Map<workerId, entries[]> — same pattern as WA CPR XML workerMap in export.ts"
  - "Supplement rate derivation: fringe total amount / total hours — documented in code comment"

requirements-completed: [STATE-03]

# Metrics
duration: 5min
completed: 2026-04-06
---

# Phase 41 Plan 02: MPWR XML Generator Summary

**MPWR XML generator using TDD: xmlbuilder2 <ProjectRollup> root, multi-classification worker grouping, 000000+ssnLast4 SSN placeholder, supplementalPayment fringe rates**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-06T19:53:00Z
- **Completed:** 2026-04-06T19:55:58Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2 (created)

## Accomplishments

- 8 failing tests written and committed (RED) covering all MPWR XML requirements
- generateMpwrXml() implemented — all 8 tests pass (GREEN)
- Multi-classification worker grouping: worker with 2 entries (different tradeDescriptions) produces exactly 1 <employeeWorkWeek> with 2 <workWeek> children
- SSN placeholder pattern enforced: <ssnLast4> always contains 000000+last4, never raw last4

## Task Commits

1. **Task 1: RED — failing MPWR XML generator tests** - `56808b7` (test)
2. **Task 2: GREEN — MPWR XML generator implementation** - `d780977` (feat)

**Plan metadata:** (final commit — see below)

_TDD tasks: test commit first (56808b7), then implementation (d780977)_

## Files Created/Modified

- `src/server/services/mpwrXmlGenerator.ts` — MpwrXmlInput type + generateMpwrXml() function; ProjectRollup root, workerMap grouping, SSN placeholder, supplementalPayments
- `tests/services/mpwrXmlGenerator.test.ts` — 8 test cases covering all plan requirements

## Decisions Made

- MPWR XML uses plain `<ProjectRollup>` root — no namespace prefix, no xmlns attributes (unlike CA eCPR which uses CPR: namespace)
- SSN placeholder: `'000000' + ssnLast4` per STATE-03; never write ssnLast4 directly to the element
- Multi-classification workers: group by workerId into one `<employeeWorkWeek>` with one `<workWeek>` per classification entry
- OT hourly rate derived as `baseRateSnapshot * 1.5`
- Supplement rates derived as `fringe total amount / total hours` for ST and OT separately

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in `audit.ts` and `projects.ts` (implicit any on unrelated parameters) were present before this plan and are out of scope.

## Known Stubs

None — all XML elements are wired to real input data from MpwrXmlInput.

## Next Phase Readiness

- generateMpwrXml() is ready for use by the export route (Plan 41-03)
- MpwrXmlInput type is exported and available for route-level data assembly
- No blockers

---
*Phase: 41-ny-state-forms*
*Completed: 2026-04-06*
