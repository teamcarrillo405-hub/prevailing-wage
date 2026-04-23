# DOL Wage Determination Live Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable live DOL WD lookup by WD number and by state/county/construction type, with project-pinned WDs and proactive cache refresh for active projects.

**Architecture:** Extend the existing `wdolFetcher` + `wageCache` + `wageLookup` pipeline. Add a `projectWageDeterminations` join table so users can pin WDs to projects. Add `GET /api/wages/fetch?wdNumber=` escape-hatch route and extend `GET /api/wages/lookup` with `constructionType`. A new `projectWageDeterminations.ts` route handles pin/unpin/set-primary. The nightly sync gains a proactive phase for active-project WDs. UI gets a new `ProjectWageDeterminationsPanel` and extended `WageLookupPage`.

**Tech Stack:** SQLite/Drizzle ORM, Express, React/React Query, SAM.gov WDOL v1 API (no auth required), Vitest/Supertest

---

## File Map

| File | Action |
|------|--------|
| `src/server/db/migrations/0039_project_wd_pins.sql` | Create |
| `src/server/db/migrations/meta/_journal.json` | Modify (add idx 35) |
| `src/server/db/schema.ts` | Modify (add `projectWageDeterminations` table + `lastFetchedAt` column) |
| `src/server/services/wageCache.ts` | Modify (add 4 new functions) |
| `src/server/services/wageLookup.ts` | Modify (add `fetchAndCacheByWdNumber`) |
| `src/server/services/wdolSync.ts` | Modify (add proactive refresh phase) |
| `src/server/routes/wages.ts` | Modify (extend lookup, add fetch endpoint) |
| `src/server/routes/projectWageDeterminations.ts` | Create |
| `src/server/index.ts` | Modify (mount new router) |
| `src/client/components/ProjectWageDeterminationsPanel.tsx` | Create |
| `src/client/pages/WageLookupPage.tsx` | Modify (construction type, multi-card, fetch-by-WD, pin modal) |
| `tests/services/wageCache.test.ts` | Modify (add pin/unpin/setPrimary tests) |
| `tests/routes/wages.test.ts` | Modify (add fetch endpoint tests) |
| `tests/routes/projectWageDeterminations.test.ts` | Create |

---

### Task 1: Migration — `project_wage_determinations` table + `last_fetched_at` column

**Files:**
- Create: `src/server/db/migrations/0039_project_wd_pins.sql`
- Modify: `src/server/db/migrations/meta/_journal.json`
- Modify: `src/server/db/schema.ts`

- [ ] **Step 1: Write the migration file**

Create `src/server/db/migrations/0039_project_wd_pins.sql` with exactly this content (note: space after `-->` is required):

```sql
ALTER TABLE wage_determinations ADD COLUMN last_fetched_at TEXT;
--> statement-breakpoint
CREATE TABLE project_wage_determinations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  wage_determination_id TEXT NOT NULL REFERENCES wage_determinations(id) ON DELETE CASCADE,
  construction_type TEXT CHECK(construction_type IN ('Building','Heavy','Highway','Residential')),
  is_primary INTEGER NOT NULL DEFAULT 0,
  pinned_at TEXT NOT NULL,
  pinned_by_user_id TEXT REFERENCES users(id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_proj_wd_unique ON project_wage_determinations(project_id, wage_determination_id);
```

- [ ] **Step 2: Register in journal**

In `src/server/db/migrations/meta/_journal.json`, append to the `entries` array (after the idx 34 entry):

```json
{
  "idx": 35,
  "version": "7",
  "when": 1745625600000,
  "tag": "0039_project_wd_pins",
  "breakpoints": true
}
```

- [ ] **Step 3: Add to schema.ts**

In `src/server/db/schema.ts`, add `lastFetchedAt` to `wageDeterminations` after `updatedAt`:

```ts
  updatedAt: text('updated_at').notNull(),
  lastFetchedAt: text('last_fetched_at'),
```

Then add the new table after `wageClassifications`:

```ts
export const projectWageDeterminations = sqliteTable('project_wage_determinations', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  wageDeterminationId: text('wage_determination_id').notNull()
    .references(() => wageDeterminations.id, { onDelete: 'cascade' }),
  constructionType: text('construction_type')
    .$type<'Building' | 'Heavy' | 'Highway' | 'Residential'>(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  pinnedAt: text('pinned_at').notNull(),
  pinnedByUserId: text('pinned_by_user_id')
    .references(() => users.id),
}, (table) => ({
  projWdUnique: uniqueIndex('idx_proj_wd_unique').on(table.projectId, table.wageDeterminationId),
}));
```

- [ ] **Step 4: Run tests to verify migration applies cleanly**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run 2>&1 | tail -10
```

Expected: 643 passing, max 2 failures (pre-existing otScenarios failures).

- [ ] **Step 5: Commit**

```bash
git add src/server/db/migrations/0039_project_wd_pins.sql \
        src/server/db/migrations/meta/_journal.json \
        src/server/db/schema.ts
git commit -m "feat: add project_wage_determinations table and last_fetched_at column (migration 0039)"
```

---

### Task 2: `wageCache.ts` — pin/unpin/setPrimary/getPinned functions

**Files:**
- Modify: `src/server/services/wageCache.ts`
- Modify: `tests/services/wageCache.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/services/wageCache.test.ts`:

```ts
import {
  upsertWageDetermination,
  upsertClassifications,
  getCachedWd,
  getCachedClassifications,
  pinWdToProject,
  unpinWdFromProject,
  setPrimaryWd,
  getPinnedWdsForProject,
} from '../../src/server/services/wageCache.js';
```

Add these test cases at the bottom of the file:

```ts
// Helper: insert a project row directly for pin tests
function seedProject(overrides: Record<string, unknown> = {}) {
  const db = (globalThis as any).__testDb;
  const id = crypto.randomUUID();
  db.insert(schema.projects).values({
    id,
    userId: crypto.randomUUID(),
    name: 'Pin Test Project',
    state: 'CA',
    county: 'Los Angeles',
    contractType: 'federal-davis-bacon',
    awardDate: '2025-01-01',
    fundingType: 'federal',
    status: 'active',
    ...overrides,
  }).run();
  return id;
}

describe('pinWdToProject / getPinnedWdsForProject / unpinWdFromProject / setPrimaryWd', () => {
  it('pins a WD to a project and retrieves it', () => {
    const wd = makeWd({ state: 'CA', county: 'Pin County' });
    const wdId = upsertWageDetermination(wd);
    const projectId = seedProject();
    pinWdToProject(projectId, wdId, 'Building', null);
    const pinned = getPinnedWdsForProject(projectId);
    expect(pinned).toHaveLength(1);
    expect(pinned[0].wageDeterminationId).toBe(wdId);
    expect(pinned[0].isPrimary).toBe(false);
  });

  it('unpins a WD from a project', () => {
    const wd = makeWd({ state: 'CA', county: 'Unpin County' });
    const wdId = upsertWageDetermination(wd);
    const projectId = seedProject();
    pinWdToProject(projectId, wdId, 'Building', null);
    unpinWdFromProject(projectId, wdId);
    const pinned = getPinnedWdsForProject(projectId);
    expect(pinned).toHaveLength(0);
  });

  it('setPrimaryWd sets one primary and clears others', () => {
    const wd1 = makeWd({ state: 'CA', county: 'Primary1' });
    const wd2 = makeWd({ state: 'CA', county: 'Primary2' });
    const wdId1 = upsertWageDetermination(wd1);
    const wdId2 = upsertWageDetermination(wd2);
    const projectId = seedProject();
    pinWdToProject(projectId, wdId1, 'Building', null);
    pinWdToProject(projectId, wdId2, 'Highway', null);
    setPrimaryWd(projectId, wdId1);
    const pinned = getPinnedWdsForProject(projectId);
    const primary = pinned.find((p) => p.wageDeterminationId === wdId1);
    const nonPrimary = pinned.find((p) => p.wageDeterminationId === wdId2);
    expect(primary?.isPrimary).toBe(true);
    expect(nonPrimary?.isPrimary).toBe(false);
    // Switch primary
    setPrimaryWd(projectId, wdId2);
    const pinned2 = getPinnedWdsForProject(projectId);
    expect(pinned2.find((p) => p.wageDeterminationId === wdId1)?.isPrimary).toBe(false);
    expect(pinned2.find((p) => p.wageDeterminationId === wdId2)?.isPrimary).toBe(true);
  });

  it('throws on duplicate pin (unique constraint)', () => {
    const wd = makeWd({ state: 'CA', county: 'Dup County' });
    const wdId = upsertWageDetermination(wd);
    const projectId = seedProject();
    pinWdToProject(projectId, wdId, 'Building', null);
    expect(() => pinWdToProject(projectId, wdId, 'Building', null)).toThrow();
  });
});
```

Note: `makeWd` returns the shape with `id` but `upsertWageDetermination` returns the actual DB id (may differ on conflict). Use the returned value.

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run tests/services/wageCache.test.ts 2>&1 | tail -15
```

Expected: FAIL — `pinWdToProject is not a function`.

- [ ] **Step 3: Implement the four new functions in `wageCache.ts`**

Add at the top of `src/server/services/wageCache.ts` (alongside existing imports):

```ts
import { projectWageDeterminations } from '../db/schema.js';
```

(Add `projectWageDeterminations` to the existing schema import line.)

Add these functions at the bottom of `wageCache.ts`:

```ts
export interface PinnedWdRow {
  wageDeterminationId: string;
  constructionType: string | null;
  isPrimary: boolean;
  pinnedAt: string;
  pinnedByUserId: string | null;
}

export function getPinnedWdsForProject(projectId: string): PinnedWdRow[] {
  const db = getDb();
  return db
    .select({
      wageDeterminationId: projectWageDeterminations.wageDeterminationId,
      constructionType: projectWageDeterminations.constructionType,
      isPrimary: projectWageDeterminations.isPrimary,
      pinnedAt: projectWageDeterminations.pinnedAt,
      pinnedByUserId: projectWageDeterminations.pinnedByUserId,
    })
    .from(projectWageDeterminations)
    .where(eq(projectWageDeterminations.projectId, projectId))
    .all() as PinnedWdRow[];
}

export function pinWdToProject(
  projectId: string,
  wageDeterminationId: string,
  constructionType: string | null,
  pinnedByUserId: string | null,
): void {
  const db = getDb();
  db.insert(projectWageDeterminations).values({
    id: crypto.randomUUID(),
    projectId,
    wageDeterminationId,
    constructionType: constructionType as 'Building' | 'Heavy' | 'Highway' | 'Residential' | null,
    isPrimary: false,
    pinnedAt: new Date().toISOString(),
    pinnedByUserId,
  }).run();
}

export function unpinWdFromProject(projectId: string, wageDeterminationId: string): void {
  const db = getDb();
  db.delete(projectWageDeterminations)
    .where(
      and(
        eq(projectWageDeterminations.projectId, projectId),
        eq(projectWageDeterminations.wageDeterminationId, wageDeterminationId),
      ),
    )
    .run();
}

// Atomically sets isPrimary=true for the given WD and clears it for all others in the project.
export function setPrimaryWd(projectId: string, wageDeterminationId: string): void {
  const db = getDb();
  // Clear all primaries for this project
  db.update(projectWageDeterminations)
    .set({ isPrimary: false })
    .where(eq(projectWageDeterminations.projectId, projectId))
    .run();
  // Set the chosen one
  db.update(projectWageDeterminations)
    .set({ isPrimary: true })
    .where(
      and(
        eq(projectWageDeterminations.projectId, projectId),
        eq(projectWageDeterminations.wageDeterminationId, wageDeterminationId),
      ),
    )
    .run();
}
```

Also add `crypto` import at the top if not already present:
```ts
import crypto from 'crypto';
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run tests/services/wageCache.test.ts 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/wageCache.ts tests/services/wageCache.test.ts
git commit -m "feat: add pin/unpin/setPrimary/getPinned functions to wageCache"
```

---

### Task 3: `wageLookup.ts` — `fetchAndCacheByWdNumber`

**Files:**
- Modify: `src/server/services/wageLookup.ts`
- Modify: `tests/routes/wages.test.ts`

- [ ] **Step 1: Write failing tests in `tests/routes/wages.test.ts`**

Add to the existing mock block at top:

```ts
import { fetchWdFromSamGov } from '../../src/server/services/wdolFetcher.js';
const mockFetch = fetchWdFromSamGov as ReturnType<typeof vi.fn>;
```

Add this describe block:

```ts
describe('GET /api/wages/fetch', () => {
  it('returns 400 when wdNumber param is missing', async () => {
    const res = await request(app).get('/api/wages/fetch');
    expect(res.status).toBe(400);
  });

  it('returns cached WD when found in cache', async () => {
    const county = `FetchCached${Date.now()}`;
    const wdNumber = `CA2025FETCH${Date.now()}`;
    seedWd({ county, wdNumber });
    const res = await request(app).get(`/api/wages/fetch?wdNumber=${wdNumber}`);
    expect(res.status).toBe(200);
    expect(res.body.wd.wdNumber).toBe(wdNumber);
  });

  it('returns 404 when not in cache and SAM.gov returns null', async () => {
    mockFetch.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/wages/fetch?wdNumber=NOTEXIST99999');
    expect(res.status).toBe(404);
  });

  it('fetches from SAM.gov and caches when not in cache', async () => {
    const wdNumber = `LIVE${Date.now()}`;
    mockFetch.mockResolvedValueOnce({
      fullReferenceNumber: wdNumber,
      revisionNumber: 0,
      location: { description: 'CA', mapping: {} },
      document: '',
      shortName: 'ca1',
      year: 2025,
      publishDate: '2025-01-01',
      standard: true,
      active: true,
    });
    const res = await request(app).get(`/api/wages/fetch?wdNumber=${wdNumber}`);
    expect(res.status).toBe(200);
    expect(res.body.wd.wdNumber).toBe(wdNumber);
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run tests/routes/wages.test.ts 2>&1 | grep "FAIL\|fail\|404\|fetch" | head -10
```

Expected: test failures for the fetch endpoint (route doesn't exist yet).

- [ ] **Step 3: Add `fetchAndCacheByWdNumber` to `wageLookup.ts`**

Add these imports to `wageLookup.ts` (alongside existing ones):

```ts
import { eq, desc } from 'drizzle-orm';
import { wageDeterminations } from '../db/schema.js';
import { getDb } from '../db/index.js';
```

Add at the bottom of `wageLookup.ts`:

```ts
// Direct WD number lookup — cache-first, falls back to live SAM.gov fetch.
// Called by GET /api/wages/fetch — the escape hatch for WDs not in the seed list.
export async function fetchAndCacheByWdNumber(wdNumber: string): Promise<WageDetermination | null> {
  const db = getDb();
  const now = new Date().toISOString();

  // Cache hit: return if unexpired
  const cached = db
    .select()
    .from(wageDeterminations)
    .where(eq(wageDeterminations.wdNumber, wdNumber))
    .orderBy(desc(wageDeterminations.revisionNumber))
    .limit(1)
    .get() as typeof wageDeterminations.$inferSelect | undefined;

  if (cached && cached.cacheExpiresAt > now) {
    const classifications = getCachedClassifications(cached.id);
    return {
      ...cached,
      county: cached.county ?? null,
      constructionType: cached.constructionType ?? null,
      publishDate: cached.publishDate ?? null,
      isActive: Boolean(cached.isActive),
      classifications: classifications.map((c) => ({
        id: c.id,
        wageDeterminationId: c.wageDeterminationId,
        tradeCode: c.tradeCode,
        tradeDescription: c.tradeDescription,
        laborType: c.laborType as 'journeyworker' | 'foreman' | 'apprentice',
        baseRate: c.baseRate,
        fringeRate: c.fringeRate,
        totalRate: c.totalRate,
        createdAt: c.createdAt,
      })),
    };
  }

  // Cache miss — fetch live from SAM.gov
  const response = await fetchWdFromSamGov(wdNumber, 0);
  if (!response) return null;

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const cacheExpiresAt = new Date(nowDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const wdId = crypto.randomUUID();

  const actualId = upsertWageDetermination({
    id: wdId,
    source: 'federal-dol',
    wdNumber: response.fullReferenceNumber,
    revisionNumber: response.revisionNumber,
    state: response.location?.description?.slice(0, 2).toUpperCase() ?? 'XX',
    county: null,
    constructionType: null,
    publishDate: response.publishDate,
    rawDocument: response.document ?? null,
    cachedAt: nowIso,
    cacheExpiresAt,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const classifications = response.document ? parseWdDocument(response.document) : [];
  upsertClassifications(actualId, classifications);

  return {
    id: actualId,
    source: 'federal-dol',
    wdNumber: response.fullReferenceNumber,
    revisionNumber: response.revisionNumber,
    state: response.location?.description?.slice(0, 2).toUpperCase() ?? 'XX',
    county: null,
    constructionType: null,
    publishDate: response.publishDate,
    isActive: true,
    cachedAt: nowIso,
    cacheExpiresAt,
    createdAt: nowIso,
    updatedAt: nowIso,
    classifications: classifications.map((c, i) => ({
      id: `${actualId}-${i}`,
      wageDeterminationId: actualId,
      tradeCode: c.code,
      tradeDescription: c.description,
      laborType: 'journeyworker' as const,
      baseRate: c.baseRate,
      fringeRate: c.fringeRate,
      totalRate: c.totalRate,
      createdAt: nowIso,
    })),
  };
}
```

- [ ] **Step 4: Add `GET /api/wages/fetch` to `wages.ts`**

In `src/server/routes/wages.ts`, add this import:

```ts
import { lookupWageDetermination, fetchAndCacheByWdNumber } from '../services/wageLookup.js';
```

Add this route after `GET /lookup`:

```ts
// GET /api/wages/fetch?wdNumber=CA20250001
// Direct WD number lookup — cache-first, SAM.gov fallback.
// Returns { wd, classifications } or 404 when not found anywhere.
wagesRouter.get('/fetch', async (req, res) => {
  const wdNumber = req.query['wdNumber'];
  if (typeof wdNumber !== 'string' || !wdNumber.trim()) {
    res.status(400).json({ error: 'wdNumber query param is required' });
    return;
  }
  const wd = await fetchAndCacheByWdNumber(wdNumber.trim().toUpperCase());
  if (!wd) {
    res.status(404).json({ error: `WD ${wdNumber} not found on SAM.gov` });
    return;
  }
  res.json({ wd, classifications: wd.classifications ?? [] });
});
```

Also extend `GET /lookup` to accept optional `constructionType` and return an array. Find the existing `GET /lookup` handler and replace its response:

Find:
```ts
  return res.json({ wd, classifications: wd.classifications ?? [] });
```

Replace with:
```ts
  const wds = [wd];
  return res.json({ wds, classifications: wds.map((w) => w.classifications ?? []) });
```

- [ ] **Step 5: Run tests**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run tests/routes/wages.test.ts 2>&1 | tail -15
```

Expected: all tests PASS (existing tests may need updating if they check `res.body.wd` — change to `res.body.wds[0]`).

- [ ] **Step 6: Fix any existing test breakage from lookup response shape change**

If existing tests assert `res.body.wd`, update them to `res.body.wds[0]`. Run:

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run 2>&1 | grep "FAIL" | head -10
```

Fix any failing assertion. Example fix in `wages.test.ts`:
```ts
// Before:
expect(res.body).toHaveProperty('wd');
expect(res.body.wd.wdNumber).toBe(...);

// After:
expect(res.body).toHaveProperty('wds');
expect(Array.isArray(res.body.wds)).toBe(true);
expect(res.body.wds[0].wdNumber).toBe(...);
```

- [ ] **Step 7: Commit**

```bash
git add src/server/services/wageLookup.ts src/server/routes/wages.ts tests/routes/wages.test.ts
git commit -m "feat: add fetchAndCacheByWdNumber and GET /api/wages/fetch endpoint"
```

---

### Task 4: `wdolSync.ts` — proactive refresh for active-project WDs

**Files:**
- Modify: `src/server/services/wdolSync.ts`

- [ ] **Step 1: Add proactive refresh phase to `runWageSync`**

Read `src/server/services/wdolSync.ts` to understand the current `runWageSync` function structure. Find where it iterates `WD_SEED_LIST` and add a second phase before or after it.

Add these imports to `wdolSync.ts`:

```ts
import { and, eq, lt } from 'drizzle-orm';
import { projectWageDeterminations, projects } from '../db/schema.js';
```

Add this function after the `WD_SEED_LIST` constant and before `runWageSync`:

```ts
// Returns WD ids linked to active projects whose cache expires within 48 hours.
// Called by runWageSync to proactively refresh before expiry.
async function getActiveProjectWdIds(): Promise<string[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const rows = db
    .select({ wdId: projectWageDeterminations.wageDeterminationId })
    .from(projectWageDeterminations)
    .innerJoin(projects, eq(projectWageDeterminations.projectId, projects.id))
    .innerJoin(wageDeterminations, eq(projectWageDeterminations.wageDeterminationId, wageDeterminations.id))
    .where(
      and(
        eq(projects.status, 'active'),
        lt(wageDeterminations.cacheExpiresAt, cutoff),
      ),
    )
    .all() as { wdId: string }[];
  return [...new Set(rows.map((r) => r.wdId))];
}
```

Inside `runWageSync` (or wherever the sync results are accumulated), add at the start:

```ts
  // Phase 1: proactively refresh WDs pinned to active projects
  const activeWdIds = await getActiveProjectWdIds();
  for (const wdId of activeWdIds) {
    const wd = db.select().from(wageDeterminations).where(eq(wageDeterminations.id, wdId)).get() as typeof wageDeterminations.$inferSelect | undefined;
    if (!wd) continue;
    const response = await fetchWdFromSamGov(wd.wdNumber, wd.revisionNumber).catch(() => null);
    if (!response) { results.failed++; continue; }
    const classifications = response.document ? parseWdDocument(response.document) : [];
    upsertWageDetermination({
      id: wd.id,
      source: wd.source as 'federal-dol',
      wdNumber: wd.wdNumber,
      revisionNumber: wd.revisionNumber,
      state: wd.state,
      county: wd.county ?? null,
      constructionType: wd.constructionType ?? null,
      publishDate: response.publishDate,
      rawDocument: response.document ?? null,
      cachedAt: new Date().toISOString(),
      cacheExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: wd.createdAt,
      updatedAt: new Date().toISOString(),
    });
    upsertClassifications(wd.id, classifications);
    results.fetched++;
  }
```

Note: `results` must already be defined before Phase 1. Check where `runWageSync` initializes it and insert after that line.

- [ ] **Step 2: Run full test suite**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run 2>&1 | tail -10
```

Expected: 643+ passing, max 2 pre-existing failures.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/wdolSync.ts
git commit -m "feat: proactively refresh WDs pinned to active projects in nightly sync"
```

---

### Task 5: Project WD pin/unpin routes

**Files:**
- Create: `src/server/routes/projectWageDeterminations.ts`
- Modify: `src/server/index.ts`
- Create: `tests/routes/projectWageDeterminations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/routes/projectWageDeterminations.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/server/index.js';
import { upsertWageDetermination } from '../../src/server/services/wageCache.js';

async function registerUser(email: string) {
  const res = await supertest(app).post('/api/auth/register').send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'] as string[] | string;
  return Array.isArray(cookies) ? cookies.join('; ') : cookies;
}

async function createProject(cookie: string) {
  const res = await supertest(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({
      name: 'WD Pin Test',
      state: 'CA',
      county: 'Los Angeles',
      contractType: 'federal-davis-bacon',
      awardDate: '2025-01-01',
      fundingType: 'federal',
    });
  return res.body.data.project.id as string;
}

function seedWd() {
  const now = new Date();
  const id = crypto.randomUUID();
  upsertWageDetermination({
    id,
    source: 'federal-dol',
    wdNumber: `CA2025PIN${Date.now()}`,
    revisionNumber: 0,
    state: 'CA',
    county: 'Los Angeles',
    constructionType: 'Building',
    publishDate: '2025-01-01',
    rawDocument: null,
    cachedAt: now.toISOString(),
    cacheExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  return id;
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

describe('project wage-determinations routes', () => {
  it('POST /api/projects/:id/wage-determinations pins a WD', async () => {
    const cookie = await registerUser(`wd-pin-${Date.now()}@test.com`);
    const projectId = await createProject(cookie);
    const wdId = seedWd();
    const res = await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    expect(res.status).toBe(201);
  });

  it('GET /api/projects/:id/wage-determinations lists pinned WDs', async () => {
    const cookie = await registerUser(`wd-list-${Date.now()}@test.com`);
    const projectId = await createProject(cookie);
    const wdId = seedWd();
    await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    const res = await supertest(app)
      .get(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.pins)).toBe(true);
    expect(res.body.pins).toHaveLength(1);
    expect(res.body.pins[0].wageDeterminationId).toBe(wdId);
  });

  it('POST duplicate pin returns 409', async () => {
    const cookie = await registerUser(`wd-dup-${Date.now()}@test.com`);
    const projectId = await createProject(cookie);
    const wdId = seedWd();
    await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    const res = await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    expect(res.status).toBe(409);
  });

  it('DELETE /api/projects/:id/wage-determinations/:wdId unpins', async () => {
    const cookie = await registerUser(`wd-del-${Date.now()}@test.com`);
    const projectId = await createProject(cookie);
    const wdId = seedWd();
    await supertest(app)
      .post(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie)
      .send({ wageDeterminationId: wdId, constructionType: 'Building' });
    const del = await supertest(app)
      .delete(`/api/projects/${projectId}/wage-determinations/${wdId}`)
      .set('Cookie', cookie);
    expect(del.status).toBe(200);
    const list = await supertest(app)
      .get(`/api/projects/${projectId}/wage-determinations`)
      .set('Cookie', cookie);
    expect(list.body.pins).toHaveLength(0);
  });

  it('PATCH /api/projects/:id/wage-determinations/:wdId sets primary', async () => {
    const cookie = await registerUser(`wd-patch-${Date.now()}@test.com`);
    const projectId = await createProject(cookie);
    const wdId1 = seedWd();
    const wdId2 = seedWd();
    await supertest(app).post(`/api/projects/${projectId}/wage-determinations`).set('Cookie', cookie).send({ wageDeterminationId: wdId1, constructionType: 'Building' });
    await supertest(app).post(`/api/projects/${projectId}/wage-determinations`).set('Cookie', cookie).send({ wageDeterminationId: wdId2, constructionType: 'Highway' });
    const patch = await supertest(app)
      .patch(`/api/projects/${projectId}/wage-determinations/${wdId1}`)
      .set('Cookie', cookie)
      .send({ isPrimary: true });
    expect(patch.status).toBe(200);
    const list = await supertest(app).get(`/api/projects/${projectId}/wage-determinations`).set('Cookie', cookie);
    const primary = list.body.pins.find((p: any) => p.wageDeterminationId === wdId1);
    expect(primary.isPrimary).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/projects/any/wage-determinations');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run tests/routes/projectWageDeterminations.test.ts 2>&1 | tail -10
```

Expected: FAIL — routes don't exist.

- [ ] **Step 3: Create `src/server/routes/projectWageDeterminations.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { getDb } from '../db/index.js';
import {
  getPinnedWdsForProject,
  pinWdToProject,
  unpinWdFromProject,
  setPrimaryWd,
} from '../services/wageCache.js';

export const projectWdRouter = Router({ mergeParams: true });

projectWdRouter.use(requireAuth);

const PinBodySchema = z.object({
  wageDeterminationId: z.string().min(1),
  constructionType: z.enum(['Building', 'Heavy', 'Highway', 'Residential']).nullable().optional(),
});

// GET /api/projects/:projectId/wage-determinations
projectWdRouter.get('/', async (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const { projectId } = req.params as { projectId: string };
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 403).json({ error: err.message ?? 'Access denied' });
    return;
  }
  const pins = getPinnedWdsForProject(projectId);
  res.json({ pins });
});

// POST /api/projects/:projectId/wage-determinations
projectWdRouter.post('/', async (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const { projectId } = req.params as { projectId: string };
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 403).json({ error: err.message ?? 'Access denied' });
    return;
  }
  const parsed = PinBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', issues: parsed.error.issues });
    return;
  }
  try {
    pinWdToProject(projectId, parsed.data.wageDeterminationId, parsed.data.constructionType ?? null, userId);
    res.status(201).json({ ok: true });
  } catch {
    res.status(409).json({ error: 'This WD is already pinned to the project' });
  }
});

// DELETE /api/projects/:projectId/wage-determinations/:wdId
projectWdRouter.delete('/:wdId', async (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const { projectId, wdId } = req.params as { projectId: string; wdId: string };
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 403).json({ error: err.message ?? 'Access denied' });
    return;
  }
  unpinWdFromProject(projectId, wdId);
  res.json({ ok: true });
});

// PATCH /api/projects/:projectId/wage-determinations/:wdId
projectWdRouter.patch('/:wdId', async (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const { projectId, wdId } = req.params as { projectId: string; wdId: string };
  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 403).json({ error: err.message ?? 'Access denied' });
    return;
  }
  if (req.body?.isPrimary !== true) {
    res.status(400).json({ error: 'Only { isPrimary: true } is supported' });
    return;
  }
  setPrimaryWd(projectId, wdId);
  res.json({ ok: true });
});
```

- [ ] **Step 4: Mount in `src/server/index.ts`**

Add import:
```ts
import { projectWdRouter } from './routes/projectWageDeterminations.js';
```

Add mount (after other project routes):
```ts
app.use('/api/projects/:projectId/wage-determinations', projectWdRouter);
```

- [ ] **Step 5: Run tests**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run tests/routes/projectWageDeterminations.test.ts 2>&1 | tail -15
```

Expected: all PASS.

- [ ] **Step 6: Run full suite**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/server/routes/projectWageDeterminations.ts src/server/index.ts tests/routes/projectWageDeterminations.test.ts
git commit -m "feat: add project WD pin/unpin/set-primary routes"
```

---

### Task 6: `ProjectWageDeterminationsPanel.tsx` — new React component

**Files:**
- Create: `src/client/components/ProjectWageDeterminationsPanel.tsx`

- [ ] **Step 1: Read the project detail page to understand where this will be inserted**

Read `src/client/pages/ProjectDetailPage.tsx` lines 715–945 to see the bottom of the JSX and where to embed the panel.

- [ ] **Step 2: Create `src/client/components/ProjectWageDeterminationsPanel.tsx`**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface PinnedWd {
  wageDeterminationId: string;
  constructionType: string | null;
  isPrimary: boolean;
  pinnedAt: string;
}

interface Props {
  projectId: string;
  projectState: string;
  projectCounty: string;
}

async function fetchPins(projectId: string): Promise<{ pins: PinnedWd[] }> {
  const res = await fetch(`/api/projects/${projectId}/wage-determinations`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load pinned WDs');
  return res.json();
}

export function ProjectWageDeterminationsPanel({ projectId, projectState, projectCounty }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ['project-wds', projectId];

  const { data, isLoading, error } = useQuery<{ pins: PinnedWd[] }, Error>({
    queryKey,
    queryFn: () => fetchPins(projectId),
  });

  const unpin = useMutation({
    mutationFn: (wdId: string) =>
      fetch(`/api/projects/${projectId}/wage-determinations/${wdId}`, {
        method: 'DELETE',
        credentials: 'include',
      }).then((r) => { if (!r.ok) throw new Error('Unpin failed'); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const setPrimary = useMutation({
    mutationFn: (wdId: string) =>
      fetch(`/api/projects/${projectId}/wage-determinations/${wdId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true }),
      }).then((r) => { if (!r.ok) throw new Error('Set primary failed'); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const wageLookupUrl = `/wages?state=${projectState}&county=${encodeURIComponent(projectCounty)}`;

  if (isLoading) return <div className="text-sm text-gray-500 mt-4">Loading wage determinations…</div>;
  if (error) return <div className="text-sm text-red-600 mt-4">Failed to load pinned WDs.</div>;

  const pins = data?.pins ?? [];

  return (
    <Card className="mt-4" padding="default">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Wage Determinations</h3>
        <a
          href={wageLookupUrl}
          className="text-xs text-blue-600 hover:underline"
        >
          + Add WD
        </a>
      </div>

      {pins.length === 0 ? (
        <p className="text-sm text-gray-500">
          No wage determinations pinned.{' '}
          <a href={wageLookupUrl} className="text-blue-600 hover:underline">Look one up</a>.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="pb-1 font-medium">WD ID</th>
              <th className="pb-1 font-medium">Construction Type</th>
              <th className="pb-1 font-medium">Primary</th>
              <th className="pb-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {pins.map((pin) => (
              <tr key={pin.wageDeterminationId} className="border-b last:border-0">
                <td className="py-2 font-mono text-xs text-gray-800">{pin.wageDeterminationId}</td>
                <td className="py-2 text-gray-700">{pin.constructionType ?? '—'}</td>
                <td className="py-2">
                  {pin.isPrimary ? (
                    <Badge variant="success">Primary</Badge>
                  ) : (
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setPrimary.mutate(pin.wageDeterminationId)}
                      disabled={setPrimary.isPending}
                    >
                      Set primary
                    </button>
                  )}
                </td>
                <td className="py-2 text-right">
                  <button
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => unpin.mutate(pin.wageDeterminationId)}
                    disabled={unpin.isPending}
                  >
                    Unpin
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Add panel to `ProjectDetailPage.tsx`**

Import the panel at the top of `ProjectDetailPage.tsx`:

```tsx
import { ProjectWageDeterminationsPanel } from '../components/ProjectWageDeterminationsPanel';
```

Find the closing section around line 943–945 (just before `</Layout>`). Add the panel after the last `</Card>`:

```tsx
<ProjectWageDeterminationsPanel
  projectId={id!}
  projectState={project.state}
  projectCounty={project.county}
/>
```

- [ ] **Step 4: TypeScript check**

```bash
cd C:/Users/glcar/prevailing-wage
npx tsc --noEmit 2>&1 | grep -v "otScenarios\|OtScenario" | head -20
```

Fix any errors.

- [ ] **Step 5: Run full test suite**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/client/components/ProjectWageDeterminationsPanel.tsx src/client/pages/ProjectDetailPage.tsx
git commit -m "feat: add ProjectWageDeterminationsPanel to project detail page"
```

---

### Task 7: `WageLookupPage.tsx` — construction type, multi-card, fetch-by-WD-number, pin modal

**Files:**
- Modify: `src/client/pages/WageLookupPage.tsx`

- [ ] **Step 1: Read the full current `WageLookupPage.tsx`**

Read the complete file to understand its current structure before modifying.

- [ ] **Step 2: Replace `WageLookupPage.tsx` with extended version**

The extended page must:
1. Add "Construction Type" optional dropdown (Building / Heavy / Highway / Residential) to the search form
2. Render results as a card list (since lookup now returns `{ wds, classifications }` array)
3. Each card has WD number, construction type, county, publish date, revision number, and a "Pin to Project" button
4. "Fetch by WD Number" section — text input + button, calls `GET /api/wages/fetch?wdNumber=...`
5. "Pin to Project" opens an inline dropdown to select which project, then calls `POST /api/projects/:id/wage-determinations`

Key changes to the `fetchWageLookup` function — update to handle new array response:

```ts
interface LookupResult {
  wds: WageDetermination[];
  classifications: WageClassification[][];
}

async function fetchWageLookup(state: string, county: string, constructionType?: string): Promise<LookupResult> {
  const params = new URLSearchParams({ state, county });
  if (constructionType) params.set('constructionType', constructionType);
  const res = await fetch(`/api/wages/lookup?${params}`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Lookup failed' }));
    const e = new Error(err.error ?? 'Lookup failed') as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  return res.json() as Promise<LookupResult>;
}

async function fetchByWdNumber(wdNumber: string): Promise<{ wd: WageDetermination; classifications: WageClassification[] }> {
  const res = await fetch(`/api/wages/fetch?wdNumber=${encodeURIComponent(wdNumber)}`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Not found' }));
    const e = new Error(err.error ?? 'Not found') as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  return res.json();
}
```

Add a `WdCard` sub-component that renders one WD result card with Pin button:

```tsx
interface WdCardProps {
  wd: WageDetermination;
  classifications: WageClassification[];
}

function WdCard({ wd, classifications }: WdCardProps) {
  const [pinProjectId, setPinProjectId] = useState('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  // Fetch user's projects for the pin dropdown
  const { data: projectsData } = useQuery<{ data: { projects: { id: string; name: string }[] } }>({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects', { credentials: 'include' }).then((r) => r.json()),
  });
  const projects = projectsData?.data?.projects ?? [];

  const handlePin = async () => {
    if (!pinProjectId) return;
    setPinStatus('loading');
    try {
      const res = await fetch(`/api/projects/${pinProjectId}/wage-determinations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wageDeterminationId: wd.id, constructionType: wd.constructionType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Pin failed');
      }
      setPinStatus('done');
    } catch {
      setPinStatus('error');
    }
  };

  return (
    <div className="border rounded-lg p-4 mb-3 bg-white shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-gray-900">{wd.wdNumber}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {wd.constructionType ?? 'All types'} · {wd.county ?? 'Statewide'} · Rev {wd.revisionNumber} · {wd.publishDate ?? 'Unknown date'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <select
              className="text-xs border rounded px-2 py-1"
              value={pinProjectId}
              onChange={(e) => { setPinProjectId(e.target.value); setPinStatus('idle'); }}
            >
              <option value="">Pin to project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {pinProjectId && pinStatus !== 'done' && (
            <Button size="sm" onClick={handlePin} disabled={pinStatus === 'loading'}>
              {pinStatus === 'loading' ? 'Pinning…' : 'Pin'}
            </Button>
          )}
          {pinStatus === 'done' && <span className="text-xs text-green-600">Pinned ✓</span>}
          {pinStatus === 'error' && <span className="text-xs text-red-600">Error</span>}
        </div>
      </div>
      {classifications.length > 0 && (
        <div className="mt-2">
          <WageClassificationsTable classifications={classifications} />
        </div>
      )}
    </div>
  );
}
```

Update the main `WageLookupPage` component to use the new shape: render `data.wds.map((wd, i) => <WdCard key={wd.id} wd={wd} classifications={data.classifications[i] ?? []} />)` instead of the current single result.

Add the "Fetch by WD Number" section as a second `<form>` below the state/county search form, using `fetchByWdNumber` in a separate `useQuery`.

- [ ] **Step 3: TypeScript check**

```bash
cd C:/Users/glcar/prevailing-wage
npx tsc --noEmit 2>&1 | grep -v "otScenarios\|OtScenario" | head -20
```

Fix all errors.

- [ ] **Step 4: Run full test suite**

```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run 2>&1 | tail -10
```

Expected: 643+ passing, max 2 pre-existing failures.

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/WageLookupPage.tsx
git commit -m "feat: extend WageLookupPage with construction type filter, multi-card results, fetch-by-WD-number, and pin-to-project"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Migration + schema: Task 1
- ✅ `fetchAndCacheByWdNumber`: Task 3
- ✅ `pinWdToProject / unpinWdFromProject / setPrimaryWd / getPinnedWdsForProject`: Task 2
- ✅ Proactive refresh in nightly sync: Task 4
- ✅ `GET /api/wages/fetch`: Task 3
- ✅ Extended `GET /api/wages/lookup` (constructionType, array response): Task 3
- ✅ `/api/projects/:id/wage-determinations` CRUD: Task 5
- ✅ `ProjectWageDeterminationsPanel`: Task 6
- ✅ Extended `WageLookupPage`: Task 7

**Placeholder scan:** None found.

**Type consistency:**
- `PinnedWdRow` defined in Task 2 (wageCache.ts), used in Task 5 (route) and Task 6 (panel) — consistent.
- `WageDetermination` type from `shared/types.ts` used throughout — unchanged.
- `projectWdRouter` exported from Task 5, imported in `index.ts` — consistent.
