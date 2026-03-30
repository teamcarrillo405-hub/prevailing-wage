---
phase: 33-team-invite-flow-team-ui
plan: "01"
subsystem: database-invite-service
tags: [schema, migration, invite-service, auth, drizzle]
dependency_graph:
  requires: []
  provides: [team_invites table, removed_at column, inviteService, assertProjectAccess soft-delete, GET /api/projects member join]
  affects: [src/server/db/schema.ts, src/server/utils/assertProjectAccess.ts, src/server/routes/projects.ts]
tech_stack:
  added: [resend@^6.9.4]
  patterns: [lazy-init resend SDK, statement-breakpoint SQL migration, drizzle innerJoin for multi-user list]
key_files:
  created:
    - src/server/db/migrations/0018_team_invites.sql
    - src/server/services/inviteService.ts
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/utils/assertProjectAccess.ts
    - src/server/routes/projects.ts
    - package.json
decisions:
  - "Migration breakpoint format is --> statement-breakpoint (one space), not -->  statement-breakpoint (two spaces) — existing 0017 migration confirms one-space is correct for this project's Drizzle migrator"
  - "Resend SDK lazy-initialized at first use — null returned if RESEND_API_KEY absent; email failure is non-fatal (console fallback)"
  - "GET /api/projects uses innerJoin on project_members instead of projects.userId — enables members (not just owners) to see all projects in their team"
metrics:
  duration: 9 minutes
  completed_date: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 7
---

# Phase 33 Plan 01: DB Foundation + Invite Service + Project Access Fixes Summary

**One-liner:** SQLite team_invites table + removed_at column, full invite lifecycle service (token gen/validate/email), assertProjectAccess soft-delete filter, and GET /api/projects member-join for multi-user visibility.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install resend + create migration + update schema | 9856b4a | package.json, 0018_team_invites.sql, _journal.json, schema.ts |
| 2 | Create inviteService + fix assertProjectAccess + fix GET /api/projects | 570dfa3 | inviteService.ts, assertProjectAccess.ts, projects.ts |

## What Was Built

### Database (Task 1)

- Migration `0018_team_invites.sql` creates `team_invites` table with all columns and adds `removed_at TEXT` to `project_members`
- Journal entry `idx: 14, tag: "0018_team_invites"` registered in `_journal.json`
- `schema.ts` declares `teamInvites` sqliteTable with full column set
- `projectMembers` table definition gains `removedAt: text('removed_at')` (nullable)
- `resend@^6.9.4` installed as production dependency

### Invite Service (Task 2)

- `inviteService.ts` exports:
  - `createInvite(inviterUserId, inviteeEmail)` — generates UUID id + 32-byte hex token, inserts row, 72h expiry
  - `validateToken(token)` — joins users table, returns status: valid/not_found/expired/used/revoked + invite + inviterEmail
  - `sendInviteEmail(to, inviteUrl)` — lazy Resend SDK init; console fallback if no API key
  - `getPendingInvite(inviterUserId)` — active invite check (not accepted, not revoked, not expired)
  - `revokeInvite(inviterUserId)` — sets revokedAt on pending invite
  - `getTeamMemberCount(userId)` — counts distinct active members across owner's projects

### Access Control Fixes (Task 2)

- `assertProjectAccess.ts`: Added `isNull(projectMembers.removedAt)` — soft-deleted members can no longer access projects
- `projects.ts` GET `/`: Replaced `eq(projects.userId, userId)` with `innerJoin(projectMembers, ...)` + `isNull(removedAt)` — project members (not just owners) can list their projects; response shape unchanged (`{ data: { projects: [...] } }` via `.map(r => r.project)`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed migration statement-breakpoint format**
- **Found during:** Task 2 (tests ran after Task 1 commit)
- **Issue:** Plan specified `-->  statement-breakpoint` (two spaces after `-->`) but Drizzle's better-sqlite3 migrator for this project requires `--> statement-breakpoint` (one space). The error was "The supplied SQL string contains more than one statement" — the two-space variant was not recognized as a breakpoint.
- **Fix:** Changed `-->  statement-breakpoint` to `--> statement-breakpoint` in `0018_team_invites.sql` to match the format used in `0017_project_members.sql` and all existing migrations.
- **Files modified:** `src/server/db/migrations/0018_team_invites.sql`
- **Commit:** `570dfa3` (included in Task 2 commit)

## Test Results

- 388 tests pass (across all worktrees) after changes
- 3 pre-existing RED stub tests in `.claude/worktrees/agent-ae6e6dde/` (CAL-01 stubs) — unrelated to this plan, pre-existing
- GET /api/projects tests pass across all worktrees confirming the join works correctly

## Known Stubs

None — all exported functions are fully implemented with real logic.

## Self-Check: PASSED

- `src/server/db/migrations/0018_team_invites.sql` — FOUND
- `src/server/services/inviteService.ts` — FOUND
- `src/server/db/migrations/meta/_journal.json` entry idx 14 — FOUND
- `schema.ts` teamInvites — FOUND
- `schema.ts` removedAt — FOUND
- `assertProjectAccess.ts` isNull filter — FOUND
- `projects.ts` innerJoin — FOUND
- Commit 9856b4a — FOUND
- Commit 570dfa3 — FOUND
