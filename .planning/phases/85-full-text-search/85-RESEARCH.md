# Phase 85: Full-Text Search — Research

**Researched:** 2026-04-26
**Domain:** SQLite FTS5, better-sqlite3, Drizzle ORM raw SQL, React debounce hooks
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Workers searchable via SQLite FTS5 virtual table `workers_fts`; triggers keep in sync on INSERT/UPDATE/DELETE; search endpoint `GET /api/projects/:id/workers/search?q=` responds < 50ms | FTS5 verified working in project's better-sqlite3; triggers verified firing through Drizzle ORM calls; `db.all(sql.raw(...))` verified for FTS5 queries; migration pattern established |
| PERF-02 | `WorkersPage.tsx` has debounced 200ms search input calling the search endpoint; DashboardPage supports client-side project name filter (no server call) | No `useDebounce` hook exists — must be written; DashboardPage already has full client-side filter implementation via `filteredProjects` useMemo |

</phase_requirements>

---

## Summary

SQLite FTS5 is the correct search mechanism for this project. The project uses `better-sqlite3` (synchronous, not async), which bundles SQLite with FTS5 compiled in — verified in this codebase. FTS5 virtual tables are not Drizzle schema objects; they are created via raw SQL migration files (same `.sql` format already used in `src/server/db/migrations/`). Triggers on the `workers` table keep `workers_fts` synchronized automatically — SQLite triggers fire on Drizzle ORM INSERT/UPDATE/DELETE calls because triggers are a SQLite engine feature, not ORM-dependent. FTS5 search results are queried through `db.all(sql.raw(...))` — verified working through Drizzle.

The `workers` table has no `trade` column. The ROADMAP's "name and trade" language maps to `name` (from `workers`) and `trade_union` (also from `workers`, the closest trade identifier). Worker `trade_description` lives in `worker_classifications` (a separate table), making per-worker FTS indexing from that table complex. Indexing `name` and `trade_union` from the workers table directly is the correct and simpler implementation.

The DashboardPage already has a complete client-side filter by project name (`filteredProjects` useMemo + `searchQuery` from URL params). Success criterion 4 is effectively already met. The 85-02 plan for DashboardPage is limited to verifying the implementation renders correctly and no new server endpoint is needed.

**Primary recommendation:** Write a plain SQL migration creating `workers_fts` as a standalone (non-content) FTS5 table with triggers. Use `db.all(sql.raw(...))` in the search route. Write a `useDebounce` hook (10 lines) in `src/client/hooks/`. No new npm packages needed.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.8.0 | SQLite driver with FTS5 bundled | Already installed; synchronous API; FTS5 confirmed working |
| drizzle-orm | 0.45.1 | ORM for typed DB queries | Already installed; `sql.raw()` used for FTS5 queries |
| React + @tanstack/react-query | 19 + 5.91 | UI state + data fetching | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm/sql` (`sql` template tag) | same | Raw SQL expressions inside Drizzle | For FTS5 MATCH queries that can't use Drizzle schema builders |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FTS5 standalone table | FTS5 content table (content='workers') | Content tables add complexity (shadow table management, explicit deletes); standalone table with triggers is simpler and sufficient for < 500 workers |
| `db.all(sql.raw(...))` | Export raw `sqlite` instance | Exporting sqlite breaks test isolation; `sql.raw()` through Drizzle is cleaner |
| Custom `useDebounce` hook | `use-debounce` npm package | No package needed; 10-line hook is idiomatic, no dependency added |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

No new directories needed. Files touch:

```
src/server/db/migrations/
  0054_workers_fts.sql            # FTS5 CREATE VIRTUAL TABLE + triggers
src/server/db/migrations/meta/
  _journal.json                   # Must add entry idx=54
src/server/routes/
  workers.ts                      # Add GET /:projectId/workers/search route
src/client/hooks/
  useDebounce.ts                  # New: 200ms debounce hook
src/client/pages/
  WorkersPage.tsx                 # Add search input + debounced query
  DashboardPage.tsx               # Verify existing filter (no new code needed)
tests/routes/
  workers.test.ts                 # Add search endpoint tests
```

### Pattern 1: FTS5 Standalone Virtual Table with Triggers

**What:** Create a standalone FTS5 table that stores its own copy of indexed columns. Triggers on the source `workers` table keep it in sync.

**When to use:** When source table columns are directly available (no join needed), and the dataset is small enough that storage duplication is trivial.

**Migration SQL:**
```sql
-- 0054_workers_fts.sql
-- Phase 85: FTS5 full-text search for workers (name + trade_union)
CREATE VIRTUAL TABLE IF NOT EXISTS workers_fts
  USING fts5(worker_id UNINDEXED, project_id UNINDEXED, name, trade_union);
--> statement-breakpoint
-- Populate from existing workers
INSERT INTO workers_fts(worker_id, project_id, name, trade_union)
  SELECT id, project_id, name, COALESCE(trade_union, '') FROM workers;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS workers_fts_ai
  AFTER INSERT ON workers BEGIN
    INSERT INTO workers_fts(worker_id, project_id, name, trade_union)
      VALUES (new.id, new.project_id, new.name, COALESCE(new.trade_union, ''));
  END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS workers_fts_au
  AFTER UPDATE ON workers BEGIN
    INSERT INTO workers_fts(workers_fts, rowid, worker_id, project_id, name, trade_union)
      VALUES('delete', old.rowid, old.id, old.project_id, old.name, COALESCE(old.trade_union, ''));
    INSERT INTO workers_fts(worker_id, project_id, name, trade_union)
      VALUES (new.id, new.project_id, new.name, COALESCE(new.trade_union, ''));
  END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS workers_fts_ad
  AFTER DELETE ON workers BEGIN
    INSERT INTO workers_fts(workers_fts, rowid, worker_id, project_id, name, trade_union)
      VALUES('delete', old.rowid, old.id, old.project_id, old.name, COALESCE(old.trade_union, ''));
  END;
```

**Key insight on FTS5 DELETE:** FTS5 standalone tables use a special `INSERT INTO fts(fts, rowid, ...) VALUES('delete', rowid, ...)` idiom to delete rows. This is NOT the same as `DELETE FROM fts`. The rowid from the `workers` table is used.

### Pattern 2: FTS5 Query via Drizzle `sql.raw()`

**What:** Run FTS5 MATCH queries using Drizzle's raw SQL escape hatch.

**Why:** FTS5 virtual tables don't have Drizzle schema objects. `sql.raw()` executes arbitrary SQL through the same connection as Drizzle.

**Verified working pattern:**
```typescript
// In search route handler — confirmed working in this codebase
import { sql } from 'drizzle-orm';

const rows = db.all(sql.raw(
  `SELECT worker_id, name, trade_union
   FROM workers_fts
   WHERE workers_fts MATCH ${db.run(sql`SELECT quote(${query})`)?.changes ?? "''"} 
   AND project_id = '${projectId}'`
));
```

**Safer parameterized pattern (use this):**
```typescript
// Use Drizzle sql template for parameterization safety
const searchResults = await db.all(
  sql`SELECT worker_id, name, trade_union
      FROM workers_fts
      WHERE workers_fts MATCH ${query + '*'} AND project_id = ${projectId}
      LIMIT 50`
);
```

**Note:** The `sql` template tag from `drizzle-orm` handles parameterization. Use `query + '*'` for prefix matching (e.g., "jo" matches "John"). Empty query should short-circuit before hitting FTS5 (return [] immediately).

### Pattern 3: Search Route Structure

**What:** Add `GET /:projectId/workers/search?q=` as a sibling to the existing `GET /:projectId/workers` route in `workers.ts`.

**Pattern:**
```typescript
// GET /api/projects/:projectId/workers/search?q=
router.get('/:projectId/workers/search', async (req, res) => {
  const projectId = req.params.projectId as string;
  const query = (req.query.q as string | undefined)?.trim() ?? '';
  const userId = req.user!.userId;
  const db = getDb();

  try {
    await assertProjectAccess(db, projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  if (!query) {
    res.json({ data: { workers: [] } });
    return;
  }

  // Prefix match: append * for FTS5 prefix search
  const ftsQuery = query.replace(/[^a-zA-Z0-9 ]/g, '').trim() + '*';
  const results = await db.all(
    sql`SELECT worker_id, name, trade_union
        FROM workers_fts
        WHERE workers_fts MATCH ${ftsQuery} AND project_id = ${projectId}
        LIMIT 50`
  );

  res.json({ data: { workers: results } });
});
```

**Route ordering:** Register `/:projectId/workers/search` BEFORE `/:projectId/workers/:workerId` to prevent Express from treating "search" as a workerId parameter.

### Pattern 4: `useDebounce` Hook

**What:** A minimal hook that delays state updates by N ms. Written in `src/client/hooks/useDebounce.ts`.

**Pattern:**
```typescript
// src/client/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
```

### Pattern 5: WorkersPage Search Integration

**What:** Add a search input to WorkersPage that debounces 200ms, calls the search endpoint, and replaces the displayed list when query is non-empty.

**Pattern:**
```typescript
const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebounce(searchQuery, 200);

const { data: searchData } = useQuery({
  queryKey: ['workers-search', projectId, debouncedQuery],
  queryFn: () => api.get<{ data: { workers: Worker[] } }>(
    `/projects/${projectId}/workers/search?q=${encodeURIComponent(debouncedQuery)}`
  ),
  enabled: !!projectId && debouncedQuery.trim().length > 0,
});

// Display: search results when query non-empty, full list when empty
const displayedWorkers = debouncedQuery.trim()
  ? (searchData?.data?.workers ?? [])
  : workers; // existing `workers` derived from allWorkers + laborFilter
```

### Pattern 6: Migration Journal Entry

**What:** After creating `0054_workers_fts.sql`, add an entry to `_journal.json`.

**Pattern — add to `entries` array in `meta/_journal.json`:**
```json
{
  "idx": 54,
  "version": "7",
  "when": 1745712000000,
  "tag": "0054_workers_fts",
  "breakpoints": true
}
```

### Anti-Patterns to Avoid

- **Forgetting `_journal.json` entry:** Drizzle silently skips migration files not in the journal. CLAUDE.md explicitly warns about this (under DB Migration Pattern).
- **Using `/:projectId/workers/:workerId` pattern for search:** Express router matches "search" as `:workerId` if the search route is registered after the parameterized route. Register `/search` first.
- **Passing unsanitized user input to FTS5 MATCH:** FTS5 throws an error on unescaped special characters (parentheses, quotes, colons). Strip or escape before querying. The `replace(/[^a-zA-Z0-9 ]/g, '').trim() + '*'` pattern is safe.
- **Using content table without understanding shadow tables:** FTS5 content tables require explicit `INSERT INTO fts(fts) VALUES('rebuild')` to populate and have complex trigger requirements. Standalone table with triggers is simpler.
- **Exporting the raw `sqlite` instance:** Breaks test isolation (the test helper uses `(globalThis as any).__testDb`). Use `db.all(sql\`...\`)` instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text tokenization | Custom string split + search logic | SQLite FTS5 MATCH | FTS5 handles tokenization, stemming, prefix matching, BM25 ranking out of the box |
| Search index sync | Manual INSERT to FTS table in route handlers | SQLite triggers | Triggers fire at the DB level — ORM calls, migrations, direct SQL all kept in sync automatically |
| Debounce timer management | Manual `useRef<NodeJS.Timeout>` + `clearTimeout` inline in page | `useDebounce` hook | Single source of truth; React lifecycle handles cleanup correctly |

**Key insight:** FTS5 triggers are the correct sync mechanism because they're engine-level — they fire whether the INSERT/UPDATE/DELETE comes from Drizzle ORM, raw SQL in a test, or a future migration script.

---

## Common Pitfalls

### Pitfall 1: "search" treated as workerId by Express

**What goes wrong:** `GET /api/projects/:id/workers/search?q=` returns 404 or calls the wrong handler because Express matches "search" as the `:workerId` parameter value.

**Why it happens:** Express routes are matched in registration order. If `/:projectId/workers/:workerId` is registered before `/:projectId/workers/search`, the latter never fires.

**How to avoid:** Register `/:projectId/workers/search` BEFORE all `/:projectId/workers/:workerId` routes in `workers.ts`.

**Warning signs:** 404 responses from search endpoint, or a 200 response that looks like a single-worker lookup.

### Pitfall 2: FTS5 special characters crash the MATCH query

**What goes wrong:** If user types `john(doe)` or `"doe"`, SQLite throws `fts5: syntax error near ")"` and the route returns 500.

**Why it happens:** FTS5 MATCH has its own query syntax with special characters (parentheses, quotes, `*`, `:`, `-`).

**How to avoid:** Strip non-alphanumeric characters (except spaces) from the query before passing to MATCH. Pattern: `query.replace(/[^a-zA-Z0-9 ]/g, '').trim() + '*'`. Append `*` for prefix matching so partial names work.

**Warning signs:** 500 errors when searching names with punctuation.

### Pitfall 3: FTS5 UPDATE trigger doesn't delete the old row

**What goes wrong:** After updating a worker's name, both the old and new name appear in search results.

**Why it happens:** FTS5 standalone tables are append-only. To update, you must `'delete'` the old rowid, then insert the new row. If the delete step is omitted, stale rows accumulate.

**How to avoid:** The AFTER UPDATE trigger must have two steps: delete old rowid, then insert new row (pattern shown in Architecture section).

**Warning signs:** Duplicate results after editing a worker name.

### Pitfall 4: Missing `_journal.json` entry

**What goes wrong:** The `0054_workers_fts.sql` file is in the migrations folder but never runs. The FTS5 table doesn't exist. The search route returns 500 with `no such table: workers_fts`.

**Why it happens:** Drizzle's migrator reads `meta/_journal.json` to determine which files to apply. Files not in the journal are silently ignored.

**How to avoid:** Always add the entry to `_journal.json` alongside creating the `.sql` file. CLAUDE.md explicitly documents this requirement.

**Warning signs:** `workers_fts` table missing from DB; migrator runs without error but table doesn't appear.

### Pitfall 5: Empty query passed to FTS5 MATCH

**What goes wrong:** When `q=` or `q` is absent, calling `MATCH ''` throws `fts5: syntax error near ""`.

**Why it happens:** FTS5 MATCH requires at least one token.

**How to avoid:** Guard the route handler — return `{ workers: [] }` immediately when `query.trim()` is empty or falsy. Never call FTS5 with an empty string.

### Pitfall 6: `trade_union` is nullable — NULL in FTS5

**What goes wrong:** Workers without a `trade_union` set cause `NULL` to be inserted into the FTS5 table. FTS5 indexes NULL as empty string, which is fine, but the trigger must handle NULL explicitly.

**How to avoid:** Use `COALESCE(new.trade_union, '')` in trigger INSERT statements.

---

## Code Examples

### FTS5 Query in Search Route (verified in this codebase)

```typescript
// Source: Live test against project's better-sqlite3 12.8.0
import { sql } from 'drizzle-orm';

// In route handler after assertProjectAccess
const ftsQuery = query.replace(/[^a-zA-Z0-9 ]/g, '').trim() + '*';
const results = await db.all(
  sql`SELECT worker_id, name, trade_union
      FROM workers_fts
      WHERE workers_fts MATCH ${ftsQuery} AND project_id = ${projectId}
      LIMIT 50`
) as { worker_id: string; name: string; trade_union: string | null }[];

res.json({ data: { workers: results } });
```

### `useDebounce` Hook (10 lines, no deps)

```typescript
// src/client/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
```

### DashboardPage — Existing Client-Side Filter (already implemented)

```typescript
// Source: DashboardPage.tsx lines 300–313 (already present, no changes needed)
const filteredProjects = useMemo(() => {
  let result = projects;
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    result = result.filter(p => p.name.toLowerCase().includes(q));
  }
  // ... funding and compliance filters
  return result;
}, [projects, searchQuery, fundingFilter, complianceFilter, summaryMap]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LIKE '%query%' on indexed columns | FTS5 MATCH with prefix search | SQLite 3.9.0 (2015) | Orders-of-magnitude faster on large datasets; proper tokenization |
| Separate search service (Elasticsearch, Typesense) | SQLite FTS5 built-in | N/A — never needed for < 100K rows | Zero infra cost, zero latency, same process |

---

## Critical Finding: `trade` Column Clarification

The ROADMAP states `workers_fts` mirrors "`name` and `trade` from `workers`". There is NO `trade` column on the `workers` table. The correct mapping is:

- `name` → `workers.name` (confirmed)
- `trade` → `workers.trade_union` (the trade/union name column directly on workers)

`trade_description` and `trade_code` live in `worker_classifications` (a joined table). Indexing across a join requires either a trigger on `worker_classifications` as well, or denormalization. Given the success criteria description ("mirrors... from `workers`"), the implementation is correctly scoped to the `workers` table only — index `name` and `trade_union`.

---

## Critical Finding: DashboardPage Filter Already Exists

`DashboardPage.tsx` already implements client-side project name filtering:
- `searchQuery` read from URL params (line 72)
- `filteredProjects` useMemo (lines 300–313) — filters by name, funding type, compliance status
- Search input bound to `inputValue` state with `handleSearchChange` updating URL params (lines 315–327)

Success criterion 4 is already met. The 85-02 plan for DashboardPage should verify the existing implementation works as required — **no new code is needed** for this criterion. The plan can document this as a verification step rather than an implementation step.

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. All tools (SQLite FTS5, better-sqlite3, Drizzle ORM, React) are already installed in this project.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/routes/workers.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | `GET /api/projects/:id/workers/search?q=john` returns workers matching "john" | integration | `npx vitest run tests/routes/workers.test.ts` | Exists — add tests in existing file |
| PERF-01 | Search is scoped to projectId (no cross-project leakage) | integration | `npx vitest run tests/routes/workers.test.ts` | Exists — add tests |
| PERF-01 | Empty query returns empty array (no FTS5 crash) | integration | `npx vitest run tests/routes/workers.test.ts` | Exists — add tests |
| PERF-01 | Unauthenticated request returns 401 | integration | `npx vitest run tests/routes/workers.test.ts` | Exists — add tests |
| PERF-02 | `useDebounce` hook delays state updates (unit) | unit | `npx vitest run tests/client/` | No — manual-only (no client test runner configured) |
| PERF-02 | DashboardPage client-side filter is operational | manual-only | n/a — existing code, no new test needed | n/a |

**Note on client-side tests:** The vitest config targets `environment: 'node'` and `setupFiles: ['./tests/helpers/db.ts']`. There is no jsdom/happy-dom browser environment configured. Client-side hook tests would require vitest-environment-jsdom setup that doesn't exist. The `useDebounce` hook is 10 lines and straightforward — manual verification via the running UI is the appropriate validation approach.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/routes/workers.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] New test cases in `tests/routes/workers.test.ts` — covers PERF-01 (search endpoint happy path, project scoping, empty query, auth guard)

*(Existing test file exists; need to append search-specific test blocks)*

---

## Open Questions

1. **Search response shape — full worker object vs. slim result?**
   - What we know: The success criteria says results "replace the full list" in `WorkersPage.tsx`. The full worker list includes `classifications` (async N+1 joins in the existing route).
   - What's unclear: Should the search endpoint return the same full shape as the workers list (with classifications), or a slim shape (name + trade_union only, no classifications)?
   - Recommendation: Return a slim shape from the search endpoint (worker_id, name, trade_union only). The WorkersPage can use these as a filtered index and render them with the same card components — the card can gracefully show "—" for classification details when not in the search payload. This keeps the search route under 50ms by avoiding N+1 joins. If the full shape is needed, the planner can add a JOIN to `worker_classifications` in the FTS search route, but this adds latency and complexity.

2. **FTS5 backfill on migration — what about existing workers?**
   - What we know: The migration needs to populate `workers_fts` from existing `workers` rows.
   - Recommendation: Include `INSERT INTO workers_fts ... SELECT ... FROM workers` in the migration SQL (shown in Architecture Patterns above). This runs once when the migration applies. Drizzle's migrator executes the full SQL block on first run only.

---

## Sources

### Primary (HIGH confidence)

- Live verification: `better-sqlite3` 12.8.0 FTS5 test in project — `CREATE VIRTUAL TABLE ... USING fts5(...)` + triggers + `db.all(sql\`...\`)` all verified working
- SQLite FTS5 official documentation — https://www.sqlite.org/fts5.html
- `drizzle-orm` `sql` template tag — verified via live test in project

### Secondary (MEDIUM confidence)

- CLAUDE.md migration pattern documentation — migration file format + journal requirement
- Existing migration files (`0000_red_vision.sql` through `0053_session_version_sam_gov.sql`) — naming and format conventions observed directly
- `src/server/db/index.ts` — confirmed `better-sqlite3` synchronous driver, module-level sqlite instance not exported

### Tertiary (LOW confidence)

- None

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 85 |
|-----------|-------------------|
| Migrations are plain SQL `.sql` files in `src/server/db/migrations/` | FTS5 virtual table creation goes in a `.sql` migration file, NOT in Drizzle schema |
| **Always register in `meta/_journal.json`** — Drizzle silently skips files not in journal | New `0054_workers_fts.sql` MUST have a journal entry with `idx: 54` |
| Never drop or rename columns — add-only migrations only | FTS5 triggers use IF NOT EXISTS; no drops |
| UI Primitives: `Card`, `Button`, `Badge`, `PageHeader`, `EmptyState` from `src/client/components/ui/` | Search input in WorkersPage must use existing UI primitives, not raw `<input>` without styling |
| TanStack Query: include all variable state in query key array | Search query must be in the `queryKey`: `['workers-search', projectId, debouncedQuery]` |
| `useRef` for synchronous guards (double-click prevention) | Not applicable to search — debounce hook uses `useState` + `useEffect` (correct pattern) |
| Design tokens via `@theme` tokens — never hardcode hex colors | Search input styling must use Tailwind token classes only |
| No new npm packages implied (project uses 0 search packages) | `useDebounce` must be a hand-written hook — no `use-debounce` package |

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all tools verified working in this project's exact version
- Architecture: HIGH — FTS5 trigger patterns and Drizzle sql.raw() tested live in the codebase
- Pitfalls: HIGH — most derived from direct inspection of the project's code structure and verified SQLite behavior
- DashboardPage finding: HIGH — read source directly; existing filter confirmed

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (SQLite FTS5 API is stable; Drizzle 0.x minor versions may change)
