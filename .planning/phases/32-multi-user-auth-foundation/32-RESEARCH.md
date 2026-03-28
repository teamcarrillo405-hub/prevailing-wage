# Phase 32 Research: Multi-User Auth Foundation

**Researched:** 2026-03-28
**Phase:** 32 — Multi-User Auth Foundation
**Confidence:** HIGH — all findings drawn directly from source files

---

## 1. Exact Access Guard Patterns — Line Numbers for All 21 Checks

### compliance.ts — 2 checks

**Check 1 — GET /api/compliance/project/:projectId (lines 27–30)**
```ts
// Line 27-28: select pattern
const [project] = await db.select().from(schema.projects)
  .where(eq(schema.projects.id, projectId)).limit(1);
// Line 29: 404 guard
if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
// Line 30: 403 guard  ← TARGET
if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
```
Note: Uses `db.select().from(schema.projects)` (not `db.query.projects.findFirst`). The `project` object returned is used only for the check — no fields are used downstream in this route. After replacement, `assertProjectAccess` return value is not needed for data.

**Check 2 — GET /api/compliance/:weekId (lines 157–170)**
```ts
// Line 157-161: load project after week load (two-step: weekId → projectId → project)
const [project] = await db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.id, result.projectId))
  .limit(1);
// Line 163-165: 404 guard
if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
// Line 167-170: 403 guard  ← TARGET
if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
```
Note: `result.projectId` is the projectId from `computeCompliance`. After replacement, `assertProjectAccess(db, result.projectId, userId)` with the return value unused.

**Skipped routes in compliance.ts — NOT checks to replace:**
- `/worker/:workerId/history` — ownership delegated to `getWorkerComplianceHistory(db, userId, workerId)` which checks `project.userId !== userId` internally (line 256). This service function is NOT in scope for phase 32 (it's in complianceService.ts, not a route guard).
- `/projects/summary` — delegates to `getBatchProjectCompliance(db, userId)` which queries `projects WHERE user_id = userId` directly. Not an access guard pattern.

---

### export.ts — 7 checks

All 7 follow the exact same pattern:
```ts
const [project] = await db
  .select()
  .from(projects)
  .where(eq(projects.id, week.projectId))
  .limit(1);
if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
```

| Route | Approx. Lines | projectId source | project fields used after check |
|-------|---------------|------------------|---------------------------------|
| GET /wh347/:weekId | 131–144 | `week.projectId` | `project.name`, `project.county`, `project.state`, `project.wdIdentifier`, `project.wdModNumber`, `project.cslbLicense`, `project.wcPolicyNumber` (many) |
| GET /a1131/:weekId | 254–268 | `week.projectId` | same CA fields |
| GET /f700/:weekId | 371–385 | `week.projectId` | WA fields |
| GET /csv/lcptracker/:weekId | 477–491 | `week.projectId` | `project.name` |
| GET /csv/emars/:weekId | 517–531 | `week.projectId` | `project.name` |
| GET /ecpr-xml/:weekId | 559–574 | `week.projectId` | many CA fields |
| GET /wa-cpr-xml/:weekId | 731–747 | `week.projectId` | WA fields |

**Key pattern for export.ts:** In all 7 routes, `project` is heavily used after the check (project name, state, county, WD identifier, CA/WA-specific fields). Replacing with `assertProjectAccess` works cleanly because the function returns the full `Project` row: `const project = await assertProjectAccess(db, week.projectId, userId)`.

---

### payroll.ts — 1 check (via local `assertProjectOwner` helper)

payroll.ts does NOT use inline `project.userId !== userId` checks. Instead it has a **file-local helper** at lines 95–116:
```ts
async function assertProjectOwner(
  projectId: string,
  userId: string,
  res: import('express').Response,
): Promise<boolean> {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return false; }
  if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return false; }
  return true;  // ← returns boolean, NOT the project row
}
```

This helper is called 7 times total in payroll.ts:
- Line 125: `await assertProjectOwner(body.projectId, userId, res)` — POST /weeks
- Line 144: `await assertProjectOwner(sourceWeek.projectId, userId, res)` — POST /weeks/copy
- Line 169: `await assertProjectOwner(originalWeek.projectId, userId, res)` — POST /weeks/amend
- Line 192: `await assertProjectOwner(week.projectId, userId, res)` — GET /weeks/:id
- Line 204: `await assertProjectOwner(projectId, userId, res)` — GET /projects/:projectId/weeks
- Line 222: `await assertProjectOwner(week.projectId, userId, res)` — POST /entries
- Line 248: `await assertProjectOwner(week.projectId, userId, res)` — PUT /entries/:id
- Line 286: `await assertProjectOwner(week.projectId, userId, res)` — PATCH /weeks/:id/submit
- Line 304: `await assertProjectOwner(week.projectId, userId, res)` — DELETE /weeks/:id/submit

The CONTEXT.md says payroll.ts has 1 check, which counts the function definition as 1 unit. In practice, `assertProjectOwner` itself is the single pattern; all call sites delegate to it. The task is to **delete** `assertProjectOwner` and replace all 9 call sites with try/catch around `assertProjectAccess`.

**Critical difference:** The local helper returns `boolean` and calls `res.status()` internally. The new `assertProjectAccess` throws — call sites need to change from:
```ts
const ok = await assertProjectOwner(projectId, userId, res);
if (!ok) return;
```
to:
```ts
const project = await assertProjectAccess(db, projectId, userId);
// (project returned but unused in most payroll routes since only projectId is needed)
```
with a route-level try/catch or a centralized error handler.

---

### projects.ts — 3 checks

**CRITICAL: POST / (create project) at lines 45–73 — MUST NOT call assertProjectAccess.**

The create route inserts the project row but does NOT insert a `project_members` row. Adding the backfill INSERT into `project_members` for the new project MUST happen inside this route after the insert, NOT via assertProjectAccess.

**Check 1 — GET /:id (lines 98–118)**
```ts
// Lines 103-106: select
const [project] = await db.select().from(projects).where(eq(projects.id, req.params.id)).limit(1);
// Lines 108-110: 404
if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
// Lines 113-116: 403  ← TARGET
if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
// Line 118: project used in response
res.json({ data: { project } });
```
After replacement: `const project = await assertProjectAccess(db, req.params.id, userId)` — project returned and sent in response.

**Check 2 — PATCH /:id (lines 122–165)**
```ts
// Lines 139-143: select
const [existing] = await db.select().from(projects).where(eq(projects.id, req.params.id)).limit(1);
// Lines 145-147: 404
if (!existing) { res.status(404).json({ error: 'Project not found' }); return; }
// Lines 150-153: 403  ← TARGET
if (existing.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
// Lines 158-161: WHERE clause also includes userId
await db.update(projects).set({ ...updates, updatedAt: now })
  .where(and(eq(projects.id, req.params.id), eq(projects.userId, userId)));
```
Note: The UPDATE WHERE clause uses both `projects.id` AND `projects.userId`. After replacing the access check, the UPDATE can simplify to `WHERE projects.id = :id` only (membership is verified by assertProjectAccess). Do not leave the redundant `eq(projects.userId, userId)` in the UPDATE clause.

**Check 3 — DELETE /:id (lines 168–195)**
```ts
// Lines 174-177: select
const [existing] = await db.select().from(projects).where(eq(projects.id, req.params.id)).limit(1);
// Lines 179-181: 404
if (!existing) { res.status(404).json({ error: 'Project not found' }); return; }
// Lines 183-185: 403  ← TARGET
if (existing.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
// Lines 189-192: WHERE clause also includes userId
await db.update(projects).set({ status: 'closed', updatedAt: now })
  .where(and(eq(projects.id, req.params.id), eq(projects.userId, userId)));
```
Same as PATCH: UPDATE WHERE clause must drop the `eq(projects.userId, userId)` condition.

**GET / (list projects) — NOT a target.** Lines 83–94 use `eq(projects.userId, userId)` as a query filter, not an access guard. This is correct behavior for listing only the caller's projects and does not need to change in phase 32.

---

### reports.ts — 1 check (via local `assertProjectOwner` helper)

reports.ts has its own `assertProjectOwner` helper at lines 19–39, identical in structure to payroll.ts:
```ts
async function assertProjectOwner(
  projectId: string, userId: string, res: Response,
): Promise<boolean> {
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return false; }
  if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
  return true;
}
```
Called at:
- Line 48: GET /:projectId/fringe-summary
- Line 66: GET /:projectId/worker/:workerId/pay-history

After replacement: delete the local helper, replace both call sites with try/catch around `assertProjectAccess`. The `project` return value is not used in either route (only `projectId` is forwarded to service functions).

---

### workers.ts — 7 checks

All 7 use the inline `db.select()...` + dual-check pattern (no local helper function):

| Route | Lines (approx.) | Select pattern | project fields used after check |
|-------|-----------------|----------------|----------------------------------|
| GET /:projectId/wage-classifications | 54–56 | `db.select().from(projects)` (compact form) | `project.state`, `project.county` |
| GET /:projectId/workers | 82–96 | `db.select().from(projects)` (expanded form) | `project.state`, `project.county` |
| POST /:projectId/workers | 148–162 | `db.select().from(projects)` (expanded form) | none (projectId only) |
| PUT /:projectId/workers/:workerId | 195–197 | compact inline | none |
| DELETE /:projectId/workers/:workerId | 232–235 | compact inline | none |
| DELETE /:projectId/workers/:workerId/classifications/:classificationId | 250–253 | compact inline | none |
| POST /:projectId/workers/:workerId/classifications | 271–285 | expanded form | none |

**Compact form (lines 54–56, 195–197, 232–235, 250–253):**
```ts
const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
```

**Expanded form (lines 82–96, 148–162, 271–285):**
```ts
const [project] = await db
  .select()
  .from(projects)
  .where(eq(projects.id, projectId))
  .limit(1);
if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
```

---

## 2. Project Loader Patterns

**All 6 route files use the same Drizzle pattern:**
```ts
const [project] = await db
  .select()
  .from(projects)       // or schema.projects in compliance.ts
  .where(eq(projects.id, someId))
  .limit(1);
```

No route uses `db.query.projects.findFirst()` or `db.get()`. The pattern is consistently `db.select().from().where().limit(1)` with array destructuring. The `assertProjectAccess` helper should use the same pattern internally.

**compliance.ts** uses `schema.projects` (imported as `* as schema`) while all other routes use named import `projects` directly. The helper function will use whichever import style is adopted for the new utility file.

---

## 3. Drizzle JOIN Pattern — Reference from payrollService.ts

`getPayrollEntries` at lines 238–257 demonstrates the canonical JOIN pattern used in this codebase:

```ts
const rows = await db
  .select({
    entry: payrollEntries,
    workerName: workers.name,
    tradeDescription: workerClassifications.tradeDescription,
    laborType: workerClassifications.laborType,
    programName: workerClassifications.programName,
  })
  .from(payrollEntries)
  .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
  .innerJoin(
    workerClassifications,
    eq(payrollEntries.classificationId, workerClassifications.id),
  )
  .where(eq(payrollEntries.payrollWeekId, weekId));
```

For `assertProjectAccess`, the equivalent JOIN will be:
```ts
const [row] = await db
  .select({ project: projects })
  .from(projectMembers)
  .innerJoin(projects, eq(projectMembers.projectId, projects.id))
  .where(
    and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId),
    )
  )
  .limit(1);
```
- If `row` is undefined AND a projects row with that ID exists → throw 403.
- If no project exists at all → throw 404.
- To distinguish: query `projects` table separately for 404 vs 403 differentiation, or accept a two-query approach (membership query + existence query on miss).

**Recommended two-query pattern (clean 404 vs 403 distinction):**
```ts
// Step 1: check membership (covers both 404 and 403 in most cases)
const [row] = await db
  .select({ project: projects })
  .from(projectMembers)
  .innerJoin(projects, eq(projectMembers.projectId, projects.id))
  .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
  .limit(1);
if (row) return row.project;  // fast path — member found

// Step 2: distinguish 404 from 403
const [exists] = await db.select({ id: projects.id }).from(projects)
  .where(eq(projects.id, projectId)).limit(1);
if (!exists) throw { status: 404, message: 'Project not found' };
throw { status: 403, message: 'Access denied' };
```

---

## 4. Test Setup Structure

### vitest.config.ts
```ts
// setupFiles: ['./tests/helpers/db.ts']   ← runs before every test file
```
The `db.ts` setup file runs `migrate(db, { migrationsFolder: './src/server/db/migrations' })` against an in-memory SQLite database. Every new `.sql` file in `migrations/` is automatically picked up at test run time. The backfill INSERT in `0017_project_members.sql` will produce 0 rows (no seed data) — this is fine and expected.

### tests/helpers/db.ts (complete file — 26 lines)
```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/server/db/schema.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeAll, afterAll } from 'vitest';

if (!process.env.ENCRYPTION_KEY_V1) {
  process.env.ENCRYPTION_KEY_V1 = 'a'.repeat(64);
}

let sqlite: InstanceType<typeof Database>;

beforeAll(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './src/server/db/migrations' });
  (globalThis as any).__testDb = db;
});

afterAll(() => { sqlite?.close(); });
```
**Key facts:**
- `ENCRYPTION_KEY_V1` already set as 64 `'a'` chars — cryptoService startup assertion passes.
- Foreign keys ON — the new `project_members` FK constraints will be enforced in tests.
- `migrate()` runs all SQL files in order — `0017_project_members.sql` will auto-run.
- The `__testDb` global is set but **not used** by route tests — those use the HTTP layer via `supertest(app)` and the app's own `getDb()`.

### Existing Route Test Pattern (consistent across all 6 route test files)
All route tests use the **HTTP layer** (supertest), NOT direct DB seeding:
```ts
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

async function registerAndLogin(suffix: string) {
  const res = await supertest(app)
    .post('/api/auth/register')
    .send({ email: `test-${suffix}-${Date.now()}@test.com`, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name: '...', state: 'CA', county: '...', ... });
  return res.body.data?.project?.id as string;
}
```

**For `cross-tenant.test.ts`:** The same HTTP pattern applies. Register two users, create projects for each via the API (which will insert `project_members` owner rows after POST /projects is updated in phase 32), then verify 403 responses for cross-user access.

---

## 5. Journal Entry Format for idx 13

The most recent entry in `_journal.json` is idx 12:
```json
{
  "idx": 12,
  "version": "6",
  "when": 1774950000000,
  "tag": "0016_workers_ssn_encrypted",
  "breakpoints": true
}
```

The new entry at idx 13 must be:
```json
{
  "idx": 13,
  "version": "6",
  "when": 1774960000000,
  "tag": "0017_project_members",
  "breakpoints": true
}
```

**`when` field:** Unix epoch milliseconds. All prior entries use round numbers. `1774960000000` is 10,000,000 ms (approximately 2.8 hours) after idx 12 — consistent with the spacing pattern. The exact value is at implementer's discretion per D-14 (Claude's discretion). Any value greater than `1774950000000` is valid.

**Important:** The `tag` field is `"0017_project_members"` matching the SQL file name. The journal `version` is `"6"` (same as all prior entries). The outer journal `version` is `"7"` (unchanged).

---

## 6. POST /projects — Must NOT Call assertProjectAccess

**Confirmed:** `POST /api/projects` at lines 45–73 of `projects.ts` creates the project row and returns it. It does NOT currently perform any access check (it's the creation endpoint). It MUST NOT call `assertProjectAccess`.

**Phase 32 addition required at this route:** After `db.insert(projects).values(...)`, insert a `project_members` owner row:
```ts
await db.insert(projectMembers).values({
  id: randomUUID(),
  projectId: id,
  userId,
  role: 'owner',
  joinedAt: now,
});
```
This ensures new projects created after the migration also have a membership row. Without this, the next call to assertProjectAccess for the new project would return 403.

**Other routes that do NOT call assertProjectAccess:**
- `GET /api/projects` — list route, filters by `eq(projects.userId, userId)`, not a single-project guard
- Any service-layer function (complianceService, reportsService) that queries by userId directly — these are out of scope for phase 32

---

## 7. tests/security/ Directory

**Does not exist.** `ls tests/` output:
```
auth.test.ts
fixtures/
helpers/
middleware/
routes/
services/
```
There is no `tests/security/` directory. The planner must add a task to **create the directory** before creating `tests/security/cross-tenant.test.ts`.

---

## 8. Drizzle Schema Pattern — How to Add projectMembers Table

The existing schema uses `sqliteTable` with named exports. The pattern for a table with a `uniqueIndex` is shown in `wageDeterminations` (lines 98–100):
```ts
export const wageDeterminations = sqliteTable('wage_determinations', {
  // ... columns ...
}, (table) => ({
  wdRevUnique: uniqueIndex('wd_rev_unique').on(table.wdNumber, table.revisionNumber),
}));
```

The new `projectMembers` table should follow this exact pattern:
```ts
export const projectMembers = sqliteTable('project_members', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role').notNull().$type<'owner' | 'member'>(),
  joinedAt: text('joined_at').notNull(),
}, (table) => ({
  projectMemberUnique: uniqueIndex('project_member_unique').on(table.projectId, table.userId),
}));
```

**Additions to `payrollEntries`** (at the end of the column list, before the `}` closing the columns object, before the index callback):
```ts
createdByUserId: text('created_by_user_id').references(() => users.id),
updatedByUserId: text('updated_by_user_id').references(() => users.id),
```
These are nullable (no `.notNull()`) and have FK references to `users.id` with no cascade (user deletion behavior is out of scope for phase 32).

**Exports needed:** `projectMembers` must be exported from `schema.ts`. `payrollEntries` is already exported — the new columns will be part of the existing export automatically.

---

## 9. Migration Timestamp Pattern

Existing `when` values in `_journal.json`:
```
idx 0:  1773889773905  (precise, millisecond-level)
idx 1:  1773932757240  (precise)
idx 2:  1773941877470  (precise)
idx 3:  1773950000000  (round)
idx 4:  1774000000000  (round)
idx 5:  1774100000000  (round)
idx 6:  1774387951000  (round seconds)
idx 7:  1774387951001  (sequential, +1ms)
idx 8:  1774481700000  (round)
idx 9:  1774481700001  (sequential, +1ms)
idx 10: 1774900000000  (round)
idx 11: 1774900100000  (round, +100s)
idx 12: 1774950000000  (round)
```

Pattern: round millisecond values with occasional sequential same-second pairs. For idx 13, use `1774960000000` (continuing the round number convention, +10,000,000ms after idx 12 ≈ 2.8 hours later).

---

## 10. payroll_entries Write Locations

`db.insert(payrollEntries)` and `upsertPayrollEntry` appear in:

| Location | Write type | Notes |
|----------|-----------|-------|
| `src/server/services/payrollService.ts` line 175–177 | INSERT with onConflictDoUpdate (upsertPayrollEntry) | Called from routes/payroll.ts POST /entries and PUT /entries/:id |
| `src/server/services/payrollService.ts` line 543–569 | INSERT (amendPayrollWeek) | Copies entries when amending a week |
| `src/server/routes/payroll.ts` (via `upsertPayrollEntry`) | Indirect | Route calls service function |

**No other files write payroll entries** (confirmed: routes/export.ts reads only; complianceService.ts reads only; reportsService.ts reads only; varianceService.ts reads only).

**D-10 impact:** `createdByUserId` and `updatedByUserId` must be populated in:
1. `payrollService.ts` `upsertPayrollEntry` — needs `userId` added to `UpsertPayrollEntryInput`. Routes call this with the body data; `userId` must be threaded through from `req.user!.userId`.
2. `payrollService.ts` `amendPayrollWeek` — entry copy at lines 543–569 should set `createdByUserId: null, updatedByUserId: null` (historical amendment copies retain no user attribution; the original entry's userId is unknown at copy time without additional joins). OR set them to the requesting user's ID since it's an amendment action — implementer's decision per D-14 (Claude's discretion).

**The route-level change for D-10:**
- `POST /api/payroll/entries` and `PUT /api/payroll/entries/:id` in `routes/payroll.ts` must pass `userId: req.user!.userId` to `upsertPayrollEntry`.
- `UpsertEntrySchema` does NOT include userId (it comes from JWT, not request body) — the service function signature change is purely internal.

---

## Summary: Change Surface for the Planner

### New files to create
| File | Purpose |
|------|---------|
| `src/server/db/migrations/0017_project_members.sql` | CREATE TABLE + backfill + ALTER |
| `src/server/utils/assertProjectAccess.ts` | Pure async helper |
| `tests/security/cross-tenant.test.ts` | IDOR regression suite |
| `tests/security/` (directory) | Does not exist yet |

### Files to modify
| File | Changes |
|------|---------|
| `src/server/db/migrations/meta/_journal.json` | Add idx 13 entry |
| `src/server/db/schema.ts` | Add `projectMembers` table export; add 2 columns to `payrollEntries` |
| `src/server/routes/compliance.ts` | Replace 2 inline checks (lines 27–30, 157–170) |
| `src/server/routes/export.ts` | Replace 7 inline checks |
| `src/server/routes/payroll.ts` | Delete `assertProjectOwner` helper (lines 95–116); replace 9 call sites; thread userId to upsertPayrollEntry |
| `src/server/routes/projects.ts` | Replace 3 inline checks (GET/:id, PATCH/:id, DELETE/:id); add `projectMembers` insert to POST / |
| `src/server/routes/reports.ts` | Delete `assertProjectOwner` helper (lines 19–39); replace 2 call sites |
| `src/server/routes/workers.ts` | Replace 7 inline checks |
| `src/server/services/payrollService.ts` | Update `upsertPayrollEntry` to accept and write userId; update `amendPayrollWeek` |

### Error handling architecture decision (Claude's discretion)
The `assertProjectAccess` function should **throw** (not call `res.status()`) to keep it reusable outside route handlers. Route files that currently use `if (!ok) return` pattern (payroll.ts, reports.ts) need a try/catch. Options:
1. Each call site wraps in try/catch matching `{ status, message }` shape.
2. Add an Express error handler in `app` that catches `{ status, message }` thrown objects.
3. Use a typed `ProjectAccessError extends Error` class.

Option 1 is lowest-risk for phase 32 (no app-wide error handler changes). The throw shape `{ status: 403, message: 'Access denied' }` matches existing response format.

### Routes that do NOT need changes
- `GET /api/projects/` (list) — uses userId as filter, not access guard
- `GET /api/compliance/projects/summary` — delegates to service, uses userId filter
- `GET /api/compliance/worker/:workerId/history` — delegates to service, service handles check
- `GET /api/compliance/worker/:workerId/history/csv` — same delegation
- Any service-layer internal functions (complianceService, reportsService) — out of scope

---

## Open Questions / Flags for Planner

1. **`getBatchProjectCompliance` and `getWorkerComplianceHistory` in complianceService.ts** both use `eq(schema.projects.userId, userId)` to filter projects. These are NOT route-layer access guards. Phase 32 does not update them. Phase 33 (team invites) will need to update these to query via `project_members` — flag for Phase 33 planning.

2. **`GET /api/projects/` list route** (projects.ts line 83) uses `eq(projects.userId, userId)` as a filter. After Phase 32, this will only show projects where the user is the original creator (via `user_id` column), not projects where they were invited as a member. Phase 33 must update this query to join `project_members`. Flag this as a known limitation of phase 32 scope.

3. **`amendPayrollWeek` userId threading**: The amendment copy at payrollService.ts line 543 writes new payroll entries. Decision needed: should these copies get `createdByUserId = requestingUserId` (the person creating the amendment) or `null`? D-10 says new entries on POST/PUT get `req.user.id`. Amendment copies are a system-generated clone, not a direct user edit — `null` is the safer default. This is Claude's discretion per D-14.

4. **`upsertPayrollEntry` signature change** will require updating `UpsertPayrollEntryInput` type (currently defined in payrollService.ts). The `userId` field should be optional (`userId?: string`) so that callers that don't have it (like `amendPayrollWeek`) can omit it and get `null` for both columns.
