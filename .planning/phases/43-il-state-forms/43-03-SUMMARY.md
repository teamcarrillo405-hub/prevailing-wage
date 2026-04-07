---
phase: 43-il-state-forms
plan: 03
slug: export-submit-routes-tests
subsystem: api-routes
tags: [il-idol, export, pdf, state-gate, nfr-03, integration-tests, certified-payroll]
dependency_graph:
  requires: [43-02]
  provides: [GET /api/export/il-pdf/:weekId, PATCH /api/payroll/weeks/:id/il-submit]
  affects: [src/server/routes/export.ts, src/server/routes/payroll.ts, tests/routes/export.test.ts, tests/routes/payroll.test.ts]
tech_stack:
  added: []
  patterns: [assertProjectAccess before state gate (NFR-03), best-effort audit log via dynamic import, state-gated PDF export, PATCH submit route with timestamp]
key_files:
  created: []
  modified:
    - src/server/routes/export.ts
    - src/server/routes/payroll.ts
    - tests/routes/export.test.ts
    - tests/routes/payroll.test.ts
key_decisions:
  - assertProjectAccess called before IL state gate in both routes — NFR-03 requirement (auth check before business logic)
  - nonPwHours mapped from top-level e.nonPwHours (not e.entry.nonPwHours) — payrollService returns it at row level, not nested under entry
  - All *IsF fringe flags hardcoded false — no fund-type data in current model (Plan 02 constraint 3)
  - Daily non-PW cells hardcoded to 0 — nonPwHours is weekly total only (Plan 02 constraint 2)
metrics:
  duration: ~15 minutes
  completed: 2026-04-07
  tasks_completed: 2
  files_modified: 4
---

# Phase 43 Plan 03: Export/Submit Routes and Tests Summary

IL PDF export route and IL IDOL submit route wired into Express, with 4 integration tests covering state-gating (400 for non-IL) and authorization (403 without project access per NFR-03).

## What Was Built

### Task 1: Two New Routes

**GET /api/export/il-pdf/:weekId** (`src/server/routes/export.ts`):
- Imports `fillIlCertifiedTranscript` from `ilPdfGenerator.js`
- Guard sequence: load week (404) → assertProjectAccess (403) → IL state gate (400) → load entries → map to IlPdfInput → generate PDF → set Content-Type/Content-Disposition → res.end(Buffer.from(pdf)) → best-effort audit log `il_pdf.downloaded`
- Filename: `il-transcript-${weekId}.pdf`

**PATCH /api/payroll/weeks/:id/il-submit** (`src/server/routes/payroll.ts`):
- Imports `setIlIdolSubmitted` from `payrollService.js`
- Guard sequence: load week (404) → assertProjectAccess (403) → setIlIdolSubmitted → best-effort audit log `agency_submission.created { agency: 'IL_IDOL' }` → 200 { ilIdolSubmittedAt }

### Task 2: 4 Integration Tests

**tests/routes/export.test.ts** — new describe block `GET /api/export/il-pdf/:weekId - STATE-08`:
1. `should return 400 for non-IL project` — creates CA project, asserts 400 with "Illinois" in error message
2. `should return 403 without project access` — creates IL project as user A, requests as user B, asserts 403

**tests/routes/payroll.test.ts** — new describe block `PATCH /api/payroll/weeks/:id/il-submit`:
1. `should set ilIdolSubmittedAt for IL project` — creates IL project + week, PATCH, asserts 200 + ilIdolSubmittedAt string, verifies persisted on GET
2. `should return 403 without project access` — creates IL project as user A, PATCH as user B, asserts 403

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add IL PDF export route and IL IDOL submit route | a97c0a7 | src/server/routes/export.ts, src/server/routes/payroll.ts |
| 2 | Add IL PDF export and IL IDOL submit integration tests | d9e91b1 | tests/routes/export.test.ts, tests/routes/payroll.test.ts |

## Verification

```
npx tsc --noEmit
  → No new errors from Phase 43 Plan 03 changes
  → Pre-existing errors in audit.ts and projects.ts are unrelated

npx vitest run tests/routes/export.test.ts tests/routes/payroll.test.ts
  → tests/routes/export.test.ts: 23 tests passed
     ✓ GET /api/export/il-pdf/:weekId - STATE-08 > should return 400 for non-IL project (72ms)
     ✓ GET /api/export/il-pdf/:weekId - STATE-08 > should return 403 without project access (74ms)
  → tests/routes/payroll.test.ts: all IL tests passed
     ✓ PATCH /api/payroll/weeks/:id/il-submit > should set ilIdolSubmittedAt for IL project (33ms)
     ✓ PATCH /api/payroll/weeks/:id/il-submit > should return 403 without project access (46ms)
```

## Deviations from Plan

**1. [Rule 1 - Bug] nonPwHours field path corrected**
- **Found during:** Task 1 code mapping
- **Issue:** The plan template used `e.entry?.nonPwHours` but `getPayrollEntriesWithWorkerDetails` selects `nonPwHours: payrollEntries.nonPwHours` as a top-level field (not nested under `entry`). Using `e.entry.nonPwHours` would always be undefined.
- **Fix:** Changed mapping to `e.nonPwHours ?? 0` (top-level on the row object)
- **Files modified:** src/server/routes/export.ts
- **Commit:** a97c0a7

## Known Stubs

None — all fields from IlPdfInput are populated from live database data. The `*IsF` fringe flags are intentionally hardcoded to `false` (no fund-type data in current model — documented Plan 02 constraint 3). Daily non-PW cells are intentionally `0` (nonPwHours is a weekly total — documented Plan 02 constraint 2).

## Self-Check: PASSED

- `src/server/routes/export.ts` — route `/il-pdf/:weekId` added at line ~1097
- `src/server/routes/payroll.ts` — route `/weeks/:id/il-submit` added before export
- `tests/routes/export.test.ts` — STATE-08 describe block appended
- `tests/routes/payroll.test.ts` — il-submit describe block appended
- Commit a97c0a7 (routes) — FOUND
- Commit d9e91b1 (tests) — FOUND
- All 4 new IL tests pass — VERIFIED
