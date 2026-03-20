---
phase: 09-reports
plan: "01"
subsystem: reports
tags: [tdd, wave-0, reports, test-stubs]
dependency_graph:
  requires: []
  provides: [RPT-01-stubs, RPT-02-stubs]
  affects: [tests/routes/reports.test.ts]
tech_stack:
  added: []
  patterns: [supertest, vitest, fixture-seeding]
key_files:
  created:
    - tests/routes/reports.test.ts
  modified: []
decisions:
  - "Fringe-summary 404 test asserts res.body.error is a string — prevents accidental pass from Express default 404 HTML"
metrics:
  duration: "1m 45s"
  completed: "2026-03-20"
  tasks_completed: 1
  files_modified: 1
requirements:
  - RPT-01
  - RPT-02
---

# Phase 9 Plan 01: Reports Test Stubs Summary

6 failing test stubs covering fringe-summary (RPT-01) and pay-history (RPT-02) endpoints with seedReportFixture helper and real assertion errors as RED baseline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create reports.test.ts with stubs for RPT-01 and RPT-02 | 83a1246 | tests/routes/reports.test.ts |

## What Was Built

`tests/routes/reports.test.ts` — 191 lines covering:

**RPT-01: GET /api/reports/:projectId/fringe-summary (3 tests)**
- 200 response with rows array shape (workerId, workerName, totalFringeCredits)
- 403 when project owned by different user
- 404 with structured error body when projectId does not exist

**RPT-02: GET /api/reports/:projectId/worker/:workerId/pay-history (3 tests)**
- 200 response with rows array shape (weekNumber, grossWages, deductions)
- Row ordering assertion (uses Array.isArray minimal check for stub)
- 403 when project owned by different user

**Fixture helper:** `seedReportFixture(cookie)` — creates project, worker, classification, payroll week, and one payroll entry (monSt:8, grossWages:400, baseRateSnapshot:50, fringeRateSnapshot:10, deductions:0). Returns `{ projectId, weekId, workerId, classificationId }`.

## Verification

All 6 tests fail with assertion errors:
- Status tests fail: 404 received instead of expected 200/403 (routes don't exist)
- Shape tests fail: res.body.rows is undefined
- The 404 fringe-summary test asserts `typeof res.body.error === 'string'` — prevents accidental pass from Express HTML 404

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 404 stub was accidentally passing**
- **Found during:** Task 1 verification
- **Issue:** The "returns 404 when projectId does not exist" test for fringe-summary was accidentally passing — Express returns 404 for missing routes, which matched the expected status 404
- **Fix:** Added additional assertion `expect(typeof res.body.error).toBe('string')` — a real route must return structured JSON; Express HTML 404 has no `.error` field
- **Files modified:** tests/routes/reports.test.ts
- **Commit:** 83a1246 (included in same commit)

## Self-Check: PASSED

- tests/routes/reports.test.ts — FOUND
- commit 83a1246 — FOUND
- 09-01-SUMMARY.md — FOUND
