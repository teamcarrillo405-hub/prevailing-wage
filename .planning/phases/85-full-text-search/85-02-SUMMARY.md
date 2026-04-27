---
phase: 85
plan: "02"
subsystem: search
tags: [fts5, useDebounce, react-hook, WorkersPage, DashboardPage, tanstack-query]
dependency_graph:
  requires: [85-01]
  provides: [useDebounce hook, WorkersPage FTS5 search UI]
  affects: [src/client/hooks/useDebounce.ts, src/client/pages/WorkersPage.tsx]
tech_stack:
  added: []
  patterns: [useDebounce generic React hook, TanStack Query enabled-gate pattern, displayedWorkers switching pattern]
key_files:
  created:
    - src/client/hooks/useDebounce.ts
  modified:
    - src/client/pages/WorkersPage.tsx
  verified_unchanged:
    - src/client/pages/DashboardPage.tsx
decisions:
  - useDebounce initialized with value (not undefined) so first render returns correct initial value without debounce penalty
  - displayedWorkers switches between search hits and labor-filter-respecting full list (fullWorkers = workers, post-filter)
  - Search input uses type="search" for native browser clear-x button — clearing input sets searchQuery='', disables search query, restores full list automatically
  - Empty state guard updated to only show "No workers match filter" when not searching (prevents false "no match" message during search)
  - DashboardPage verified code-free — filteredProjects useMemo at lines 300-313 meets Phase 85 success criterion 4 by pre-existing Phase 18 implementation
metrics:
  duration: "3 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 2
  files_changed: 2
---

# Phase 85 Plan 02: Debounced Workers Search UI Summary

**One-liner:** Generic `useDebounce<T>` React hook + WorkersPage search input with 200ms debounce calling FTS5 endpoint, displayedWorkers switching between search hits and full list; DashboardPage filter verified unchanged.

---

## Artifacts Produced

### New Hook: `src/client/hooks/useDebounce.ts`

```typescript
export function useDebounce<T>(value: T, delayMs: number): T
```

- Generic: works with any state type
- `useState<T>` initialized with `value` — first render returns initial value immediately (no debounce penalty on mount)
- `clearTimeout` cleanup on every effect re-run — cancels stale pending timers when `value` changes mid-type
- Dependencies `[value, delayMs]` — re-arms correctly if delay is ever changed by parent
- No external dependencies

### Modified: `src/client/pages/WorkersPage.tsx`

**Additions:**

1. Import: `import { useDebounce } from '../hooks/useDebounce'`

2. Search state + debounced query (after existing queries):
   - `const [searchQuery, setSearchQuery] = useState('')`
   - `const debouncedQuery = useDebounce(searchQuery, 200)` — 200ms locked to PERF-02 spec
   - `WorkerSearchHit` type matching 85-01 slim shape: `{ worker_id, name, trade_union }`
   - TanStack `useQuery` with `queryKey: ['workers-search', projectId, debouncedQuery]`
   - `enabled: !!projectId && debouncedQuery.trim().length > 0` — no empty requests
   - `staleTime: 30_000` — 30s cache reduces flicker on repeated prefix searches

3. `displayedWorkers` switch:
   - `isSearching = debouncedQuery.trim().length > 0`
   - `fullWorkers = workers` (the existing labor-filter-respecting list)
   - `searchHits` re-shaped to `Worker` interface (nulls for missing fields; finds full record if in-memory match exists)
   - `displayedWorkers = isSearching ? reshapedHits : fullWorkers`
   - JSX uses `displayedWorkers.map((w) => ...)` — zero change to card/row rendering

4. Search input above worker list (only shown when `allWorkers.length > 0`):
   - `<input type="search">` with `sr-only` label for accessibility
   - Token classes only: `border-border-default`, `bg-surface-card`, `text-foreground`, `placeholder:text-text-muted`, `focus:ring-brand-gold`
   - Inline "Searching..." and "No workers match..." feedback states

### Verified Unchanged: `src/client/pages/DashboardPage.tsx`

**Phase 85 success criterion 4 confirmed met by pre-existing Phase 18 code:**

- `searchQuery` reads from URL search params at line 72
- `filteredProjects` useMemo at lines 300-313 filters by name + funding + compliance
- Search input bound via `handleSearchChange` updating URL params (lines 315-327)
- Rendered list iterates `filteredProjects` at lines 635-647

Grep count: `grep -c "filteredProjects" src/client/pages/DashboardPage.tsx` → **4** (>= 3 required)
Git diff: `git diff --stat HEAD -- src/client/pages/DashboardPage.tsx` → **empty** (zero changed lines)

---

## Test Results

- `npx vitest run tests/routes/workers.test.ts` — **25/25 pass** (Wave 1 server regression: zero)
- `npx vitest run` (full suite) — **734 tests pass, 56 test files pass, 7 skipped** (no regressions)
- `npx tsc --noEmit` — **1 pre-existing error** in `src/server/services/stripeService.ts` (Stripe API version string mismatch, unrelated to this plan; confirmed pre-existing before any changes)

---

## Deviations from Plan

None. Plan executed exactly as written.

---

## Known Stubs

None. Data flows end-to-end:
- User types in search input → `searchQuery` state updates
- `useDebounce` delays 200ms → `debouncedQuery` updates
- TanStack query fires `GET /api/projects/:id/workers/search?q=` → FTS5 hits returned
- `displayedWorkers` switches to search hits → rendered list updates
- User clears input → `searchQuery=''` → `debouncedQuery=''` → `enabled=false` → `displayedWorkers=fullWorkers`

---

## Manual UAT (Deferred to Phase 85 verify-work step)

Per 85-VALIDATION.md "Manual-Only Verifications":
1. Type in WorkersPage search → results appear after ~200ms (not every keystroke)
2. Clear input → full worker list restored without reload
3. DashboardPage search input → projects filter in real time (client-side, no network call)
4. Cross-browser: native clear-x button in search input clears and restores list

---

## Self-Check: PASSED

- `src/client/hooks/useDebounce.ts` — FOUND
- `src/client/pages/WorkersPage.tsx` — FOUND, contains useDebounce(searchQuery, 200), workers-search, displayedWorkers (x3), encodeURIComponent(debouncedQuery), debouncedQuery.trim().length > 0
- `src/client/pages/DashboardPage.tsx` — VERIFIED UNCHANGED (git diff empty)
- Commit `8e4bd5e` (Task 1: useDebounce + WorkersPage) — FOUND
- 734/734 tests pass
