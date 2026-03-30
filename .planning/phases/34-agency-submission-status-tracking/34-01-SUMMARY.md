---
phase: 34-agency-submission-status-tracking
plan: "01"
subsystem: backend
tags: [db-migration, drizzle-schema, service-functions, api-routes, payroll-tracking]
dependency_graph:
  requires: []
  provides: [PATCH /api/payroll/weeks/:id/ca-submit, PATCH /api/payroll/weeks/:id/wa-submit]
  affects: [payrollWeeks table, payrollService.ts]
tech_stack:
  added: []
  patterns: [Drizzle ORM update pattern, assertProjectAccess auth guard, AgencySubmitSchema Zod boolean toggle]
key_files:
  created:
    - src/server/db/migrations/0019_agency_submission.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/services/payrollService.ts
    - src/server/routes/payroll.ts
decisions:
  - CA/WA submission tracking is independent of WH-347 edit lock (D-05 — no assertWeekNotSubmitted guard)
  - Service functions return typed result objects ({ caEcprSubmittedAt: string|null }) for structured API responses
  - AgencySubmitSchema uses boolean toggle (submitted: true/false) rather than separate set/clear endpoints
metrics:
  duration_seconds: 262
  completed_date: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 4
---

# Phase 34 Plan 01: Agency Submission Status Tracking (Backend) Summary

**One-liner:** SQLite migration + Drizzle schema columns + four service functions + two PATCH routes for independent CA eCPR and WA L&I submission timestamp tracking on payroll weeks.

## What Was Built

Two new nullable text columns on `payroll_weeks` (`ca_ecpr_submitted_at`, `wa_lni_submitted_at`) tracked via Drizzle schema. Four service functions (`setCaEcprSubmitted`, `clearCaEcprSubmitted`, `setWaLniSubmitted`, `clearWaLniSubmitted`) following the existing submit pattern. Two PATCH routes — `/weeks/:id/ca-submit` and `/weeks/:id/wa-submit` — accepting `{ submitted: boolean }` and returning the updated timestamp or null.

Both routes require auth + `assertProjectAccess`. Neither applies the WH-347 edit lock (`assertWeekNotSubmitted`) — CA/WA submission tracking is independent of WH-347 submission (D-05).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `1989ba4` | feat(34-01): migration + schema for agency submission columns |
| Task 2 | `0f69976` | feat(34-01): service functions + PATCH routes for CA/WA submission tracking |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes for all payroll files (pre-existing `projects.ts` implicit any unrelated)
- Migration file `0019_agency_submission.sql` created with two ALTER TABLE statements
- Journal entry registered at idx 15, tag `0019_agency_submission`
- Schema has both `caEcprSubmittedAt` and `waLniSubmittedAt` columns on payrollWeeks
- Both PATCH routes registered in payroll router
- No submittedAt guard applied (D-05 compliance)

## Known Stubs

None.

## Self-Check: PASSED
