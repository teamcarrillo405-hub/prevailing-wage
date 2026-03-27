---
phase: 30-wa-pwia-submission-assist
plan: 01
subsystem: db-schema, project-routes, test-stubs
tags: [wa, pwia, migration, tdd-red, wave-0]
dependency_graph:
  requires: []
  provides: [pwia_intent_id column, UpdateProjectSchema pwiaIntentId, Wave-0 test stubs]
  affects: [Plan 02 WA CPR XML generator, Plan 03 PWIA modal]
tech_stack:
  added: []
  patterns: [SQL-only add-column migration, Drizzle schema column, Zod optional field, Wave-0 RED stubs]
key_files:
  created:
    - src/server/db/migrations/0015_wa_pwia_intent_id.sql
    - tests/services/waCprXmlGenerator.test.ts
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/routes/projects.ts
    - tests/routes/export.test.ts
decisions:
  - "pwiaIntentId stored as TEXT (not INTEGER) — matches existing pattern of dirProjectId; Plan 02 route converts to integer when building WaCprData"
  - "waTradeCode optional param added to createWorkerWithClassification helper — needed by route test stubs, backward compatible"
metrics:
  duration: ~5 minutes
  completed: "2026-03-27T10:29:20Z"
  tasks: 2
  files: 6
---

# Phase 30 Plan 01: DB Migration + Wave 0 Test Stubs Summary

**One-liner:** Added `pwia_intent_id` TEXT column via migration 0015, wired through Drizzle schema and PATCH route, plus Wave 0 RED stubs (9 unit + 5 route) for WA CPR XML export.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DB migration + schema + projects route | 895a532 | 0015_wa_pwia_intent_id.sql, _journal.json, schema.ts, projects.ts |
| 2 | Wave 0 RED stubs for waCprXmlGenerator and wa-cpr-xml route | 58a4358 | waCprXmlGenerator.test.ts, export.test.ts |

## What Was Built

### Task 1: DB Foundation

- **Migration `0015_wa_pwia_intent_id.sql`:** `ALTER TABLE projects ADD COLUMN pwia_intent_id TEXT;`
- **Journal:** Entry idx=11 registered with tag `0015_wa_pwia_intent_id`
- **Schema:** `pwiaIntentId: text('pwia_intent_id')` added after `contractNumber` in projects table
- **Projects route:** `pwiaIntentId: z.string().max(20).optional()` in `UpdateProjectSchema` — PATCH /api/projects/:id now accepts and persists this field

### Task 2: Wave 0 RED Stubs

**`tests/services/waCprXmlGenerator.test.ts`** (9 test cases, all RED):
- Root element `<WaPWCPR>` without namespace prefixes
- `<intentId>` integer element
- Day1–Day7 regular/overtime hour mapping
- `amendedFlag` false/true behavior and `amendReason` presence
- Employee personal info and grossPay
- Trade code, county, jobClass in tradeHoursWage
- Rate amounts with 2 decimal places
- `apprenticeFlg` boolean

**`tests/routes/export.test.ts`** — new `describe('GET /api/export/wa-cpr-xml/:weekId')` (5 test cases, all RED):
- 403 for unauthorized user (other user's week)
- 400 for non-WA project with "Washington" error message
- 400 when pwiaIntentId missing from project with "Intent ID" error message
- 422 when worker has null waTradeCode with "trade code" error message
- 200 with `application/xml` content-type, `<WaPWCPR>` root, `<intentId>` for valid WA project

## Deviations from Plan

**1. [Rule 1 - Adaptation] Adapted test stubs to cookie auth pattern**
- **Found during:** Task 2
- **Issue:** Plan's route test stubs used JWT Bearer token auth (`set('Authorization', \`Bearer ${token}\`)`) but the existing export.test.ts uses httpOnly cookie auth (`set('Cookie', cookie)`). The `registerUser` helper returns a cookie string, not a token.
- **Fix:** Adapted all 5 route stubs to use cookie auth matching the existing test pattern.
- **Files modified:** tests/routes/export.test.ts

**2. [Rule 2 - Missing helper param] Added waTradeCode to createWorkerWithClassification**
- **Found during:** Task 2
- **Issue:** The route test stub for the 200 success case passes `waTradeCode: 'CARP'` to `createWorkerWithClassification`, but the existing helper didn't support this parameter.
- **Fix:** Added optional `extra?: { waTradeCode?: string }` parameter to the helper, spreading it into the classification POST request when provided. Fully backward compatible — all existing calls pass.
- **Files modified:** tests/routes/export.test.ts

## Verification Results

- Migration SQL: `ALTER TABLE projects ADD COLUMN pwia_intent_id TEXT;` — confirmed
- Journal idx 11: confirmed with `"tag": "0015_wa_pwia_intent_id"`
- Schema column: `pwiaIntentId: text('pwia_intent_id')` — confirmed
- Route schema: `pwiaIntentId: z.string().max(20).optional()` — confirmed
- Unit tests: 9 `it()` blocks — confirmed RED (import error: waCprXmlGenerator.ts missing)
- Route tests: 5 test cases under `describe('GET /api/export/wa-cpr-xml/:weekId')` — confirmed RED (404: route missing)
- Pre-existing tests: F700 WA (5 passing), A-1-131 CA (5 passing), projects (all passing) — no regressions

## Self-Check: PASSED

- [x] `src/server/db/migrations/0015_wa_pwia_intent_id.sql` exists
- [x] `tests/services/waCprXmlGenerator.test.ts` exists with 9 test cases
- [x] `tests/routes/export.test.ts` has `describe('GET /api/export/wa-cpr-xml/:weekId'`
- [x] Commit 895a532 exists
- [x] Commit 58a4358 exists
