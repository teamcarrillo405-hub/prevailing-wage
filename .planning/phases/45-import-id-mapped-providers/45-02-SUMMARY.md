---
phase: 45-import-id-mapped-providers
plan: 02
subsystem: payroll-import
tags: [import, mappings, provider-mappings, paychex, sage-300, nfr-03, api-routes]
dependency_graph:
  requires: [phase-44-payroll-provider-mappings-table, 45-01]
  provides: [GET-mappings-route, POST-mappings-route]
  affects: [importRouter, payrollProviderMappings]
tech_stack:
  added: []
  patterns: [onConflictDoUpdate-upsert, assertProjectAccess-guard, optional-query-filter]
key_files:
  created: []
  modified:
    - src/server/routes/import.ts
    - tests/routes/import.test.ts
decisions:
  - "onConflictDoUpdate targets all 3 columns of providerMappingUnique index (projectId, provider, providerWorkerId) — required for correct upsert semantics"
  - "GET route constructs WHERE clause conditionally: and(eq(projectId), eq(provider)) when ?provider= is present, eq(projectId) alone otherwise — avoids drizzle-orm and(undefined) issues"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-06"
  tasks: 1
  files: 2
---

# Phase 45 Plan 02: GET and POST /mappings Routes Summary

**One-liner:** GET and POST `/api/payroll/import/mappings` routes on importRouter that fetch and batch-upsert provider-to-worker ID mappings with project access enforcement (NFR-03).

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GET and POST /mappings routes to importRouter | a96a77f | src/server/routes/import.ts, tests/routes/import.test.ts |

---

## What Was Built

### Route 1: GET /mappings/:projectId

- Extracts `projectId` from params, optional `?provider=` from query string
- Calls `assertProjectAccess(db, projectId, userId)` — returns 403 if no access (NFR-03)
- Queries `payrollProviderMappings` with conditional WHERE: `eq(projectId)` alone, or `and(eq(projectId), eq(provider))` when filter present
- Returns `{ mappings: [{ id, projectId, provider, providerWorkerId, workerId, createdAt }] }`

### Route 2: POST /mappings

- Body: `{ projectId, provider, mappings: [{ providerWorkerId, workerId }] }`
- Validates all three fields present — returns 400 if any missing
- Calls `assertProjectAccess(db, projectId, userId)` — returns 403 if no access (NFR-03)
- Iterates mappings, runs `INSERT ... ON CONFLICT DO UPDATE` targeting the 3-column `providerMappingUnique` index `(projectId, provider, providerWorkerId)`, updating `workerId` on conflict
- Returns `{ saved: mappings.length }`

### Imports Added to import.ts

- `and` added to `drizzle-orm` import alongside existing `eq`
- `payrollProviderMappings` added to schema import alongside existing `payrollEntries, payrollImports`

---

## Test Results

**Total: 20 tests pass in tests/routes/import.test.ts (11 pre-existing + 9 new), 0 failures**

| Test Suite | Tests | Status |
|---|---|---|
| POST /api/payroll/import/preview | 5 | PASS |
| POST /api/payroll/import/commit | 6 | PASS |
| GET /api/payroll/import/mappings/:projectId | 4 | PASS (new) |
| POST /api/payroll/import/mappings | 5 | PASS (new) |

New test coverage:
- GET returns 200 with correct mapping fields
- GET filters correctly by `?provider=` query param
- GET returns 403 for user without project access (NFR-03)
- GET returns 401 unauthenticated
- POST saves mappings and returns count
- POST upserts: re-mapping same providerWorkerId updates workerId, keeps single row
- POST returns 400 when mappings array is missing
- POST returns 403 for user without project access (NFR-03)
- POST returns 401 unauthenticated

---

## Deviations from Plan

None — plan executed exactly as written. The `onConflictDoUpdate` approach specified in the plan was implemented as specified. Conditional WHERE clause for the optional `?provider=` filter was a natural implementation detail not requiring deviation.

---

## Known Stubs

None. Both routes are fully wired to the live `payrollProviderMappings` table.

---

## Decisions Made

1. **onConflictDoUpdate targets 3-column index** — `(projectId, provider, providerWorkerId)` matches `providerMappingUnique`. Using only `id` would not trigger conflict detection since new rows always get a new `randomUUID()` id.
2. **Conditional WHERE avoids `and(undefined)`** — When `?provider=` is absent, uses `eq(payrollProviderMappings.projectId, projectId)` directly rather than `and(eq(...), undefined)` which would be a drizzle-orm type error.

---

## Self-Check: PASSED

Files exist:
- FOUND: src/server/routes/import.ts (modified)
- FOUND: tests/routes/import.test.ts (modified)

Commits exist:
- FOUND: a96a77f (Task 1 — feat(45-02): add GET and POST /mappings routes to importRouter)
