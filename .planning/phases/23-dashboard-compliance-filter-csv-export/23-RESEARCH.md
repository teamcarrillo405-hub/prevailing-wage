# Phase 23: Dashboard Compliance Filter + CSV Export — Research

**Researched:** 2026-03-24
**Domain:** Batch compliance aggregation endpoint, dashboard filter chips, client-side CSV generation
**Confidence:** HIGH — all findings based on direct codebase analysis; no external API uncertainty

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-05 | User can filter the project dashboard by compliance status (Compliant / Has Violations / No Payroll / Archived) using a batch summary endpoint — no N+1 per-card fetches | New `GET /api/compliance/projects/summary` endpoint returns one status per project in a single call; client maps results to filter chip state via `useMemo`; ProjectCard N+1 queries are suppressed when batch data is available |
| AUD-03 | User can download per-worker compliance history as a CSV file (17 columns including project, week, worker, violation type, amounts — UTF-8 with BOM for Excel) | `csv-stringify` ^6.7.0 must be installed; server-side CSV generation from existing `getWorkerComplianceHistory()` data; UTF-8 BOM prefix (`\uFEFF`) required for Excel column alignment |

</phase_requirements>

---

## Summary

Phase 23 has two distinct deliverables: a batch compliance summary endpoint for dashboard filtering, and a CSV download from the existing worker compliance history page. Neither requires database schema changes, new UI primitives, or new page routes. Both are additive changes to already-built surfaces.

The batch compliance endpoint (`GET /api/compliance/projects/summary`) is the server-side workhorse. It replaces N per-card compliance calls with a single call that returns the compliance status for every project owned by the authenticated user. The endpoint runs `computeCompliance()` for each payroll week across all projects and categorizes each project as `compliant`, `violations`, `no-payroll`, or `archived`. This is O(projects × weeks) but is acceptable for a single-user app at current scale. The client filters the already-fetched project array client-side using `useMemo`, consistent with how the existing search and funding type filters work in `DashboardPage.tsx`.

The CSV export lives on `WorkerComplianceHistoryPage.tsx` and calls a new server route (`GET /api/compliance/worker/:workerId/history/csv`) that serializes the same data already returned by the JSON history endpoint into a UTF-8 BOM CSV. The BOM prefix (`\uFEFF`) is non-negotiable for Excel — without it, special characters in worker names or project names will render as encoding artifacts. The `csv-stringify` package is NOT installed (confirmed by inspecting `package.json`) and must be added. It is the natural complement to `csv-parse` already in `dependencies`.

**Primary recommendation:** Install `csv-stringify`, add the batch summary endpoint before the `/:weekId` wildcard in `compliance.ts`, update `DashboardPage.tsx` with filter chips that use `useMemo` filtering (same pattern as search/funding), and add a CSV download button to `WorkerComplianceHistoryPage.tsx` using the established Blob URL download pattern.

---

## Standard Stack

### Core (all existing, no version changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express + TypeScript | 5.2.1 | New route handler in compliance.ts | Already the app's API layer |
| Drizzle ORM | 0.45.1 | Batch query: all projects + weeks for user | Already used for all DB access |
| TanStack Query | 5.91.0 | New query key for batch summary; useMemo filter | Already used in DashboardPage |
| React + TypeScript | 19.2.4 | Filter chip UI in DashboardPage | Already the app's UI layer |

### New (one library only)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| csv-stringify | ^6.7.0 | Server-side CSV serialization with UTF-8 BOM | Same monorepo as csv-parse (^6.2.0 already in deps); streaming-native for Express; ~42KB |

**Confirmed NOT installed:** `csv-stringify` is absent from `package.json` `dependencies` and `devDependencies`. `csv-parse` ^6.2.0 is present, confirming the monorepo version line.

**Installation:**
```bash
npm install csv-stringify
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| csv-stringify (server) | Client-side CSV assembly via string concatenation | Client-side is fragile for quoting, newlines in data, and BOM injection; csv-stringify handles RFC 4180 escaping correctly |
| csv-stringify (server) | papaparse (already installed) | papaparse is a parser; its stringify API is less documented for Node server use; csv-stringify is purpose-built for generation |
| New CSV route | Reuse the JSON history endpoint + client-side stringify | Client-side stringify loses RFC 4180 quoting guarantees; BOM injection is trickier from client |

---

## Architecture Patterns

### Recommended Project Structure (changes only)
```
src/
├── server/
│   ├── routes/
│   │   └── compliance.ts     # ADD: GET /projects/summary + GET /worker/:id/history/csv
│   └── services/
│       └── complianceService.ts  # ADD: getBatchProjectCompliance()
└── client/
    └── pages/
        ├── DashboardPage.tsx      # ADD: filter chips, complianceFilter state, batch query
        └── WorkerComplianceHistoryPage.tsx  # ADD: Download CSV button + fetch handler
```

### Pattern 1: Batch Summary Endpoint (DASH-05)

**What:** Single `GET /api/compliance/projects/summary` that returns `{ projects: Array<{ id, status }> }` for all projects owned by the authenticated user.

**When to use:** Dashboard page load — one call replaces N per-card calls.

**Route registration order is critical.** The new route `/projects/summary` MUST be registered BEFORE the existing `/:weekId` wildcard in `compliance.ts`. This is the same pattern used for `/project/:projectId` and `/worker/:workerId/history`. All specific-segment routes before the wildcard.

```typescript
// MUST be before complianceRouter.get('/:weekId', ...)
complianceRouter.get('/projects/summary', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  // 1. Fetch all user's projects
  // 2. For each project: run computeCompliance() for all weeks
  // 3. Derive status: 'archived' | 'violations' | 'compliant' | 'no-payroll'
  // 4. Return { projects: [{ id, status }] }
});
```

**Status derivation rules:**
- `archived` — project.status === 'closed' (short-circuit, no compliance computation needed)
- `violations` — any week has `result.hasViolations === true`
- `no-payroll` — weekCount === 0
- `compliant` — all weeks pass (no violations, has at least 1 week)

**Service function:** Add `getBatchProjectCompliance(db, userId)` to `complianceService.ts`. Returns `Map<projectId, 'archived' | 'violations' | 'compliant' | 'no-payroll'>`. Route calls this and serializes to JSON array.

### Pattern 2: Filter Chips in DashboardPage (DASH-05)

**What:** Five chip buttons (All / Compliant / Has Violations / No Payroll / Archived) above the project grid. Clicking a chip sets `complianceFilter` state and the `useMemo` filtered list applies it against the batch summary map.

**When to use:** Triggered by batch summary data being present. Chips are disabled or hidden during loading state.

**Key architectural decision:** The batch summary is a separate TanStack Query from the projects list. The dashboard has two queries:
1. `['projects', showArchived ? 'all' : 'active']` — existing project list (unchanged)
2. `['compliance-summary-batch']` — new batch summary

The client creates a `Map<projectId, status>` from the batch summary response using `useMemo`. The filter chips set `complianceFilter` state. The existing `filteredProjects` `useMemo` gains a third filter condition: if `complianceFilter` is non-empty, filter by `summaryMap.get(project.id) === complianceFilter`.

**URL persistence:** Add `compliance` to `useSearchParams` — consistent with `q` and `funding`. Use `setSearchParams(prev => next)` functional form to avoid wiping co-existing params (critical, per Phase 18 decision).

```typescript
// Derived from batch summary response
const summaryMap = useMemo(() => {
  const map = new Map<string, string>();
  for (const item of (summaryData?.projects ?? [])) {
    map.set(item.id, item.status);
  }
  return map;
}, [summaryData]);

// Chip filter applied in existing filteredProjects useMemo
if (complianceFilter) {
  result = result.filter(p => summaryMap.get(p.id) === complianceFilter);
}
```

**Chip rendering:** Use the existing `border` + `rounded` + `text-sm` inline style pattern for filter affordance. Active chip uses `bg-brand-gold text-white`; inactive uses `bg-surface-card border-border-default text-text-primary`. Do not introduce a new UI primitive for chips — inline styles consistent with the search/funding filter bar.

### Pattern 3: CSV Download from Compliance History Page (AUD-03)

**What:** "Download CSV" button on `WorkerComplianceHistoryPage`. Clicking it calls `GET /api/compliance/worker/:workerId/history/csv`, receives a `text/csv` response, and triggers a browser download using the established Blob URL pattern.

**New route:** `/worker/:workerId/history/csv` — registered BEFORE `/:weekId` wildcard in `compliance.ts`. Reuses `getWorkerComplianceHistory()` service function (no new service logic). Serializes results via `csv-stringify`.

```typescript
// Route path: must be before /:weekId
complianceRouter.get('/worker/:workerId/history/csv', requireAuth, async (req, res) => {
  // same ownership check as /worker/:workerId/history
  // call getWorkerComplianceHistory(db, userId, workerId)
  // serialize to CSV via csv-stringify
  // set Content-Type: text/csv; charset=utf-8
  // set Content-Disposition: attachment; filename="compliance-history-{workerName}.csv"
  // write UTF-8 BOM (\uFEFF) before CSV content
  res.send('\uFEFF' + csvString);
});
```

**CSV Blob download pattern** (established in Phase 16):
```typescript
// Source: STATE.md [Phase 16] decision
const res = await fetch(`/api/compliance/worker/${workerId}/history/csv`);
const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `compliance-history-${workerName}.csv`;
a.click();
setTimeout(() => URL.revokeObjectURL(url), 100);
```

**Button:** Use secondary button classes directly on a `<button>` element (not `<a>`) since we use fetch-driven download, not a plain anchor. Use `useRef` for double-click guard (not `useState` — established pattern per Phase 16).

### Anti-Patterns to Avoid

- **Do not add a compliance status cache column to the `projects` table.** Cache invalidation is triggered by every payroll entry change, every week addition, and every amendment. Computing on-read via `computeCompliance()` is the correct pattern. The existing `GET /api/compliance/project/:projectId` already does this per-card — the batch endpoint simply calls the same logic in a loop.
- **Do not register `/projects/summary` after `/:weekId`.** Express matches routes in declaration order. The string "projects" would be captured as a `weekId` parameter, producing a 404 on every dashboard load.
- **Do not register `/worker/:workerId/history/csv` after `/:weekId`.** Same wildcard capture issue.
- **Do not use client-side CSV assembly (string concatenation).** RFC 4180 requires double-quoting fields that contain commas, double quotes, or newlines. Worker names and project names can legally contain commas. Use `csv-stringify`.
- **Do not omit the UTF-8 BOM.** Excel on Windows defaults to system encoding for CSV files. Without the BOM (`\uFEFF`), Excel misidentifies the encoding and worker names with accented characters (common in construction workforce) render as garbled characters. The BOM is the success criterion for AUD-03 criterion 5.
- **Do not use `setSearchParams({ compliance: val })` (direct object form).** This wipes co-existing `q` and `funding` params. Always use the functional form: `setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('compliance', val); return next; })`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV serialization with RFC 4180 quoting | Custom string builder with `join(',')` | csv-stringify | Commas in project names, double quotes in fields, newlines in addresses all require proper escaping |
| UTF-8 BOM injection | Base64 encode + inject | Prepend `\uFEFF` string to csv-stringify output | BOM is a single Unicode character; prepending to the string before `res.send()` is the correct approach |
| Filter chip active state | Custom CSS class toggle logic | Inline conditional Tailwind classes | One ternary expression; no abstraction needed |

---

## Common Pitfalls

### Pitfall 1: Route Wildcard Capture
**What goes wrong:** `GET /api/compliance/projects/summary` returns 404 with `{ error: 'Payroll week not found' }`. Test coverage on the batch endpoint passes locally but breaks in route order.
**Why it happens:** Express matches `/:weekId` before `/projects/summary` if `/projects/summary` is registered after the wildcard.
**How to avoid:** Register `/projects/summary` and `/worker/:workerId/history/csv` IMMEDIATELY after the existing specific-segment routes at the top of the `complianceRouter` declaration, before `/:weekId`.
**Warning signs:** `res.body.error === 'Payroll week not found'` on a summary endpoint test.

### Pitfall 2: Excel Encoding Artifacts (BOM Missing)
**What goes wrong:** CSV opens in Excel with garbled characters in worker names: `JosÃ© GonzÃ¡lez` instead of `José González`.
**Why it happens:** Excel on Windows uses the active system code page (often Windows-1252) for CSV files unless a BOM is present. Without BOM, UTF-8 bytes are misread.
**How to avoid:** Prepend `\uFEFF` to the CSV string before `res.send()`. Set `Content-Type: text/csv; charset=utf-8`.
**Warning signs:** AUD-03 success criterion 5 fails ("no encoding artifacts in Excel").

### Pitfall 3: N+1 Queries in Batch Endpoint
**What goes wrong:** Dashboard with 20 projects takes 3+ seconds to load because the batch endpoint makes 20 × (weeks per project) separate DB calls serially.
**Why it happens:** Calling `computeCompliance(db, weekId)` in a nested loop is correct for correctness but each call makes multiple DB queries.
**How to avoid:** The current per-project compliance route already does this and is acceptable for a single-user app. Document the O(projects × weeks) complexity. For Phase 23, serial execution is fine. If profiling shows > 500ms, defer to a future optimization phase.
**Warning signs:** Dashboard load time > 1s on test fixture with 5+ projects.

### Pitfall 4: Filter State Lost on Back Navigation
**What goes wrong:** User sets "Has Violations" filter, clicks into a project, presses back, and lands on unfiltered dashboard.
**Why it happens:** `complianceFilter` stored only in `useState` (not persisted to URL) resets on navigation.
**How to avoid:** Use `useSearchParams` for `complianceFilter` state — same as `q` and `funding`. Initialize from `searchParams.get('compliance') ?? ''`.
**Warning signs:** Back button clears the compliance filter chip selection.

### Pitfall 5: Double-Click Produces Two CSV Downloads
**What goes wrong:** User double-clicks "Download CSV" and receives two file downloads.
**Why it happens:** `useState` for download state is async/batched and cannot prevent the second click before the first fetch resolves.
**How to avoid:** Use `useRef` as a synchronous download guard, consistent with Phase 16 `generatingRef` pattern documented in `STATE.md`.
**Warning signs:** Two files appear in the Downloads folder on rapid double-click.

### Pitfall 6: complianceFilter Wipes Other URL Params
**What goes wrong:** Selecting a compliance filter chip clears the active search query or funding filter.
**Why it happens:** `setSearchParams({ compliance: 'violations' })` replaces the entire params object.
**How to avoid:** Always use `setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('compliance', val); return next; })` — Phase 18 established pattern, documented in STATE.md.
**Warning signs:** Search input clears when a compliance chip is clicked.

---

## Code Examples

### csv-stringify Basic Usage (server-side)
```typescript
// Source: npm csv-stringify README — stringify/sync API
import { stringify } from 'csv-stringify/sync';

const csvString = stringify(rows, {
  header: true,
  columns: [
    { key: 'projectName', header: 'Project Name' },
    { key: 'weekEndingDate', header: 'Week Ending Date' },
    // ... 17 columns total
  ],
});

res.setHeader('Content-Type', 'text/csv; charset=utf-8');
res.setHeader('Content-Disposition', `attachment; filename="compliance-${workerName}.csv"`);
res.send('\uFEFF' + csvString);  // BOM prefix required for Excel
```

### TanStack Query Batch Summary (client-side)
```typescript
// Source: TanStack Query v5 docs — same queryFn pattern used throughout app
const { data: summaryData } = useQuery({
  queryKey: ['compliance-summary-batch'],
  queryFn: () => api.get<{ projects: Array<{ id: string; status: string }> }>(
    '/compliance/projects/summary'
  ),
  staleTime: 60_000,  // same staleTime as per-card queries
});

const summaryMap = useMemo(() => {
  const map = new Map<string, string>();
  for (const item of (summaryData?.data?.projects ?? [])) {
    map.set(item.id, item.status);
  }
  return map;
}, [summaryData]);
```

### Filter Chips Pattern
```typescript
// Consistent with existing search/funding bar in DashboardPage.tsx
const COMPLIANCE_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'compliant', label: 'Compliant' },
  { value: 'violations', label: 'Has Violations' },
  { value: 'no-payroll', label: 'No Payroll' },
  { value: 'archived', label: 'Archived' },
];

// In JSX — no new component, inline chip row
<div className="flex flex-wrap items-center gap-2 mb-4">
  {COMPLIANCE_FILTER_OPTIONS.map(opt => (
    <button
      key={opt.value}
      onClick={() => handleComplianceFilterChange(opt.value)}
      className={`text-xs px-3 py-1 rounded border transition-colors ${
        complianceFilter === opt.value
          ? 'bg-brand-gold text-white border-brand-gold'
          : 'bg-surface-card text-text-primary border-border-default hover:border-brand-gold'
      }`}
    >
      {opt.label}
    </button>
  ))}
</div>
```

### 17-Column CSV Schema (WH-347 field convention order)
```typescript
// Columns ordered by WH-347 form field convention, not schema order
const CSV_COLUMNS = [
  { key: 'workerName',              header: 'Worker Name' },
  { key: 'ssnLast4',                header: 'SSN Last 4' },
  { key: 'projectName',             header: 'Project Name' },
  { key: 'projectId',               header: 'Project ID' },
  { key: 'weekEndingDate',          header: 'Week Ending Date' },
  { key: 'payrollNumber',           header: 'Payroll Number' },
  { key: 'violationType',           header: 'Violation Type' },
  { key: 'detail',                  header: 'Detail' },
  { key: 'expected',                header: 'Expected Wages' },
  { key: 'actual',                  header: 'Actual Wages' },
  { key: 'delta',                   header: 'Delta' },
  { key: 'apprenticeHours',         header: 'Apprentice Hours' },
  { key: 'journeyworkerHours',      header: 'Journeyworker Hours' },
  { key: 'maxAllowedApprenticeHours', header: 'Max Allowed Apprentice Hours' },
  { key: 'weekId',                  header: 'Week ID' },
  { key: 'projectIdRaw',            header: 'Source Project ID' },
  { key: 'exportedAt',              header: 'Exported At' },
];
// Total: 17 columns — matches AUD-03 requirement
```

---

## Implementation Notes (Derived from Codebase Analysis)

### Existing `/api/compliance/project/:projectId` Route

The existing per-project compliance route in `compliance.ts` (lines 20-45) already implements the correct per-project aggregation logic: load all weeks via `listPayrollWeeks(projectId)`, run `computeCompliance(db, week.id)` for each week, set `hasViolations = true` on first hit. The new batch endpoint is this same pattern applied to all user projects in one call, returning a simplified status string per project instead of detailed badge/weekCount data.

The existing `ProjectCard.tsx` query (`['compliance-summary', project.id]`) makes one API call per card. With the new batch endpoint, the DashboardPage can pass the precomputed status into each ProjectCard as a prop instead of having each card fetch independently. However, this is a refactor optimization — Phase 23 can also leave ProjectCard queries in place and just add filter chips that use the batch summary separately. The simpler approach (add batch query + filter chips, leave ProjectCard queries intact) is recommended to minimize blast radius.

### `badge` vs `status` Naming

The existing `/api/compliance/project/:projectId` returns `{ badge: 'violations' | 'clean' }`. The new batch endpoint should use `status` as the field name and use the expanded vocabulary: `'violations' | 'compliant' | 'no-payroll' | 'archived'`. The existing `badge: 'clean'` in per-card responses is not changed — that endpoint is already in production and the `ProjectCard.tsx` relies on it.

### Worker Name in CSV Filename

The `WorkerComplianceHistoryPage.tsx` already has `data.workerName` from the existing JSON query. The CSV download button can read from the already-loaded TanStack Query cache. The filename should sanitize the worker name for safe filesystem use: replace spaces with hyphens, strip non-ASCII characters. Example: `compliance-history-jose-gonzalez.csv`.

### "No Payroll" vs "Archived" Filter Interaction

A project can be both `archived` (status === 'closed') and have no payroll. The batch endpoint should classify archived projects as `archived` first (short-circuit), regardless of payroll count. This matches user expectation: the "Archived" chip shows ALL archived projects, even those with payroll data.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N per-card compliance fetches (Phase 8) | Single batch summary (Phase 23) | Phase 23 | Eliminates N+1 on dashboard load |
| No CSV export | csv-stringify UTF-8 BOM download | Phase 23 | Audit-ready export for auditors using Excel |

---

## Open Questions

1. **Should ProjectCard N+1 queries be removed once batch summary is available?**
   - What we know: ProjectCard currently makes its own `GET /api/compliance/project/:projectId` call with `staleTime: 60_000`. The batch summary gives the same status. Two sources of truth for the same data.
   - What's unclear: Whether removing ProjectCard queries (and instead receiving status as a prop from DashboardPage) is in scope for Phase 23 or deferred.
   - Recommendation: Leave ProjectCard queries intact for Phase 23. The filter chips use the batch summary; the cards use their own queries. Plan this as a Wave 2 task at most, not Wave 1. Removing them avoids the N+1 but adds a prop-drilling change to ProjectCard that is a separate concern.

2. **Should the CSV route reuse the JSON history endpoint internally or duplicate the service call?**
   - What we know: Both `GET /worker/:workerId/history` and `GET /worker/:workerId/history/csv` call `getWorkerComplianceHistory(db, userId, workerId)`. The service function is pure and can be called twice.
   - What's unclear: Whether to colocate them in the same route handler with a format query param (`?format=json|csv`).
   - Recommendation: Two separate routes, same service call. Keeps Content-Type and Content-Disposition headers clean without conditional logic. Route naming is clear.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 + Supertest ^7.2.2 |
| Config file | `/c/Users/glcar/prevailing-wage/vitest.config.ts` |
| Quick run command | `vitest run tests/routes/compliance.test.ts` |
| Full suite command | `vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-05 | `GET /api/compliance/projects/summary` returns status per project | integration | `vitest run tests/routes/compliance.test.ts` | ✅ (file exists, tests for new describe block added in Wave 0) |
| DASH-05 | Summary returns `violations` when project has under-wage entry | integration | `vitest run tests/routes/compliance.test.ts` | ✅ (reuses seedProjectWithViolation fixture) |
| DASH-05 | Summary returns `no-payroll` when project has no weeks | integration | `vitest run tests/routes/compliance.test.ts` | ✅ |
| DASH-05 | Summary returns `archived` for closed projects without computing compliance | integration | `vitest run tests/routes/compliance.test.ts` | ✅ |
| DASH-05 | Summary returns 403 when unauthenticated | integration | `vitest run tests/routes/compliance.test.ts` | ✅ |
| AUD-03 | CSV route returns 200 with Content-Type text/csv | integration | `vitest run tests/routes/compliance.test.ts` | ✅ (new describe block) |
| AUD-03 | CSV response body begins with UTF-8 BOM (`\uFEFF`) | integration | `vitest run tests/routes/compliance.test.ts` | ✅ |
| AUD-03 | CSV contains header row with 17 column names | integration | `vitest run tests/routes/compliance.test.ts` | ✅ |
| AUD-03 | CSV route returns 403 when worker belongs to different user | integration | `vitest run tests/routes/compliance.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** `vitest run tests/routes/compliance.test.ts`
- **Per wave merge:** `vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work 23`

### Wave 0 Gaps
- [ ] `tests/routes/compliance.test.ts` — add new `describe('GET /api/compliance/projects/summary')` block with 5 stub tests using `expect().toBe()` assertions (not `.todo`) — covers DASH-05
- [ ] `tests/routes/compliance.test.ts` — add new `describe('GET /api/compliance/worker/:workerId/history/csv')` block with 4 stub tests — covers AUD-03
- [ ] Framework install: `npm install csv-stringify` — required before Wave 1 implementation

*(Existing test infrastructure fully covers all other requirements. No new test files needed.)*

---

## Sources

### Primary (HIGH confidence — direct codebase analysis)
- `src/server/routes/compliance.ts` — confirmed route ordering pattern, existing routes, wildcard `/:weekId` position
- `src/server/services/complianceService.ts` — confirmed `computeCompliance()` signature, `getWorkerComplianceHistory()` return type, `WorkerViolationHistoryEntry` shape (14 fields)
- `src/client/pages/DashboardPage.tsx` — confirmed `useSearchParams` pattern, `useMemo` filter pattern, `setSearchParams(prev => next)` functional form, existing filter bar structure
- `src/client/pages/WorkerComplianceHistoryPage.tsx` — confirmed existing data structure, query key, fetch pattern, `data.workerName` availability
- `src/client/components/projects/ProjectCard.tsx` — confirmed N+1 per-card query with `staleTime: 60_000`
- `src/server/db/schema.ts` — confirmed `projects.status` field (`'active' | 'closed'`), payrollWeeks and payrollEntries structure
- `package.json` — confirmed `csv-stringify` is NOT installed; `csv-parse` ^6.2.0 IS installed; `vitest` ^4.1.0 is present
- `tests/routes/compliance.test.ts` — confirmed `seedProjectWithViolation` fixture, existing describe block structure, Supertest pattern
- `tests/helpers/db.ts` — confirmed in-memory SQLite test setup, migration-based schema

### Secondary (MEDIUM confidence — verified against codebase + npm registry)
- `csv-stringify` ^6.7.0 — confirmed on npm registry as current version matching csv-parse monorepo; sync API confirmed via README
- TanStack Query v5 staleTime pattern — confirmed from multiple existing uses in ProjectCard.tsx

### Tertiary (LOW confidence — not needed; all findings are HIGH/MEDIUM)
None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from direct package.json inspection
- Architecture: HIGH — all patterns verified against existing working implementation in compliance.ts, DashboardPage.tsx, WorkerComplianceHistoryPage.tsx
- Pitfalls: HIGH — route ordering from established project pattern; BOM requirement from AUD-03 explicit success criterion; URL param wipe from Phase 18 documented decision

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable — no external API dependency, all internal codebase)
