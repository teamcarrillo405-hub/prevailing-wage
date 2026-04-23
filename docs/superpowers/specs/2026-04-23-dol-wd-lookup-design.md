# DOL Wage Determination Live Lookup — Design Spec

**Date:** 2026-04-23  
**Status:** Approved  

---

## Goal

Enable live DOL wage determination lookup via SAM.gov — both auto-discovery by state/county/construction type and direct lookup by WD number — with project-pinned WDs and proactive cache refresh for active projects.

## Architecture

Build on the existing proven foundation (`wdolFetcher`, `wageCache`, `wdolSync`, `WageLookupPage`). The SAM.gov direct fetch (`fetchWdFromSamGov`) is reliable; the gap is discovery and project association. This design fills both gaps without touching the working fetch/parse pipeline.

**Tech Stack:** SQLite/Drizzle ORM, Express, React/React Query, SAM.gov WDOL v1 API (no auth required)

---

## Section 1: Data Model

### New table: `projectWageDeterminations`

Links a project to one or more pinned WDs. One row per WD per project.

```sql
CREATE TABLE project_wage_determinations (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  wage_determination_id TEXT NOT NULL REFERENCES wage_determinations(id) ON DELETE CASCADE,
  construction_type     TEXT CHECK(construction_type IN ('Building','Heavy','Highway','Residential')),
  is_primary            INTEGER NOT NULL DEFAULT 0,
  pinned_at             TEXT NOT NULL,
  pinned_by_user_id     TEXT REFERENCES users(id)
);
CREATE UNIQUE INDEX idx_proj_wd_unique ON project_wage_determinations(project_id, wage_determination_id);
```

`isPrimary` marks which WD is used for compliance checks when multiple WDs are pinned. Setting a new primary atomically clears `is_primary` on all other rows for the same project.

### Modified table: `wageDeterminations`

Add one new column (migration):
- `last_fetched_at TEXT` — timestamp of the last successful SAM.gov API fetch, distinct from `cached_at`. Used by the proactive refresh logic to avoid redundant fetches.

(`is_active` already exists per the `wages.ts` coverage query — confirm before migration.)

---

## Section 2: Backend Services

### `wageLookup.ts` — new export

```ts
fetchAndCacheByWdNumber(wdNumber: string): Promise<WageDetermination | null>
```

Calls `fetchWdFromSamGov(wdNumber, 0)`, parses via `parseWdDocument`, upserts into `wageDeterminations` + `wageClassifications`, sets `lastFetchedAt`. Returns `WageDetermination | null`. This is the escape-hatch for direct WD number lookup.

### `wdolSync.ts` — proactive refresh upgrade

The nightly cron (currently monthly seed-list sync) gains a second phase:

1. **Proactive refresh** — query `projectWageDeterminations JOIN projects` where `projects.status = 'active'`, collect all linked WD ids, re-fetch any whose `cacheExpiresAt < now + 48h` (48h early window for active projects).
2. **Seed list expansion** — expand `WD_SEED_LIST` to cover all 50 states with their most common county-level WD numbers (sourced from SAM.gov WDOL cross-index).
3. Lazy refresh (existing behavior) — all non-project WDs refresh on next user request only.

### `wageCache.ts` — new functions

```ts
getPinnedWdsForProject(projectId: string): Promise<WageDetermination[]>
pinWdToProject(projectId: string, wageDeterminationId: string, constructionType: string | null, userId: string): Promise<void>
unpinWdFromProject(projectId: string, wageDeterminationId: string): Promise<void>
setPrimaryWd(projectId: string, wageDeterminationId: string): Promise<void>  // atomically clears other isPrimary rows
```

---

## Section 3: API Routes

### Extended: `GET /api/wages/lookup`

Add optional `constructionType` query param (`Building | Heavy | Highway | Residential`). When provided, filter seed-list results to matching construction type. Response changes from single WD to array:

```json
{ "wds": [WageDetermination], "classifications": [[WageClassification]] }
```

Existing single-WD callers continue to work (first element).

### New: `GET /api/wages/fetch?wdNumber=CA20250001`

Direct WD number lookup. Cache-first: if cached and not stale, return immediately. Otherwise call `fetchAndCacheByWdNumber`. Returns `{ wd, classifications }` or 404. No auth required (read-only public data).

### New: `/api/projects/:projectId/wage-determinations`

All four endpoints require auth + project membership:

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/projects/:projectId/wage-determinations` | List pinned WDs with `isPrimary` flag |
| `POST` | `/api/projects/:projectId/wage-determinations` | Pin a WD `{ wageDeterminationId, constructionType }` |
| `DELETE` | `/api/projects/:projectId/wage-determinations/:wdId` | Unpin |
| `PATCH` | `/api/projects/:projectId/wage-determinations/:wdId` | `{ isPrimary: true }` — set primary (atomically clears others) |

---

## Section 4: UI

### `WageLookupPage.tsx` *(extend)*

- Add "Construction Type" dropdown (optional) to the search form
- Results render as a card list when multiple WDs match — each card: WD number, construction type, county, publish date, revision number
- "Pin to Project" button per card — opens modal with dropdown of user's active projects; calls `POST /api/projects/:id/wage-determinations`
- "Fetch by WD Number" section below search — text input + Fetch button, calls `GET /api/wages/fetch?wdNumber=...`, renders result as a single card with same Pin button

### New: `ProjectWageDeterminationsPanel.tsx`

Table component embedded in the project detail page:

| WD Number | Construction Type | Publish Date | Primary | Actions |
|-----------|------------------|--------------|---------|---------|
| CA20250001 | Building | 2025-01-24 | ★ | Unpin |
| CA20250002 | Highway | 2025-01-24 |   | Set Primary · Unpin |

- "Add WD" button → links to `WageLookupPage` pre-filtered to `?state=XX&county=...` for this project's location
- "Set as Primary" calls `PATCH /api/projects/:id/wage-determinations/:wdId`
- "Unpin" calls `DELETE`

### Project detail page *(minor)*

Add `ProjectWageDeterminationsPanel` below the existing project info section.

---

## Error Handling

- `fetchAndCacheByWdNumber` returns `null` on SAM.gov failure — route returns 404, UI shows "WD not found on SAM.gov. Enter rates manually." and links to `ManualWageEntryForm`
- Pin conflicts (same WD already pinned) — 409 with clear message
- Unpin of the primary WD — allowed; `isPrimary` clears, compliance checker falls back to most-recently-pinned WD

---

## Testing

- Unit: `fetchAndCacheByWdNumber` with mocked `fetchWdFromSamGov` — cache hit, cache miss, SAM.gov failure
- Unit: `setPrimaryWd` atomicity — verify only one `isPrimary=1` per project after multiple calls
- Route: `GET /api/wages/fetch` — cached hit, live fetch, 404
- Route: `POST /api/projects/:id/wage-determinations` — pin, duplicate pin (409), unpin, set primary
- UI: no UI tests (manual QA of WageLookupPage pin flow and ProjectWageDeterminationsPanel)

---

## Out of Scope

- SAM.gov search/index API (confirmed broken — all tested endpoints return 404)
- Automatic WD discovery without any user input (requires working search API)
- State-specific WD sources (CA DIR, WA L&I) — existing adapter pattern handles these separately
- WD rate history / audit trail of rate changes over time
