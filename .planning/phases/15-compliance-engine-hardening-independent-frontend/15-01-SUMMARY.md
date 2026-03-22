---
phase: 15-compliance-engine-hardening-independent-frontend
plan: 01
subsystem: compliance-engine
tags: [compliance, apprentice-ratio, davis-bacon, tdd, comp-03]
dependency_graph:
  requires: []
  provides: [WeekViolation, computeCompliance-weekViolations, PayrollWeekDetailPage-apprentice-badge]
  affects: [src/server/services/complianceService.ts, src/client/pages/PayrollWeekDetailPage.tsx]
tech_stack:
  added: []
  patterns: [TDD RED-GREEN, week-level violation aggregation, additive interface extension]
key_files:
  created: []
  modified:
    - src/server/services/complianceService.ts
    - src/client/pages/PayrollWeekDetailPage.tsx
    - tests/services/complianceService.test.ts
decisions:
  - apprenticePercent required when laborType=apprentice — validation enforced by workers API schema
  - weekViolations rendered inside existing violations <ul> — consistent layout, single violations list
  - apprenticeHours > maxAllowed uses strict greater-than — exactly at 1:3 is compliant
metrics:
  duration: 7min
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_modified: 3
---

# Phase 15 Plan 01: Apprentice Ratio Violation Detection (COMP-03) Summary

JWT auth with apprentice ratio violation detection added to compliance engine and displayed in the PayrollWeekDetailPage compliance panel.

## What Was Built

COMP-03 apprentice ratio violation detection: `computeCompliance()` now aggregates apprentice and journeyworker hours across all entries in a payroll week, fires a `WeekViolation` when apprentice hours exceed the 1:3 ratio, and the PayrollWeekDetailPage renders an "Apprentice Ratio" badge with detail text when the violation is present.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing COMP-03 tests | b0e9b18 | tests/services/complianceService.test.ts |
| 1 (GREEN) | WeekViolation + apprentice ratio check | b6a1c27 | src/server/services/complianceService.ts, tests/ |
| 2 | Display weekViolations in compliance panel | 1f8cefb | src/client/pages/PayrollWeekDetailPage.tsx |

## Decisions Made

- `apprenticePercent` is required by the workers API when `laborType === 'apprentice'` — `seedApprenticeWorker` helper must include it (value 80 used for test fixture)
- `weekViolations` rendered inside the same `<ul>` as entry-level violations — no separate section needed, consistent visual treatment
- Strict greater-than comparison (`apprenticeHours > maxAllowed`) — exactly at the 1:3 ratio is compliant, not a violation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing apprenticePercent in seedApprenticeWorker helper**
- **Found during:** Task 1 GREEN phase (2 of 7 COMP-03 tests still failing after initial implementation)
- **Issue:** `seedApprenticeWorker` created apprentice classification without `apprenticePercent`. Workers API schema has a `.refine()` validation requiring `apprenticePercent` when `laborType === 'apprentice'`, causing classification creation to return 400 and entry to have no apprentice classification in DB.
- **Fix:** Added `apprenticePercent: 80` to the POST body in `seedApprenticeWorker`
- **Files modified:** tests/services/complianceService.test.ts
- **Commit:** b6a1c27 (included in GREEN commit)

## Verification

- All 13 compliance service tests pass (6 original COMP-01/COMP-02 + 7 new COMP-03)
- Full test suite: 188 tests pass, 0 failures across 19 test files

## Self-Check: PASSED
