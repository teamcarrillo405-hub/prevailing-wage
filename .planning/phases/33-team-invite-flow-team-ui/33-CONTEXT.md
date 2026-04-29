# Phase 33: Team Invite Flow + Team UI — Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

An account owner can invite one other user by email (tokenized link, 72-hour expiry), view team membership, revoke a pending invite, remove the existing member (soft-delete with `removed_at` for future MT-05 purge), and transfer ownership. The invitee registers via a dedicated `/accept-invite` page — NOT the public `/register` route.

This phase also fixes `GET /api/projects` to join `project_members` instead of filtering by `projects.userId`, so invited members see the owner's projects.

This phase does NOT include: 1-year purge job for removed members, per-project permission tiers, more than 2 users, or admin impersonation.

</domain>

<decisions>
## Implementation Decisions

### Email Delivery (MT-01)

- **D-01:** Install `@resend/node` (Resend SDK). Configure via `RESEND_API_KEY` environment variable. Send invite emails from a single `from` address (e.g. `team@<configured domain>` or the env-configured sender). No nodemailer, no SMTP config.
- **D-02:** If `RESEND_API_KEY` is not set, fall back to logging the invite URL to the server console (so the feature is testable locally without email credentials). The server still returns `201` — the invite row is created; email just doesn't deliver.

### Invite Token + DB (MT-01, MT-02)

- **D-03:** New `team_invites` table (migration `0018_team_invites.sql`, idx 14 in `_journal.json`):
  ```
  id            text PK
  inviter_user_id  text FK → users.id
  invitee_email text NOT NULL
  token         text NOT NULL UNIQUE
  expires_at    text NOT NULL (ISO 8601, 72 hours from creation)
  accepted_at   text nullable
  revoked_at    text nullable
  created_at    text NOT NULL
  ```
- **D-04:** Token is a cryptographically random 32-byte hex string (`crypto.randomBytes(32).toString('hex')`), stored plain in `team_invites.token`. It is NOT hashed — single-use, 72hr expiry is sufficient entropy for this threat model.
- **D-05:** An invite is "pending" when `accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`. Only one pending invite may exist at a time — checked server-side before creating a new one.

### 2-User Cap Enforcement (MT-02)

- **D-06:** Before creating an invite, the server checks two conditions:
  1. The account already has 2 distinct users in `project_members` → respond `409 { error: 'Team is at capacity (2 members)' }`
  2. A pending invite already exists for this owner → respond `409 { error: 'An invite is already pending' }`
  Both are distinct error codes so the UI can show different messages.

### project_members: soft-delete for MT-05 (MT-05)

- **D-07:** Add `removed_at` (nullable text ISO 8601) column to `project_members` via the same migration `0018_team_invites.sql`. When a member is removed, set `removed_at = now()` rather than deleting the row. `assertProjectAccess` already queries `project_members` — it must filter to `WHERE removed_at IS NULL` so removed members lose access immediately.
- **D-08:** The 1-year purge job is deferred — Phase 33 only records `removed_at`. The concrete scope of "purge" (which tables, what rules) will be defined in a future phase when the compliance requirement is confirmed.

### Invite Registration Flow (MT-01)

- **D-09:** Dedicated route `GET /accept-invite?token=X` in React (added to `App.tsx`). The `AcceptInvitePage` calls `GET /api/team/invite/:token` to validate and retrieve the associated email, pre-fills + locks the email field, and submits to `POST /api/auth/accept-invite`.
- **D-10:** `POST /api/auth/accept-invite` accepts `{ token, password }`. It:
  1. Validates token (not expired, not accepted, not revoked)
  2. Creates the `users` row (same as register — hash password, assign UUID)
  3. Inserts `project_members` rows with `role: 'member'` for every project owned by the inviter
  4. Marks `team_invites.accepted_at = now()`
  5. Sets session cookie and returns `201 { user }` — invitee is logged in immediately
- **D-11:** The existing `/api/auth/register` route and `/register` page are UNCHANGED. The `INVITE_CODE` env-var guard on `/register` continues to protect open registration. No conflict.

### `GET /api/projects` Fix — Project List for Members

- **D-12:** `GET /api/projects` currently filters by `eq(projects.userId, userId)`. Replace with a join on `project_members` so members see all projects they belong to (where `removed_at IS NULL`). Filter by active/all status is preserved.

### Team API Routes

- **D-13:** New router `src/server/routes/team.ts` mounted at `/api/team`. Routes:
  - `GET /api/team` — returns `{ members: [...], pendingInvite: {...} | null }`. Members include id, email, role, joinedAt. Requires auth.
  - `POST /api/team/invite` — owner sends invite. Validates cap, creates `team_invites` row, sends email via Resend. Owner-only (check `role: 'owner'` in `project_members`).
  - `DELETE /api/team/invite` — owner revokes pending invite (sets `revoked_at`). Owner-only.
  - `DELETE /api/team/members/:userId` — owner removes member (sets `removed_at` on all their `project_members` rows). Owner-only.
  - `POST /api/team/transfer` — owner transfers ownership. Sets requester's `project_members.role = 'member'`, target's `project_members.role = 'owner'` across all shared projects. Owner-only.
- **D-14:** `GET /api/team/invite/:token` — PUBLIC (no auth required) — validates token, returns `{ email, inviterEmail }` for the AcceptInvitePage pre-fill. Returns 404 if not found, 410 if expired/used/revoked.
- **D-15:** "Owner-only" check: query `project_members` for `(projectId = any of owner's projects, userId = req.user.id, role = 'owner', removed_at IS NULL)`. In practice, for a 2-user account, a simpler check is: look up any project where the user is `role: 'owner'` in `project_members`.

### Team Settings UI — `/team` page (MT-01, MT-02, MT-04, MT-05)

- **D-16:** New `TeamPage` at `/team`. Added to the protected routes in `App.tsx`. Nav link "Team" added to the dark nav bar in the app shell.
- **D-17:** `TeamPage` layout:
  - **Members section**: Card listing current members with name (email), role badge (Owner/Member), and — if owner — a "Remove" button (with confirmation) and "Transfer Ownership" button next to the member.
  - **Invite section**: Card with email input + "Send Invite" button (disabled + tooltip when at capacity or invite pending). Shows pending invite status with invitee email + "Revoke" link if one exists.
- **D-18:** Ownership transfer uses a confirmation modal ("Transfer ownership to X? You will become a Member.") before calling `POST /api/team/transfer`.
- **D-19:** All team mutations use `@tanstack/react-query` `useMutation` + `queryClient.invalidateQueries(['team'])` on success.

### Claude's Discretion

- Exact email template/HTML body for the invite email
- Whether to show the owner's own card as non-removable (no Remove button on self)
- Loading states, error banners, and toast-style feedback for team mutations
- Whether to use a `useTeam()` custom hook wrapping the React Query fetch

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DB Schema
- `src/server/db/schema.ts` — add `teamInvites` table + `removedAt` on `projectMembers`
- `src/server/db/migrations/meta/_journal.json` — register idx 14, tag `0018_team_invites`

### New Files
- `src/server/db/migrations/0018_team_invites.sql` — CREATE TABLE team_invites + ALTER TABLE project_members ADD removed_at
- `src/server/routes/team.ts` — NEW team management router
- `src/server/services/inviteService.ts` — NEW invite creation, validation, email dispatch
- `src/client/pages/TeamPage.tsx` — NEW team settings page
- `src/client/pages/AcceptInvitePage.tsx` — NEW accept-invite registration page

### Files to Modify
- `src/server/routes/auth.ts` — add `POST /api/auth/accept-invite` route
- `src/server/routes/projects.ts` — fix `GET /api/projects` to join `project_members`
- `src/server/utils/assertProjectAccess.ts` — add `removed_at IS NULL` filter
- `src/server/app.ts` (or wherever routes are registered) — mount `team.ts` router
- `src/client/App.tsx` — add `/accept-invite` and `/team` routes
- App shell nav component — add "Team" nav link

### Requirements
- `.planning/REQUIREMENTS.md` §MT-01, MT-02, MT-04, MT-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Auth Pattern
- `POST /api/auth/register` accepts `{ email, password, inviteCode }` — `inviteCode` is the static env-var guard, NOT the team invite token
- `POST /api/auth/accept-invite` (new) parallels register but validates `team_invites.token` instead
- Session cookie: `pw_session`, 7-day maxAge, httpOnly, sameSite: lax

### Email Library Not Installed
- No nodemailer, no Resend, no SendGrid in `package.json` — must `npm install @resend/node`
- If `RESEND_API_KEY` is absent: log invite URL to console, proceed normally (local dev / test friendly)

### project_members Current State (Phase 32)
- Columns: `id`, `project_id`, `user_id`, `role` (`'owner'|'member'`), `joined_at`
- `removed_at` column added by migration `0018_team_invites.sql`
- `assertProjectAccess` queries `project_members` JOIN `projects` — must add `isNull(projectMembers.removedAt)` after D-07

### GET /api/projects Current State
- `conditions = [eq(projects.userId, userId)]` — only creator's projects returned
- Fix: join `project_members` where `userId = req.user.id AND removed_at IS NULL`, return distinct project rows

### Migration Convention
- SQL-only, manually registered in `meta/_journal.json`
- Next idx: 14, next tag: `0018_team_invites`
- Uses `-->  statement-breakpoint` separator between statements

### Critical Pitfalls
- `POST /api/auth/accept-invite` must insert `project_members` rows for ALL of the inviter's projects (not just one) — a member must immediately see all projects
- Owner check: use `project_members.role = 'owner'` (not `projects.userId`) — Phase 32 D-03 clarified that `projects.user_id` is NOT the authority; `project_members` is
- Expired/used/revoked tokens must all return HTTP 410 Gone (not 404) from `GET /api/team/invite/:token` — so the AcceptInvitePage can show "link expired" vs "link not found"
- Transfer ownership must update `project_members.role` for ALL projects, not just one
- `removed_at` filter must be added to `assertProjectAccess` to revoke access immediately on removal

</code_context>

<specifics>
## Specific Implementation Details

- New table: `team_invites` (id, inviter_user_id FK, invitee_email, token, expires_at, accepted_at, revoked_at, created_at)
- `project_members` gains `removed_at` nullable column
- Resend SDK for email, console fallback if `RESEND_API_KEY` absent
- Accept invite: validates token → creates user → inserts project_members for all inviter's projects → logs in
- `/team` page: members list + invite form + revoke + remove + transfer ownership
- `/accept-invite?token=X` page: token validation → pre-filled locked email → password → join
- `GET /api/projects` fixed to join `project_members` (not `projects.userId`)
- `assertProjectAccess` updated: add `removed_at IS NULL` filter

</specifics>

<deferred>
## Deferred Ideas

- 1-year purge job for removed members (MT-05 scope TBD — what exactly gets deleted)
- Per-project permission tiers (flat model is intentional per MT-03)
- More than 2 users per account
- Invite expiry extension / resend (can revoke + re-invite)
- Admin impersonation

</deferred>

---

*Phase: 33-team-invite-flow-team-ui*
*Context gathered: 2026-03-28*
