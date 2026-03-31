---
phase: 35-payroll-import-server-pipeline
plan: "02"
subsystem: import-routes
tags: [payroll-import, express-router, multer, multipart-upload, integration-tests, audit-trail]
dependency_graph:
  requires: [importTypes, importService, payrollImports-migration]
  provides: [import-router, preview-endpoint, commit-endpoint]
  affects: [phase-36-import-ui]
tech_stack:
  added: []
  patterns: [multer-memoryStorage, manual-multer-invocation-for-error-handling, drizzle-async-insert-loop, supertest-multipart-attach]
key_files:
  created:
    - src/server/routes/import.ts
    - tests/routes/import.test.ts
  modified:
    - src/server/index.ts
decisions:
  - "multer wrapped in manual invocation (upload.single()(req,res,cb)) so MulterError is caught as 400 not 500"
  - "commit route uses drizzle async .select() with explicit type annotation to satisfy TS strict mode"
  - "tests access payrollImports audit rows via globalThis.__testDb directly — no separate audit endpoint needed for test verification"
  - "getPayrollEntries returns { entry, workerName, ... } shape — tests destructure accordingly"
metrics:
  duration_seconds: 694
  completed_date: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
  tests_added: 11
  tests_passing: 11
---

# Phase 35 Plan 02: Import Routes Summary

**One-liner:** Express router with multer-based multipart preview endpoint and JSON commit endpoint, both enforcing auth + assertProjectAccess + submitted-week 423 guard, with payrollImports audit row on commit.

## What Was Built

### Import Router (Task 1)

**`src/server/routes/import.ts` — `importRouter`:**
- `POST /preview` — multipart/form-data upload via multer memoryStorage, 5 MB limit, CSV MIME types only
  - multer wrapped in manual invocation to capture `MulterError` as 400 (LIMIT_FILE_SIZE → "File too large. Maximum 5 MB.")
  - reads `weekId` from `req.body.weekId` (multipart form field alongside file)
  - 400 if no file, 404 if week not found, then `assertProjectAccess`, then 423 if `week.submittedAt`
  - calls `parseImportFile(req.file.buffer, weekId, week.projectId, db)` — 400 on throw (unknown provider)
  - returns `ImportPreviewResult` JSON
- `POST /commit` — JSON body: `{ weekId, provider, matched[], unmatchedCount?, sourceFilename? }`
  - same auth + access + submitted-week guard as preview
  - pre-insert conflict check against existing `payrollEntries` — 409 if any conflicts
  - inserts one `payrollEntries` row per matched worker via loop
  - inserts one `payrollImports` audit row
  - returns `{ committed: N }`

**`src/server/index.ts`:**
- Added `import { importRouter } from './routes/import.js'`
- Mounted at `app.use('/api/payroll/import', importRouter)` — placed after team router, before static serving

### Integration Tests (Task 2)

**`tests/routes/import.test.ts` — 11 tests, all green:**

Preview endpoint:
- 401 when unauthenticated
- 400 when no file uploaded
- 400 for unknown CSV format ("Could not detect payroll provider")
- 423 when week is submitted
- QB CSV: matched worker in `matched[]`, unmatched worker in `unmatched[]`, correct day hours (monSt=8, tueSt=8, monOt=2)
- ADP CSV: `provider='adp'`, `adpWeeklyTotalsOnly=true`, hours on Monday (monSt=40, monOt=5)

Commit endpoint:
- 401 when unauthenticated
- 423 when week is submitted
- Success: `payrollEntries` row created with correct day values, `payrollImports` audit row with provider/committedCount/unmatchedCount/sourceFilename
- 409 when worker already has entry for week (second commit attempt)
- Multi-worker: `committed=2`, two `payrollEntries` rows created, audit row has `committedCount=2`

## Decisions Made

1. **multer manual invocation** — wrapping `upload.single()` in a callback gives control over `MulterError` classification. Without this, Express's default error handler returns 500 for oversized files.
2. **No re-parse on commit** — per D-09, commit route accepts resolved rows from client; does not require the original file. Keeps the route simple and avoids re-upload.
3. **Conflict pre-check before any insert** — per D-06 and context pitfalls, `payrollEntries` uniqueness check happens before any insert attempt, not via DB error handling.
4. **Explicit type annotation on existingEntries.map** — TypeScript strict mode required `(e: { workerId: string; classificationId: string })` annotation since the async drizzle select return type inference wasn't narrowed automatically in this context.

## Deviations from Plan

None — plan executed exactly as written. The only TypeScript error in the build is the pre-existing `projects.ts` line 110/115 implicit any, documented in CLAUDE.md as a known non-fatal issue.

## Known Stubs

None. Both endpoints are fully wired — preview calls `parseImportFile` which does live DB queries; commit inserts live rows and audit records.

## Self-Check: PASSED

| File | Status |
|------|--------|
| src/server/routes/import.ts | FOUND |
| tests/routes/import.test.ts | FOUND |
| src/server/index.ts (mount line) | FOUND |

| Commit | Message |
|--------|---------|
| e055a73 | feat(35-02): import router with preview (multipart) and commit (JSON) endpoints |
| 79eae0d | test(35-02): integration tests for import routes — 11 tests all green |
