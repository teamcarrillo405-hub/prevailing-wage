# Phase 18: Dashboard Search + Filter — Research

**Researched:** 2026-03-23
**Domain:** React client-side filtering with URL-persisted state (react-router-dom v7 useSearchParams)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-03 | User can search projects by name on the dashboard with URL-persisted filter state | useSearchParams persists `q` param in URL; client-side `.filter()` on the fetched array |
| DASH-04 | User can filter projects by funding type on the dashboard | useSearchParams persists `funding` param; FUNDING_TYPE_LABELS already in ProjectCard — values are `federal`, `state`, `mixed` |
</phase_requirements>

---

## Summary

Phase 18 is a pure client-side feature. The full project list is already fetched by DashboardPage via TanStack Query. Search and funding type filter are applied as in-memory `.filter()` operations on the returned array — no new API endpoints or server changes are needed.

URL persistence is the only non-trivial requirement. React Router v7.13.1 (installed) ships `useSearchParams`, which reads and writes `?q=foo&funding=state` query parameters. This hook provides back-button survival for free: the browser restores the full URL on back-navigation, which re-initializes the hook's state from the URL, and the filter is re-applied automatically.

The empty state when no projects match the active filters reuses the existing `EmptyState` primitive with a message that reflects what the user searched for.

**Primary recommendation:** Implement everything in `DashboardPage.tsx`. Add `useSearchParams` for state, derive `filteredProjects` via `useMemo`, add a text input and a `<select>` dropdown below the existing archive toggle. One plan, one file change.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | 7.13.1 (installed) | `useSearchParams` for URL-persisted filter state | Already in stack; v7 re-exports everything from react-router |
| React `useMemo` | React 19 (installed) | Derive filtered list from raw query data + search params | Prevents re-filter on every render; standard pattern |
| TanStack Query | 5.91.0 (installed) | Data fetching — no change needed | Already fetches full project list |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useCallback` | React 19 | Stable handler refs for input onChange | Use only if profiling shows re-render issue — not required for this phase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useSearchParams` (URL state) | `useState` (component state) | `useState` is simpler but doesn't survive back-navigation — DASH-03 explicitly requires URL persistence |
| Client-side filter | Server-side filter (`?name=foo`) | Server filtering adds a round trip and bypasses TanStack Query cache; client filtering is instant and aligns with existing cache key pattern |

**No new packages needed.** Everything required is already installed.

---

## Architecture Patterns

### Recommended Project Structure

No new files needed. All changes are in:

```
src/client/pages/
└── DashboardPage.tsx     # add useSearchParams, search input, funding dropdown, filtered list
```

No new test files needed at the server level (no server changes). The `nyquist_validation` key is absent from `.planning/config.json`, so validation architecture is included below.

### Pattern 1: useSearchParams for URL-persisted filter state

**What:** Replace local `useState` for filter values with `useSearchParams`. Reading from the URL on mount means the back button restores state automatically.

**When to use:** Any time filter/search state needs to survive navigation away from and back to the page.

**Example:**
```typescript
// Source: react-router v7 — useSearchParams is a re-export from react-router core
import { useSearchParams } from 'react-router-dom';

const [searchParams, setSearchParams] = useSearchParams();
const searchQuery = searchParams.get('q') ?? '';
const fundingFilter = searchParams.get('funding') ?? '';

function handleSearch(value: string) {
  setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (value) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
    return next;
  });
}
```

**Critical:** Always use the functional form of `setSearchParams` (callback with `prev`) to avoid wiping existing params when updating a single param. Setting `q` must not clear `funding` and vice versa.

### Pattern 2: Client-side filter via useMemo

**What:** Derive `filteredProjects` from the TanStack Query data and the current search params using `useMemo`. Re-derives only when the raw list or the search params change.

**When to use:** When the full dataset is already in memory and filtering is fast (< 100 items for typical contractor).

**Example:**
```typescript
// No external source needed — standard React pattern
import { useMemo } from 'react';

const filteredProjects = useMemo(() => {
  let result = projects;
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    result = result.filter(p => p.name.toLowerCase().includes(q));
  }
  if (fundingFilter) {
    result = result.filter(p => p.fundingType === fundingFilter);
  }
  return result;
}, [projects, searchQuery, fundingFilter]);
```

### Pattern 3: Archive toggle coexists with search params

The existing `showArchived` state (`useState`) controls the TanStack Query key and API URL. This must be migrated to a search param too, or left as `useState` but kept in sync. The simplest approach: leave `showArchived` as `useState` (it drives the query fetch, not just display). Search and funding filter are applied post-fetch.

**Decision:** Keep `showArchived` as `useState`. It changes which data is fetched (different query key), while `q` and `funding` filter the already-fetched data. Mixing fetch-level and display-level state in one param source adds complexity without benefit.

### Pattern 4: Funding type dropdown values

The `fundingType` field on the Project interface is `'federal' | 'state' | 'mixed'`. These are the same values used in `FUNDING_TYPE_LABELS` in `ProjectCard.tsx`. The select dropdown options map directly:

```typescript
// Matches schema.ts fundingType enum
const FUNDING_OPTIONS = [
  { value: '', label: 'All Funding Types' },
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'mixed', label: 'Mixed' },
];
```

### Pattern 5: Empty state for filtered zero results

Use the existing `EmptyState` primitive. Message must distinguish "no projects exist" from "no projects match your filter":

```typescript
// When filteredProjects.length === 0 AND projects.length > 0
<EmptyState
  heading="No matching projects"
  message={`No projects match "${searchQuery}"${fundingFilter ? ` with funding type "${FUNDING_TYPE_LABELS[fundingFilter]}"` : ''}.`}
/>

// When projects.length === 0 (no projects at all — existing behavior preserved)
<EmptyState
  heading="No projects yet"
  message='Click "New Project" to create your first prevailing wage project.'
  action={<Button onClick={() => setShowForm(true)}>New Project</Button>}
/>
```

### Anti-Patterns to Avoid

- **Setting searchParams non-functionally:** `setSearchParams({ q: value })` wipes all other params. Always use the callback form.
- **Filtering inside the TanStack Query queryFn:** Puts filter logic at the network layer, bypasses cache, causes refetch on every keystroke.
- **Debouncing the search input:** The project list is small (single contractor, rarely > 50 projects). Debounce adds code complexity with no UX benefit. Filter on every keystroke.
- **Controlled input tied directly to searchParams string:** Reading `searchParams.get('q')` as the input value causes the input to lag on each keystroke because URL updates go through history. Use a local `useState` for the input value and sync to URL with a small delay OR use uncontrolled input with onChange — see pitfall section.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL state persistence | Custom URL parser / history manipulation | `useSearchParams` from react-router-dom | Router already owns history; hand-rolling breaks back button integration |
| Client-side text search | Fuzzy search, tokenizer | `String.includes()` | Project names are short; simple substring match is correct and fast enough |
| Funding type enum list | Fetching distinct values from API | Hardcoded from schema enum | `fundingType` is a closed enum in schema.ts — `federal`, `state`, `mixed` |

---

## Common Pitfalls

### Pitfall 1: Controlled input lag with useSearchParams

**What goes wrong:** If the text input's `value` prop is bound to `searchParams.get('q')`, every keystroke writes to the URL, which triggers a re-render cycle through the router, causing the input to feel sluggish or skip characters on fast typing.

**Why it happens:** `setSearchParams` is not synchronous with React's controlled input flow. The URL update triggers a history push, which is asynchronous relative to the React event loop.

**How to avoid:** Use a separate `useState` for the controlled input value. Sync to the URL on change (this is fine — the URL write is the side effect, the input state is the source of truth for display). Alternatively, use an uncontrolled input with `defaultValue` and update the URL from `onChange`.

```typescript
// Correct pattern
const [inputValue, setInputValue] = useState(() => searchParams.get('q') ?? '');

function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
  const val = e.target.value;
  setInputValue(val);
  setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (val) next.set('q', val); else next.delete('q');
    return next;
  });
}
```

**Initialize `inputValue`** from `searchParams.get('q')` so that on back-navigation, the input is pre-populated from the URL.

**Warning signs:** Input feels sticky, characters are dropped, cursor jumps to end.

### Pitfall 2: showArchived state interacts with query key

**What goes wrong:** The TanStack Query key is `['projects', showArchived ? 'all' : 'active']`. If `showArchived` is migrated to `useSearchParams`, the initialization from URL must happen synchronously — otherwise the first render fetches with the wrong key before the URL is read.

**How to avoid:** Keep `showArchived` as local `useState`. The archive toggle is a data-fetch concern; search/filter are display concerns. They are different layers.

### Pitfall 3: setSearchParams functional form omitted

**What goes wrong:** `setSearchParams({ funding: 'federal' })` replaces the entire search string — `q` is wiped.

**How to avoid:** Always use `setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('funding', value); return next; })`.

### Pitfall 4: Empty string param left in URL

**What goes wrong:** When the user clears the search box, `q=` remains in the URL as an empty param. This is ugly and could cause issues if consumers check for param presence.

**How to avoid:** In the update handler, call `next.delete('q')` when the value is empty or whitespace-only. Same for `funding` when "All Funding Types" is selected.

---

## Code Examples

### Full useSearchParams initialization pattern (back-nav safe)

```typescript
// Source: react-router v7 docs pattern (confirmed installed: 7.13.1)
const [searchParams, setSearchParams] = useSearchParams();

// These derive from URL on every render — back button restores them automatically
const searchQuery = searchParams.get('q') ?? '';
const fundingFilter = searchParams.get('funding') ?? '';

// Local input state initialized from URL for controlled input
const [inputValue, setInputValue] = useState(() => searchParams.get('q') ?? '');
```

### Funding select element (design-token compliant)

```tsx
<select
  value={fundingFilter}
  onChange={(e) => {
    const val = e.target.value;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('funding', val); else next.delete('funding');
      return next;
    });
  }}
  className="text-sm border border-border-default rounded-sm px-3 py-1.5 bg-surface-card text-text-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold"
>
  {FUNDING_OPTIONS.map(opt => (
    <option key={opt.value} value={opt.value}>{opt.label}</option>
  ))}
</select>
```

### Full filter row layout (matches existing archive toggle pattern)

```tsx
{/* Filter bar — below archive toggle, above project grid */}
<div className="flex flex-wrap items-center gap-3 mb-4">
  <input
    type="text"
    value={inputValue}
    onChange={handleSearchChange}
    placeholder="Search projects..."
    className="text-sm border border-border-default rounded-sm px-3 py-1.5 bg-surface-card text-text-primary placeholder:text-text-secondary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold w-56"
  />
  <select ...>
    {/* FUNDING_OPTIONS */}
  </select>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-router v5: `useHistory` + `location.search` manual parse | react-router v6+: `useSearchParams` hook (Web standard URLSearchParams) | v6.0 (2021) | No manual URL parsing; hook handles encode/decode |
| react-router v6 re-export from `react-router-dom` | react-router v7: `useSearchParams` lives in `react-router` core; `react-router-dom` re-exports it | v7.0 (2024) | Import from either package works; already installed as v7.13.1 |

**No deprecated patterns apply to this phase.**

---

## Open Questions

1. **Should the search input debounce before writing to URL?**
   - What we know: Project lists are small (single contractor, likely < 30 projects). No API call is triggered by the filter.
   - What's unclear: Nothing — debounce is not needed.
   - Recommendation: No debounce. Filter on every keystroke. Simpler code.

2. **Should showArchived migrate to useSearchParams?**
   - What we know: It controls the query key and which API endpoint is called. It is a data-fetch decision.
   - What's unclear: Whether DASH-03 "URL-persisted filter state" is intended to include the archive toggle.
   - Recommendation: Leave `showArchived` as `useState`. REQUIREMENTS.md says DASH-03 is "URL-persisted filter state" for the name search. The archive toggle was shipped in Phase 17 as a local toggle — do not change behavior. If ambiguous, keep scope minimal.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=verbose tests/routes/projects.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-03 | Search input filters project names by substring, state persisted in URL | manual (browser) | N/A — client-side filter, no server call | N/A |
| DASH-04 | Funding type select filters to matching projects, URL param `funding` set | manual (browser) | N/A — client-side filter, no server call | N/A |

**Note:** Both DASH-03 and DASH-04 are pure client-side filter operations. There is no new server route, no new API endpoint, no database query change. The existing `GET /api/projects` tests (tests/routes/projects.test.ts) cover all the server surface touched by this phase (none). Automated test coverage for client-side filtering would require a browser testing framework (Playwright, Cypress) which is not present in this stack. Browser checkpoint verification is the validation gate.

### Sampling Rate

- **Per task commit:** `npm test` (full suite — 188 tests, fast, no new tests added)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + browser checkpoint before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. No new test files needed. No new server-side routes to test.

---

## Sources

### Primary (HIGH confidence)

- Installed package: `node_modules/react-router-dom@7.13.1` — `useSearchParams` confirmed present in `react-router/dist/development/chunk-2YMDXNOJ.js` and `index.js`
- `src/client/pages/DashboardPage.tsx` — existing component structure, current state shape, archive toggle pattern
- `src/client/components/projects/ProjectCard.tsx` — `FUNDING_TYPE_LABELS`, `fundingType` values `federal|state|mixed`
- `src/server/routes/projects.ts` — `fundingType` enum confirmed as `federal|state|mixed`, no server changes needed
- `src/server/db/schema.ts` — `projects.fundingType` type confirmed
- `src/client/components/ui/EmptyState.tsx` — props: `heading`, `message`, `action`
- `src/client/components/ui/Button.tsx` — variant/size API confirmed
- `src/client/index.css` — design tokens: `border-default`, `surface-card`, `text-primary`, `text-secondary`, `brand-gold`
- `package.json` — React 19, TanStack Query 5.91.0, react-router-dom 7.13.1 confirmed

### Secondary (MEDIUM confidence)

- React Router v7 `useSearchParams` functional setter form (verified by reading installed source — functional callback form required to preserve existing params)

### Tertiary (LOW confidence)

None — all critical claims verified against installed source or project files.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries verified installed, versions confirmed
- Architecture: HIGH — existing DashboardPage code read in full; pattern is straightforward additive change
- Pitfalls: HIGH — `useSearchParams` controlled-input lag is a known issue verified against the hook's async nature; functional setter form verified against installed source
- Empty state: HIGH — EmptyState component props verified from source

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (react-router-dom stable; no churn expected)
