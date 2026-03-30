---
phase: 33-team-invite-flow-team-ui
verified: 2026-03-29T00:00:00Z
status: gaps_found
score: 14/15 must-haves verified
re_verification: false
gaps:
  - truth: "MT-05 purge mechanism: removed member data deleted after 1 year"
    status: partial
    reason: "removedAt timestamp is recorded on removal (retention period can be tracked), but no scheduled job or cleanup mechanism exists to purge payroll entries, submissions, and activity records 1 year after removal. The cron job in index.ts handles only wage sync."
    artifacts:
      - path: "src/server/index.ts"
        issue: "Cron job (line 66) is for wdolSync only; no second cron or purge service exists"
    missing:
      - "A scheduled job (e.g., cron or background task) that queries project_members WHERE removed_at IS NOT NULL AND removed_at < NOW() - 1 year and deletes associated payroll_entries, payroll_weeks, and worker records belonging exclusively to the removed user"
      - "Alternatively, a migration or admin route that can be triggered to run the purge, with the removedAt timestamp as the reference point"
human_verification:
  - test: "Full end-to-end invite flow in browser"
    expected: "Owner sends invite, invitee accepts via console URL, 2-user cap enforced, inline confirm for remove/transfer works, Team nav link visible"
    why_human: "Visual and interactive behavior; Plan 03 SUMMARY states human verification was approved but this verifier cannot confirm browser interaction"
---

# Phase 33: Team Invite Flow & Team UI Verification Report

**Phase Goal:** An account owner can invite one other user by email and manage team membership — including viewing pending invites, transferring ownership, and revoking access — without any per-project permission configuration
**Verified:** 2026-03-29
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | team_invites table exists with all columns after migration runs | VERIFIED | `0018_team_invites.sql` lines 1-13 creates all 8 columns; `_journal.json` has idx 14 tag `0018_team_invites` |
| 2 | project_members.removed_at column exists after migration runs | VERIFIED | `0018_team_invites.sql` line 13: `ALTER TABLE project_members ADD COLUMN removed_at TEXT`; `schema.ts` line 55: `removedAt: text('removed_at')` |
| 3 | assertProjectAccess rejects users whose project_members rows have removed_at set | VERIFIED | `assertProjectAccess.ts` line 23: `isNull(projectMembers.removedAt)` in WHERE clause |
| 4 | GET /api/projects returns projects for members (not just project creator) | VERIFIED | `projects.ts` line 100: `.innerJoin(projectMembers, ...)` with `isNull(projectMembers.removedAt)` filter |
| 5 | inviteService exports all six functions with real implementations | VERIFIED | `inviteService.ts` exports: `createInvite`, `validateToken`, `sendInviteEmail`, `getPendingInvite`, `revokeInvite`, `getTeamMemberCount` — all fully implemented with DB operations |
| 6 | GET /api/team returns members list and pending invite for authenticated user | VERIFIED | `team.ts` lines 78-135: returns `{ members, pendingInvite, isOwner }` with real DB queries |
| 7 | POST /api/team/invite creates invite and returns 201 (owner-only, capacity + pending checks) | VERIFIED | `team.ts` lines 140-170: checks `isOwner`, `getTeamMemberCount >= 2` → 409, `getPendingInvite` → 409 |
| 8 | DELETE /api/team/invite revokes pending invite (owner-only) | VERIFIED | `team.ts` lines 173-185: calls `revokeInvite`, returns 404 if none pending |
| 9 | DELETE /api/team/members/:userId sets removed_at on all member's project_members rows | VERIFIED | `team.ts` lines 188-215: updates all rows for targetUserId where `removedAt IS NULL` |
| 10 | POST /api/team/transfer swaps owner/member roles across all shared projects | VERIFIED | `team.ts` lines 220-268: iterates all ownerRows and swaps roles per project |
| 11 | GET /api/team/invite/:token returns invite data (public, no auth) | VERIFIED | `team.ts` lines 18-30: mounted BEFORE `router.use(requireAuth)`; returns 404/410/200 |
| 12 | POST /api/auth/accept-invite creates user, inserts project_members for ALL inviter projects, logs in | VERIFIED | `auth.ts` lines 102-170: creates user, inserts member rows for all inviter projects, marks acceptedAt, sets session cookie, returns 201 |
| 13 | TeamPage and AcceptInvitePage are substantive, wired, and data-flowing UI | VERIFIED | Both pages: fetch real APIs, handle all states, render role badges, inline confirms, locked email input |
| 14 | Routes wired in App.tsx and Team nav link in Layout | VERIFIED | App.tsx line 62: `/team` inside ProtectedRoute; line 66: `/accept-invite` public; Layout.tsx line 27: `<Link to="/team">` |
| 15 | MT-05: Removed member data retained for 1 year then purged | PARTIAL | `removedAt` timestamp is recorded (enabling 1-year calculation), data is NOT deleted at removal time (correct), but NO purge job exists to delete data after 1 year |

**Score:** 14/15 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/db/migrations/0018_team_invites.sql` | CREATE TABLE team_invites + ALTER project_members | VERIFIED | All columns present; `--> statement-breakpoint` separator correct (one space, matches project convention) |
| `src/server/db/schema.ts` | teamInvites table + removedAt on projectMembers | VERIFIED | `teamInvites` sqliteTable declared; `removedAt: text('removed_at')` on projectMembers |
| `src/server/services/inviteService.ts` | createInvite, validateToken, sendInviteEmail | VERIFIED | 135 lines; all 6 functions exported with full implementations; lazy Resend SDK with console fallback |
| `src/server/utils/assertProjectAccess.ts` | removed_at IS NULL filter | VERIFIED | `isNull(projectMembers.removedAt)` confirmed at line 23 |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/routes/team.ts` | Team management API router | VERIFIED | 272 lines; exports `teamRouter`; all 6 endpoints present |
| `tests/routes/team.test.ts` | Integration tests (min 100 lines) | VERIFIED | 623 lines; 25 test cases across 7 describe blocks; covers all routes |
| `src/server/routes/auth.ts` | POST /api/auth/accept-invite | VERIFIED | Route exists; validates token, creates user, inserts project_members, sets cookie, returns 201 |
| `src/server/index.ts` | app.use('/api/team', teamRouter) | VERIFIED | Line 49: `app.use('/api/team', teamRouter)` confirmed |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/client/pages/TeamPage.tsx` | Team management page (min 100 lines) | VERIFIED | 327 lines; useQuery, 4 useMutations, Members card, Invite card, inline confirm rows, capacity guards |
| `src/client/pages/AcceptInvitePage.tsx` | Accept invite page (min 50 lines) | VERIFIED | 155 lines; 5-state token machine, locked email input, POST to accept-invite |
| `src/client/App.tsx` | Routes for /team and /accept-invite | VERIFIED | /team inside ProtectedRoute; /accept-invite public (no PublicRoute wrapper), per D-09 |
| `src/client/components/shared/Layout.tsx` | Team nav link | VERIFIED | `<Link to="/team">` with correct Tailwind classes at line 27 |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `schema.ts` | `0018_team_invites.sql` | teamInvites sqliteTable declared | WIRED | `teamInvites` table in schema matches migration DDL columns exactly |
| `assertProjectAccess.ts` | `schema.ts` | isNull(projectMembers.removedAt) | WIRED | `isNull` imported from drizzle-orm; applied in WHERE at line 23 |
| `routes/projects.ts` | `schema.ts` | innerJoin projectMembers for GET / | WIRED | `.innerJoin(projectMembers, ...)` at line 100 with `isNull(projectMembers.removedAt)` |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `routes/team.ts` | `services/inviteService.ts` | import all 6 functions | WIRED | Line 8-11: imports createInvite, validateToken, sendInviteEmail, getPendingInvite, revokeInvite, getTeamMemberCount |
| `routes/auth.ts` | `services/inviteService.ts` | imports validateToken | WIRED | Line 10: `import { validateToken } from '../services/inviteService.js'` |
| `server/index.ts` | `routes/team.ts` | app.use('/api/team', teamRouter) | WIRED | Lines 21 + 49 confirmed |

### Plan 03 Key Links

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `TeamPage.tsx` | `/api/team` | fetch in useQuery | WIRED | Line 41: `fetch('/api/team', { credentials: 'include' })` |
| `TeamPage.tsx` | `/api/team/invite` | fetch in useMutation (POST + DELETE) | WIRED | Lines 48, 73: POST and DELETE to `/api/team/invite` |
| `TeamPage.tsx` | `/api/team/members/:userId` | fetch in useMutation (DELETE) | WIRED | Line 86: `fetch(\`/api/team/members/${userId}\`, { method: 'DELETE' })` |
| `TeamPage.tsx` | `/api/team/transfer` | fetch in useMutation (POST) | WIRED | Line 104: `fetch('/api/team/transfer', { method: 'POST' })` |
| `AcceptInvitePage.tsx` | `/api/team/invite/:token` | fetch in useEffect | WIRED | Line 27: `fetch(\`/api/team/invite/${token}\`, { credentials: 'include' })` |
| `AcceptInvitePage.tsx` | `/api/auth/accept-invite` | fetch POST on form submit | WIRED | Line 49: `fetch('/api/auth/accept-invite', { method: 'POST' })` |
| `App.tsx` | `TeamPage.tsx` | Route path='/team' | WIRED | Line 62: `<Route path="/team" element={<TeamPage />} />` |
| `App.tsx` | `AcceptInvitePage.tsx` | Route path='/accept-invite' | WIRED | Line 66: `<Route path="/accept-invite" element={<AcceptInvitePage />} />` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `TeamPage.tsx` | `data` (members, pendingInvite, isOwner) | `GET /api/team` → DB queries on `projectMembers` + `users` + `teamInvites` | Yes — real DB selects with joins | FLOWING |
| `AcceptInvitePage.tsx` | `inviteData` (email, inviterEmail) | `GET /api/team/invite/:token` → `validateToken` → DB select on `teamInvites` joined to `users` | Yes — real DB query | FLOWING |
| `GET /api/team` (team.ts) | members array | `projectMembers` innerJoin `users` WHERE `removedAt IS NULL` | Yes — real DB select | FLOWING |
| `POST /api/auth/accept-invite` | new user + projectMembers rows | DB insert to `users` and `projectMembers`; `teamInvites` update for acceptedAt | Yes — real DB writes | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — requires running server. Routes require HTTP server to be active. The integration test suite (25 tests in `tests/routes/team.test.ts`) serves as the functional verification instead.

Note: 25 integration tests cover all route behaviors including 201/403/409 capacity/409 pending/410/404 status codes, full accept-invite lifecycle with 2-project verification, role swap confirmation, and self-removal guard.

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| MT-01 | 33-01, 33-02, 33-03 | Owner can invite one other user by email; invitee receives registration link and creates account | SATISFIED | `createInvite` + `sendInviteEmail` in inviteService; `POST /api/team/invite` + `GET /api/team/invite/:token` + `POST /api/auth/accept-invite` chain creates account and adds to all owner projects; TeamPage + AcceptInvitePage UI complete |
| MT-02 | 33-01, 33-02, 33-03 | Maximum 2 users per account; invite button disabled when at capacity | SATISFIED | `getTeamMemberCount` returns count; `POST /api/team/invite` returns 409 when count >= 2; TeamPage disables Send Invite and shows "Team is at capacity (2 members maximum)." helper text |
| MT-04 | 33-02, 33-03 | Owner can transfer ownership; original owner becomes regular member | SATISFIED | `POST /api/team/transfer` swaps roles across ALL shared projects; TeamPage inline confirm for transfer; integration test "swaps owner/member roles across all shared projects" passes |
| MT-05 | 33-01, 33-02 | Removed member data retained for 1 year, then purged | PARTIAL | `removedAt` timestamp recorded on `DELETE /api/team/members/:userId` — data is soft-deleted (not immediately destroyed), enabling 1-year retention window. However, NO purge job exists to delete payroll entries/submissions/activity records after 1 year. REQUIREMENTS.md marks this complete but the purge mechanism is absent from the codebase. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/server/routes/team.ts` | 372 | `res.json(...)` after `db.update(...)` with no row-count check on DELETE /members | Info | If targetUserId has no active rows, still returns 200 "Member removed" — benign, idempotent behavior is acceptable |
| `src/server/routes/team.ts` | 425 | POST /transfer has no check that targetUserId is an active member of the owner's team | Warning | A transfer to a userId that has no project_members rows silently succeeds with no rows updated — owner loses owner role but target never gains it. Logic gap, not a stub. |

---

## Human Verification Required

### 1. End-to-End Browser Flow

**Test:** Start dev server (`npm run dev`), log in as owner, navigate to /team, send an invite, copy the console URL, open in incognito, complete account creation, verify both members appear, verify capacity guard activates, test Remove and Transfer Ownership inline confirms.
**Expected:** Full flow works as described in Plan 03 Task 3 verification steps; Team nav link visible in header.
**Why human:** Visual rendering, cookie-based auth flow, and interactive UI states cannot be verified programmatically without a running browser.

---

## Gaps Summary

One gap blocks full MT-05 compliance: the data retention purge mechanism is absent.

**MT-05 partial implementation:** The `removedAt` column is correctly set on all `project_members` rows when a member is removed (`DELETE /api/team/members/:userId`). This records the removal timestamp and prevents the removed user from accessing projects (via `isNull(removedAt)` filters). The data itself — payroll entries, payroll weeks, workers — is retained (not deleted at removal time), which is the correct behavior for the 1-year window. However, REQUIREMENTS.md states the records should be "purged" after 1 year. No cron job, background task, or admin route implements this purge. The existing cron in `index.ts` is exclusively for wage data sync.

**Minor logic concern in transfer route:** `POST /api/team/transfer` does not validate that `targetUserId` is an active member of the owner's team before swapping roles. If an invalid UUID is sent for a non-member, the owner's role is set to 'member' but no owner row is created for the target — leaving the team without an owner. This is a logic gap worth addressing in a follow-up.

The human browser verification step from Plan 03 was reportedly approved by the user, but this verifier cannot independently confirm that interaction.

---

_Verified: 2026-03-29_
_Verifier: Claude (gsd-verifier)_
