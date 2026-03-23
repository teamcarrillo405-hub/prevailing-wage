---
phase: 21-payroll-amendment-workflow
plan: 01
subsystem: server
tags: [amendment, payroll, service, route, export, tdd, compliance]
dependency_graph:
  requires:
    - Phase 17: payrollWeeks schema (amendmentNumber, originalWeekId columns)
    - Phase 19: assertWeekNotSubmitted, updateWeekSubmission (submission lifecycle)
  provides:
    - amendPayrollWeek() service function
    - POST /api/payroll/weeks/amend route
    - Amended WH-347 PDF label and filename
  affects:
    - Phase 21 Plan 02: UI will call POST /weeks/amend to create amendment weeks
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN: 9 failing tests committed before implementation
    - max() aggregate from drizzle-orm for sequential amendment numbering
    - Rate snapshot cloning (not live re-fetch) — 29 CFR Part 3 compliance
key_files:
  created: []
  modified:
    - src/server/services/payrollService.ts
    - src/server/routes/payroll.ts
    - src/server/routes/export.ts
    - tests/routes/payroll.test.ts
decisions:
  - "amendPayrollWeek() is a dedicated function (not reusing copyPayrollWeek()) — copy re-fetches live rates, amendment must clone snapshots"
  - "rootWeekId = originalWeek.originalWeekId ?? originalWeek.id — chains of amendments always resolve to the original week"
  - "max(amendmentNumber) WHERE originalWeekId = rootWeekId — sequential numbering across all amendments of same root"
  - "POST /weeks/amend placed before GET /weeks/:id wildcard — prevents Express route capture"
  - "Both payrollNumber label and filename updated in export.ts — distinguishes amended PDFs by content and download name"
metrics:
  duration: "5 min"
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_modified: 4
---

# Phase 21 Plan 01: Payroll Amendment Workflow (Server-Side) Summary

Server-side amendment workflow: `amendPayrollWeek()` service with sequential numbering + snapshot cloning, `POST /weeks/amend` route with 201/409/404 semantics, and "N (AMENDED M)" WH-347 PDF label with amended filename, all backed by 11 integration tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Amendment integration tests (failing) | a768dfc | tests/routes/payroll.test.ts |
| 1 | amendPayrollWeek() service + POST /weeks/amend route | cfd026c | payrollService.ts, payroll.ts |
| 2 | Amended WH-347 label + filename + export tests | a0d1ea7 | export.ts, payroll.test.ts |

## What Was Built

**`amendPayrollWeek()` in `payrollService.ts`:**
- Verifies original week exists and is submitted (throws if not)
- Resolves root week: `originalWeekId ?? id` — handles chains of amendments
- Queries `MAX(amendmentNumber)` for all amendments of the root week
- Creates new `payrollWeeks` row with same `weekEndingDate`/`payrollNumber`/`isFinal`, sets `originalWeekId`, `amendmentNumber`, `submittedAt: null`
- Clones all `payrollEntries` from source — copies `baseRateSnapshot`/`fringeRateSnapshot` directly (never calls `getCachedWd` or `lookupWageDetermination`)
- Returns `{ weekId, amendmentNumber, copiedCount }`

**`POST /api/payroll/weeks/amend` in `payroll.ts`:**
- Registered after `POST /weeks/copy` and before `GET /weeks/:id` to prevent wildcard capture
- 404 if week not found, 403 if not project owner, 409 if week not submitted
- 201 with result on success

**Amended WH-347 in `export.ts`:**
- `payrollNumber` field: `"N (AMENDED M)"` when `amendmentNumber != null && originalWeekId != null`
- Filename: `wh347-N-amended-M.pdf` for amendment weeks, `wh347-N.pdf` for normal weeks

## Test Results

- Amendment tests: 11 new tests (9 AMD-01/03 + 2 AMD-02), all GREEN
- Full suite: 218 passing (was 188 pre-v2.3), no regressions
- 7 test files skipped (pre-existing skips unrelated to this plan)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- `src/server/services/payrollService.ts` — amendPayrollWeek() present: confirmed
- `src/server/routes/payroll.ts` — /weeks/amend route: confirmed
- `src/server/routes/export.ts` — AMENDED conditional: confirmed
- `tests/routes/payroll.test.ts` — 11 new tests: confirmed
- Commits a768dfc, cfd026c, a0d1ea7 — all present in git log

## Self-Check: PASSED
