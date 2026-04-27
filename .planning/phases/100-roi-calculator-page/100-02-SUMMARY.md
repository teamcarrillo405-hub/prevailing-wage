---
phase: 100-roi-calculator-page
plan: 02
subsystem: server-leads
tags: [roi, leads, api, migration, TRUST-04]
dependency_graph:
  requires: [100-01-PLAN]
  provides: [POST-/api/roi-leads, roi_leads-table, 0061-migration]
  affects: [src/server/db/schema.ts, src/server/index.ts]
tech_stack:
  added: []
  patterns: [zod-validate-middleware, drizzle-insert, supertest-integration-tests]
key_files:
  created:
    - src/server/routes/roiLeads.ts
    - src/server/routes/roiLeads.test.ts
    - src/server/db/migrations/0061_roi_leads.sql
  modified:
    - src/server/db/schema.ts
    - src/server/db/migrations/meta/_journal.json
    - src/server/index.ts
decisions:
  - Migration numbered 0061 (not 0055 as plan stated) — last actual migration was 0060_checklist_syncs; idx sequence preserved
  - roiLeadsRouter uses named export (not default) matching roiLeads.ts pattern in plan; index.ts uses { roiLeadsRouter }
  - Route mounted before /api/auth (public — no requireAuth middleware) matching /api/sub-upload placement
  - afterEach cleanup uses db.delete(roiLeads) without WHERE — cleans all test rows, safe in isolated in-memory DB
metrics:
  duration: 8m
  completed: 2026-04-27
  tasks_completed: 2
  files_changed: 6
---

# Phase 100 Plan 02: POST /api/roi-leads Backend Summary

## One-liner

Drizzle roi_leads table + migration 0061 + Express POST route with zod validation + 6 integration tests — all passing, no TS errors.

## What Was Built

- `src/server/db/schema.ts`: `roiLeads` table appended (id, email, projectCount, workerCount, estimatedSavings, capturedAt)
- `src/server/db/migrations/0061_roi_leads.sql`: CREATE TABLE IF NOT EXISTS roi_leads
- `src/server/db/migrations/meta/_journal.json`: idx 61 entry registered
- `src/server/routes/roiLeads.ts`: POST / handler — zod validates email+counts+savings, inserts row, returns 201 with full row or 400 with validation error
- `src/server/routes/roiLeads.test.ts`: 6 integration tests covering all 6 behaviors
- `src/server/index.ts`: mounted at `/api/roi-leads` without requireAuth

## Validation

- email: z.string().email() — rejects "notanemail", requires format
- projectCount: int, min 1, max 1000
- workerCount: int, min 1, max 10000
- estimatedSavings: number, min 0

## Tests (all 6 passing)

1. 201 with full row on valid payload
2. 400 when email missing
3. 400 when email invalid format
4. 400 when projectCount negative
5. 400 when workerCount missing
6. Persists to DB on success

## CRITICAL DEVIATION

[Rule 3 - Plan Fix] Plan specified migration `0055_roi_leads.sql` and journal idx 55 — but actual last migration is `0060_checklist_syncs.sql` (idx 60). Used `0061_roi_leads.sql` / idx 61 to maintain correct sequence. Without this correction, the migrator would have failed (duplicate idx or skipped migration).

## Full Test Suite

Before: 803 tests, 65 files
After: 824 tests, 67 files (+21 tests, +2 files: roiLeads.test.ts + RoiCalculatorPage.test.tsx)
Result: 824 passed, 0 failed, 42 todo

## Self-Check: PASSED

- 0061_roi_leads.sql exists with CREATE TABLE statement
- _journal.json idx 61 entry confirmed
- roiLeads exported from schema.ts
- index.ts contains roi-leads route (verified with grep)
- commit 1765e06: feat(100-02): POST /api/roi-leads + migration 0061
