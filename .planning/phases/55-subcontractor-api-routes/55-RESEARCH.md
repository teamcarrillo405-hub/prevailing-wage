# Phase 55: Subcontractor API Routes - Research

**Researched:** 2026-04-13
**Domain:** Express route authoring (CRUD + sub-resource), assertProjectAccess, dynamic-import audit logging
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-03 | Sub management routes: GET/POST/PATCH/DELETE /api/projects/:id/subcontractors — all with assertProjectAccess | assertProjectAccess pattern is fully documented from workers.ts; Drizzle schema confirmed in schema.ts |
| SUB-04 | CPR tracking routes: GET/POST/PATCH /api/projects/:id/subcontractors/:subId/cpr-weeks — mark week received/compliant | UNIQUE constraint on (subcontractorId, weekEndingDate) requires upsert-or-404 on PATCH; pattern drawn from payroll routes |
| NFR-03 | All new routes apply assertProjectAccess before any data access | Enforcement verified across workers.ts, payroll.ts, export.ts — pattern is consistent and well-understood |
</phase_requirements>

---

## Summary

Phase 55 adds a single new route file (`src/server/routes/subcontractors.ts`) mounted at `/api/projects` in `index.ts`, implementing seven HTTP routes split across two resource levels: the subcontractor CRUD surface (SUB-03) and the CPR-week tracking sub-resource (SUB-04). No new Drizzle schema changes are needed — both tables were created in Phase 54.

The implementation pattern is already established across multiple existing route files. The `assertProjectAccess(db, projectId, userId)` call must appear at the top of every handler before any DB access — this is the NFR-03 requirement, and it is enforced consistently in `workers.ts`, `payroll.ts`, `export.ts`, and others. The CPR-week PATCH route must handle the UNIQUE constraint on `(subcontractorId, weekEndingDate)` by treating it as an update-if-exists operation. Audit logging applies only to two lifecycle events — `subcontractor.created` and `subcontractor.removed` — using the dynamic import pattern from Phase 38.

**Primary recommendation:** Write `subcontractors.ts` following the `workers.ts` structural pattern exactly: `router.use(requireAuth)` at top, named Zod schemas, `assertProjectAccess` before every handler's DB access, dynamic import for audit logs, and `export default router` at the bottom. Mount at `app.use('/api/projects', subcontractorsRouter)` in `index.ts`.

---

## Project Constraints (from CLAUDE.md)

- All new routes apply `assertProjectAccess` before any data access (NFR-03)
- `randomUUID` from `crypto` — not the `uuid` package (Phase 39 decision)
- `dynamic import` for `auditService` in route files to avoid circular dependency risk (Phase 38 decision)
- All state comparisons use `.toUpperCase()` — not relevant to this phase
- No hard-delete of projects or payroll weeks — subcontractors may be hard-deleted (no retention requirement); DELETE /subcontractors/:subId is a real DELETE with cascade
- Drizzle migrations are add-only — no new migration needed in this phase (schema already exists)
- Design tokens, React patterns — client-side only; not applicable here

---

## Standard Stack

### Core (all already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | existing | Router + HTTP handlers | Project standard |
| zod | existing | Request body validation via `validate` middleware | Project standard |
| drizzle-orm | existing | DB queries (eq, and, or, sql) | Project standard |
| better-sqlite3 | existing | SQLite driver | Project standard |
| crypto (node built-in) | built-in | randomUUID() for new IDs | Phase 39 locked decision |

### No new installation required

All dependencies are present. This phase is pure route authoring against existing schema.

---

## Architecture Patterns

### Recommended Project Structure

```
src/server/routes/
├── subcontractors.ts    # NEW — Phase 55; mounted at /api/projects
├── workers.ts           # Reference pattern
├── payroll.ts           # Reference pattern (audit log usage)
└── ...
src/server/
└── index.ts             # Add subcontractorsRouter import + mount
tests/routes/
└── subcontractors.test.ts  # NEW — Phase 55 tests
```

### Pattern 1: Standard Route File Structure (from workers.ts)

**What:** All project-scoped route files follow this exact structure.
**When to use:** Always — non-negotiable project convention.

```typescript
// src/server/routes/subcontractors.ts
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { subcontractors, subcontractorCprWeeks } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';

const router = Router();
router.use(requireAuth);

// ... Zod schemas ...
// ... route handlers ...

export default router;
```

### Pattern 2: assertProjectAccess Call (from workers.ts, payroll.ts)

**What:** Called at the top of every handler before any DB read or write. The try/catch pattern is consistent across all files.
**When to use:** Every single route handler — no exceptions (NFR-03).

```typescript
// Source: src/server/routes/workers.ts (lines 100-106, 130-136, etc.)
const projectId = req.params.id as string;
const userId = req.user!.userId;
const db = getDb();

try {
  await assertProjectAccess(db, projectId, userId);
} catch (err: any) {
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
  return;
}
// DB access begins here
```

### Pattern 3: Sub-resource Ownership Verification

**What:** For routes that take both `:id` (project) and `:subId` (subcontractor), assert project access first, then verify the sub belongs to that project.
**When to use:** All CPR-week routes and PATCH/DELETE sub routes.

```typescript
// assertProjectAccess first (NFR-03)
try {
  await assertProjectAccess(db, projectId, userId);
} catch (err: any) {
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
  return;
}

// Then verify the sub belongs to this project
const [sub] = await db
  .select()
  .from(subcontractors)
  .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
  .limit(1);

if (!sub) {
  res.status(404).json({ error: 'Subcontractor not found' });
  return;
}
```

### Pattern 4: UNIQUE Constraint Upsert for CPR Weeks (POST)

**What:** `subcontractor_cpr_weeks` has UNIQUE(subcontractor_id, week_ending_date). A POST to create a CPR week that already exists should return 409 or the existing record. The safer pattern for this phase is to check existence first and return 409 if it already exists, then INSERT for new records.

Note: SQLite lacks `INSERT OR UPDATE ON CONFLICT` with partial-column updates. The workers.ts classification route uses INSERT only. The payroll.ts amendment route uses DELETE+INSERT for upsert. For CPR weeks, the cleaner UX is: POST creates (409 if duplicate), PATCH updates (404 if not found).

```typescript
// POST: check duplicate before insert
const [existing] = await db
  .select()
  .from(subcontractorCprWeeks)
  .where(and(
    eq(subcontractorCprWeeks.subcontractorId, subId),
    eq(subcontractorCprWeeks.weekEndingDate, body.weekEndingDate),
  ))
  .limit(1);

if (existing) {
  res.status(409).json({ error: 'CPR week already exists for this subcontractor and week' });
  return;
}
```

### Pattern 5: Dynamic Import Audit Log (from payroll.ts Phase 38 pattern)

**What:** Audit logs use dynamic import to avoid circular dependency. Wrapped in best-effort try/catch — audit failure must NEVER fail the primary request.
**When to use:** Only for `subcontractor.created` (POST sub) and `subcontractor.removed` (DELETE sub). No audit log on CPR week operations per the phase spec.

```typescript
// Source: src/server/routes/payroll.ts (lines 387-400)
// Best-effort audit log (Phase 38 pattern — AUDIT-03)
try {
  const { insertAuditLog } = await import('../services/auditService.js');
  await insertAuditLog({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    ipAddress: req.ip ?? null,
    projectId,
    entityType: 'subcontractor',
    entityId: newSub.id,
    action: 'subcontractor.created',
    snapshot: { name: newSub.name, licenseNumber: newSub.licenseNumber ?? null },
  });
} catch (auditErr) { console.error('[audit]', auditErr); }
```

### Pattern 6: Router Mount in index.ts

**What:** All project-scoped routes mount at `/api/projects`. The new router adds one line to the existing mount block.
**When to use:** Exactly once per new router.

```typescript
// Source: src/server/index.ts (lines 43, 57)
// Existing pattern:
app.use('/api/projects', workersRouter);
app.use('/api/projects', payrollWeekClassificationsRouter);

// New line to add:
import subcontractorsRouter from './routes/subcontractors.js';
// ...
app.use('/api/projects', subcontractorsRouter);
```

### Route Signatures

SUB-03 — Subcontractor management (all at `/:id/subcontractors`):
- `GET    /api/projects/:id/subcontractors` — list all subs for project
- `POST   /api/projects/:id/subcontractors` — create sub; audit `subcontractor.created`
- `PATCH  /api/projects/:id/subcontractors/:subId` — update sub fields
- `DELETE /api/projects/:id/subcontractors/:subId` — hard delete sub + cascade; audit `subcontractor.removed`

SUB-04 — CPR week tracking (at `/:id/subcontractors/:subId/cpr-weeks`):
- `GET    /api/projects/:id/subcontractors/:subId/cpr-weeks` — list all CPR weeks for sub
- `POST   /api/projects/:id/subcontractors/:subId/cpr-weeks` — create CPR week record
- `PATCH  /api/projects/:id/subcontractors/:subId/cpr-weeks/:weekId` — update receivedDate, isCompliant, notes

### Zod Schemas

```typescript
const CreateSubSchema = z.object({
  name: z.string().min(1).max(500),
  licenseNumber: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  address: z.string().max(500).optional(),
});

const UpdateSubSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  licenseNumber: z.string().max(200).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

const CreateCprWeekSchema = z.object({
  weekEndingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekEndingDate must be YYYY-MM-DD'),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  isCompliant: z.union([z.literal(0), z.literal(1)]).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const UpdateCprWeekSchema = z.object({
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  isCompliant: z.union([z.literal(0), z.literal(1)]).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
```

**isCompliant Zod note:** The schema column is bare `integer` (null/0/1). In Zod, model it as `z.union([z.literal(0), z.literal(1)]).optional().nullable()` — this accepts null (unassessed), 0 (non-compliant), or 1 (compliant) and rejects arbitrary integers. Do NOT use `z.boolean()` — that would lose the null=unassessed semantic.

### Anti-Patterns to Avoid

- **Calling DB before assertProjectAccess:** Any DB read/write before the access check is an IDOR vulnerability. assertProjectAccess MUST be the first DB operation in every handler.
- **Static import of auditService:** Causes circular dependency risk. Always use `await import('../services/auditService.js')` inside the try/catch block.
- **z.boolean() for isCompliant:** The three-state integer (null/0/1) must NOT be mapped to boolean. `z.boolean()` would reject null and coerce 0 to false.
- **Audit log on PATCH sub or all CPR-week operations:** The phase spec only requires `subcontractor.created` and `subcontractor.removed`. Over-logging is fine if done carefully, but the success criteria explicitly call out only these two.
- **Forgetting sub-belongs-to-project check on CPR-week routes:** assertProjectAccess verifies the user-project membership; it does NOT verify the subcontractor belongs to that project. Both checks are required on sub-resource routes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID generator | `randomUUID()` from `crypto` | Node built-in, project-wide locked decision (Phase 39) |
| Request validation | Custom parse logic | `validate(ZodSchema)` middleware | Project-standard middleware already in place |
| Auth guard | Route-level token parse | `requireAuth` middleware | Project-standard middleware; all routes use it |
| Project membership check | Inline SQL join | `assertProjectAccess(db, projectId, userId)` | The centralized IDOR guard — do not inline |
| Audit logging | Custom DB insert | `insertAuditLog` from `auditService.js` | Handles SSN redaction, meta enrichment, consistent schema |

---

## Common Pitfalls

### Pitfall 1: Missing Sub-Project Membership Verification on CPR-Week Routes
**What goes wrong:** `assertProjectAccess` confirms the user can access the project. It does NOT confirm that `:subId` belongs to `:id`. A user with access to project A could request CPR weeks for a sub from project B if the sub ID is guessed.
**Why it happens:** Forgetting that sub-resource routes need two levels of scoping.
**How to avoid:** After assertProjectAccess succeeds, always query `subcontractors` with `and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId))`. Return 404 if not found.
**Warning signs:** CPR-week tests that don't test cross-project sub access.

### Pitfall 2: isCompliant Zod/DB Mismatch
**What goes wrong:** Using `z.boolean()` for `isCompliant` causes Zod to coerce `null` to `false` and `0` to `false` — collapsing the three-state column to two states.
**Why it happens:** The column is semantically boolean but stored as 0/1/null.
**How to avoid:** Use `z.union([z.literal(0), z.literal(1)]).optional().nullable()` in Zod. Pass the raw integer value to the DB insert/update — never coerce.
**Warning signs:** GET returning `false` where null was stored; PATCH with null not clearing the value.

### Pitfall 3: Audit Log Static Import Circular Dependency
**What goes wrong:** `import { insertAuditLog } from '../services/auditService.js'` at the top of the file creates a circular dependency chain that causes module load failures in certain test configurations.
**Why it happens:** auditService imports getDb, which may trigger other service imports.
**How to avoid:** Always use `const { insertAuditLog } = await import('../services/auditService.js')` inside the route handler's try/catch block. This is the Phase 38 locked decision.
**Warning signs:** Module initialization errors in tests; audit log calls that run at module load time.

### Pitfall 4: Duplicate Route Conflict With Existing Payroll Routes
**What goes wrong:** The route file uses `/:id/subcontractors` but other route files (workers.ts, payrollWeekClassifications.ts) also mount at `/api/projects`. Express resolves routes in declaration order — no conflict as long as path segments don't clash.
**Why it happens:** Not a real conflict, but worth understanding the mounting pattern.
**How to avoid:** The `:id/subcontractors` path prefix is unique. Existing routes use `:projectId/workers`, `:projectId/payroll-week-classifications`, etc. No collision.

### Pitfall 5: weekEndingDate Uniqueness Conflict on POST CPR Week
**What goes wrong:** If a CPR week for (subId, weekEndingDate) already exists, the DB throws a UNIQUE constraint violation. If the route doesn't check first, the error surfaces as an unhandled 500.
**Why it happens:** SQLite throws `SQLITE_CONSTRAINT: UNIQUE constraint failed` which Express's default error handler returns as 500.
**How to avoid:** Before INSERT, query for existence with `and(eq(subcontractorId), eq(weekEndingDate))`. Return 409 if found. The PATCH route handles updates to existing records.
**Warning signs:** 500 errors on repeated POST with same weekEndingDate.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/routes/subcontractors.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUB-03 | GET /api/projects/:id/subcontractors returns 200 with list | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |
| SUB-03 | POST creates a subcontractor, returns 201 | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |
| SUB-03 | PATCH updates sub fields, returns 200 | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |
| SUB-03 | DELETE removes sub (cascade CPR weeks), returns 200 | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |
| SUB-03 | 403 for non-member on every sub route | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |
| SUB-04 | GET cpr-weeks returns list for valid sub | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |
| SUB-04 | POST cpr-weeks creates week record, returns 201 | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |
| SUB-04 | POST cpr-weeks returns 409 on duplicate weekEndingDate | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |
| SUB-04 | PATCH cpr-weeks updates receivedDate/isCompliant/notes | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |
| SUB-04 | 403 for non-member on every CPR route | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |
| NFR-03 | assertProjectAccess called before any DB access | integration | `npx vitest run tests/routes/subcontractors.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/routes/subcontractors.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/routes/subcontractors.test.ts` — covers all SUB-03, SUB-04, NFR-03 behaviors listed above

*(No framework install needed — Vitest already configured and running.)*

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure route authoring against existing local SQLite DB and installed packages).

---

## Code Examples

### Full handler skeleton: POST /api/projects/:id/subcontractors

```typescript
// Source: workers.ts POST pattern + payroll.ts audit pattern
router.post('/:id/subcontractors', validate(CreateSubSchema), async (req, res) => {
  const projectId = req.params.id as string;
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const body = req.body as z.infer<typeof CreateSubSchema>;
  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(subcontractors).values({
    id,
    projectId,
    name: body.name,
    licenseNumber: body.licenseNumber ?? null,
    contactName: body.contactName ?? null,
    contactEmail: body.contactEmail ?? null,
    address: body.address ?? null,
    createdAt: now,
  });

  const [newSub] = await db.select().from(subcontractors).where(eq(subcontractors.id, id)).limit(1);

  // Best-effort audit log (Phase 38 pattern)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId,
      entityType: 'subcontractor',
      entityId: id,
      action: 'subcontractor.created',
      snapshot: { name: body.name },
    });
  } catch (auditErr) { console.error('[audit]', auditErr); }

  res.status(201).json({ data: { subcontractor: newSub } });
});
```

### Full handler skeleton: DELETE /api/projects/:id/subcontractors/:subId

```typescript
router.delete('/:id/subcontractors/:subId', async (req, res) => {
  const { id: projectId, subId } = req.params as { id: string; subId: string };
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  const [sub] = await db
    .select()
    .from(subcontractors)
    .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: 'Subcontractor not found' });
    return;
  }

  // Cascade via ON DELETE CASCADE on subcontractor_cpr_weeks
  await db.delete(subcontractors).where(eq(subcontractors.id, subId));

  // Best-effort audit log (Phase 38 pattern)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      ipAddress: req.ip ?? null,
      projectId,
      entityType: 'subcontractor',
      entityId: subId,
      action: 'subcontractor.removed',
      snapshot: { name: sub.name },
    });
  } catch (auditErr) { console.error('[audit]', auditErr); }

  res.json({ data: { deleted: true } });
});
```

### Full handler skeleton: PATCH cpr-weeks/:weekId

```typescript
router.patch('/:id/subcontractors/:subId/cpr-weeks/:weekId', validate(UpdateCprWeekSchema), async (req, res) => {
  const { id: projectId, subId, weekId } = req.params as { id: string; subId: string; weekId: string };
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // Verify sub belongs to project
  const [sub] = await db
    .select()
    .from(subcontractors)
    .where(and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId)))
    .limit(1);
  if (!sub) { res.status(404).json({ error: 'Subcontractor not found' }); return; }

  // Verify CPR week belongs to sub
  const [week] = await db
    .select()
    .from(subcontractorCprWeeks)
    .where(and(eq(subcontractorCprWeeks.id, weekId), eq(subcontractorCprWeeks.subcontractorId, subId)))
    .limit(1);
  if (!week) { res.status(404).json({ error: 'CPR week not found' }); return; }

  const body = req.body as z.infer<typeof UpdateCprWeekSchema>;

  await db.update(subcontractorCprWeeks)
    .set({
      receivedDate: body.receivedDate !== undefined ? body.receivedDate : week.receivedDate,
      isCompliant: body.isCompliant !== undefined ? body.isCompliant : week.isCompliant,
      notes: body.notes !== undefined ? body.notes : week.notes,
    })
    .where(eq(subcontractorCprWeeks.id, weekId));

  const [updated] = await db.select().from(subcontractorCprWeeks).where(eq(subcontractorCprWeeks.id, weekId)).limit(1);
  res.json({ data: { cprWeek: updated } });
});
```

### Test file skeleton (supertest pattern from workers.test.ts)

```typescript
// tests/routes/subcontractors.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

async function registerAndLogin(suffix: string) {
  const email = `sub-route-${suffix}-${Date.now()}@test.com`;
  const res = await supertest(app).post('/api/auth/register').send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name: 'Sub Test Project', state: 'CA', county: 'Los Angeles',
            contractType: 'federal-davis-bacon', awardDate: '2025-01-01', fundingType: 'federal' });
  return res.body.data?.project?.id as string;
}

describe('SUB-03: subcontractor CRUD', () => {
  it('GET returns 200 with empty list for new project', async () => { ... });
  it('POST creates sub and returns 201', async () => { ... });
  it('PATCH updates sub fields', async () => { ... });
  it('DELETE removes sub', async () => { ... });
  it('returns 403 for non-member on GET', async () => { ... });
  it('returns 403 for non-member on POST', async () => { ... });
  it('returns 403 for non-member on PATCH', async () => { ... });
  it('returns 403 for non-member on DELETE', async () => { ... });
});

describe('SUB-04: CPR week tracking', () => {
  it('POST creates cpr-week and returns 201', async () => { ... });
  it('POST returns 409 on duplicate weekEndingDate', async () => { ... });
  it('PATCH updates receivedDate and isCompliant', async () => { ... });
  it('GET returns list of cpr-weeks for sub', async () => { ... });
  it('returns 403 for non-member on all CPR routes', async () => { ... });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-route ownership inline SQL | `assertProjectAccess` centralized | Phase 32 | Non-negotiable for all new routes |
| Static import of auditService | Dynamic import in handler | Phase 38 | Prevents circular dep in all subsequent phases |
| `uuid` package | `randomUUID` from `crypto` | Phase 39 | No extra dependency; identical API |

---

## Open Questions

1. **Should PATCH sub return the full updated subcontractor or just `{ updated: true }`?**
   - What we know: GET returns full records; POST returns 201 + full record (workers.ts pattern)
   - What's unclear: Phase spec does not specify PATCH response shape
   - Recommendation: Return full updated record (consistent with workers.ts PUT pattern which calls `updateWorker` and returns `{ data: { worker: result } }`)

2. **Should GET cpr-weeks be sorted?**
   - What we know: The schema has no updatedAt; weekEndingDate is text ISO 8601
   - What's unclear: Phase spec does not specify sort order
   - Recommendation: Order by `weekEndingDate` descending — most recent week first; add `import { desc } from 'drizzle-orm'`

---

## Sources

### Primary (HIGH confidence)
- `src/server/routes/workers.ts` — route file structural template; all patterns verified by direct read
- `src/server/routes/payroll.ts` — dynamic import audit pattern; verified lines 387-400
- `src/server/utils/assertProjectAccess.ts` — full function signature and behavior verified
- `src/server/services/auditService.ts` — `insertAuditLog` signature and all fields verified
- `src/server/db/schema.ts` — `subcontractors` and `subcontractorCprWeeks` definitions confirmed at lines 412-439
- `src/server/index.ts` — route mounting pattern verified; mount point is `/api/projects`
- `vitest.config.ts` — test framework configuration verified
- `tests/helpers/db.ts` — in-memory migration test setup verified
- `tests/routes/workers.test.ts` — supertest test pattern verified

### Secondary (MEDIUM confidence)
- `REQUIREMENTS.md` SUB-03, SUB-04 — requirements text confirmed
- `STATE.md` accumulated decisions — Phase 54, Phase 38 locked decisions confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing; no new packages
- Architecture: HIGH — route file pattern verified against 3+ existing files; assertProjectAccess verified from source
- Pitfalls: HIGH — all pitfalls derived from existing code decisions in STATE.md and direct source inspection
- Test patterns: HIGH — verified from workers.test.ts and vitest.config.ts

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable stack; no external dependencies)
