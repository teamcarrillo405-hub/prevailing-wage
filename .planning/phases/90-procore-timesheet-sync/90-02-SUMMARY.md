---
phase: 90-procore-timesheet-sync
plan: "02"
subsystem: integrations
tags: [procore, timesheet-import, react-page, routes]
dependency_graph:
  requires: [90-01]
  provides: [procore-timesheet-routes, ProcoreImportPage, /procore/import-route]
  affects: [integrations.ts, App.tsx]
tech_stack:
  added: [ProcoreImportPage.tsx]
  patterns: [fetch-preview-commit pattern, day-of-week grouping, requireAuth mock in tests]
key_files:
  created:
    - src/client/pages/ProcoreImportPage.tsx
    - tests/procoreRoutes.test.ts
  modified:
    - src/server/routes/integrations.ts
    - src/client/App.tsx
decisions:
  - "Import payload uses PROCORE_IMPORT as classificationId placeholder — real classification must be set on payroll entry page post-import (documented as known stub)"
  - "vi.mock('../src/server/middleware/auth.js') needed to bypass JWT validation in supertest tests"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  files_changed: 4
---

# Phase 90 Plan 02: Procore Timesheet Fetch + Import Bridge + ProcoreImportPage Summary

One-liner: Procore timesheet fetch/import routes + three-state React import page (input, preview table with checkboxes, success banner) registered at /procore/import.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | GET /procore/timesheet-entries + POST /procore/import | d3f531a | integrations.ts, tests/procoreRoutes.test.ts |
| 2 | ProcoreImportPage + App.tsx route | d3f531a | ProcoreImportPage.tsx, App.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] requireAuth mock needed for route tests**
- **Found during:** Task 1 testing
- **Issue:** Supertest requests were being rejected by requireAuth JWT verification (401) even when `req.user` was set by middleware. The JWT validation overrides any pre-set req.user.
- **Fix:** Added `vi.mock('../src/server/middleware/auth.js')` to inject test user without JWT validation, matching the correct test pattern for Express route testing.
- **Files modified:** tests/procoreRoutes.test.ts
- **Commit:** d3f531a

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| src/client/pages/ProcoreImportPage.tsx | `classificationId: 'PROCORE_IMPORT'` | Procore timesheet entries don't carry prevailing-wage classification IDs. Users must correct the classification on the Payroll Entry page after import. A future plan should add classification mapping to the import flow. |

## Verification Results

- GET /procore/timesheet-entries returns 400 on missing params, 401 if not connected, 200 + mapped rows on success
- POST /procore/import returns 400 on bad body, 401 if not connected, 423 if week submitted, 200 + { committed, weekId } on success
- ProcoreImportPage.tsx implements all three states: input form, preview table, success banner
- /procore/import registered in App.tsx inside the ProtectedRoute layout
- tsc --noEmit: 0 new errors
- vitest: 784 passed (9 new procoreRoutes.test.ts tests)

## Self-Check: PASSED
