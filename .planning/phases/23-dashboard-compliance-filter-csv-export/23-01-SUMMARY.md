---
phase: 23-dashboard-compliance-filter-csv-export
plan: "01"
subsystem: compliance-api
tags: [compliance, csv-export, batch-query, server-routes]
dependency_graph:
  requires: []
  provides: [getBatchProjectCompliance, GET /api/compliance/projects/summary, GET /api/compliance/worker/:workerId/history/csv]
  affects: [src/server/services/complianceService.ts, src/server/routes/compliance.ts]
tech_stack:
  added: [csv-stringify@6.7.0]
  patterns: [discriminated-union-return, route-ordering-before-wildcard, UTF-8-BOM-CSV]
key_files:
  created: []
  modified:
    - src/server/services/complianceService.ts
    - src/server/routes/compliance.ts
    - tests/routes/compliance.test.ts
    - package.json
decisions:
  - "Used DELETE /api/projects/:id (not PATCH /archive) to close project in archived test — matches existing soft-delete pattern"
  - "Route ordering: /projects/summary and /worker/:workerId/history/csv both registered before /:weekId wildcard"
  - "getBatchProjectCompliance() short-circuits on status=closed (no compliance computation needed for archived projects)"
metrics:
  duration: "5 minutes"
  completed: "2026-03-24"
  tasks_completed: 1
  files_modified: 4
---

# Phase 23 Plan 01: Batch Compliance Summary + CSV Export Summary

**One-liner:** Batch project compliance endpoint classifying all user projects as archived/violations/compliant/no-payroll in one call, plus UTF-8 BOM CSV download with 17 WH-347 columns for per-worker audit history.

## What Was Built

### getBatchProjectCompliance() service function

Added to `src/server/services/complianceService.ts`. Queries all projects for a user, classifies each:
- `archived` — project.status === 'closed' (short-circuit, no compliance computation)
- `no-payroll` — project has 0 payroll weeks
- `violations` — any week returns hasViolations === true (breaks on first match)
- `compliant` — all weeks checked, no violations found

Returns `Map<string, 'archived' | 'violations' | 'compliant' | 'no-payroll'>`.

### GET /api/compliance/projects/summary

Registered before `/:weekId` wildcard in compliance.ts. Returns `{ projects: [{ id, status }] }`. Eliminates N+1 per-card compliance fetches on the dashboard.

### GET /api/compliance/worker/:workerId/history/csv

Registered before `/:weekId` wildcard. Uses `csv-stringify/sync` for synchronous CSV generation. Returns:
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="compliance-history-{worker-name-safe}.csv"`
- UTF-8 BOM prefix (`\uFEFF`) for Excel compatibility
- 17 columns: Worker Name, SSN Last 4, Project Name, Project ID, Week Ending Date, Payroll Number, Violation Type, Detail, Expected Wages, Actual Wages, Delta, Apprentice Hours, Journeyworker Hours, Max Allowed Apprentice Hours, Week ID, Source Project ID, Exported At
- 403 for cross-user access (delegates to existing getWorkerComplianceHistory() authorization)

### Integration tests (9 new tests across 2 describe blocks)

**GET /api/compliance/projects/summary (5 tests):**
- Returns status array for authenticated user
- Returns violations for project with under-wage entry
- Returns no-payroll for project with no weeks
- Returns archived for closed project (uses DELETE /api/projects/:id soft-delete)
- Returns 401 when unauthenticated

**GET /api/compliance/worker/:workerId/history/csv (4 tests):**
- Returns 200 with Content-Type text/csv
- Response body begins with UTF-8 BOM (charCodeAt(0) === 0xFEFF)
- CSV has header row with 17 column names
- Returns 403 for worker belonging to different user

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Archive test used wrong HTTP method**
- **Found during:** Task 1 verification (first test run)
- **Issue:** Plan specified `PATCH /api/projects/:id/archive` but the actual archive endpoint is `DELETE /api/projects/:id` (soft-delete that sets status='closed'), per the existing projects.ts route
- **Fix:** Updated test to use `DELETE /api/projects/${projectId}` with status=200 assertion before calling summary
- **Files modified:** tests/routes/compliance.test.ts
- **Commit:** 4eb9aea

## Verification Results

```
Test Files  1 passed (1)
Tests       24 passed (24)
```

Full suite (after task commit):
```
Test Files  19 passed | 7 skipped (26)
Tests       233 passed | 42 todo (275)
```

No regressions. Previous test count was 224 passing (24 - 9 new = 215 pre-existing compliance tests + all other suites passing).

## Self-Check: PASSED

- `src/server/services/complianceService.ts` contains `export async function getBatchProjectCompliance(` — FOUND
- `src/server/routes/compliance.ts` contains `/projects/summary` before `/:weekId` (line 73 vs 145) — FOUND
- `src/server/routes/compliance.ts` contains `/worker/:workerId/history/csv` before `/:weekId` (line 83 vs 145) — FOUND
- `tests/routes/compliance.test.ts` contains both new describe blocks — FOUND
- Commit 4eb9aea exists — FOUND
- `csv-stringify` in package.json dependencies — FOUND
