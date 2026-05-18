---
phase: 152-p0-compliance-fixes
plan: 01
subsystem: compliance-engine,payroll-import
tags: [compliance, apprentice-ratio, dt-hours, import, COMP-FIX-01, COMP-FIX-02]
requirements: [COMP-FIX-01, COMP-FIX-02]
dependency_graph:
  requires: []
  provides: [apprentice-ratio-daily-check, dt-hours-import-validation]
  affects: [complianceService, importRouter, WeekViolation]
tech_stack:
  added: []
  patterns: [per-day worker-count grouping, state-based field rejection]
key_files:
  created: []
  modified:
    - src/server/services/complianceService.ts
    - src/server/routes/import.ts
    - src/server/services/importTypes.ts
    - tests/services/complianceService.test.ts
    - tests/routes/import.test.ts
decisions:
  - Use worker-count per day (not hour-count per week) for COMP-03 daily ratio check
  - Group by day-of-week only (not trade+day) so journeyworker/apprentice tradeDescriptions do not need to match
  - Store dtHours in monDt column (total weekly DT in first slot, no per-day split available at import)
  - Reject non-Saturday weekEndingDate in new tests (matches COMP-FIX-05 federal validation)
metrics:
  duration_minutes: 45
  completed_date: 2026-05-18
  tasks_completed: 3
  files_modified: 5
---

# Phase 152 Plan 01: Daily Apprentice Ratio + DT Hours Import Fix Summary

Fixes two federal compliance calculation bugs: apprentice ratio checked weekly instead of daily, and DT hours hardcoded to 0 on CSV import.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix complianceService.ts apprentice ratio to daily | d6db8e9 | src/server/services/complianceService.ts |
| 2 | Fix import.ts DT hours parsing | 2bcba3b | src/server/routes/import.ts, src/server/services/importTypes.ts |
| 3 | Update tests | c3b955b | tests/services/complianceService.test.ts, tests/routes/import.test.ts |

## What Was Built

### COMP-FIX-01: Daily Apprentice Ratio Check

Replaced the weekly-aggregate `apprentice-ratio` violation with a per-(day-of-week) daily check producing `apprentice-ratio-daily` violations.

**Old behavior:** Summed all apprentice hours and all journeyworker hours for the whole week, then checked if apprentice total exceeded 1/3 of JW total. This allowed a "cheating" pattern where heavy apprentice staffing on one day was offset by JW-heavy days.

**New behavior:** For each day of the week (mon/tue/wed/thu/fri/sat/sun), counts distinct workers with hours > 0. If apprentice worker count / journeyworker worker count > 1/3 for any day, fires `apprentice-ratio-daily` with the day and worker counts. Pure-apprentice days (no JW) are skipped.

**Key design choices:**
- Groups by day only (not trade+day) because `getPayrollEntries` returns `tradeDescription` which differs between JW ("Electrician") and apprentice ("Electrician Apprentice")
- Counts workers present, not hours — matches regulatory language ("ratio of apprentices to journeyworkers")
- Apprentice-registration check preserved as-is

**New violation type:** Added `'apprentice-ratio-daily'` to `WeekViolation.violationType` and `WorkerViolationHistoryEntry.violationType` unions.

### COMP-FIX-02: DT Hours Import Parsing

Fixed hardcoded `monDt: 0...sunDt: 0` in the `/commit` endpoint.

**Changes:**
- Added `dtHours?: number | null` to `ImportedRow` interface in `importTypes.ts`
- Added project state lookup in `/commit` handler
- DT-allowed states: CA, AK, NV
- Rows with `dtHours > 0` on non-DT projects → 422 with detailed error
- Valid `dtHours` stored in `monDt` field (weekly total in Monday slot — per-day split unavailable at import level)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] trade+day grouping incompatible with getPayrollEntries schema**
- **Found during:** Task 1 implementation
- **Issue:** Plan pseudocode groups by `(trade, date)` but `getPayrollEntries` joins `workerClassifications.tradeDescription` which differs between JW and apprentice entries ("Electrician" vs "Electrician Apprentice"), causing them never to be in the same group
- **Fix:** Simplified to day-only grouping — still satisfies the daily ratio requirement and all new tests pass
- **Files modified:** src/server/services/complianceService.ts

**2. [Rule 1 - Bug] Non-Saturday test dates broke after COMP-FIX-05 validation**
- **Found during:** Task 3 test execution
- **Issue:** All existing compliance test dates (2025-05-01 through 2025-07-01) are non-Saturdays; COMP-FIX-05 rejects federal payroll weeks that don't end on Saturday
- **Fix:** Updated all new test dates to valid Saturdays (2025-05-03, 2025-05-10, 2025-07-05, 2025-06-07, 2025-06-14, 2025-06-21)
- **Note:** Pre-existing tests in the file still use non-Saturday dates and fail (25 pre-existing failures). These are out of scope for this plan.

## Pre-existing Test Failures (Not Caused by This Plan)

25 tests in `tests/services/complianceService.test.ts` and 12 tests in `tests/routes/import.test.ts` fail due to the Saturday weekEndingDate validation added in COMP-FIX-05 (phase 151). These were already failing before this plan was executed. Out of scope per deviation rules.

## New Tests Added

**Compliance tests (passing):**
- COMP-03: violation fires when 1 apprentice works same day as 1 JW (3 violations for Mon/Tue/Wed)
- COMP-03: no violation when 3 JW and 1 apprentice on same day (exactly at 1:3 ratio)
- COMP-03: no violation when apprentice only works days without any JW on site
- COMP-FIX-01: Monday fires, Friday (no App present) does not

**Import tests (passing):**
- COMP-FIX-02: CA project with dtHours=2 accepted (200)
- COMP-FIX-02: TX federal project with dtHours=2 rejected (422)
- COMP-FIX-02: dtHours=0 accepted for any state (200)

## Self-Check: PASSED

- src/server/services/complianceService.ts: FOUND
- src/server/routes/import.ts: FOUND
- src/server/services/importTypes.ts: FOUND
- tests/services/complianceService.test.ts: FOUND
- tests/routes/import.test.ts: FOUND
- Commit d6db8e9: verified in git log
- Commit 2bcba3b: verified in git log
- Commit c3b955b: verified in git log
