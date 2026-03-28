# Phase 32: Multi-User Auth Foundation — Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The app's project ownership model supports multiple users via a `project_members` join table. Every route that guards project access uses a single centralized `assertProjectAccess` function — eliminating IDOR risk before any team data exists. `createdByUserId` / `updatedByUserId` columns added to `payroll_entries` for MT-05 data retention attribution.

This phase does NOT include: invite email sending, team UI, ownership transfer, member removal, 2-user cap enforcement. Those are Phase 33.

</domain>

<decisions>
## Implementation Decisions

### project_members Schema (MT-03)

- **D-01:** New `project_members` table with columns: `id` (text PK), `project_id` (FK → projects.id CASCADE DELETE), `user_id` (FK → users.id), `role` (text: `'owner'` | `'member'`), `joined_at` (text ISO 8601). Unique index on `(project_id, user_id)` — a user can only be a member of a project once.
- **D-02:** `role` column is included in Phase 32's migration. Phase 33 inserts member rows with `role: 'member'` — it needs the column to exist. One fewer ALTER migration later.
- **D-03:** `projects.user_id` column is NOT dropped or modified. It remains the creator FK. `assertProjectAccess` does NOT read `projects.user_id` for membership — it reads `project_members` only (clean single code path after backfill).

### Migration + Backfill (MT-03)

- **D-04:** Single SQL migration file: `0017_project_members.sql`. Registered at idx 13 in `_journal.json`.
- **D-05:** Backfill included in the same SQL migration: `INSERT INTO project_members SELECT lower(hex(randomblob(16))), id, user_id, 'owner', created_at FROM projects` — every existing project gets a `project_members` owner row at migration time. No dual code path in `assertProjectAccess`.
- **D-06:** After migration runs, `assertProjectAccess` checks `project_members` exclusively — no fallback to `project.userId === userId`. Clean code path.

### assertProjectAccess Helper (MT-03)

- **D-07:** Create `src/server/utils/assertProjectAccess.ts` — pure async function. Signature:
  ```ts
  async function assertProjectAccess(
    db: DrizzleDb,
    projectId: string,
    userId: string
  ): Promise<Project>
  ```
  Queries `project_members` JOIN `projects` for `(projectId, userId)`. Returns the full `Project` row on success (so callers don't need a second query). Throws `{ status: 403, message: 'Access denied' }` if no membership found. Throws `{ status: 404, message: 'Project not found' }` if project doesn't exist at all.
- **D-08:** Replace all 21 scattered `if (project.userId !== userId)` checks across 6 route files with `const project = await assertProjectAccess(db, projectId, req.user.id)`. The return value is the project, so the route no longer needs a separate `db.query.projects.findFirst()` call.

### createdByUserId / updatedByUserId on payroll_entries (MT-05)

- **D-09:** Add `created_by_user_id` (nullable text, FK → users.id) and `updated_by_user_id` (nullable text, FK → users.id) columns to `payroll_entries` table via the same SQL migration (`0017_project_members.sql`). Nullable for all existing rows — no backfill needed (historical entries have no user attribution).
- **D-10:** Drizzle schema (`schema.ts`) gains `createdByUserId` and `updatedByUserId` on `payrollEntries`. Route handlers that POST/PUT payroll entries must populate `created_by_user_id = req.user.id` and `updated_by_user_id = req.user.id` on write. MT-05 data retention (Phase 33) will use `created_by_user_id` to identify entries created by a removed member.

### Route Refactoring Scope (MT-03)

- **D-11:** Files to refactor (confirmed by grep):
  - `src/server/routes/compliance.ts` — 2 checks
  - `src/server/routes/export.ts` — 7 checks
  - `src/server/routes/payroll.ts` — 1 check
  - `src/server/routes/projects.ts` — 3 checks
  - `src/server/routes/reports.ts` — 1 check
  - `src/server/routes/workers.ts` — 7 checks
- **D-12:** Routes that load the project before the access check (common pattern: `findFirst` then compare) collapse to a single `assertProjectAccess` call that returns the project. No behavioral change — same 403 response, just centralized.

### Cross-Tenant Test Suite (MT-03)

- **D-13:** Add a `tests/security/cross-tenant.test.ts` file. Creates two users (userA, userB), two projects (projectA owned by userA, projectB owned by userB). Verifies that userB gets 403 on every project-scoped route using projectA's ID. Covers all 6 route files. This is the regression safety net for future route additions.
- **D-14:** Existing route tests continue to work unchanged — they use a single-user setup and the backfill ensures that user's projects are in `project_members`.

### Claude's Discretion

- Exact error format in `assertProjectAccess` (thrown object vs custom Error subclass vs direct res.status)
- Whether to put `assertProjectAccess` in `src/server/utils/` or `src/server/middleware/`
- Whether `assertProjectAccess` accepts `res` and calls it directly, or throws and lets the route handler catch (throw pattern is cleaner for reuse)
- Migration timestamp value for `_journal.json` `when` field

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DB Schema
- `src/server/db/schema.ts` — add `projectMembers` table + `createdByUserId`/`updatedByUserId` on `payrollEntries`
- `src/server/db/migrations/meta/_journal.json` — register idx 13, tag `0017_project_members`

### New Files
- `src/server/db/migrations/0017_project_members.sql` — CREATE TABLE + backfill INSERT + ALTER TABLE payroll_entries
- `src/server/utils/assertProjectAccess.ts` — NEW pure async helper

### Routes to Refactor
- `src/server/routes/compliance.ts` (2 checks)
- `src/server/routes/export.ts` (7 checks)
- `src/server/routes/payroll.ts` (1 check)
- `src/server/routes/projects.ts` (3 checks)
- `src/server/routes/reports.ts` (1 check)
- `src/server/routes/workers.ts` (7 checks)

### Tests
- `tests/security/cross-tenant.test.ts` — NEW cross-tenant IDOR regression suite
- `tests/helpers/db.ts` — setup file (confirm ENCRYPTION_KEY_V1 already set for crypto service)

### Requirements
- `.planning/REQUIREMENTS.md` §MT-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Access Guard Pattern (to be replaced)
```ts
// Pattern found 21 times across 6 route files:
const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
if (!project) { res.status(404)...; return; }
if (project.userId !== userId) { res.status(403)...; return; }
```

### Migration Convention
- SQL-only, manually registered in `_journal.json` — same as every prior migration
- Next idx: 13, next tag: `0017_project_members`
- Backfill SQL: `INSERT INTO project_members (id, project_id, user_id, role, joined_at) SELECT lower(hex(randomblob(16))), id, user_id, 'owner', created_at FROM projects`

### Integration Points
- `schema.ts` — add `projectMembers` export + `payrollEntries` new columns
- All 6 route files above — swap `findFirst + manual check` for `assertProjectAccess` return value
- `tests/helpers/db.ts` — migration will auto-run against in-memory DB via `migrate()`; backfill INSERT will produce 0 rows (no seed data) which is fine

### Critical Pitfalls
- `project_members` backfill must run AFTER the `CREATE TABLE` in the same migration — ordering matters in SQL
- `assertProjectAccess` must NOT be called in routes that handle project creation (POST /projects) — the project doesn't exist in `project_members` yet at that point; handle separately
- `payroll_entries` ALTER adds nullable columns only — no backfill, no NOT NULL constraint

</code_context>

<specifics>
## Specific Implementation Details

- New table: `project_members` (id text PK, project_id FK, user_id FK, role text, joined_at text, UNIQUE(project_id, user_id))
- Backfill: INSERT owner row for every existing project at migration time
- `createdByUserId` / `updatedByUserId` on `payroll_entries` — nullable, written on POST/PUT
- `assertProjectAccess(db, projectId, userId)` — returns Project or throws 403/404
- All 21 `project.userId !== userId` checks replaced with `assertProjectAccess` call
- Cross-tenant test suite covers all 6 route files (userB cannot access userA's project)

</specifics>

<deferred>
## Deferred Ideas

- Member-level permission tiers (read-only vs. full) — flat model is intentional per MT-03; per-project tiers are out of scope for v3.0
- Admin impersonation or super-user access — v4+
- Audit log of access checks — deferred to v4+ compliance milestone

</deferred>

---

*Phase: 32-multi-user-auth-foundation*
*Context gathered: 2026-03-28*
