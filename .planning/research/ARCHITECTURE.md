# Architecture Patterns

**Project:** HCC Prevailing Wage v2.4 — Ship-Ready + Design Elevation
**Researched:** 2026-03-24
**Confidence:** HIGH — based on direct codebase analysis of all affected files

---

## System Overview (as of v2.3)

```
┌────────────────────────────────────────────────────────────────────────┐
│                         React Client (Vite)                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐   │
│  │ DashboardPage│  │PayrollWeekDetail  │  │ WorkerCompliance       │   │
│  │  (+ compliance│  │  (+ PDF generate) │  │ HistoryPage            │   │
│  │   status filt)│  │                  │  │  (+ CSV export)        │   │
│  └──────┬───────┘  └────────┬─────────┘  └──────────┬─────────────┘  │
│         │                   │                        │                 │
│  ┌──────┴───────────────────┴────────────────────────┴──────────────┐ │
│  │              TanStack Query (cache + invalidation)                │ │
│  └──────────────────────────────┬───────────────────────────────────┘ │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  │ fetch /api/*
┌─────────────────────────────────┼──────────────────────────────────────┐
│                          Express Server                                 │
│  ┌───────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │/api/export    │  │/api/compliance   │  │/api/projects             │ │
│  │  /wh347/:id   │  │  /project/:id    │  │  GET /?status=           │ │
│  │  /csv/lcp/:id │  │  /worker/:id/    │  │  PATCH /:id              │ │
│  │  /csv/emars/:id│  │    history       │  │                          │ │
│  │  [+ state PDFs]│  │  /:weekId        │  │                          │ │
│  │               │  │  [+ /projects/   │  │                          │ │
│  │               │  │    summary]      │  │                          │ │
│  └───────┬───────┘  └────────┬─────────┘  └────────────┬─────────────┘ │
│          │                   │                          │               │
│  ┌───────┴───────────────────┴──────────────────────────┴────────────┐ │
│  │   Services: payrollService, complianceService, wh347Generator,    │ │
│  │             stateFormGenerator (NEW), csvExporter                  │ │
│  └──────────────────────────────┬────────────────────────────────────┘ │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  │ Drizzle ORM
┌─────────────────────────────────┼──────────────────────────────────────┐
│  SQLite                                                                 │
│  projects (status, userId, state, county, fundingType, ...)            │
│  payrollWeeks (submitted_at, submitted_to, amendment_number, ...)      │
│  payrollEntries (baseRateSnapshot, fringeRateSnapshot, grossWages,...) │
│  workers │ workerClassifications │ wageDeterminations                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Q1: State Form Route Design

### Recommendation: Single parametric route with a form-type enum

Register one route:

```
GET /api/export/state-form/:weekId?form=ca-dir|wa-li
```

This sits alongside the existing routes in `export.ts`:

```typescript
// Existing:
router.get('/wh347/:weekId', ...)
router.get('/csv/lcptracker/:weekId', ...)
router.get('/csv/emars/:weekId', ...)

// New:
router.get('/state-form/:weekId', ...)
```

**Why one route, not two separate routes:**

The ownership check, week/project load, and entry fetch are identical for both CA DIR and WA L&I. The only difference between them is which generator function is called and which PDF filename is returned. A form-type query param keeps that differentiation at the generation layer without duplicating 30 lines of auth/data-loading boilerplate.

The alternative — `/api/export/ca-dir/:weekId` and `/api/export/wa-li/:weekId` — would produce two routes that are structurally identical up to the generator call. The `?form=` param makes the branching point explicit and leaves room for future state forms (NY DOL, etc.) without adding a new route per form.

**Implementation shape:**

```typescript
// routes/export.ts — new handler at end of file before export
router.get('/state-form/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const formType = req.query.form as string;
  const userId = req.user!.userId;

  if (!['ca-dir', 'wa-li'].includes(formType)) {
    res.status(400).json({ error: 'Invalid form type. Use: ca-dir or wa-li' });
    return;
  }

  // Same ownership check + data load as /wh347/:weekId
  // ...

  // Branch on formType:
  if (formType === 'ca-dir') {
    const pdf = await fillCaDirForm(data, templateBytes);
    res.setHeader('Content-Disposition', `attachment; filename="ca-dir-${weekId}.pdf"`);
    res.end(Buffer.from(pdf));
  } else {
    const pdf = await fillWaLiForm(data, templateBytes);
    res.setHeader('Content-Disposition', `attachment; filename="wa-li-${weekId}.pdf"`);
    res.end(Buffer.from(pdf));
  }
});
```

**New files (server-side):**

- `src/server/services/caDirGenerator.ts` (NEW) — mirrors `wh347Generator.ts` structure: exports `fillCaDirForm(data, templateBytes): Promise<Uint8Array>`, uses `pdf-lib` coordinate overlay on the CA DIR official template
- `src/server/services/waLiGenerator.ts` (NEW) — same pattern for WA L&I form
- `assets/ca-dir-official.pdf` (NEW) — CA DIR PWC 100 or equivalent official template
- `assets/wa-li-official.pdf` (NEW) — WA L&I Certified Payroll Report template

**Modified files (server-side):**

- `src/server/routes/export.ts` (MODIFIED) — add single `/state-form/:weekId` handler

**Client trigger:** Add "Download CA DIR" / "Download WA L&I" buttons in `PayrollWeekDetailPage.tsx` using the same fetch-driven Blob download pattern as the existing WH-347 button (confirmed working pattern from v2.2). Only show the button when the project's `state` matches the form's jurisdiction (`project.state === 'CA'` for CA DIR, `project.state === 'WA'` for WA L&I).

**State data note:** `stateWageAdapter.ts` already defines `CaDirAdapter` and `WaLiAdapter` for wage lookups. The CA/WA states are fully supported in the wage determination layer. State form generation is a new output concern only.

---

## Q2: Contractor Guidance System Architecture

### Recommendation: HelpText primitive + inline prose. No sidebar, no feature tour.

The existing UI primitive set (`Card`, `Button`, `Badge`, `PageHeader`, `EmptyState`) already handles the structural layer. The guidance system needs only one new primitive.

**New primitive: `HelpText.tsx`**

```typescript
// src/client/components/ui/HelpText.tsx
// Renders contextual guidance inline with form fields or section headers.
// Two variants:
//   inline — small muted text below a form field label
//   callout — slightly elevated block with an icon, for multi-sentence guidance

interface HelpTextProps {
  children: React.ReactNode;
  variant?: 'inline' | 'callout';
}
```

This is a dumb display component — no state, no context, no provider. That is the correct call for this scope.

**Pattern: guidance is co-located with the feature it describes.**

Do not use a context provider, a help sidebar, or a tooltip system. Those patterns assume the guidance content is decoupled from the UI element — appropriate for multi-user SaaS with role-based help. For a single-user compliance workflow tool, the guidance lives on the page near the action it explains.

Specific application per page:

| Page | Guidance type | Where |
|------|--------------|-------|
| `LandingPage.tsx` | Prose explainer (already has sections) | Existing marketing sections — no new component needed |
| `ProjectDetailPage.tsx` | `HelpText` callout on 4-step workflow indicator | Below step labels, explaining what each step requires |
| `PayrollEntryPage.tsx` | `HelpText` inline under classification selector | Explains rate snapshot behavior, fringe credit |
| `WorkersPage.tsx` | `EmptyState` with action (already exists) | Update message copy to explain why workers come first |
| `PayrollWeekDetailPage.tsx` | `HelpText` callout above WH-347 download | Explains what the form is and when to submit |
| `DashboardPage.tsx` | `EmptyState` with action (already exists) | Update action label to "Create Your First Project" with subtitle |

**Tooltips: use sparingly, only for icon-only controls.**

Tooltips require hover, which is problematic on touch devices. The existing compliance badges have enough visual affordance. Use `title` attribute for brief hover labels on icon buttons where no text label fits — do not introduce a tooltip library.

**No sidebar guidance panel.** A sidebar would occupy permanent horizontal real estate on every page to serve content a contractor only needs the first three times. The compliance software is used repeatedly by trained users. Guidance should fade into the background, not be permanently prominent.

**New files:**
- `src/client/components/ui/HelpText.tsx` (NEW) — single primitive, ~30 lines

**Modified files:**
- `src/client/pages/ProjectDetailPage.tsx` — add callout HelpText under workflow steps
- `src/client/pages/PayrollEntryPage.tsx` — add inline HelpText under key fields
- `src/client/pages/PayrollWeekDetailPage.tsx` — add callout HelpText above WH-347 download
- `src/client/pages/DashboardPage.tsx` — update EmptyState message copy
- `src/client/pages/WorkersPage.tsx` — update EmptyState message copy

---

## Q3: UI/UX Overhaul Build Order

### Recommendation: tokens → components → pages. Photography via CSS custom property, loaded from `public/`.

**Build order and rationale:**

1. **Design tokens first (`src/client/index.css`)**

   Add new tokens to the existing `@theme` block. The existing token architecture is correct — this is an extension, not a replacement:

   ```css
   /* New tokens for v2.4 */
   --color-surface-dark: #1a1a1a;        /* full dark surface */
   --color-surface-dark-alt: #242424;    /* card on dark background */
   --color-brand-gold-dim: #c9a10e;      /* hover state for gold buttons */
   --color-gold-gradient-start: #F5C518;
   --color-gold-gradient-end: #c9a10e;
   --shadow-card-elevated: 0 4px 12px 0 rgb(0 0 0 / 0.12), 0 2px 4px -1px rgb(0 0 0 / 0.08);
   ```

   Do not hardcode gradient values in JSX. Define them as CSS custom properties and reference them in component styles. This preserves the existing constraint: all brand values via `@theme` tokens.

2. **Update `Card.tsx` and `Button.tsx` for depth/shadow variants**

   The Card component needs an `elevated` variant that applies `shadow-card-elevated` and slightly stronger border. Do not change existing variant behavior — add the new variant alongside.

   The Button component may need a `gold` variant (filled gold background, dark text) for primary CTAs on dark surfaces. Verify against current `primary` variant behavior before adding.

3. **Pages last — apply tokens and photograph backgrounds page by page**

   Start with `LandingPage.tsx` (highest visual impact, not behind auth). Then `DashboardPage.tsx`. Auth pages last (least visible to returning users).

**Photography integration: `public/` directory + CSS background-image**

There is currently no `public/` directory. Create it. Vite serves `public/` at the root path with no bundling — the correct approach for large static assets like photographs.

```
/public/
  hero-construction.jpg      (LandingPage hero section)
  dashboard-bg.jpg           (DashboardPage header band, optional)
```

Reference in CSS, not in JSX:

```css
/* In index.css or a page-specific <style> block */
.hero-section {
  background-image: url('/hero-construction.jpg');
  background-size: cover;
  background-position: center;
}
```

Do not import images via `import heroImg from './hero-construction.jpg'` in React components unless you need Vite's asset hashing (which is not needed for manually managed brand photography). Direct `/public` paths are simpler, cacheable, and swappable without a rebuild.

**Dark gold gradient pattern:**

```css
.gradient-gold {
  background: linear-gradient(135deg, var(--color-gold-gradient-start), var(--color-gold-gradient-end));
}
```

Applied as a Tailwind utility via `@layer utilities` in `index.css`, not as an inline style. This keeps the constraint: no hardcoded hex in JSX.

**New files:**
- `public/` directory (NEW)
- `public/hero-construction.jpg` (NEW — sourced externally)
- Potentially `public/dashboard-bg.jpg` (NEW — optional)

**Modified files:**
- `src/client/index.css` — new tokens, new utility classes
- `src/client/components/ui/Card.tsx` — elevated variant
- `src/client/components/ui/Button.tsx` — verify if gold variant needed
- `src/client/pages/LandingPage.tsx` — apply hero background, gradient sections
- `src/client/pages/DashboardPage.tsx` — apply elevated card styling

---

## Q4: Dashboard Compliance Status Filter Endpoint

### Recommendation: `GET /api/compliance/projects/summary` returns per-project status keyed by projectId.

**Route design:**

Add to `src/server/routes/compliance.ts` — must be registered before `/:weekId` to avoid wildcard capture (the existing file already documents this pattern and applies it for `/project/:projectId` and `/worker/:workerId/history`):

```
GET /api/compliance/projects/summary
Response: {
  projects: Array<{
    projectId: string,
    status: 'compliant' | 'violations' | 'no-payroll'
  }>
}
```

The three status values map cleanly to the filter UI:
- `compliant` — at least one week exists, no violations found in any week
- `violations` — at least one week has `hasViolations: true`
- `no-payroll` — `listPayrollWeeks(projectId)` returns empty array

**Why this shape (not `badge: string`):**

The existing `/api/compliance/project/:projectId` returns `{ badge: 'violations' | 'clean', weekCount, lastWeekNumber }`. That endpoint is per-project and called inside `ProjectCard`. The summary endpoint is dashboard-level and batches all projects at once. Using `status` instead of `badge` avoids confusion between the two endpoints and gives the filter the clean enum it needs.

**Server implementation sketch:**

```typescript
// In compliance.ts — before /:weekId handler
complianceRouter.get('/projects/summary', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  // Fetch all active projects for this user
  const userProjects = await db.select()
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId));

  const results = await Promise.all(
    userProjects.map(async (project) => {
      const weeks = await listPayrollWeeks(project.id);
      if (weeks.length === 0) {
        return { projectId: project.id, status: 'no-payroll' as const };
      }
      for (const week of weeks) {
        const result = await computeCompliance(db, week.id);
        if (result?.hasViolations) {
          return { projectId: project.id, status: 'violations' as const };
        }
      }
      return { projectId: project.id, status: 'compliant' as const };
    })
  );

  res.json({ projects: results });
});
```

**Performance note:** `computeCompliance()` is fast (reads snapshots, no live lookups) but it is called per-week per-project. For a contractor with 20 projects × 30 weeks each, this is 600 synchronous computations. Use `Promise.all` across projects (as shown) to parallelize at the project level. Document this as a known O(projects × weeks) operation — acceptable for a single-user app. If a contractor builds up hundreds of projects over years, add a `?projectIds=` param to allow the client to batch only visible projects.

**Client-side filter integration in `DashboardPage.tsx`:**

```typescript
// Fetch summary once on mount alongside project list
const { data: complianceSummary } = useQuery({
  queryKey: ['compliance-summary'],
  queryFn: () => fetch('/api/compliance/projects/summary').then(r => r.json()),
  staleTime: 60_000,
});

// Build a lookup map
const complianceByProject = useMemo(() =>
  Object.fromEntries(
    (complianceSummary?.projects ?? []).map(p => [p.projectId, p.status])
  ), [complianceSummary]);

// Add compliance filter state
const [complianceFilter, setComplianceFilter] = useState<'all' | 'compliant' | 'violations' | 'no-payroll'>('all');

// Extend existing filteredProjects useMemo
const filteredProjects = useMemo(() =>
  projects
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(p => fundingTypeFilter === 'all' || p.fundingType === fundingTypeFilter)
    .filter(p => complianceFilter === 'all' || complianceByProject[p.id] === complianceFilter),
  [projects, searchTerm, fundingTypeFilter, complianceFilter, complianceByProject]
);
```

This does not pass the compliance badge as a prop to `ProjectCard` — `ProjectCard` continues to fetch its own compliance badge via its existing `useQuery` for display purposes. The summary endpoint is only for filter gating in `DashboardPage`. This avoids prop threading through `ProjectCard`.

**Modified files:**
- `src/server/routes/compliance.ts` (MODIFIED) — add `/projects/summary` before `/:weekId`
- `src/client/pages/DashboardPage.tsx` (MODIFIED) — add compliance filter state + useMemo extension

---

## Q5: Production Deployment — SQLite Persistence

### Recommendation: Volume mount on Railway or Fly.io. Do not migrate to Postgres. Do not use Turso yet.

**Decision: volume mount is the right call for a single-user app at this stage.**

The three options evaluated:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Volume mount (Railway/Fly.io) | Zero code change, SQLite stays, simple ops | Volume must be configured manually, container restarts can lose ephemeral state if volume path misconfigured | USE THIS |
| Turso (libSQL cloud) | Replicated, no volume needed, branching for dev/prod | Requires replacing `better-sqlite3` with `@libsql/client`, rewriting Drizzle config, async driver vs sync driver mismatch | Defer to v3 if multi-device needed |
| Postgres (Neon/Supabase) | Standard production DB, no volume management | Full migration of all Drizzle schema and queries, JSON/text type differences, `better-sqlite3` removed, full test suite re-run | Out of scope |

**Why Postgres migration is wrong for v2.4:**

The app has 1,522 passing tests as of v2.3. A Postgres migration would require rewriting the Drizzle schema (`sqliteTable` → `pgTable`), auditing every raw query, updating the test setup, and re-validating all tests. This is a 2–3 day effort that produces no user-visible value. The Postgres migration is a future milestone, not a v2.4 item.

**Why Turso is premature:**

Turso requires switching from `better-sqlite3` (synchronous) to `@libsql/client` (async). Drizzle supports both drivers but the adapter is different. All `db.get()` calls in the codebase (there are several in `stateWageAdapter.ts`) use the synchronous API. This is a non-trivial driver swap. Worth doing when multi-device or collaborative access is needed. Not now.

**Volume mount implementation:**

```
# Railway: attach a persistent volume to /app/data
# Set environment variable:
DATABASE_PATH=/app/data/prevailing-wage.sqlite

# In src/server/db/index.ts — read from env:
const dbPath = process.env.DATABASE_PATH ?? './prevailing-wage.sqlite';
```

The current `getDb()` likely uses a hardcoded path. The only required code change is making the path configurable via environment variable.

**Fly.io is the preferred host over Railway for volume stability.** Railway's volume mount is newer and has documented edge cases around IOPS limits. Fly.io volumes are mature and well-documented for SQLite workloads. Either works; Fly.io is lower risk.

**Env config required for production:**

```
DATABASE_PATH=/app/data/prevailing-wage.sqlite
JWT_SECRET=<strong random value>
SAM_GOV_API_KEY=<production key>
NODE_ENV=production
PORT=4099
```

**Auth hardening note:** The existing JWT-in-httpOnly-cookie pattern is correct for production. The constraint from `PROJECT.md` ("do not change auth model") is right. The only hardening needed is ensuring `JWT_SECRET` is a strong value from environment, not a hardcoded fallback.

---

## Component Map: New vs. Modified (v2.4)

| File | Status | Change |
|------|--------|--------|
| `src/server/routes/export.ts` | MODIFIED | Add `GET /state-form/:weekId?form=` handler |
| `src/server/routes/compliance.ts` | MODIFIED | Add `GET /projects/summary` before `/:weekId` |
| `src/server/services/caDirGenerator.ts` | NEW | CA DIR form filler using pdf-lib coordinate overlay |
| `src/server/services/waLiGenerator.ts` | NEW | WA L&I form filler using pdf-lib coordinate overlay |
| `src/server/db/index.ts` | MODIFIED | Read `DATABASE_PATH` from env |
| `src/client/components/ui/HelpText.tsx` | NEW | Inline and callout guidance primitive |
| `src/client/components/ui/Card.tsx` | MODIFIED | Add `elevated` shadow variant |
| `src/client/components/ui/Button.tsx` | MODIFIED | Verify/add gold variant for dark surface CTAs |
| `src/client/index.css` | MODIFIED | New @theme tokens (dark surface, gold gradient, elevated shadow), new utility classes |
| `src/client/pages/DashboardPage.tsx` | MODIFIED | Compliance status filter, complianceSummary fetch, filter useMemo extension |
| `src/client/pages/PayrollWeekDetailPage.tsx` | MODIFIED | State form download buttons (conditional on project.state), HelpText callout |
| `src/client/pages/LandingPage.tsx` | MODIFIED | Hero photography, gradient sections |
| `src/client/pages/ProjectDetailPage.tsx` | MODIFIED | HelpText callouts on workflow steps |
| `src/client/pages/PayrollEntryPage.tsx` | MODIFIED | HelpText inline on key fields |
| `src/client/pages/WorkersPage.tsx` | MODIFIED | EmptyState copy update |
| `src/client/pages/WorkerComplianceHistoryPage.tsx` | MODIFIED | CSV export button |
| `assets/ca-dir-official.pdf` | NEW | CA DIR official form template |
| `assets/wa-li-official.pdf` | NEW | WA L&I official form template |
| `public/hero-construction.jpg` | NEW | Hero photography asset |

---

## Data Flow: Key Scenarios

### State Form Download (CA DIR)
```
PayrollWeekDetailPage (project.state === 'CA')
  → "Download CA DIR" button — fetch-driven Blob download
  → GET /api/export/state-form/:weekId?form=ca-dir
  → export.ts: same ownership check + week/entry load as /wh347/:weekId
  → calls fillCaDirForm(data, templateBytes) from caDirGenerator.ts
  → streams PDF response
  → client: Blob → URL.createObjectURL() → click → revokeObjectURL
```

### Dashboard Compliance Filter
```
DashboardPage mounts
  → useQuery(['compliance-summary']) → GET /api/compliance/projects/summary
  → compliance.ts: loads all user projects → per-project:
      listPayrollWeeks() → for each week: computeCompliance()
      → returns 'compliant' | 'violations' | 'no-payroll' per project
  → client: builds complianceByProject lookup map
  → complianceFilter state drives filteredProjects useMemo
  → filter chips: "All | Compliant | Has Violations | No Payroll"
```

### CSV Export from Compliance History
```
WorkerComplianceHistoryPage
  → "Export CSV" button (no API call needed)
  → client-side: serialize existing violations[] array to CSV string
  → Blob download via URL.createObjectURL()
  → no new API endpoint required — data already in component state
```

---

## Build Order with Dependency Reasoning

| Step | Feature | Depends On | Why This Order |
|------|---------|-----------|----------------|
| 1 | Design tokens + CSS utilities | — | Everything visual depends on tokens being stable. Extend `index.css` first. |
| 2 | `HelpText.tsx` primitive | Step 1 tokens | New primitive; no page work until it exists. One small file. |
| 3 | `Card.tsx` elevated variant | Step 1 tokens | Dashboard and form pages need elevated cards for visual hierarchy. |
| 4 | Dashboard compliance filter | Existing compliance route | `GET /projects/summary` endpoint + `DashboardPage.tsx` useMemo extension. Most user-visible data feature. |
| 5 | CSV export from compliance history | — | Client-only; no API changes. Independent; quick win. |
| 6 | State form generators (CA DIR, WA L&I) | pdf-lib already installed | New service files + single route addition. PDF template assets needed before coding starts — source them first. |
| 7 | Contractor guidance (HelpText callouts) | Steps 2, 3 | Primitive must exist; applies to multiple pages. Do as a single pass across all pages. |
| 8 | UI/UX overhaul (photography, gradients) | Steps 1, 3 | Tokens locked, Card variants done. Visual polish pass across LandingPage, DashboardPage. |
| 9 | Production deployment config | — | Env variable for DATABASE_PATH, Fly.io volume mount setup, SAM.gov prod key. Independent of all feature work. |

**Critical path:** Steps 1 → 4 → 8 for the visual milestone. Steps 6 (state forms) requires sourcing official PDF templates externally before development can begin — this is the most likely scheduling constraint.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Routes Per State Form

**What:** `/api/export/ca-dir/:weekId` and `/api/export/wa-li/:weekId` as two distinct Express routes.
**Why it's wrong:** The ownership check, week load, entry fetch, and response headers are identical. Duplicates ~30 lines of boilerplate per new state. Adding NY DOL later becomes a third copy.
**Do this instead:** One parametric route with `?form=ca-dir|wa-li`. Branch only on the generator call.

### Anti-Pattern 2: Storing Compliance Summary in DB

**What:** Cache compliance status as a column on the `projects` table (`compliance_status TEXT`), update it whenever payroll entries change.
**Why it's wrong:** Compliance is computed from frozen snapshots in `payrollEntries`. A cached status column creates a sync problem: any time an entry is added, corrected, or amended, the cached status must be invalidated. The cache management logic becomes more complex than the computation itself.
**Do this instead:** Compute on read via `computeCompliance()`. It is fast (no live WD lookups). The `/projects/summary` endpoint batches the computation for dashboard use.

### Anti-Pattern 3: Importing Photography via Vite Import

**What:** `import heroBg from '../../assets/hero-construction.jpg'` in LandingPage.
**Why it's wrong:** Vite will process and hash the image at build time. For manually managed brand photography that gets swapped without rebuild, this adds friction. The image hash changes on every swap, invalidating CDN caches unnecessarily.
**Do this instead:** Place images in `public/` and reference via `/hero-construction.jpg` in CSS. Vite copies `public/` verbatim to `dist/` — no processing, no hashing.

### Anti-Pattern 4: Tooltip Library for Guidance

**What:** Install `@radix-ui/react-tooltip` or `react-tooltip` for contextual help.
**Why it's wrong:** Tooltips require hover (broken on touch). A tooltip library adds a dependency and a new interaction pattern. The compliance software is used on desktop browsers with full keyboard and mouse support, but the guidance content needs to be glanceable, not hidden behind hover.
**Do this instead:** `HelpText` component with `inline` variant under form fields and `callout` variant for multi-sentence guidance blocks. Always visible, always readable, no interaction required.

### Anti-Pattern 5: Turso/Postgres for v2.4

**What:** Migrate from SQLite to Turso or Postgres as part of the production deployment phase.
**Why it's wrong:** Both require rewriting the Drizzle adapter and driver. `better-sqlite3` uses a synchronous API (`db.get()`, used in `stateWageAdapter.ts`); both alternatives are async-first. The migration risks breaking the 1,522-test suite and adds 2–3 days of work with no user-visible feature value.
**Do this instead:** Volume mount on Fly.io. Read `DATABASE_PATH` from environment. Ship with the existing SQLite + `better-sqlite3` stack. Migrate to Turso when multi-device access or replication is a real requirement.

---

## Integration Points with Existing Patterns

| Existing Pattern | How v2.4 Uses It |
|-----------------|-----------------|
| `export.ts` route structure | State form route follows identical ownership-check-then-data-load-then-generate pattern. Copy the block from `/wh347/:weekId` as the starting template. |
| `fillWh347()` in `wh347Generator.ts` | `fillCaDirForm()` and `fillWaLiForm()` mirror this signature exactly: `(data, templateBytes) => Promise<Uint8Array>`. Same pdf-lib coordinate overlay approach. |
| `complianceRouter` route ordering | `/projects/summary` must be registered before `/:weekId` — same rule as existing `/project/:projectId` and `/worker/:workerId/history`. The comment at line 17 of `compliance.ts` documents why. |
| `computeCompliance()` | Called per-week in `/projects/summary` — no service changes needed. Function already returns `hasViolations: boolean`. |
| Fetch-driven Blob download in `PayrollWeekDetailPage` | State form buttons reuse this exact pattern: `fetch()` → `.blob()` → `URL.createObjectURL()` → click → `setTimeout(URL.revokeObjectURL, 100)`. `generatingRef` useRef double-click guard should also be replicated per button. |
| `@theme` tokens in `index.css` | New design tokens extend the existing block. Never add `--color-*: initial` which wipes Tailwind's 33 component defaults (per the warning comment at line 1 of `index.css`). |
| `Badge` component variants | No new variants needed for v2.4. Existing `compliant`, `violation`, `warning`, `neutral` cover all new status displays. |
| `EmptyState` component | Update copy on DashboardPage and WorkersPage — no code changes to the component itself, only prop values at call sites. |
| TanStack Query staleTime pattern | `complianceSummary` should use `staleTime: 60_000` — same value as `ProjectCard`'s compliance query, avoiding excessive refetches on navigate-back. |

---

## Sources

- Direct codebase analysis: `src/server/routes/export.ts` — confirmed route pattern, ownership check, data load sequence, stream response shape
- Direct codebase analysis: `src/server/routes/compliance.ts` — confirmed route ordering constraint (specific before wildcard), existing `/project/:projectId` and `/worker/:workerId/history` patterns
- Direct codebase analysis: `src/server/services/complianceService.ts` — confirmed `computeCompliance()` signature, `hasViolations` field, `ComplianceResult` shape
- Direct codebase analysis: `src/server/services/stateWageAdapter.ts` — confirmed CA/WA adapters already exist for wage lookup; state form generation is a separate concern
- Direct codebase analysis: `src/client/index.css` — confirmed @theme token structure and the `--color-*: initial` danger warning
- Direct codebase analysis: `src/server/index.ts` — confirmed `/api/export` and `/api/compliance` mount points
- Direct codebase analysis: `src/server/db/schema.ts` — confirmed `projects.status`, `payrollWeeks` columns, cascade delete patterns
- `.planning/PROJECT.md` — confirmed constraints: pdf-lib, no new UI frameworks, SQLite via Drizzle, JWT auth unchanged, add-only migrations
- `.planning/research/ARCHITECTURE.md` (v2.3) — confirmed prior decisions on ProjectCard per-card compliance fetch, client-side useMemo filter pattern, batch compliance endpoint as deferred item

---
*Architecture research for: HCC Prevailing Wage v2.4 — Ship-Ready + Design Elevation*
*Researched: 2026-03-24*
