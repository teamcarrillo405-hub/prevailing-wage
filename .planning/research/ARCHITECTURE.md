# Architecture Research

**Domain:** Prevailing wage compliance SaaS — v2.3 feature integration
**Researched:** 2026-03-23
**Confidence:** HIGH — based on direct codebase analysis of all affected files

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Client (Vite)                           │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────────┐ │
│  │ DashboardPage│  │ PayrollListPage │  │  PayrollWeekDetailPage   │ │
│  │  (+ search/  │  │  (+ submitted  │  │  (+ submission panel,    │ │
│  │   filter,    │  │   badges,      │  │   amend button,          │ │
│  │   archive    │  │   amendment    │  │   amended WH-347 label)  │ │
│  │   toggle)    │  │   badges)      │  │                          │ │
│  └──────┬───────┘  └──────┬─────────┘  └───────────┬──────────────┘ │
│         │                 │                         │                │
│  ┌──────┴─────────────────┴─────────────────────────┴─────────────┐ │
│  │             TanStack Query (queryKey cache + invalidation)       │ │
│  └──────────────────────────────────┬──────────────────────────────┘ │
└─────────────────────────────────────┼────────────────────────────────┘
                                      │ fetch /api/*
┌─────────────────────────────────────┼────────────────────────────────┐
│                        Express Server                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │
│  │/api/payroll │  │/api/reports  │  │/api/export │  │/api/projects│ │
│  │ (+ /copy,   │  │ (+ /workers/ │  │ (amended   │  │ (+ ?status  │ │
│  │  /submit,   │  │  :id/        │  │  PDF label)│  │  filter)    │ │
│  │  /amend)    │  │  violations) │  │            │  │             │ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  └─────┬──────┘ │
│         │                │                 │                │        │
│  ┌──────┴────────────────┴─────────────────┴────────────────┴──────┐ │
│  │     Services: payrollService, complianceService,                 │ │
│  │     reportsService, wh347Generator                               │ │
│  └──────────────────────────────────┬─────────────────────────────┘  │
└─────────────────────────────────────┼────────────────────────────────┘
                                      │ Drizzle ORM
┌─────────────────────────────────────┼────────────────────────────────┐
│  SQLite                                                               │
│  payrollWeeks (+ submitted_at, submitted_to,                         │
│                + amendment_number, original_week_id)                 │
│  payrollEntries  │  projects (status already exists)                 │
│  workers  │  workerClassifications  │  wageDeterminations            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Copy Previous Payroll Week

### What it does
Pre-fill a new payroll week from a prior week's entries (same workers, same classifications, same ST/OT hours as a starting template). Contractor adjusts from there.

### DB changes
None. Uses existing `payrollWeeks` and `payrollEntries` tables.

### New API route
```
POST /api/payroll/weeks/copy
Body:    { projectId, sourceWeekId, weekEndingDate, payrollNumber }
Response: { id: newWeekId, payrollNumber }
```

Server logic:
1. `assertProjectOwner(projectId, userId)` — existing ownership pattern
2. `getPayrollEntries(sourceWeekId)` — already returns all 14 daily hour columns + rate snapshots
3. `createPayrollWeek({ projectId, weekEndingDate, payrollNumber })`
4. Iterate source entries: call `upsertPayrollEntry()` for each, with new `payrollWeekId`, copying all ST/OT and snapshot columns verbatim

Rate snapshots from the prior week are copied as-is. They represent the rate at the time of the prior entry. The contractor edits them if rates changed before certifying the new week. This is intentional — the copy is a template, not a certified document.

### Client changes
- `PayrollEntryPage.tsx` (MODIFIED): Add a "Copy from previous week" option in the new-week creation form. When checked: fetch `GET /api/payroll/projects/:projectId/weeks` to list prior weeks, show a `<select>` for source week, then POST to `/api/payroll/weeks/copy` instead of `POST /api/payroll/weeks`.
- On success: navigate to the new `PayrollEntryPage` with the new weekId.
- TanStack Query invalidation: `['payroll-weeks', projectId]`

---

## Feature 2: WH-347 Submission Tracking

### What it does
Mark a payroll week as submitted — record when and to whom. Visible in the payroll list and week detail view.

### DB changes — add-only to `payrollWeeks`
```sql
ALTER TABLE payroll_weeks ADD COLUMN submitted_at TEXT;
ALTER TABLE payroll_weeks ADD COLUMN submitted_to TEXT;
```
- `submitted_at`: ISO 8601 timestamp, null = not yet submitted
- `submitted_to`: free-text agency name (e.g. "DOL EBSA", "City of LA PWB"), null until submitted

Two nullable columns on the existing table. No new table needed.

### New API routes (added to `routes/payroll.ts`)
```
POST /api/payroll/weeks/:weekId/submit
Body:    { submittedTo: string }
Response: { week }   (full week row with new columns)

DELETE /api/payroll/weeks/:weekId/submit
Response: { week }   (clears submitted_at and submitted_to)
```

POST sets `submitted_at = new Date().toISOString()` and `submitted_to = body.submittedTo`.
DELETE sets both to null. Neither touches `payrollEntries`.

`GET /api/payroll/weeks/:id` already returns the full week row via Drizzle `select()`. Once the migration adds the columns, they appear in the response automatically — no route change needed for reads.

### Client changes
- `PayrollWeek` interface in both `PayrollListPage.tsx` and `PayrollWeekDetailPage.tsx` (MODIFIED): add `submittedAt: string | null` and `submittedTo: string | null`
- `PayrollListPage.tsx` (MODIFIED): Render a `<Badge variant="compliant">Submitted</Badge>` next to weeks where `submittedAt` is not null. Show submittedTo text alongside.
- `PayrollWeekDetailPage.tsx` (MODIFIED): Add a submission status panel (new `<Card>`) below the compliance check card.
  - Not submitted: show a form with a text input for agency name and a "Mark as Submitted" button
  - Submitted: show formatted date + agency name + an "Undo" link that calls `DELETE /api/payroll/weeks/:id/submit`
- Query invalidation: `['payroll-week', weekId]` and `['payroll-weeks', projectId]`

---

## Feature 3: Payroll Amendment Workflow

### What it does
Correct a submitted payroll week, generating an "AMENDED" WH-347 for resubmission.

### Decision: extend `payrollWeeks`, not a new table
A separate `payroll_amendments` table adds join complexity to every week query downstream (compliance, export, reports). Because there is at most one or two correction cycles per submission in practice, extending `payrollWeeks` is the correct call.

### DB changes — add-only to `payrollWeeks`
```sql
ALTER TABLE payroll_weeks ADD COLUMN amendment_number INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payroll_weeks ADD COLUMN original_week_id TEXT REFERENCES payroll_weeks(id);
```
- `amendment_number`: 0 = original, 1 = first amendment, 2 = second
- `original_week_id`: null for originals; points to the root payroll week for all amendments

### New API route
```
POST /api/payroll/weeks/:weekId/amend
Response: { id: newWeekId, payrollNumber, amendmentNumber }
```

Server logic:
1. Load source week, verify ownership
2. Create a new `payrollWeek` with: same `projectId`, `weekEndingDate`, `payrollNumber`; `amendment_number = sourceWeek.amendment_number + 1`; `original_week_id = sourceWeek.original_week_id ?? sourceWeek.id`; `submitted_at = null`
3. Copy all `payrollEntries` from source to new week (same bulk-upsert logic as copy-week)
4. Return new week id

### Amended WH-347 PDF label
`fillWh347()` in `wh347Generator.ts` is unchanged. The caller (`export.ts`) assembles the `payrollNumber` string. Modify the assembly block in `export.ts`:

```typescript
const payrollNumberLabel = week.amendment_number > 0
  ? `${week.payrollNumber} (AMENDED ${week.amendment_number})`
  : String(week.payrollNumber);
```

This renders on the WH-347 in the "Certified Payroll No." field. No coordinate or layout changes needed.

### Client changes
- `PayrollWeekDetailPage.tsx` (MODIFIED): Show "Amend This Week" button only when `submittedAt` is not null. Show `<Badge variant="warning">Amendment</Badge>` when `amendment_number > 0`.
- `PayrollListPage.tsx` (MODIFIED): Show amendment badge next to amended weeks. Sort or group so amendments appear adjacent to their original week.
- `PayrollWeek` interface: add `amendmentNumber: number` and `originalWeekId: string | null`

### Build dependency
Submission tracking (Feature 2) must be complete before amendments. The "Amend" button is shown only on weeks where `submittedAt` is not null.

---

## Feature 4: Project Completion / Archive

### What it does
Mark a project as archived (complete), hide it from the active dashboard by default, show it on demand.

### DB changes
None. The `projects` table already has `status TEXT NOT NULL DEFAULT 'active'` typed as `'active' | 'closed'`. The existing `DELETE /api/projects/:id` route already sets `status = 'closed'`. The existing `PATCH /api/projects/:id` already accepts `{ status }` via `UpdateProjectSchema`. No new columns or routes are needed.

### API change: `GET /api/projects` (MODIFIED)
Add an optional `?status=` query param with values `active` (default), `closed`, or `all`. Filter is applied server-side because it is a simple `eq(projects.status, status)` clause — not worth the complexity of parsing on the client.

```typescript
const statusFilter = req.query.status ?? 'active';
const where = statusFilter === 'all'
  ? eq(projects.userId, userId)
  : and(eq(projects.userId, userId), eq(projects.status, statusFilter));
```

Default to `active` so existing behavior is unchanged for all current consumers.

### Client changes
- `DashboardPage.tsx` (MODIFIED): Add a "Show Archived" toggle (boolean `useState`). When toggled, pass `?status=all` or `?status=closed` as a query param to the projects fetch. Use `['projects', { status }]` as the query key so toggling does not invalidate the active-project cache.
- `ProjectDetailPage.tsx` (MODIFIED): Add "Archive Project" / "Restore Project" button in the project actions area. Calls `PATCH /api/projects/:id` with `{ status: 'closed' }` or `{ status: 'active' }`. Invalidate `['projects', { status: 'active' }]` on success.
- `ProjectCard.tsx` (MODIFIED): When `project.status === 'closed'`, render a `<Badge variant="neutral">Archived</Badge>` on the card and reduce visual emphasis (e.g. opacity-60 or a gray border).

---

## Feature 5: Dashboard Search + Filter

### What it does
Let contractors search by project name and filter by funding type on the dashboard. Compliance filter is scoped below.

### Decision: client-side filter over TanStack Query data
A contractor's project list is small (10–100 projects at most). Server-side filtering adds API surface, tests, and cache key fragmentation. Client-side `useMemo` over the already-fetched array is the correct approach.

### State and filter logic (all in `DashboardPage.tsx`)
```typescript
const [searchTerm, setSearchTerm] = useState('');
const [fundingTypeFilter, setFundingTypeFilter] = useState<'all' | 'federal' | 'state' | 'mixed'>('all');

const filteredProjects = useMemo(() =>
  projects
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(p => fundingTypeFilter === 'all' || p.fundingType === fundingTypeFilter),
  [projects, searchTerm, fundingTypeFilter]
);
```

### Compliance filter (deferred pattern)
The compliance badge for each project is fetched inside `ProjectCard` via a per-card `useQuery`. To filter by compliance at the dashboard level, the options are:

**Option A (deferred to future):** Add `GET /api/compliance/projects/summary?projectIds=x,y,z` batch endpoint. `DashboardPage` fetches all summaries at once, passes badge data as a prop to each card, and can filter on it.

**Option B (v2.3 scope):** Implement name + fundingType filter now. Note "compliance filter requires batch summary endpoint" in the UI as a future enhancement. Do not block v2.3 on the batch endpoint.

Implement Option B for v2.3.

### Client changes
- `DashboardPage.tsx` (MODIFIED): Add search input + funding type dropdown above the project grid. Add `useMemo`-derived `filteredProjects`. Render `filteredProjects` instead of `projects`. Show zero-results EmptyState when filter yields no matches.

---

## Feature 6: Per-Worker Compliance History

### What it does
Show a worker-centric view of all compliance violations across all projects and weeks — for audit responses.

### DB changes
None. All data exists in `payrollEntries`, `payrollWeeks`, `workerClassifications`, and `projects`.

### New API route
```
GET /api/reports/workers/:workerId/violations
Response: {
  workerId: string,
  workerName: string,
  violations: Array<{
    projectId: string,
    projectName: string,
    weekId: string,
    weekEndingDate: string,
    payrollNumber: number,
    violationType: 'under-wage' | 'cwhssa-ot' | 'apprentice-ratio',
    expected?: number,
    actual?: number,
    delta?: number,
    detail?: string
  }>
}
```

**Ownership check:** The worker belongs to a project. Verify via join:
```typescript
const [worker] = await db.select().from(workers)
  .innerJoin(projects, eq(workers.projectId, projects.id))
  .where(and(eq(workers.id, workerId), eq(projects.userId, userId)))
  .limit(1);
```

**Query strategy:** Call `computeCompliance(db, weekId)` per week that this worker appeared in, then filter `result.violations` to entries where `workerId` matches. This is N+1 per week but is an audit-time operation, not a hot path. Flag it as a known pattern and document that a batch computation path can replace it if needed.

This reuses the existing `complianceService.computeCompliance()` exactly as-is. No service changes.

**Worker week lookup:** Query `payrollEntries` joined to `payrollWeeks` and `projects` filtered by `workerId` and `projects.userId = userId` to get the full list of `weekId`s across all projects. Then loop over unique weekIds.

### New service function: `reportsService.ts` (MODIFIED)
Add `getWorkerViolations(workerId, userId)` that runs the query strategy above and returns the structured violation list with project and week context.

### New client page: `WorkerViolationsPage.tsx` (NEW)
- Route: `/workers/:workerId/violations` (new route in `App.tsx`)
- Layout: `PageHeader` with worker name, table of violations with columns: Project, Week Ending, Payroll #, Violation Type, Expected, Actual, Delta
- Badge per violation type using existing `Badge` variants
- Entry point: "Compliance History" link on each worker row in `WorkersPage.tsx` (MODIFIED)

A dedicated page is correct for audit use — it needs full table space and printability.

---

## Component Map: New vs. Modified

| Component | Status | Change |
|-----------|--------|--------|
| `schema.ts` | MODIFIED | Add 4 columns to `payrollWeeks` (submitted_at, submitted_to, amendment_number, original_week_id) |
| `payrollService.ts` | MODIFIED | Add `copyPayrollWeek()` and `createAmendedWeek()` functions |
| `reportsService.ts` | MODIFIED | Add `getWorkerViolations()` function |
| `wh347Generator.ts` | NO CHANGE | `fillWh347()` unchanged — caller assembles amended label string |
| `routes/export.ts` | MODIFIED | Detect `amendment_number > 0`, format `payrollNumberLabel` |
| `routes/payroll.ts` | MODIFIED | Add `POST /weeks/copy`, `POST /weeks/:id/submit`, `DELETE /weeks/:id/submit`, `POST /weeks/:id/amend` |
| `routes/reports.ts` | MODIFIED | Add `GET /workers/:workerId/violations` |
| `routes/projects.ts` | MODIFIED | Add `?status=` query param to `GET /` list route |
| `DashboardPage.tsx` | MODIFIED | Search/filter bar, archive toggle, `useMemo` filter, `['projects', { status }]` query key |
| `PayrollListPage.tsx` | MODIFIED | Submitted badge, amendment badge on week rows; `PayrollWeek` interface extended |
| `PayrollWeekDetailPage.tsx` | MODIFIED | Submission panel (Card), Amend button, amendment badge; `PayrollWeek` interface extended |
| `ProjectDetailPage.tsx` | MODIFIED | Archive/Restore action button |
| `ProjectCard.tsx` | MODIFIED | Render archived state badge |
| `PayrollEntryPage.tsx` | MODIFIED | "Copy from previous week" option in new-week form |
| `WorkersPage.tsx` | MODIFIED | Add "Compliance History" link per worker row |
| `WorkerViolationsPage.tsx` | NEW | Per-worker compliance history table, route `/workers/:workerId/violations` |

---

## DB Migration Strategy

All changes are add-only. Four new nullable/defaulted columns on `payrollWeeks`. No column drops anywhere.

**Migration file: `0009_payroll_week_submission_amendment.sql`**
```sql
ALTER TABLE payroll_weeks ADD COLUMN submitted_at TEXT;
ALTER TABLE payroll_weeks ADD COLUMN submitted_to TEXT;
ALTER TABLE payroll_weeks ADD COLUMN amendment_number INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payroll_weeks ADD COLUMN original_week_id TEXT REFERENCES payroll_weeks(id);
```

Must be manually registered in `src/server/db/migrations/meta/_journal.json` (per PROJECT.md migration workflow constraint). Next `idx` is 5 based on the current journal (entries 0–4).

No migration needed for any other feature: project archive uses the existing `status` column, all other features are computed or use existing tables.

---

## Data Flow: Key Scenarios

### Copy Week
```
PayrollEntryPage → user enables "Copy from Week #N"
  → POST /api/payroll/weeks/copy { sourceWeekId, weekEndingDate, payrollNumber }
  → payroll.ts: assertProjectOwner → getPayrollEntries(sourceWeekId)
             → createPayrollWeek() → upsertPayrollEntry() × N entries
  → Response: { id: newWeekId }
  → Client navigates to PayrollEntryPage with newWeekId
  → Invalidate: ['payroll-weeks', projectId]
```

### Submit Week
```
PayrollWeekDetailPage submission panel
  → POST /api/payroll/weeks/:id/submit { submittedTo }
  → db.update(payrollWeeks).set({ submitted_at, submitted_to, updatedAt })
  → Response: { week } (includes new columns)
  → Invalidate: ['payroll-week', weekId], ['payroll-weeks', projectId]
  → UI: panel switches to "Submitted on [date] to [agency]" state
```

### Amend Week
```
PayrollWeekDetailPage (submittedAt not null)
  → "Amend This Week" button
  → POST /api/payroll/weeks/:id/amend
  → Server: createPayrollWeek with amendment_number = N+1, original_week_id set
           → copyEntries from source to new week
  → Response: { id: newWeekId, amendmentNumber }
  → Client navigates to PayrollEntryPage for new week (contractor edits)
  → On WH-347 download from amended week: export.ts formats
    payrollNumber as "3 (AMENDED 1)"
```

### Worker Violations
```
WorkersPage → "Compliance History" link for worker
  → GET /api/reports/workers/:workerId/violations
  → reportsService: query all payrollWeeks for worker across all projects
                  → call computeCompliance(db, weekId) per week
                  → filter violations by workerId, collect with project context
  → WorkerViolationsPage renders grouped violation table
```

---

## Build Order with Dependency Reasoning

| Step | Feature | Depends On | Rationale |
|------|---------|-----------|-----------|
| 1 | DB migration | — | Prerequisite for submission tracking and amendments. Must be done first. |
| 2 | Project Archive | Migration not needed | Uses existing `status` column. Completely independent. Delivers visible value immediately. Shares `DashboardPage.tsx` work with Feature 5. |
| 3 | Dashboard Search + Filter | Step 2 (shares DashboardPage session) | Name + fundingType filter is pure client logic. Do in same session as archive since both modify DashboardPage. |
| 4 | Submission Tracking | Step 1 (new DB columns) | New routes + UI panel. Independent of amendment. Unlocks the "amend" trigger. |
| 5 | Copy Previous Week | Step 1 done (no migration needed for copy, but migration defines week shape) | Entry-copying logic is reused by amendments in Step 6. Build it first to validate the pattern. |
| 6 | Amendment Workflow | Steps 1, 4, 5 | Reuses copy-entries logic. "Amend" button requires submission state from Step 4. |
| 7 | Per-Worker Violations | — | Fully independent read-only feature. No DB changes. Can slot in any time but placed last as a reporting feature. |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Compliance Results in DB

**What people do:** Create a `compliance_violations` table, write violation rows at payroll entry time, query that table for reports.

**Why it's wrong:** Compliance results are derived from `payrollEntries` snapshots. Storing them duplicates data, creates a sync problem if entries are corrected, and adds write overhead to the hot path.

**Do this instead:** Compute on read. `complianceService.computeCompliance()` is fast because it only reads entries — no live WD lookups. Worker violation history is an audit-time operation, not a dashboard query, so N+1 per week is acceptable.

### Anti-Pattern 2: New `payroll_amendments` Table

**What people do:** Create a `payroll_amendments` table with FK to `payroll_weeks`, treat original and amendment as different entity types.

**Why it's wrong:** Every downstream consumer (compliance, WH-347 generation, reports, list queries) would need to join `payroll_amendments` to know if a week is an amendment. `payrollWeeks` is the central entity — extending it with `amendment_number` and `original_week_id` keeps all existing consumers intact.

**Do this instead:** Two nullable/defaulted columns on `payrollWeeks`. Zero = original, positive integer = amendment count. `original_week_id` provides back-reference without a separate table.

### Anti-Pattern 3: Server-Side Filter for Dashboard Search

**What people do:** Add `?name=`, `?fundingType=`, `?compliance=` query params to `GET /api/projects`, add WHERE clauses, write tests for each combination.

**Why it's wrong:** A contractor's project list is small. Server-side filtering adds API surface, test complexity, and cache key fragmentation (every filter combo becomes a distinct cache entry).

**Do this instead:** Fetch all projects once with `?status=active`, filter client-side with `useMemo`. Keep the API param surface minimal (only `?status=` is needed). Add a batch compliance summary endpoint only if compliance filtering is needed as a first-class feature.

### Anti-Pattern 4: Auto-Clearing Submission Status on Entry Edit

**What people do:** When a contractor edits any payroll entry on a submitted week, automatically clear `submitted_at`.

**Why it's wrong:** Removes the audit trail without the contractor's explicit intent. The amendment workflow handles correction of submitted weeks.

**Do this instead:** Submitted weeks are read-only for entry edits. The "Amend" action creates a new week for corrections. The original submitted week is preserved immutably once `submitted_at` is set.

### Anti-Pattern 5: Rate Snapshots Re-fetched During Copy

**What people do:** When copying a prior week's entries to a new week, look up the current wage determination rate for each worker's classification and use that as the snapshot.

**Why it's wrong:** The copy is a template. If the contractor copies week 3 to create week 4 and the rate changed in week 4, they need to know about it and update it intentionally. Silently updating rates during copy masks the change.

**Do this instead:** Copy the prior week's `baseRateSnapshot` and `fringeRateSnapshot` verbatim. The contractor sees the carried-over rates on `PayrollEntryPage` and corrects them if needed before certifying.

---

## Integration Points with Existing Patterns

| Existing Pattern | How v2.3 Uses It |
|-----------------|-----------------|
| `assertProjectOwner()` local helper | Replicated in each new route following the established pattern. Do not refactor to shared module — each route file is self-contained by design. |
| `upsertPayrollEntry()` | Copy-week and amendment reuse this function directly — no bulk insert shortcut needed given 8 workers/page as the ceiling. |
| `complianceService.computeCompliance()` | Worker violations calls this per-week, no service changes. |
| `Badge` component variants | Submitted: `variant="compliant"`. Amendment: `variant="warning"`. Archived: `variant="neutral"`. All existing variants cover v2.3 needs. |
| `queryKey: ['payroll-week', weekId]` | Submission and amendment actions must invalidate this key in addition to the list key. |
| `isFinal` flag on `payrollWeeks` | Amendments copy the source week's `isFinal` value unchanged. Not reset by the amendment workflow. |
| Migration manual journal pattern | New migration must add a `_journal.json` entry with `idx: 5` (next after the current 0–4 sequence). |
| `wh347Data.payrollNumber` string field | Already accepts strings — amended label `"3 (AMENDED 1)"` requires no type change to `Wh347Data`. |

---

## Sources

- Direct codebase analysis: `src/server/db/schema.ts` — full table structure confirmed
- Direct codebase analysis: `src/server/routes/payroll.ts`, `projects.ts`, `export.ts`, `reports.ts`
- Direct codebase analysis: `src/server/services/payrollService.ts`, `complianceService.ts`, `reportsService.ts`, `wh347Generator.ts`
- Direct codebase analysis: `src/client/pages/DashboardPage.tsx`, `PayrollListPage.tsx`, `PayrollWeekDetailPage.tsx`
- Direct codebase analysis: `src/server/db/migrations/meta/_journal.json` — migration index sequence
- `.planning/PROJECT.md` — confirmed constraints, key decisions, and existing status column

---
*Architecture research for: HCC Prevailing Wage v2.3 — Contractor Workflow Efficiency + Audit Readiness*
*Researched: 2026-03-23*
