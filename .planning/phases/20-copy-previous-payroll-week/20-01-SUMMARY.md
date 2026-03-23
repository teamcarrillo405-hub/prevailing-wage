---
phase: 20-copy-previous-payroll-week
plan: "01"
subsystem: payroll-api
tags: [payroll, copy-week, compliance, tdd]
dependency_graph:
  requires: []
  provides: [copyPayrollWeek-service, POST-weeks-copy-route]
  affects: [payrollService.ts, payroll.ts]
tech_stack:
  added: []
  patterns: [cache-first-WD-lookup, preview-commit-pattern, skip-reason-enum]
key_files:
  created: []
  modified:
    - src/server/services/payrollService.ts
    - src/server/routes/payroll.ts
    - tests/routes/payroll.test.ts
decisions:
  - "Use getCachedWd ?? lookupWageDetermination pattern (matching workers.ts) for cache-first WD lookup in copyPayrollWeek"
  - "Test 5 uses unique state/county (WY + timestamp) to prevent WD cross-contamination in shared in-memory SQLite test DB"
  - "Route placed before GET /weeks/:id to prevent /weeks/copy being captured by :id wildcard"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-23"
  tasks_completed: 1
  files_modified: 3
---

# Phase 20 Plan 01: Copy Previous Payroll Week — API Summary

**One-liner:** `copyPayrollWeek()` service with cache-first WD rate re-fetch, worker-inactive/rate-lookup-failed/no-wd-found skip reasons, and `POST /api/payroll/weeks/copy` supporting preview (no DB write) and commit modes.

## What Was Built

### copyPayrollWeek() service function (`src/server/services/payrollService.ts`)

Exported interfaces added:
- `CopyWeekInput` — projectId, sourceWeekId, weekEndingDate, payrollNumber, preview
- `CopiedEntry` — workerId, workerName, classificationId, tradeDescription, baseRate, fringeRate
- `SkippedEntry` — same + reason ('worker-inactive' | 'rate-lookup-failed' | 'no-wd-found')
- `CopyWeekResult` — weekId (null in preview), copied[], skipped[]

Function logic:
1. Fetches project for state/county
2. Builds rate map via `getCachedWd ?? lookupWageDetermination` then `getCachedClassifications`
3. Queries source entries joined with workers + workerClassifications
4. Per entry: checks workerIsActive, then rateMap lookup, then adds to copied or skipped
5. Preview mode: returns without DB writes
6. Commit mode: calls `createPayrollWeek` then `upsertPayrollEntry` for each copied entry with fresh rates

Compliance guarantees enforced:
- NEVER copies baseRateSnapshot/fringeRateSnapshot from source
- NEVER defaults to rate 0 when tradeCode is missing
- New week has null submittedAt/submittedTo/amendmentNumber/originalWeekId (createPayrollWeek defaults)

### POST /api/payroll/weeks/copy route (`src/server/routes/payroll.ts`)

- `CopyWeekSchema` — sourceWeekId, weekEndingDate (YYYY-MM-DD), payrollNumber (int >= 1), preview (bool, default false)
- Route registered BEFORE `GET /weeks/:id` to prevent wildcard capture
- 404 if sourceWeekId not found, 403 if user doesn't own project
- Returns 200 for preview=true, 201 for preview=false

### Integration tests (`tests/routes/payroll.test.ts`)

9 new tests added in `describe('POST /api/payroll/weeks/copy — PAY-01 + PAY-02')`:

| Test | Scenario | Result |
|------|----------|--------|
| 1 | preview=true returns weekId: null | Pass |
| 2 | preview=false creates new week with weekId | Pass |
| 3 | Copied entries use fresh WD rates (55/22 not source 50/25) | Pass |
| 4 | Inactive worker → skipped with 'worker-inactive' | Pass |
| 5 | tradeCode not in WD → skipped with 'rate-lookup-failed' | Pass |
| 6 | New week has null submittedAt/submittedTo/amendmentNumber/originalWeekId | Pass |
| 7 | Source daily hours (monSt..sunOt) preserved in copied entries | Pass |
| 8 | 404 for non-existent sourceWeekId | Pass |
| 9 | 403 for user not owning the project | Pass |

## Test Results

- `npx vitest run tests/routes/payroll.test.ts`: 27/27 passing
- `npx vitest run` (full suite): 405/405 passing, 0 failures, 0 regressions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WD unique constraint collision in seedWdCache test helper**
- **Found during:** Task 1 (RED → GREEN transition)
- **Issue:** `seedWdCache` used static wdNumber `'TEST-WD-001'` — caused UNIQUE constraint failure when multiple tests seeded WDs for same state/county
- **Fix:** Changed wdNumber to `TEST-WD-${wdId}` using the unique `wdId` timestamp value
- **Files modified:** tests/routes/payroll.test.ts

**2. [Rule 1 - Bug] Test 5 WD cross-contamination from prior tests**
- **Found during:** Task 1 (GREEN phase — 1 test remaining after fixing issue 1)
- **Issue:** Test 5 used `CA/Los Angeles` (shared with all other tests) — a prior test's CARP WD was found by `getCachedWd`, making the rate map include CARP, which prevented the `rate-lookup-failed` skip
- **Fix:** Test 5 now creates a project with unique state `WY` + county `copy-no-rate-county-${Date.now()}` so getCachedWd only finds the intentionally seeded PLUM-only WD
- **Files modified:** tests/routes/payroll.test.ts

## Self-Check: PASSED

Files verified:
- src/server/services/payrollService.ts — contains copyPayrollWeek, CopyWeekInput, CopyWeekResult
- src/server/routes/payroll.ts — contains router.post('/weeks/copy'), CopyWeekSchema
- tests/routes/payroll.test.ts — contains 9 copy-week tests, all passing

Commits verified:
- 2f6db3a — test(20-01): add failing tests (RED)
- 94a6012 — feat(20-01): implement copyPayrollWeek service + route (GREEN)
