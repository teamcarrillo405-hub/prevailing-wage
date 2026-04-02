---
phase: 38-audit-trail-wiring-activity-ui
plan: "01"
subsystem: audit-logging
tags: [audit, compliance, AUDIT-03, NFR-03, worker-crud, payroll]
dependency_graph:
  requires: [37-02]
  provides: [audit-callsites-wired, workerService, deletePayrollEntry]
  affects: [workers-routes, payroll-routes, export-routes, import-routes]
tech_stack:
  added: []
  patterns:
    - Best-effort insertAuditLog in try/catch — never lets audit failure propagate
    - Dynamic import for auditService in route files to avoid circular deps
    - Static import in service files (payrollService, workerService)
    - Pre-query SELECT before upsert for create vs update detection
key_files:
  created:
    - src/server/services/workerService.ts
    - tests/services/workerService.test.ts
    - tests/services/payrollService.audit.test.ts
  modified:
    - src/server/index.ts
    - src/server/routes/workers.ts
    - src/server/services/payrollService.ts
    - src/server/routes/payroll.ts
    - src/server/routes/export.ts
    - src/server/routes/import.ts
decisions:
  - trust proxy set to 1 for real client IP via X-Forwarded-For on Render.com
  - assertProjectAccess called BEFORE deletePayrollEntry for correct authorization ordering
  - Dynamic import used in routes for auditService to avoid top-level circular dep risk
  - Static import used in services (workerService, payrollService) — no circular dep there
  - workerName looked up in payroll route via workers table SELECT for audit meta
metrics:
  duration: "7 minutes"
  completed_date: "2026-04-02"
  tasks: 2
  files: 8
---

# Phase 38 Plan 01: Audit Trail Wiring Summary

**One-liner:** Wired all 13 available Tier-1 audit actions via insertAuditLog() across 5 files — worker CRUD, payroll entry CRUD, week submission, 3 export downloads, 2 agency submissions, and 1 import commit.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create workerService.ts + trust proxy + Wave 0 tests | 2b9e11c | workerService.ts, workers.ts, index.ts, workerService.test.ts |
| 2 | Payroll entry audit + submission/export/import audit wiring | 7760151 | payrollService.ts, payroll.ts, export.ts, import.ts, payrollService.audit.test.ts |

## What Was Built

### Task 1: Worker Service + Trust Proxy

- `src/server/index.ts`: Added `app.set('trust proxy', 1)` on line 32 — enables real client IP via `X-Forwarded-For` behind Render.com load balancer
- `src/server/services/workerService.ts`: New file with `createWorker`, `updateWorker`, `deleteWorker` — each calls `insertAuditLog()` best-effort in a try/catch
  - `createWorker`: snapshots the inserted worker row; `ssnEncrypted` auto-redacted by auditService
  - `updateWorker`: computes diff via `diffObjects(before, after)`; only logs if diff is non-null
  - `deleteWorker`: snapshots the row before deletion
- `src/server/routes/workers.ts`: Refactored POST/PUT/DELETE handlers to delegate to workerService — removed inline DB operations from route handlers

### Task 2: Payroll Entry + All Remaining Audit Callsites

- `src/server/services/payrollService.ts`:
  - Added `and` import from drizzle-orm
  - Added `import { insertAuditLog, diffObjects } from './auditService.js'`
  - Extended `UpsertPayrollEntryInput` with `userEmail?`, `ipAddress?`, `workerName?`, `payrollNumber?`
  - Pre-query `SELECT` before upsert in `upsertPayrollEntry` to detect create vs update
  - Post-upsert audit: `payroll_entry.created` or `payroll_entry.updated` with snapshot or diff
  - Added `deletePayrollEntry()` function with `payroll_entry.deleted` audit
- `src/server/routes/payroll.ts`:
  - Imported `deletePayrollEntry`, `workers` table
  - Added `DELETE /entries/:entryId` route with `assertProjectAccess` guard before delete
  - `PATCH /weeks/:id/submit`: `payroll_week.submitted` audit after `updateWeekSubmission()`
  - `DELETE /weeks/:id/submit`: `payroll_week.unsubmitted` audit after `clearWeekSubmission()`
  - `PATCH /weeks/:id/ca-submit`: `agency_submission.created` with `meta.agency='CA_DIR'` when `submitted=true`
  - `PATCH /weeks/:id/wa-submit`: `agency_submission.created` with `meta.agency='WA_LNI'` when `submitted=true`
  - POST/PUT entry handlers: thread `userEmail`, `ipAddress`, `workerName`, `payrollNumber` to `upsertPayrollEntry`
- `src/server/routes/export.ts`: Audit after each download response:
  - `GET /wh347/:weekId`: `wh347.downloaded`
  - `GET /ecpr-xml/:weekId`: `ecpr_xml.downloaded`
  - `GET /wa-cpr-xml/:weekId`: `wa_pwia_xml.downloaded`
- `src/server/routes/import.ts`: `payroll_import.committed` audit after payrollImports row insert

## Audit Actions Wired (13 of 15)

| Action | File | Method |
|--------|------|--------|
| worker.created | workerService.ts | createWorker() |
| worker.updated | workerService.ts | updateWorker() |
| worker.deleted | workerService.ts | deleteWorker() |
| payroll_entry.created | payrollService.ts | upsertPayrollEntry() |
| payroll_entry.updated | payrollService.ts | upsertPayrollEntry() |
| payroll_entry.deleted | payrollService.ts | deletePayrollEntry() |
| payroll_week.submitted | payroll.ts | PATCH /weeks/:id/submit |
| payroll_week.unsubmitted | payroll.ts | DELETE /weeks/:id/submit |
| agency_submission.created (CA_DIR) | payroll.ts | PATCH /weeks/:id/ca-submit |
| agency_submission.created (WA_LNI) | payroll.ts | PATCH /weeks/:id/wa-submit |
| wh347.downloaded | export.ts | GET /wh347/:weekId |
| ecpr_xml.downloaded | export.ts | GET /ecpr-xml/:weekId |
| wa_pwia_xml.downloaded | export.ts | GET /wa-cpr-xml/:weekId |
| payroll_import.committed | import.ts | POST /commit |

Deferred (Phase 41/43): `ny_mpwr_xml.downloaded`, `il_pdf.downloaded` (routes not yet created).

## Test Results

- `npx vitest run tests/services/workerService.test.ts` — 4/4 pass
- `npx vitest run tests/services/payrollService.audit.test.ts` — 3/3 pass
- `npx vitest run --exclude ".claude/**"` — 403/403 pass, 0 regressions

## Deviations from Plan

None — plan executed exactly as written. The `deletePayrollEntry` route was correctly structured to call `assertProjectAccess` before the delete operation (as noted in the IMPORTANT note in the plan's Step 4 description).

## Known Stubs

None — all 13 audit callsites produce real audit_logs rows. No placeholder data.

## Self-Check: PASSED
