# Phase 33: Team Invite Flow + Team UI — Research

**Researched:** 2026-03-30
**Domain:** Email invite tokens, team membership CRUD, Drizzle SQLite migrations, React + TanStack Query UI
**Confidence:** HIGH

## Summary

Phase 33 adds team membership to a mature Express/React/SQLite app that already has the `project_members` table (from Phase 32). The work is well-scoped: one new DB table (`team_invites`), one new column on `project_members` (`removed_at`), four new API routes under `/api/team`, two auth routes (`GET /api/team/invite/:token` public + `POST /api/auth/accept-invite`), two client pages (`TeamPage`, `AcceptInvitePage`), one new service (`inviteService.ts`), and several targeted modifications to existing files.

All architectural decisions are locked in CONTEXT.md — there is nothing to explore. Research focus was on: verifying the correct npm package name for Resend (CONTEXT.md says `@resend/node` which does not exist; the real package is `resend`), confirming current SDK API shape, confirming Drizzle migration mechanics that already work in this project, verifying the TanStack Query v5 mutation API used throughout the codebase, and cataloguing the exact component APIs the UI must consume.

No runtime state concerns apply: the `project_members` and `team_invites` tables are purely additive; the `removed_at` column is nullable and safe to add via `ALTER TABLE`; no external datastores cache team identity.

**Primary recommendation:** Install `npm install resend` (not `@resend/node`), follow the `{ data, error } = await resend.emails.send(...)` API, and use the existing migration/schema/test patterns without deviation.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Email Delivery (MT-01)**
- D-01: Install `@resend/node` (Resend SDK). Configure via `RESEND_API_KEY` environment variable. Send invite emails from a single `from` address. No nodemailer, no SMTP config.
  - **RESEARCH CORRECTION:** Package `@resend/node` does not exist on npm. The correct package is `resend` (v6.9.4). The import and API are identical: `import { Resend } from 'resend'`. This must be reflected in all plans.
- D-02: If `RESEND_API_KEY` is not set, fall back to logging the invite URL to the server console. Server still returns `201`.

**Invite Token + DB (MT-01, MT-02)**
- D-03: New `team_invites` table in migration `0018_team_invites.sql` (idx 14 in `_journal.json`): `id`, `inviter_user_id FK → users.id`, `invitee_email`, `token`, `expires_at`, `accepted_at nullable`, `revoked_at nullable`, `created_at`
- D-04: Token is `crypto.randomBytes(32).toString('hex')` — stored plain, not hashed
- D-05: "Pending" = `accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`. Only one pending invite at a time.

**2-User Cap Enforcement (MT-02)**
- D-06: Before creating an invite: check if 2 distinct users in `project_members` (→ 409 "Team is at capacity (2 members)") and check if pending invite exists (→ 409 "An invite is already pending"). Distinct error codes.

**project_members: soft-delete for MT-05 (MT-05)**
- D-07: Add nullable `removed_at` column to `project_members` in same migration `0018_team_invites.sql`. Removal sets `removed_at = now()` instead of deleting the row. `assertProjectAccess` must filter `WHERE removed_at IS NULL`.
- D-08: 1-year purge job is deferred.

**Invite Registration Flow (MT-01)**
- D-09: Route `GET /accept-invite?token=X` in React. `AcceptInvitePage` calls `GET /api/team/invite/:token`, pre-fills + locks email, submits to `POST /api/auth/accept-invite`.
- D-10: `POST /api/auth/accept-invite` accepts `{ token, password }`. Validates → creates user → inserts `project_members` for ALL inviter's projects → marks `accepted_at` → sets session cookie → returns `201 { user }`.
- D-11: `/api/auth/register` and `/register` page are UNCHANGED. `INVITE_CODE` env-var guard continues as-is.

**GET /api/projects Fix**
- D-12: Replace `eq(projects.userId, userId)` with a join on `project_members` (where `removed_at IS NULL`). Active/all status filter preserved.

**Team API Routes**
- D-13: New router `src/server/routes/team.ts` at `/api/team`:
  - `GET /api/team` — `{ members: [...], pendingInvite: {...} | null }` — auth required
  - `POST /api/team/invite` — owner-only, creates `team_invites` row, sends email
  - `DELETE /api/team/invite` — owner-only, sets `revoked_at`
  - `DELETE /api/team/members/:userId` — owner-only, sets `removed_at` on all their `project_members` rows
  - `POST /api/team/transfer` — owner-only, swaps roles across all shared projects
- D-14: `GET /api/team/invite/:token` — PUBLIC, returns `{ email, inviterEmail }`, 404 not found, 410 expired/used/revoked
- D-15: Owner check via `project_members WHERE user_id = req.user.id AND role = 'owner' AND removed_at IS NULL`

**Team Settings UI**
- D-16: New `TeamPage` at `/team` — protected route. "Team" nav link in `Layout.tsx`.
- D-17: Members Card + Invite Card layout (see UI-SPEC.md)
- D-18: Transfer ownership uses inline confirm row (per UI-SPEC.md D-18 divergence note — modal NOT used)
- D-19: All team mutations use `@tanstack/react-query` `useMutation` + `queryClient.invalidateQueries(['team'])` on success

### Claude's Discretion

- Exact email template/HTML body for the invite email
- Whether to show the owner's own card as non-removable (no Remove button on self)
- Loading states, error banners, and toast-style feedback for team mutations
- Whether to use a `useTeam()` custom hook wrapping the React Query fetch

### Deferred Ideas (OUT OF SCOPE)

- 1-year purge job for removed members (MT-05 scope TBD)
- Per-project permission tiers
- More than 2 users per account
- Invite expiry extension / resend
- Admin impersonation
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MT-01 | Owner can invite one other user by email; invitee receives a registration link and creates their account through it | inviteService.ts + Resend SDK `resend` (v6.9.4) + token-based link flow via `team_invites` table; `AcceptInvitePage` + `POST /api/auth/accept-invite` |
| MT-02 | Maximum 2 users total per account; invite button disabled when at capacity | Server-side cap check (D-06) before `POST /api/team/invite`; UI `disabled` state on Send Invite button (D-17) |
| MT-04 | Owner can transfer ownership; original owner becomes a regular member | `POST /api/team/transfer` updates `project_members.role` across ALL shared projects; inline confirm pattern from UI-SPEC.md |
| MT-05 | When a member is removed, records retained (soft delete with `removed_at`) | `removed_at` column on `project_members` via migration; `assertProjectAccess` filter; `DELETE /api/team/members/:userId` sets `removed_at` |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | 6.9.4 | Transactional email delivery | Project decision D-01; official Resend Node SDK (NOT `@resend/node` — that package does not exist) |
| `@tanstack/react-query` | ^5.91.0 (installed) | Server state, mutations, query invalidation | Already used throughout all existing pages |
| `react-hook-form` | ^7.71.2 (installed) | Form management for invite + accept-invite forms | Already installed |
| `zod` | ^4.3.6 (installed) | Route input validation schemas | Already used on all routes |
| `drizzle-orm` | ^0.45.1 (installed) | DB query builder for `team_invites` table | Already used throughout |
| `crypto` (Node built-in) | built-in | `randomBytes(32).toString('hex')` for token generation | Decision D-04; no additional install |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `supertest` | installed | Route integration tests | Used in all existing `tests/routes/*.test.ts` files |
| `vitest` | installed | Test runner | Already configured via `vitest.config.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `resend` | `nodemailer` | D-01 explicitly forbids nodemailer |
| Inline confirm row (UI-SPEC) | Modal component | UI-SPEC note D-18 divergence: inline row is project pattern, avoids new component |
| Plain stored token | Hashed token | D-04: plain storage is intentional; 32-byte + 72h expiry is sufficient |

**Installation:**
```bash
npm install resend
```

**Version verification:** `resend` is at 6.9.4 as of 2026-03-30 (confirmed via `npm view resend version`).

---

## Architecture Patterns

### Recommended Project Structure

New files for this phase:
```
src/
├── server/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 0018_team_invites.sql      # NEW — CREATE TABLE + ALTER TABLE
│   │   │   └── meta/_journal.json         # MODIFY — register idx 14
│   │   └── schema.ts                      # MODIFY — add teamInvites + removedAt
│   ├── routes/
│   │   ├── team.ts                        # NEW — /api/team router
│   │   └── auth.ts                        # MODIFY — add accept-invite route
│   │   └── projects.ts                    # MODIFY — fix GET /api/projects
│   ├── services/
│   │   └── inviteService.ts               # NEW — token create, validate, email
│   ├── utils/
│   │   └── assertProjectAccess.ts         # MODIFY — add removed_at IS NULL
│   └── index.ts                           # MODIFY — mount team router
└── client/
    ├── pages/
    │   ├── TeamPage.tsx                   # NEW
    │   └── AcceptInvitePage.tsx           # NEW
    ├── components/shared/
    │   └── Layout.tsx                     # MODIFY — add "Team" nav link
    └── App.tsx                            # MODIFY — add /team + /accept-invite routes
```

### Pattern 1: Migration File Convention

This project uses SQL-only migrations registered in `_journal.json`. The current highest idx is 13 (`0017_project_members`). The new migration must be idx 14.

```sql
-- src/server/db/migrations/0018_team_invites.sql
CREATE TABLE team_invites (
  id TEXT PRIMARY KEY,
  inviter_user_id TEXT NOT NULL REFERENCES users(id),
  invitee_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint

ALTER TABLE project_members ADD COLUMN removed_at TEXT;
```

`_journal.json` entry to add:
```json
{
  "idx": 14,
  "version": "6",
  "when": <unix_ms>,
  "tag": "0018_team_invites",
  "breakpoints": true
}
```

**Critical:** The `-->  statement-breakpoint` separator is required between SQL statements. Drizzle's better-sqlite3 migrator uses this to split statements. Verified from existing migration `0017_project_members.sql`.

### Pattern 2: Drizzle Schema Declaration

Existing schema in `src/server/db/schema.ts` uses `sqliteTable`. The new `teamInvites` table follows the same pattern:

```typescript
// Source: existing schema.ts pattern
export const teamInvites = sqliteTable('team_invites', {
  id: text('id').primaryKey(),
  inviterUserId: text('inviter_user_id').notNull().references(() => users.id),
  inviteeEmail: text('invitee_email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at').notNull(),
});
```

`projectMembers` gains:
```typescript
removedAt: text('removed_at'),
```

The `uniqueIndex` on `(projectId, userId)` already exists — do NOT re-declare it.

### Pattern 3: Route Structure (Express Router)

All routes follow the same Router pattern. The new `team.ts` router mounts at `/api/team` in `src/server/index.ts`:

```typescript
// src/server/routes/team.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth); // all team routes require auth except the public token lookup
// ... routes
export { router as teamRouter };

// src/server/index.ts addition:
import { teamRouter } from './routes/team.js';
app.use('/api/team', teamRouter);
```

The public `GET /api/team/invite/:token` route must be excluded from `requireAuth`. Options:
1. Mount it BEFORE `router.use(requireAuth)` in team.ts
2. Or export as a separate attachment on authRouter

The cleanest option is to declare the public route BEFORE the `router.use(requireAuth)` line in `team.ts`. Express router applies middleware only to subsequently defined routes.

### Pattern 4: Owner-Only Middleware

D-15 specifies checking `project_members WHERE user_id = req.user.id AND role = 'owner' AND removed_at IS NULL`. A reusable helper or inline check works — the project does not have a `requireOwner` middleware yet. Given only 4 endpoints need it, inline checks in `team.ts` are consistent with existing route patterns.

### Pattern 5: TanStack Query v5 Mutation

All existing mutation patterns in the codebase use TanStack Query v5 `useMutation`. The key API shape verified from installed version ^5.91.0:

```typescript
// Source: TanStack Query v5 pattern used throughout this project
const mutation = useMutation({
  mutationFn: async (data: { email: string }) => {
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['team'] });
  },
});
```

**Note:** In TanStack Query v5, `invalidateQueries` takes an object: `{ queryKey: ['team'] }` — not a positional array argument. Confirm from existing code in the repo before writing.

### Pattern 6: `assertProjectAccess` Modification

Current `assertProjectAccess.ts` queries `projectMembers` without a `removed_at IS NULL` filter. After the migration adds `removed_at`, this must be added:

```typescript
// Modified WHERE clause in assertProjectAccess.ts
.where(
  and(
    eq(projectMembers.projectId, projectId),
    eq(projectMembers.userId, userId),
    isNull(projectMembers.removedAt),  // ADD THIS — D-07
  ),
)
```

Import `isNull` from `drizzle-orm`.

### Pattern 7: GET /api/projects Fix

Current code filters by `eq(projects.userId, userId)`. The fix joins `project_members`:

```typescript
// src/server/routes/projects.ts — GET / handler
const userProjects = await db
  .select({ project: projects })
  .from(projects)
  .innerJoin(
    projectMembers,
    and(
      eq(projectMembers.projectId, projects.id),
      eq(projectMembers.userId, userId),
      isNull(projectMembers.removedAt),
    ),
  )
  .where(
    statusFilter && statusFilter !== 'active'
      ? undefined
      : eq(projects.status, 'active'),
  );
```

Note: The `and(...conditions)` pattern currently used needs to be refactored — the join predicate carries the user filter, and `status` is the only remaining WHERE condition.

### Pattern 8: Resend SDK Usage

**Package name:** `resend` (NOT `@resend/node` — that package does not exist on npm).

```typescript
// src/server/services/inviteService.ts
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendInviteEmail(to: string, inviteUrl: string, fromEmail: string): Promise<void> {
  if (!resend) {
    console.log(`[invite] RESEND_API_KEY not set. Invite URL: ${inviteUrl}`);
    return;
  }
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject: 'You have been invited to join HCC Prevailing Wage',
    html: `<p>Click the link below to accept your invitation:</p><p><a href="${inviteUrl}">${inviteUrl}</a></p>`,
  });
  if (error) {
    console.error('[invite] Resend error:', error);
    // Do not rethrow — invite row is created; email failure is non-fatal per D-02
  }
}
```

### Anti-Patterns to Avoid

- **Do NOT hash the invite token:** D-04 explicitly specifies plain storage. 32-byte token + 72h expiry + single-use is the intended threat model.
- **Do NOT use `projects.userId` for ownership checks:** Per Phase 32 D-03, `project_members.role = 'owner'` is the authority. Using `projects.userId` is the old pattern that was explicitly deprecated.
- **Do NOT insert `project_members` for only one project:** When accepting invite, insert rows for ALL of the inviter's projects. Missing even one means the member cannot access it.
- **Do NOT soft-delete only one project_members row on member removal:** Set `removed_at` on ALL rows for that `userId` where the inviter owns the project.
- **Do NOT return 404 for expired/used/revoked tokens:** Return 410 Gone. The `AcceptInvitePage` uses this to show "Link Expired" vs "Link Not Found" (see UI-SPEC.md).
- **Do NOT transfer ownership for only one project:** `POST /api/team/transfer` must update `project_members.role` across ALL projects the pair shares.
- **Do NOT use `@resend/node` as the package name:** That package does not exist. Use `resend`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transactional email | Custom SMTP/nodemailer setup | `resend` npm package | D-01; Resend handles delivery, retries, bounce handling |
| Cryptographic token | Math.random() or UUID | `crypto.randomBytes(32).toString('hex')` | Node built-in; UUID is not hex; randomBytes is the correct primitive |
| Form validation (invite) | Manual `if (!email.includes('@'))` | `zod` schema + existing `validate` middleware | Already in every route; consistent error shape |
| Query state/loading | Manual `useState` fetch | `useQuery` + `useMutation` | TanStack Query v5 already installed and used throughout |

**Key insight:** The project's existing middleware (`requireAuth`, `validate`), utility (`assertProjectAccess`), and schema patterns must be reused — every new file must follow the same structure as existing files, not invent new conventions.

---

## Common Pitfalls

### Pitfall 1: Wrong Package Name for Resend

**What goes wrong:** `npm install @resend/node` fails with 404. Build/test pipeline errors.
**Why it happens:** CONTEXT.md D-01 specifies `@resend/node` but this package does not exist. Resend renamed their package.
**How to avoid:** Install `resend` (not `@resend/node`). Import as `import { Resend } from 'resend'`.
**Warning signs:** `npm error 404 Not Found - GET https://registry.npmjs.org/@resend%2fnode`

### Pitfall 2: Partial project_members Update on Accept-Invite

**What goes wrong:** Member can only see the first project the inviter owns, not all of them.
**Why it happens:** `POST /api/auth/accept-invite` queries the inviter's projects and inserts one row per project. A `LIMIT 1` or premature exit leaves other projects inaccessible.
**How to avoid:** Query ALL projects where inviter has a `project_members` row, then batch insert all `project_members` rows for the new user before returning.
**Warning signs:** Member sees fewer projects than owner; test with owner that has 2+ projects.

### Pitfall 3: removed_at Filter Missing in assertProjectAccess

**What goes wrong:** Removed members can still access all project data after being removed.
**Why it happens:** `assertProjectAccess` queries `projectMembers` but the new `removedAt` column defaults to NULL for all existing rows — the filter must be ADDED, it's not implicit.
**How to avoid:** Add `isNull(projectMembers.removedAt)` to the WHERE clause in `assertProjectAccess.ts` immediately after the migration.
**Warning signs:** Existing tests still pass but a removed member can call `GET /api/projects/:id` and get 200.

### Pitfall 4: `GET /api/projects` Returns No Results After Fix

**What goes wrong:** After replacing `eq(projects.userId, userId)` with a join, the query returns 0 rows even though projects exist.
**Why it happens:** The `project_members` backfill in migration `0017_project_members.sql` only ran for projects that existed at migration time. New projects created after Phase 32 use `POST /api/projects` which already inserts the owner row — so those are fine. However, the JOIN condition must use `eq(projectMembers.userId, userId)` and `isNull(projectMembers.removedAt)` to filter correctly.
**How to avoid:** Verify the join produces correct results with a test that: (1) creates owner + project, (2) registers member + invites + accepts, (3) calls `GET /api/projects` as member and confirms the owner's projects appear.
**Warning signs:** Empty `projects` array in API response after fix.

### Pitfall 5: 410 vs 404 for Token Validation

**What goes wrong:** `AcceptInvitePage` shows "Invite Not Found" instead of "Link Expired" for used/revoked/expired tokens.
**Why it happens:** Developer returns 404 for all token lookup failures.
**How to avoid:** `GET /api/team/invite/:token` returns 404 only when token row doesn't exist. Returns 410 Gone when token exists but is expired, accepted, or revoked. The `AcceptInvitePage` handles both status codes differently per UI-SPEC.md.
**Warning signs:** UI-SPEC acceptance test for "expired token shows 'Link Expired'" state fails.

### Pitfall 6: TanStack Query v5 invalidateQueries API

**What goes wrong:** `queryClient.invalidateQueries(['team'])` throws a TypeScript error or silently fails.
**Why it happens:** TanStack Query v5 changed the API — `invalidateQueries` now takes `{ queryKey: [...] }` not a positional array.
**How to avoid:** Use `queryClient.invalidateQueries({ queryKey: ['team'] })`.
**Warning signs:** TypeScript error on `invalidateQueries` call; team data does not refresh after mutation.

### Pitfall 7: migration_breakpoint Missing

**What goes wrong:** Drizzle migrator throws "could not parse SQL" or silently skips the `ALTER TABLE` statement.
**Why it happens:** The Drizzle better-sqlite3 migrator requires `-->  statement-breakpoint` (two spaces after `-->`) between SQL statements in the same migration file.
**How to avoid:** Place `-->  statement-breakpoint` between every SQL statement in `0018_team_invites.sql`. Verified pattern from `0017_project_members.sql`.
**Warning signs:** `removed_at` column missing after migration; `ALTER TABLE` statement skipped.

---

## Code Examples

### Token Generation (D-04)
```typescript
// Source: CONTEXT.md D-04 + Node.js crypto built-in
import { randomBytes } from 'crypto';
const token = randomBytes(32).toString('hex'); // 64 hex chars
const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
```

### Accept-Invite: project_members Insert for All Inviter Projects
```typescript
// Source: CONTEXT.md D-10 — must insert for ALL inviter projects
const inviterProjects = await db
  .select({ projectId: projectMembers.projectId })
  .from(projectMembers)
  .where(
    and(
      eq(projectMembers.userId, invite.inviterUserId),
      isNull(projectMembers.removedAt),
    ),
  );

await db.insert(projectMembers).values(
  inviterProjects.map(({ projectId }) => ({
    id: randomUUID(),
    projectId,
    userId: newUserId,
    role: 'member' as const,
    joinedAt: now,
  }))
);
```

### Owner Check Pattern
```typescript
// Source: CONTEXT.md D-15 — use project_members.role, NOT projects.userId
const [ownerRow] = await db
  .select({ id: projectMembers.id })
  .from(projectMembers)
  .where(
    and(
      eq(projectMembers.userId, req.user!.userId),
      eq(projectMembers.role, 'owner'),
      isNull(projectMembers.removedAt),
    ),
  )
  .limit(1);

if (!ownerRow) {
  res.status(403).json({ error: 'Owner access required' });
  return;
}
```

### AcceptInvitePage — Token Validation States
```typescript
// Source: CONTEXT.md D-14 + UI-SPEC.md token state table
// HTTP 200 → show form
// HTTP 404 → EmptyState heading="Invite Not Found"
// HTTP 410 → EmptyState heading="Link Expired"

useEffect(() => {
  const token = new URLSearchParams(location.search).get('token');
  if (!token) { setTokenState('invalid'); return; }
  fetch(`/api/team/invite/${token}`, { credentials: 'include' })
    .then(async (res) => {
      if (res.status === 200) {
        const body = await res.json();
        setInviteData(body.data);
        setTokenState('valid');
      } else if (res.status === 410) {
        setTokenState('expired');
      } else {
        setTokenState('invalid');
      }
    })
    .catch(() => setTokenState('error'));
}, []);
```

### Layout.tsx — Team Nav Link Addition
```tsx
// Source: Layout.tsx existing pattern — add after "Wage Lookup" link
<Link to="/team" className="text-sm text-gray-300 hover:text-brand-gold transition-colors">
  Team
</Link>
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js crypto | Token generation (D-04) | ✓ | built-in | — |
| `resend` npm package | Email delivery (D-01) | ✗ (not yet installed) | 6.9.4 available | Console log fallback (D-02) — no blocking dependency |
| `RESEND_API_KEY` env var | Live email delivery | Not set locally | — | Console fallback per D-02; tests pass without it |
| SQLite (via better-sqlite3) | DB migrations | ✓ | installed | — |
| Vitest | Test suite | ✓ | installed | — |

**Missing dependencies with no fallback:**
- None — `RESEND_API_KEY` absence is handled by D-02 console fallback.

**Missing dependencies with fallback:**
- `resend` package not yet installed → `npm install resend` required in Wave 0 / plan 33-01.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via `vitest.config.ts`) |
| Config file | `vitest.config.ts` (project root) |
| Setup file | `tests/helpers/db.ts` — in-memory SQLite, runs all migrations |
| Quick run command | `npm test` (vitest run) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MT-01 | `POST /api/team/invite` creates invite row + returns 201 | integration | `npm test -- tests/routes/team.test.ts` | ❌ Wave 0 |
| MT-01 | `GET /api/team/invite/:token` returns 200 with email; 404 not found; 410 expired | integration | `npm test -- tests/routes/team.test.ts` | ❌ Wave 0 |
| MT-01 | `POST /api/auth/accept-invite` creates user + project_members + session | integration | `npm test -- tests/routes/team.test.ts` | ❌ Wave 0 |
| MT-02 | Second invite blocked when team at 2 members (409) | integration | `npm test -- tests/routes/team.test.ts` | ❌ Wave 0 |
| MT-02 | Second invite blocked when pending invite exists (409) | integration | `npm test -- tests/routes/team.test.ts` | ❌ Wave 0 |
| MT-04 | `POST /api/team/transfer` swaps roles across all projects | integration | `npm test -- tests/routes/team.test.ts` | ❌ Wave 0 |
| MT-05 | `DELETE /api/team/members/:userId` sets removed_at | integration | `npm test -- tests/routes/team.test.ts` | ❌ Wave 0 |
| MT-05 | Removed member rejected by assertProjectAccess (403) | integration | `npm test -- tests/routes/team.test.ts` | ❌ Wave 0 |
| D-12 | `GET /api/projects` returns owner's projects for member | integration | `npm test -- tests/routes/projects.test.ts` | ✅ (extend existing) |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/routes/team.test.ts` — covers MT-01, MT-02, MT-04, MT-05 team API routes
- [ ] `tests/routes/team.test.ts` — covers `POST /api/auth/accept-invite` (could go in `auth.test.ts`)

*(Existing `tests/routes/projects.test.ts` must be extended to test `GET /api/projects` join fix for D-12.)*

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` apply to this phase:

1. **NEVER hard-delete** project or payroll data — soft-delete pattern confirmed; `removed_at` is the correct approach for MT-05.
2. **DB Migration Pattern:** Plain SQL files in `src/server/db/migrations/`, always registered in `meta/_journal.json`. Next idx = 14. Tag = `0018_team_invites`. Use `-->  statement-breakpoint` between statements.
3. **Design Tokens:** All colors via `@theme` tokens in `src/client/index.css`. Do not hardcode hex values. Key tokens: `bg-nav-dark`, `border-brand-gold`, `text-brand-gold`, `bg-brand-gold`, `bg-surface-card`, `bg-surface-page`.
4. **UI Primitives:** Use existing `Card`, `Button`, `Badge`, `PageHeader`, `EmptyState` from `src/client/components/ui/` — do not create new primitives. Phase 33 UI-SPEC.md confirms this.
5. **Button component:** No `asChild` prop — the `Button` component does not support it. Do not add a `fullWidth` prop either — use `className="w-full"` instead.
6. **Badge `neutral` variant:** Uses built-in Tailwind `bg-gray-100/text-gray-600` — do NOT use `bg-status-neutral` (that token does not exist).
7. **React Patterns:** `useRef` for synchronous guards. TanStack Query keys must include all variable state. Blob URL downloads use `fetch()` → Blob → `createObjectURL()` → click → `revokeObjectURL`.
8. **`WildcardRedirect` / `PublicRoute` inline in App.tsx** — single-use components do not warrant separate files. `AcceptInvitePage` should be added as a standalone public route (like `/login`), not wrapped in `<PublicRoute>` (which redirects authenticated users).

---

## Open Questions

1. **Email `from` address**
   - What we know: D-01 says `team@<configured domain>` or env-configured sender. No `FROM_EMAIL` env var exists yet.
   - What's unclear: Should a `FROM_EMAIL` or `RESEND_FROM` env var be introduced, or should it be hardcoded as a constant in `inviteService.ts`?
   - Recommendation: Introduce `RESEND_FROM_EMAIL` env var with a sensible default (e.g., `team@hccprevailingwage.com`). Log a warning if absent. This is in Claude's Discretion.

2. **AcceptInvitePage route protection**
   - What we know: D-09 says it's NOT the public `/register` route. The existing `<PublicRoute>` wrapper redirects authenticated users to `/dashboard`.
   - What's unclear: Should an already-authenticated user be able to visit `/accept-invite`? (e.g., owner accidentally opens their own invite link)
   - Recommendation: Treat `/accept-invite` as a fully public route (no `<PublicRoute>` wrapper) — let the submit handler return a sensible error if the token is already used. Simpler than special-casing auth state.

3. **`GET /api/projects` — Drizzle `select` shape after join**
   - What we know: Adding a join changes the select result from `Project[]` to `{ project: Project }[]`.
   - What's unclear: The current handler does `res.json({ data: { projects: userProjects } })` — needs to map `userProjects.map(r => r.project)` or use `select({ project: projects })` and unwrap.
   - Recommendation: Use `.select({ project: projects })` in the join query and map to `userProjects.map(r => r.project)` before sending response. Match the existing `{ data: { projects: [...] } }` response shape exactly.

---

## Sources

### Primary (HIGH confidence)

- Project source files (`src/server/routes/auth.ts`, `projects.ts`, `schema.ts`, `assertProjectAccess.ts`, `index.ts`) — existing patterns confirmed by direct read
- `src/server/db/migrations/0017_project_members.sql` — confirms `-->  statement-breakpoint` convention
- `src/server/db/migrations/meta/_journal.json` — confirms next idx is 14
- `src/client/components/ui/Button.tsx`, `Badge.tsx`, `Layout.tsx` — confirmed exact component APIs
- `src/client/App.tsx` — confirmed route registration pattern
- `tests/helpers/db.ts` + `tests/routes/auth.test.ts` — confirmed test infrastructure pattern
- `package.json` — confirmed installed dependencies and versions
- `.planning/phases/33-team-invite-flow-team-ui/33-UI-SPEC.md` — visual/interaction contract (approved 2026-03-29)
- `.planning/phases/33-team-invite-flow-team-ui/33-CONTEXT.md` — all architecture decisions

### Secondary (MEDIUM confidence)

- npm registry: `npm view resend version` → 6.9.4 (verified 2026-03-30)
- Resend official docs (`resend.com/docs/send-with-nodejs`) — confirmed `import { Resend } from 'resend'` + `resend.emails.send({ from, to, subject, html })` + `{ data, error }` return shape

### Tertiary (LOW confidence)

- None — all claims verified from project source or official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry and project `package.json`
- Architecture: HIGH — all patterns verified from existing project source files
- Pitfalls: HIGH — derived directly from CONTEXT.md "Critical Pitfalls" section + project source code analysis
- UI patterns: HIGH — verified from UI-SPEC.md (approved) + direct component source reads

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack; Resend SDK version worth re-checking if > 30 days)
