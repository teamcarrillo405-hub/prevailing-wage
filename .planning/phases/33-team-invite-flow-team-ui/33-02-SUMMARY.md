---
phase: 33-team-invite-flow-team-ui
plan: "02"
subsystem: team-api-routes
tags: [team, invite, api, routes, auth, integration-tests]
dependency_graph:
  requires: [33-01]
  provides: [teamRouter, GET /api/team, POST /api/team/invite, DELETE /api/team/invite, DELETE /api/team/members/:userId, POST /api/team/transfer, GET /api/team/invite/:token, POST /api/auth/accept-invite]
  affects: [src/server/routes/team.ts, src/server/routes/auth.ts, src/server/index.ts, tests/routes/team.test.ts]
tech_stack:
  added: []
  patterns: [public-route-before-requireAuth, helper-function-for-owner-check, drizzle-update-all-rows-for-user]
key_files:
  created:
    - src/server/routes/team.ts
    - tests/routes/team.test.ts
  modified:
    - src/server/routes/auth.ts
    - src/server/index.ts
decisions:
  - "GET /invite/:token mounted BEFORE router.use(requireAuth) so unauthenticated users can validate tokens on the accept-invite page"
  - "isOwner() helper queries project_members for any active owner row — works for users with multiple projects"
  - "getOwnerUserId() helper traverses member -> project -> owner so a member calling GET /api/team sees the correct team view"
  - "TypeScript implicit-any on map callbacks fixed with explicit type annotations (pre-existing projects.ts:110 error is unrelated)"
metrics:
  duration: 12 minutes
  completed_date: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 33 Plan 02: Team API Routes + Integration Tests Summary

**One-liner:** Express team router with 6 endpoints + accept-invite auth route + 25-test integration suite covering ownership enforcement, capacity checks, token validation, and full invite-accept lifecycle.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create team.ts router + accept-invite auth route + mount in index.ts | 5ed389a | team.ts, auth.ts, index.ts |
| 2 | Write integration tests for team routes | 4b574ba | tests/routes/team.test.ts |

## What Was Built

### Team Router (Task 1)

- `src/server/routes/team.ts` — full team management router mounted at `/api/team`:
  - `GET /invite/:token` — **public route** (before `requireAuth`): validates token, returns 404/410/200 with `{ email, inviterEmail }`
  - `GET /` — list team members with roles + pending invite + `isOwner` flag for authenticated user
  - `POST /invite` — owner-only; checks capacity (>=2 → 409) and pending invite (→ 409); calls `createInvite` + `sendInviteEmail`
  - `DELETE /invite` — owner-only; calls `revokeInvite`, returns 404 if nothing to revoke
  - `DELETE /members/:userId` — owner-only; sets `removedAt` on ALL `project_members` rows for that user; blocks self-removal
  - `POST /transfer` — owner-only; swaps `owner`/`member` roles across all projects for current owner + target

- `src/server/routes/auth.ts` — new `POST /api/auth/accept-invite` route:
  - Validates token via `validateToken` → 404/410
  - Checks email not already registered → 409
  - Creates user, inserts `project_members` rows for ALL inviter projects (D-10 critical), marks `acceptedAt`, sets session cookie
  - Returns 201 with `{ user: { id, email } }`

- `src/server/index.ts` — mounts `teamRouter` at `/api/team`

### Integration Tests (Task 2)

- `tests/routes/team.test.ts` — 25 integration tests across 7 describe blocks:
  - `POST /api/team/invite`: 201, 403, 409 capacity, 409 pending, 400 invalid email, 401 unauthenticated
  - `GET /api/team/invite/:token`: 200 valid, 404 not found, 410 expired, 410 used
  - `POST /api/auth/accept-invite`: 201 full lifecycle with 2-project verification, 410 re-use, 400 short password
  - `GET /api/team`: members with correct roles, 401
  - `DELETE /api/team/invite`: 200 revoke, 404 no pending, 403 non-owner
  - `DELETE /api/team/members/:userId`: 200 removes all rows, 400 self-removal, 403 non-owner
  - `POST /api/team/transfer`: 200 swaps both projects, 400 self-target, 403 non-owner, 400 invalid UUID

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript implicit-any on map callbacks**
- **Found during:** Task 1 (TypeScript compile check)
- **Issue:** `inviterProjects.map(({ projectId }) => ...)` and `rows.map(r => ...)` produced `TS7031`/`TS7006` implicit-any errors under the project's strict-ish TS config
- **Fix:** Added explicit type annotations: `map((p: { projectId: string }) => ...)` in auth.ts and `map((r: { userId: string; email: string; role: string; joinedAt: string }) => ...)` in team.ts
- **Files modified:** `src/server/routes/auth.ts`, `src/server/routes/team.ts`
- **Commit:** `5ed389a` (included in Task 1 commit)

## Test Results

- 25/25 team route tests pass
- 143/143 auth route tests pass (no regressions)
- Pre-existing failures in `.claude/worktrees/` and `tests/security/cross-tenant.test.ts` are unrelated to this plan

## Known Stubs

None — all routes are fully implemented with real DB operations.

## Self-Check: PASSED

- `src/server/routes/team.ts` — FOUND
- `tests/routes/team.test.ts` — FOUND
- `src/server/routes/auth.ts` contains `accept-invite` — FOUND
- `src/server/index.ts` contains `app.use('/api/team', teamRouter)` — FOUND
- Commit 5ed389a — FOUND
- Commit 4b574ba — FOUND
