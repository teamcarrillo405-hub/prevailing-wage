---
phase: 5
plan: "05-03"
slug: job-cost-variance-report
status: complete
completed_date: "2026-03-19"
duration_minutes: 7
tasks_completed: 7
files_created: 9
files_modified: 2
commits: 6

subsystem: variance-reporting
tags: [variance, budget, recharts, pdf, sqlite]

dependency_graph:
  requires: [payroll_weeks, payroll_entries, projects]
  provides: [project_budgets, varianceService, variancePdf, varianceRouter, VarianceReportPage]
  affects: [src/server/index.ts]

tech_stack:
  added: [recharts@3.8.0]
  patterns:
    - "Linear burn rate: workingBudget / totalWeeks * payrollNumber"
    - "Upsert via delete-then-insert (SQLite, no ON CONFLICT REPLACE due to UNIQUE)"
    - "PDFDocument.create() for generated PDFs — never load()"
    - "Recharts Tooltip formatter typed as (value) => string to satisfy ValueType union"

key_files:
  created:
    - src/server/db/migrations/0007_project_budgets.sql
    - src/server/services/varianceService.ts
    - src/server/services/variancePdf.ts
    - src/server/routes/variance.ts
    - src/client/components/VarianceSummaryTable.tsx
    - src/client/components/VarianceTrendChart.tsx
    - src/client/pages/VarianceReportPage.tsx
    - tests/services/varianceService.test.ts
    - tests/services/variancePdf.test.ts
    - tests/routes/variance.test.ts
  modified:
    - src/server/db/schema.ts (appended projectBudgets table)
    - src/server/index.ts (registered varianceRouter at /api/variance)

decisions:
  - "Linear burn rate model: workingBudget / totalWeeks * payrollNumber — cumulative budget through payroll N"
  - "Cost source: grossWages when non-null, else totalHours * (baseRateSnapshot + fringeRateSnapshot) — never reads wageClassifications"
  - "isOverThreshold = Math.abs(variancePct) > varianceThresholdPct — uses cumulative variance not weekly"
  - "Recharts 3 Tooltip formatter typed as (value) rather than (value: number) to satisfy ValueType | undefined union"

requirements_closed: [VAR-01, VAR-02, VAR-03, VAR-04]
---

# Phase 5 Plan 03: Job Cost Variance Report Summary

**One-liner:** Week-by-week variance report with linear burn rate, threshold flags, Recharts trend chart, and PDF export using project_budgets table.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| W0-1 | Install recharts | 9e2a6e0 | package.json, package-lock.json |
| W0-2 | Variance service test stubs | e7740a4 | tests/services/varianceService.test.ts |
| W0-3 | Variance PDF and routes test stubs | e7740a4 | tests/services/variancePdf.test.ts, tests/routes/variance.test.ts |
| 1-1 | Schema migration for project_budgets | fc188d8 | schema.ts, 0007_project_budgets.sql |
| 1-2 | varianceService.ts | 55fa246 | src/server/services/varianceService.ts |
| 1-3 | variancePdf.ts and variance routes | 5f280f9 | variancePdf.ts, variance.ts, index.ts |
| 2-1 | VarianceSummaryTable, VarianceTrendChart, VarianceReportPage | 5764ef9 | 3 UI files |

## Verification Results

- TypeScript: `npx tsc --noEmit` passes (excluding pre-existing union.ts and workers.ts errors from other plans)
- recharts: installed and verified with `node -e "require('recharts') && console.log('ok')"`
- Test stubs: 19 todo tests listed across 3 files
- Migration: `project_budgets` table confirmed in data/prevailing-wage.db
- Schema: `projectBudgets` export appended after `gsaRates` in schema.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts 3 Tooltip formatter type mismatch**
- **Found during:** Task 2-1
- **Issue:** `(value: number) => string` not assignable to Recharts `Formatter<ValueType, NameType>` because `ValueType` includes `undefined`
- **Fix:** Changed to `(value) => fmtCurrency(Number(value))` — inferred type satisfies the union
- **Files modified:** src/client/components/VarianceTrendChart.tsx
- **Commit:** 5764ef9

**2. [Rule 3 - Scope] req.params type cast added**
- **Found during:** Task 1-3
- **Issue:** Express 5 types `req.params` values as `string | string[]` — drizzle `eq()` requires `string`
- **Fix:** Cast `projectId as string` at all usage sites in variance.ts (consistent with project pattern from decisions log)
- **Files modified:** src/server/routes/variance.ts
- **Commit:** 5f280f9

## Self-Check: PASSED

All created files verified present. All 6 commits confirmed in git log.
