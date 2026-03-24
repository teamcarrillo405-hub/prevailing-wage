---
phase: 24-california-dir-a-1-131-form
plan: 02
subsystem: ui
tags: [react, react-hook-form, zod, tailwindcss, typescript, vitest]

# Dependency graph
requires:
  - phase: 24-01
    provides: DB schema with cslbLicense/wcPolicyNumber on projects and monDt-sunDt on payrollEntries; server routes accepting CA fields
provides:
  - ProjectForm with conditional CSLB + WC fields visible only when state=CA
  - PayrollWeekForm with DT hour columns gated on isCA prop
  - PayrollEntryPage passes isCA derived from project.state to PayrollWeekForm
  - payrollService persists monDt-sunDt fields in upsertPayrollEntry
  - CAL-01 tests (3) GREEN
  - CAL-03 tests (2) GREEN
affects: [25-washington-form, CA-specific WH-347 generation in future plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - watch() from react-hook-form to derive isCA from state field
    - Conditional JSX block gated on isCA for CA-specific form fields
    - Optional prop with default (isCA?: boolean = false) for progressive enhancement

key-files:
  created: []
  modified:
    - src/client/components/projects/ProjectForm.tsx
    - src/client/components/PayrollWeekForm.tsx
    - src/client/pages/PayrollEntryPage.tsx
    - src/server/services/payrollService.ts
    - tests/routes/projects.test.ts
    - tests/routes/payroll.test.ts

key-decisions:
  - "isCA derived from watch('state') in ProjectForm - re-renders on every state keystroke, fields appear/disappear immediately"
  - "PayrollEntryPage adds a second useQuery for project data to get state - separate from workers query, uses ['project', projectId] key"
  - "DT fields included in payrollService UpsertPayrollEntryInput type and persisted in DB values + onConflictDoUpdate - DB columns existed but service was not passing them through"
  - "isCA defaults to false in PayrollWeekForm - non-CA callers get no DT columns without change"

patterns-established:
  - "CA-conditional UI: watch(state field) => isCA => conditional render amber-bordered section"
  - "DT spread pattern: ...(isCA ? { monDt, tueDt, ... } : {}) in form payload"

requirements-completed: [CAL-01, CAL-03]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 24 Plan 02: CA-Conditional UI Summary

**ProjectForm conditionally shows CSLB License + WC Policy fields when state=CA; PayrollWeekForm renders DT hour columns only for CA projects; 5 RED test stubs turned GREEN (CAL-01 x3, CAL-03 x2)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-24T14:45:00Z
- **Completed:** 2026-03-24T14:48:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- ProjectForm watches `state` field live and renders CSLB/WC fields in an amber section only when state=CA
- PayrollWeekForm accepts `isCA` prop — renders DT column headers and input cells, includes DT payload when saving
- PayrollEntryPage fetches project data to derive `isCA` and passes it down to PayrollWeekForm
- Fixed payrollService to actually persist monDt-sunDt fields (DB columns existed but service was omitting them)
- All 5 RED stubs replaced with real assertions; all 75 targeted tests pass

## Task Commits

1. **Task 1: CA-conditional project fields in ProjectForm + CAL-01 tests GREEN** - `d7a61d3` (feat)
2. **Task 2: DT hour columns in PayrollWeekForm + CAL-03 tests GREEN** - `6fb0e7a` (feat)

## Files Created/Modified

- `src/client/components/projects/ProjectForm.tsx` - Added cslbLicense/wcPolicyNumber to schema, watch('state'), isCA derive, conditional amber CA fields block
- `src/client/components/PayrollWeekForm.tsx` - Added isCA prop, DT form values, DT column headers, DT input cells, DT payload spread
- `src/client/pages/PayrollEntryPage.tsx` - Added project query, derive isCA from project.state, pass isCA to PayrollWeekForm
- `src/server/services/payrollService.ts` - Added monDt-sunDt to UpsertPayrollEntryInput, values object, and onConflictDoUpdate set
- `tests/routes/projects.test.ts` - Replaced 3 RED CAL-01 stubs with real assertions
- `tests/routes/payroll.test.ts` - Replaced 2 RED CAL-03 stubs with real assertions

## Decisions Made

- watch('state') in ProjectForm re-evaluates isCA on every keystroke so CA fields appear as soon as the user types "CA" — no blur required
- PayrollEntryPage uses a second independent query `['project', projectId]` rather than threading state through existing workers query — cleaner separation of concerns
- DT columns use `step="0.25"` (double-time is often calculated in quarter-hour increments for CA DIR) vs `step="0.5"` for ST/OT

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] payrollService not persisting DT fields**
- **Found during:** Task 2 (DT hours in PayrollWeekForm)
- **Issue:** UpsertPayrollEntryInput type did not include monDt-sunDt fields. DB schema had the columns with default 0, route schema accepted the fields, but the service values object and onConflictDoUpdate set omitted them entirely — DT values would silently be ignored
- **Fix:** Added monDt-sunDt to UpsertPayrollEntryInput interface, values object, and onConflictDoUpdate set in payrollService.ts
- **Files modified:** src/server/services/payrollService.ts
- **Verification:** CAL-03 test 1 asserts entry.monDt === 2 after POST with monDt: 2 — passes
- **Committed in:** 6fb0e7a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical persistence)
**Impact on plan:** Essential for correctness — without this fix, DT values submitted from the UI would have been silently discarded. No scope creep.

## Issues Encountered

None - both tasks executed cleanly after the payrollService deviation was identified and auto-fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CAL-01 (CA project fields) and CAL-03 (DT hours capture) both GREEN
- Ready for Plan 24-03: CA DIR A-1-131 PDF generation
- PayrollWeekForm DT data is now stored in DB and accessible for form generation

---
*Phase: 24-california-dir-a-1-131-form*
*Completed: 2026-03-24*
