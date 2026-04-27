---
phase: 85
plan: "01"
subsystem: search
tags: [fts5, sqlite, workers, search, migration, triggers]
dependency_graph:
  requires: []
  provides: [workers_fts virtual table, GET /workers/search route]
  affects: [workers.ts routes, workers test suite]
tech_stack:
  added: []
  patterns: [FTS5 standalone virtual table, SQLite triggers for index sync, Drizzle sql template tag for raw FTS5 queries]
key_files:
  created:
    - src/server/db/migrations/0054_workers_fts.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/routes/workers.ts
    - tests/routes/workers.test.ts
decisions:
  - Use plain DELETE FROM workers_fts WHERE worker_id = old.id in triggers (not FTS5 delete idiom) — standalone FTS5 tables support WHERE-clause DELETE on UNINDEXED columns; the rowid delete idiom is for content tables only and fails in trigger context
  - Route registered at line 194 before first :workerId route at line 294 — prevents Express from treating "search" as workerId param
  - Sanitize input with replace(/[^a-zA-Z0-9 ]/g, '') + '*' prefix before FTS5 MATCH — guards against FTS5 syntax errors from parens, quotes, colons
  - assertProjectAccess called before FTS5 query — NFR-03 IDOR protection pattern
metrics:
  duration: "10 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 2
  files_changed: 4
---

# Phase 85 Plan 01: FTS5 Workers Full-Text Search Summary

**One-liner:** SQLite FTS5 standalone virtual table `workers_fts` with INSERT/UPDATE/DELETE trigger sync + authenticated `GET /workers/search?q=` route returning slim `{ worker_id, name, trade_union }` results.

---

## Artifacts Produced

### Migration: `src/server/db/migrations/0054_workers_fts.sql`
- Creates `workers_fts` FTS5 virtual table with columns: `worker_id UNINDEXED`, `project_id UNINDEXED`, `name`, `trade_union`
- Backfill INSERT from existing `workers` rows on first migration run
- `COALESCE(trade_union, '')` guards nullable column throughout

**Journal entry:** idx:54 / tag:`0054_workers_fts` / version:7 / breakpoints:true — registered after idx:53 (`0053_session_version_sam_gov`)

### Search Route: `src/server/routes/workers.ts`
- Route: `router.get('/:projectId/workers/search', ...)` — **line 194**
- First `/:workerId` route: line 294 (`router.put(...)`) — search is registered BEFORE all `:workerId` routes (route-ordering invariant satisfied)
- `sql` imported from `drizzle-orm` (added to existing `eq, and` import)

### Trigger Names and What Each Does

| Trigger | When | What |
|---------|------|------|
| `workers_fts_ai` | AFTER INSERT ON workers | Inserts new row into workers_fts |
| `workers_fts_au` | AFTER UPDATE ON workers | Deletes old FTS row (WHERE worker_id = old.id), inserts new row |
| `workers_fts_ad` | AFTER DELETE ON workers | Deletes FTS row WHERE worker_id = old.id |

### Tests Added: 9 (in `tests/routes/workers.test.ts` → `describe('GET /:projectId/workers/search')`)

1. Happy path: name match returns correct worker with trade_union
2. Project scoping: cross-project leakage impossible
3. Empty query (q='' and absent): returns `[]`, never hits FTS5 MATCH
4. FTS5-only-special-char query: sanitizes to empty, returns `[]` (no crash)
5. Unauthenticated: 401
6. Cross-tenant: 403 (assertProjectAccess fires before FTS5)
7. Route ordering: search handler resolves (not :workerId), returns array shape
8. UPDATE trigger sync: old name absent from results, new name present
9. DELETE trigger sync: deleted worker absent from results

**All 25 workers.test.ts tests pass.**

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FTS5 delete idiom does not work in trigger context for standalone tables**

- **Found during:** Task 2 (test 8 and 9 failures: UPDATE/DELETE triggers not removing stale FTS rows)
- **Issue:** The plan specified the FTS5 delete idiom: `INSERT INTO workers_fts(workers_fts, rowid, ...) VALUES('delete', old.rowid, ...)`. This is documented for content tables. For standalone FTS5 tables, the `rowid` in the FTS table is auto-assigned and does NOT correlate with `workers.rowid`. Additionally, a subquery `(SELECT rowid FROM workers_fts WHERE worker_id = old.id)` within the trigger fails with "SQL logic error" in `better-sqlite3` trigger context.
- **Fix:** Replace the FTS5 delete idiom with `DELETE FROM workers_fts WHERE worker_id = old.id` — SQLite FTS5 standalone tables support standard `DELETE ... WHERE` on UNINDEXED columns. Verified working in Node.js before migration was updated.
- **Files modified:** `src/server/db/migrations/0054_workers_fts.sql`
- **Commit:** `145a2d1` (included in Task 2 commit along with route and tests)

**2. [Rule 1 - Pre-existing test failures] `workerSex PUT` test was failing before this plan**

- **Found during:** Initial test run
- **Status:** Pre-existing failures in `MA worker demographics` and `workerSex` describe blocks. These failures were present before Phase 85 work. After the trigger fix, all 3 pre-existing failures also resolved (likely due to better test isolation with the corrected trigger not throwing errors that affected subsequent tests).

---

## Known Stubs

None. All data flows are wired end-to-end: workers write → triggers fire → FTS5 indexed → search route queries FTS5 → results returned.

---

## Open Follow-ups

1. **Performance benchmark (deferred to manual UAT):** Seed 500 workers, run `curl -w "%{time_total}\n"` against search endpoint — must be < 0.05s. Not a blocker for Wave 1 merge. Documented in 85-VALIDATION.md §"Manual-Only Verifications".
2. **Plan 85-02:** `WorkersPage.tsx` search input with `useDebounce` hook + DashboardPage filter verification (next plan in phase).

---

## Self-Check: PASSED

- `src/server/db/migrations/0054_workers_fts.sql` — FOUND
- `src/server/db/migrations/meta/_journal.json` — FOUND, idx:54 present
- `src/server/routes/workers.ts` — search route at line 194, before :workerId at line 294
- `tests/routes/workers.test.ts` — 9 search tests added, all passing
- Commit `c0e278f` (migration) — FOUND
- Commit `145a2d1` (route + tests) — FOUND
- 25/25 workers.test.ts tests pass
