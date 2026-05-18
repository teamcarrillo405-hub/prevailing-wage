---
phase: 152-p0-compliance-fixes
plan: "02"
subsystem: payroll-validation
tags: [compliance, server-side-guards, federal-regulations, 29-cfr-part-3]
dependency_graph:
  requires: []
  provides: [COMP-FIX-03, COMP-FIX-04, COMP-FIX-05]
  affects: [payrollService, payroll-routes, payroll-tests]
tech_stack:
  added: []
  patterns: [throw-status-pattern, utc-day-check, post-repair-guard]
key_files:
  created: []
  modified:
    - src/server/services/payrollService.ts
    - src/server/routes/payroll.ts
    - tests/routes/payroll.test.ts
decisions:
  - Guards placed in service (after rate-repair) rather than routes to avoid breaking zero-rate repair flow
  - Federal detection uses fundingType === 'federal' OR !state (per plan constraint)
  - All existing test weekEndingDates updated to Saturdays as required by COMP-FIX-04
metrics:
  duration: 25m
  completed: "2026-05-18"
  tasks_completed: 5
  files_modified: 3
---

# Phase 152 Plan 02: Server-Side Payroll Entry Validation Guards Summary

Three server-side validation guards added to enforce federal payroll compliance rules: zero wage rate rejection (COMP-FIX-05), deduction cap enforcement (COMP-FIX-03), and Saturday week-end date requirement for federal projects (COMP-FIX-04).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Read payroll routes | (analysis) | src/server/routes/payroll.ts |
| 2 | COMP-FIX-05 base rate guard | 63e8c63 | src/server/services/payrollService.ts |
| 3 | COMP-FIX-03 deduction cap guard | 9b6d202 | src/server/routes/payroll.ts |
| 4 | COMP-FIX-04 Saturday week-end guard | 9b6d202 | src/server/routes/payroll.ts |
| 5 | Tests + existing date fixes | 303a7f3 | tests/routes/payroll.test.ts |

## Implementation Details

### COMP-FIX-05 (MISSING_WAGE_RATE)
Guard placed in `upsertPayrollEntry` in `payrollService.ts` AFTER the Phase 64 zero-rate repair block. If `effectiveBase <= 0` after the repair attempt (i.e., no WD in cache to repair from), throws `{ status: 422, code: 'MISSING_WAGE_RATE' }`. Both POST and PUT entry routes now wrap `upsertPayrollEntry` in try/catch and return structured 422 JSON. Existing repair test (`baseRateSnapshot: 0` + pinned WD) continues to pass because repair runs before the guard.

### COMP-FIX-03 (DEDUCTION_EXCEEDS_GROSS)
Guard placed in `upsertPayrollEntry` AFTER gross wages are computed from effective rates. Throws `{ status: 422, code: 'DEDUCTION_EXCEEDS_GROSS', message: 'Total deductions ($X.XX) cannot exceed gross wages ($Y.YY)' }`. Boundary case (deductions === grossWages) is allowed.

### COMP-FIX-04 (WEEK_MUST_END_SATURDAY)
Guard placed in `POST /api/payroll/weeks` route before the duplicate-week check. Performs a DB lookup to get `fundingType` and `state` for the project. Federal detection: `fundingType === 'federal' OR !state`. Uses `new Date(weekEndingDate + 'T00:00:00Z').getUTCDay()` to avoid timezone issues — 6 = Saturday. Returns 422 `WEEK_MUST_END_SATURDAY` for non-Saturday dates on federal projects. State projects are unrestricted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Guards placed in service layer, not route layer**
- **Found during:** Task 2
- **Issue:** The plan specified guards in `payroll.ts` routes, but existing tests send `baseRateSnapshot: 0` expecting 201 (because the service auto-repairs zero rates from the WD cache). Adding the guard in the route before calling the service would break these existing tests.
- **Fix:** COMP-FIX-05 and COMP-FIX-03 guards placed in `payrollService.ts` `upsertPayrollEntry` AFTER the Phase 64 repair block. Routes wrap the service call in try/catch to convert 422 errors to structured JSON responses. COMP-FIX-04 (week creation) stays in the route since it has no service repair dependency.
- **Files modified:** `src/server/services/payrollService.ts`, `src/server/routes/payroll.ts`
- **Commits:** 63e8c63, 9b6d202

**2. [Rule 3 - Blocking] All existing test weekEndingDates updated to Saturdays**
- **Found during:** Task 5
- **Issue:** All 30+ existing payroll tests used federal projects with non-Saturday weekEndingDates (Sundays, Mondays, Wednesdays). Adding COMP-FIX-04 would have broken the entire test suite.
- **Fix:** Updated every static weekEndingDate in `payroll.test.ts` to its nearest past Saturday. Updated the dynamic `due-soon` pastDate computation to always select a past Saturday. Verified all converted dates with `getUTCDay() === 6`.
- **Files modified:** `tests/routes/payroll.test.ts`
- **Commit:** 303a7f3

## Test Results

- `tests/routes/payroll.test.ts`: 50/50 passed (including 6 new guard tests)
- Pre-existing failures in `compliance.test.ts`, `audit.test.ts`, `export.test.ts`, `copilot.test.ts` confirmed pre-existing before this plan's changes (verified by `git stash` + run)

## Known Stubs

None — all guards are fully implemented with structured 422 responses.

## Self-Check: PASSED

- `src/server/services/payrollService.ts` — MISSING_WAGE_RATE guard present after repair block
- `src/server/services/payrollService.ts` — DEDUCTION_EXCEEDS_GROSS guard present after gross computation
- `src/server/routes/payroll.ts` — WEEK_MUST_END_SATURDAY guard in POST /weeks handler
- `src/server/routes/payroll.ts` — try/catch around `upsertPayrollEntry` in both POST and PUT entry handlers
- `tests/routes/payroll.test.ts` — 50 tests pass
- Commits 63e8c63, 9b6d202, 303a7f3 verified in git log
