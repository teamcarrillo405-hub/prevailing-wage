---
phase: 32-multi-user-auth-foundation
plan: "04"
subsystem: compliance-service
tags: [security, idor, multi-user, membership, compliance]
dependency_graph:
  requires: [32-03]
  provides: [MT-03-complete]
  affects: [complianceService.ts, cross-tenant.test.ts]
tech_stack:
  added: []
  patterns: [projectMembers-innerJoin, membership-based-access-check]
key_files:
  created: []
  modified:
    - src/server/services/complianceService.ts
    - tests/security/cross-tenant.test.ts
decisions:
  - "Inline the membership join pattern in service functions rather than calling assertProjectAccess (which expects req-style callers)"
  - "Distinguish 404 vs 403 in getWorkerComplianceHistory with a two-query pattern: membership join first, existence check second"
  - "createWorker test helper sends no tradeUnion field (omit vs null) to satisfy Zod optional validation"
metrics:
  duration: 5m
  completed: "2026-03-29T19:02:47Z"
  tasks_completed: 2
  files_modified: 2
requirements: [MT-03]
---

# Phase 32 Plan 04: Gap Closure — complianceService Membership Checks Summary

**One-liner:** Replaced three legacy `projects.userId` ownership queries in `complianceService.ts` with `projectMembers` inner-join checks, and added a 12th cross-tenant test verifying 403 on the worker history IDOR surface.

---

## What Was Built

Phase 32 delivered the core multi-user infrastructure (project_members table, assertProjectAccess, all 6 route files) but left three locations in `complianceService.ts` using the legacy direct-ownership model. This plan closes all three gaps.

### Task 1: complianceService.ts — Three Membership-Based Access Replacements

**Gap 1 — `getWorkerComplianceHistory` source-project access check (was line 256):**

Replaced the two-step `db.select().from(projects).where(eq(projects.id, ...))` + `if (project.userId !== userId)` pattern with a single projectMembers inner-join query. When no membership row is found, a second existence-only query distinguishes 403 (project exists, not a member) from 404 (project doesn't exist).

**Gap 2 — `getBatchProjectCompliance` project list (was line 166):**

Replaced `db.select().from(projects).where(eq(projects.userId, userId))` with a projectMembers inner-join so non-owner project members see their projects in the dashboard compliance summary.

**Gap 3 — `getWorkerComplianceHistory` cross-project scope (was line 270):**

Replaced the same direct ownership query used to build `projectsInScope` for cross-project worker merges (when `ssnLast4` is non-null) with a projectMembers inner-join.

### Task 2: cross-tenant.test.ts — 12th Test

Added:
- `createWorker` helper function (POST to `/api/projects/:projectId/workers`)
- `workerIdA` describe-scope variable and `beforeAll` setup call
- New `it()` block: "GET /api/compliance/worker/:workerId/history — userB gets 403 on userA worker"

Suite now passes 12/12 (was 11/11).

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run tests/security/cross-tenant.test.ts` | 12/12 passed |
| `grep -c "projects.userId" complianceService.ts` | 0 matches |
| `npx tsc --noEmit` | Clean (no errors) |

---

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `57a8f67` | fix(32-04): replace legacy userId ownership checks with projectMembers joins in complianceService |
| 2 | `9245788` | test(32-04): add worker compliance history cross-tenant test (12th assertion) |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed createWorker helper: omit tradeUnion rather than send null**

- **Found during:** Task 2 test run — new test returned 404 instead of 403
- **Issue:** Plan's suggested `createWorker` body included `tradeUnion: null`. The workers route's Zod schema declares `tradeUnion: z.string().max(200).optional()` — optional means the field can be absent, but `null` fails the `.string()` validator. The POST returned a 422, `res.body.data?.worker?.id` was `undefined`, and the endpoint was called with `/api/compliance/worker/undefined/history` which returned 404 (worker not found) rather than 403.
- **Fix:** Removed `tradeUnion` from the send body entirely (omit rather than null).
- **Files modified:** `tests/security/cross-tenant.test.ts`
- **Commit:** `9245788`

---

## Known Stubs

None — all three gaps are fully wired to real DB queries. No placeholder data.

---

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|---------|
| MT-03 | COMPLETE | All project-scoped endpoints, including `/api/compliance/worker/:workerId/history`, now enforce membership-based access. Cross-tenant suite passes 12/12. |

## Self-Check: PASSED

- `57a8f67` exists in git log: confirmed
- `9245788` exists in git log: confirmed
- `src/server/services/complianceService.ts` modified: confirmed (0 `projects.userId` references in service functions)
- `tests/security/cross-tenant.test.ts` modified: confirmed (12 tests, all passing)
- `32-04-SUMMARY.md` created at `.planning/phases/32-multi-user-auth-foundation/32-04-SUMMARY.md`
