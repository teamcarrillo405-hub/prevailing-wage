---
phase: 07-compliance-engine-payroll-week-view
plan: 02
subsystem: compliance-engine
tags: [compliance, cwhssa, under-wage, payroll, service, route]
dependency_graph:
  requires: [07-01]
  provides: [07-03, 07-04]
  affects: [payroll-route, wh347-export]
tech_stack:
  added: []
  patterns: [violation-loop, ownership-check, snapshot-delegation]
key_files:
  created:
    - src/server/services/complianceService.ts
    - src/server/routes/compliance.ts
  modified:
    - src/server/routes/payroll.ts
decisions:
  - cwhssa-ot fires when totalOt > 0 AND |delta| > 0.01 (takes priority); under-wage fires when no OT and delta < -0.01
  - POST /api/payroll/entries added to payroll route (test seeding required it — Rule 3 auto-fix)
  - complianceRouter is NOT registered in index.ts yet — deferred to Plan 04 per wave planning
metrics:
  duration: 8m
  completed: "2026-03-20"
  tasks: 2
  files: 3
---

# Phase 07 Plan 02: Compliance Engine Service and Route Summary

Compliance engine built: `computeCompliance()` detects under-wage (COMP-01) and CWHSSA OT mismatches (COMP-02) by comparing stored `grossWages` against `calculateCwhssaOt()` output using frozen rate snapshots.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | complianceService.ts — violation loop delegating to calculateCwhssaOt() | eb7f9e2 | src/server/services/complianceService.ts, src/server/routes/payroll.ts |
| 2 | compliance route — GET /api/compliance/:weekId with ownership check | 0199cdb | src/server/routes/compliance.ts |

## Verification

All 6 `complianceService.test.ts` tests pass. Route tests in `compliance.test.ts` remain failing (3/4) as expected — `index.ts` wiring is deferred to Plan 04.

```
Test Files  1 passed  (complianceService.test.ts)
Tests       6 passed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added POST /api/payroll/entries route**
- **Found during:** Task 1 (TDD green phase)
- **Issue:** Test helper `seedEntry()` called `POST /api/payroll/entries` but only `PUT /entries/:id` existed — entries were not being created, all violation-detection tests returned empty violations array
- **Fix:** Added `POST /api/payroll/entries` handler to `payroll.ts` with the same validation schema and ownership check as the existing PUT route
- **Files modified:** `src/server/routes/payroll.ts`
- **Commit:** eb7f9e2

**2. [Rule 1 - Bug] Corrected violation type precedence for OT entries**
- **Found during:** Task 1 (TDD green phase — 5/6 tests passing)
- **Issue:** Original logic had `under-wage` firing first (delta < -0.01), but test COMP-02 expects `cwhssa-ot` when OT hours are present and wages mismatch
- **Fix:** Reversed precedence — `cwhssa-ot` checked first when `totalOt > 0 AND |delta| > 0.01`; `under-wage` only fires when no OT is present
- **Files modified:** `src/server/services/complianceService.ts`
- **Commit:** eb7f9e2

## Decisions Made

- **Violation type when OT present:** `cwhssa-ot` fires whenever `totalOt > 0 AND |delta| > 0.01`. `under-wage` is reserved for pure straight-time underpayment (no OT). This aligns with test expectations from Plan 01 stubs.
- **POST /api/payroll/entries:** Added as a convenience endpoint mirroring the existing PUT. This is a natural complement to the PUT upsert pattern and unblocks test seeding.

## Self-Check

- [x] `src/server/services/complianceService.ts` exists and exports `ComplianceViolation`, `ComplianceResult`, `computeCompliance`
- [x] `src/server/routes/compliance.ts` exists and exports `complianceRouter`
- [x] Commits eb7f9e2 and 0199cdb exist
- [x] 6/6 complianceService.test.ts tests pass
- [x] No schema changes (no compliance boolean columns)
- [x] computeCompliance delegates OT math entirely to calculateCwhssaOt()
