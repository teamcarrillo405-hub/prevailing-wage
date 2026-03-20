# Phase 9: Reports - Research

**Researched:** 2026-03-20
**Domain:** Read-only data aggregation reports — fringe benefit summary and worker pay history
**Confidence:** HIGH (all findings drawn directly from codebase inspection)

---

## Summary

Phase 9 adds two read-only reports: a fringe benefit summary per worker (RPT-01) and a worker pay history (RPT-02). Both reports draw exclusively from data already in the database — specifically from `payrollEntries`, which contains `fringeRateSnapshot`, `baseRateSnapshot`, `grossWages`, `deductions`, and 14 daily hour columns (7 days x ST/OT). No schema migrations are required.

The research flag from STATE.md ("Confirm fringeRateSnapshot exists on payrollEntries") is resolved: `fringeRateSnapshot real('fringe_rate_snapshot').notNull()` is present in `payrollEntries` (schema.ts line 144). It is stored and used by the compliance engine already.

The client UI has a "Reports (coming soon)" placeholder — a `<span>` in ProjectDetailPage.tsx (line 115-118) — which must be converted to a real `<Link>` pointing to a new reports page at `/projects/:projectId/reports`. A new ReportsPage (or two sub-pages) must be created and registered in App.tsx. The reports route follows the same structural pattern as the existing VarianceReportPage / VarianceReportPageRoute.

**Primary recommendation:** Build one `ReportsPage` that hosts both reports as tabs (or anchored sections). Backend: one new `reportsRouter` with two GET endpoints. No PDF export needed for v2.0 — on-screen view only per ROADMAP success criteria.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RPT-01 | User can view a fringe benefit summary showing fringe credits per worker for a project | `fringeRateSnapshot` exists on all payroll entries; query joins payrollEntries -> payrollWeeks -> workers, grouped per worker across all weeks in the project |
| RPT-02 | User can view worker pay history — all payroll weeks, hours, gross wages, and deductions — for a worker on a project | All needed columns exist: daily ST/OT columns, `grossWages`, `deductions`, `netPay`; query joins payrollEntries -> payrollWeeks filtered by workerId + projectId |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | (existing) | DB queries — multi-table joins, grouping | Already used across all services |
| Express Router | (existing) | New `/api/reports` route module | Consistent with all other route files |
| React + react-query | (existing) | Client data fetching and display | Used on every existing page |
| Zod | (existing) | Query param validation on report endpoints | Used on all existing routes |
| Tailwind CSS | (existing) | Styling new pages | HCC design tokens already configured |

### Supporting

No new libraries needed. Reports are on-screen read-only tables — no PDF, no charting library required for v2.0.

**Installation:**

None required.

---

## Architecture Patterns

### Recommended File Layout

```
src/server/routes/reports.ts          # New route: reportsRouter
src/server/services/reportsService.ts # New service: getFringeSummary(), getWorkerPayHistory()
src/client/pages/ReportsPage.tsx      # New page: tabs/sections for both reports
tests/routes/reports.test.ts          # Route tests (Supertest pattern)
tests/services/reportsService.test.ts # Service unit tests (if logic is non-trivial)
```

App.tsx: Add `/projects/:projectId/reports` route.
ProjectDetailPage.tsx: Replace `<span>` placeholder with `<Link to={...}>`.
index.ts: Register `app.use('/api/reports', reportsRouter)`.

### Pattern 1: Service-then-Route (matches all existing patterns)

**What:** Pure data computation lives in `reportsService.ts`, the route handles auth/ownership check, then calls the service.
**When to use:** Always — consistent with complianceService, varianceService, payrollService.

```typescript
// src/server/services/reportsService.ts
import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { payrollEntries, payrollWeeks, workers, workerClassifications } from '../db/schema.js';

export interface FringeSummaryRow {
  workerId: string;
  workerName: string;
  totalSt: number;
  totalOt: number;
  totalHours: number;
  totalFringeCredits: number;   // sum of (totalHours * fringeRateSnapshot) per entry
  weekCount: number;
}

export async function getFringeSummary(projectId: string): Promise<FringeSummaryRow[]> {
  const db = getDb();
  // Join payrollEntries -> payrollWeeks (filter projectId) -> workers
  // Aggregate per workerId
  const rows = await db
    .select({ ... })
    .from(payrollEntries)
    .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id))
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .where(eq(payrollWeeks.projectId, projectId));
  // Aggregate in JS (SQLite groupBy in Drizzle works but JS reduce is simpler here)
  return aggregateByWorker(rows);
}
```

```typescript
export interface WorkerPayHistoryRow {
  payrollWeekId: string;
  weekNumber: number;           // payrollWeeks.payrollNumber
  weekEndingDate: string;       // payrollWeeks.weekEndingDate
  totalSt: number;
  totalOt: number;
  grossWages: number | null;
  deductions: number;
  netPay: number | null;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
}

export async function getWorkerPayHistory(
  projectId: string,
  workerId: string,
): Promise<WorkerPayHistoryRow[]> {
  const db = getDb();
  // Join payrollEntries -> payrollWeeks, filter by workerId + projectId
  // Order by weekEndingDate DESC (most recent first)
  const rows = await db
    .select({ ... })
    .from(payrollEntries)
    .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id))
    .where(
      and(
        eq(payrollWeeks.projectId, projectId),
        eq(payrollEntries.workerId, workerId),
      ),
    )
    .orderBy(desc(payrollWeeks.weekEndingDate));
  return rows.map(mapToPayHistoryRow);
}
```

### Pattern 2: Route URL Design

Following the existing convention:

```
GET /api/reports/:projectId/fringe-summary         — RPT-01
GET /api/reports/:projectId/worker/:workerId/pay-history  — RPT-02
```

Ownership check: load project by projectId, verify `project.userId === req.user.userId`. Same assertProjectOwner pattern used in payroll.ts.

### Pattern 3: Client Page — Two-section layout

The ReportsPage receives `projectId` from `useParams`. It renders two sections accessible via simple tab buttons or anchored headings. For RPT-02, a worker selector dropdown is needed (fetch workers list for the project using the existing `GET /api/projects/:projectId/workers` endpoint).

```typescript
// src/client/pages/ReportsPage.tsx
export function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<'fringe' | 'payHistory'>('fringe');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  // ... useQuery calls for each report
}
```

### Pattern 4: Route Registration (index.ts)

```typescript
// In src/server/index.ts — add after existing router registrations
import { reportsRouter } from './routes/reports.js';
app.use('/api/reports', reportsRouter);
```

### Anti-Patterns to Avoid

- **Do NOT query live wage determination tables for these reports.** The ROADMAP success criteria explicitly says "drawn from stored fringe rate snapshots — not live wage determination data." Use only `fringeRateSnapshot` from `payrollEntries`.
- **Do NOT compute fringe credits as a per-week total across all workers.** RPT-01 is per-worker, showing fringe credits each worker earned across all weeks — not a weekly aggregate.
- **Do NOT use a separate DB connection in the service.** Use `getDb()` like all other services.
- **Do NOT skip the ownership check.** Every route that takes a projectId must verify `project.userId === req.user.userId`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grouping payroll entries by worker | Custom reduce loop from scratch | Drizzle select + JS `Map`/`reduce` — same pattern used in varianceService | Edge case: a worker may have multiple classifications in one week (unique constraint is per weekId+workerId+classificationId) — aggregation must sum across classifications per worker per week |
| Ownership check | Inline project fetch every route | Extract `assertProjectOwner()` helper — same helper in payroll.ts | DRY; avoid copy-paste 403 logic |
| Worker selector for RPT-02 | New workers endpoint | Reuse existing `GET /api/projects/:projectId/workers` | Already returns worker list with id + name |

**Key insight:** All data is already stored. The only work is writing join queries and a clean display layer.

---

## Common Pitfalls

### Pitfall 1: Multi-Classification Workers Double-Counted in Fringe Summary

**What goes wrong:** A worker with two active classifications (e.g., Carpenter + Foreman) will have two payroll entries per week — one per classificationId. Summing hours naively without grouping by worker (not classification) will double-count that worker's hours and fringe credits.

**Why it happens:** The unique constraint on `payrollEntries` is `(payrollWeekId, workerId, classificationId)` — so a single worker can have N entries per week.

**How to avoid:** Always aggregate by `workerId` as the grouping key, not `classificationId`. Sum ST and OT across all entries for that worker per week, then multiply each entry's hours by its own `fringeRateSnapshot` before summing.

**Warning signs:** Fringe summary shows 2x expected total for any worker who is both journeyworker and foreman.

### Pitfall 2: fringe_rate_snapshot vs. fringeRate from wageClassifications

**What goes wrong:** Using the live `wageClassifications.fringeRate` instead of `payrollEntries.fringeRateSnapshot` for fringe credit calculation.

**Why it happens:** Wage determinations can be updated; the snapshot was frozen at entry time to support audit accuracy.

**How to avoid:** Always use `fringeRateSnapshot` from `payrollEntries`. ROADMAP success criteria (Phase 9 item 1) explicitly mandates "stored fringe rate snapshots — not live wage determination data."

**Warning signs:** Fringe amounts change when wage determinations are refreshed.

### Pitfall 3: Missing Worker Selection UI for RPT-02

**What goes wrong:** Building RPT-02 without a worker selector shows an empty state because no `workerId` is provided.

**Why it happens:** Unlike RPT-01 (all workers, one project), RPT-02 requires both projectId and workerId.

**How to avoid:** The ReportsPage must load the workers list for the project (via existing workers endpoint) and render a select/dropdown before showing the pay history table. Default to the first worker when the list loads.

### Pitfall 4: Hours Computation

**What goes wrong:** Forgetting to sum the 14 daily columns (monSt + tueSt + ... + sunSt and monOt + ... + sunOt) and instead using a "totalHours" column that does not exist.

**Why it happens:** The schema has no pre-computed total — all 14 daily columns are stored individually (same as compliance engine uses).

**How to avoid:** Compute totals in the service: `totalSt = monSt + tueSt + wedSt + thuSt + friSt + satSt + sunSt`. Reference complianceService.ts lines 52-57 — it already does this correctly.

### Pitfall 5: App.tsx Route Not Registered

**What goes wrong:** ReportsPage renders in isolation but navigating to `/projects/:projectId/reports` shows the dashboard fallback.

**Why it happens:** App.tsx has a catch-all `<Route path="*" element={<Navigate to="/dashboard" />}` — any unregistered path silently redirects.

**How to avoid:** Add route to App.tsx AND update the `<span>` in ProjectDetailPage.tsx to `<Link>` in the same plan.

---

## Code Examples

Verified patterns from existing codebase:

### Hour Summation (from complianceService.ts lines 52-57)

```typescript
const totalSt =
  (e.monSt ?? 0) + (e.tueSt ?? 0) + (e.wedSt ?? 0) +
  (e.thuSt ?? 0) + (e.friSt ?? 0) + (e.satSt ?? 0) + (e.sunSt ?? 0);
const totalOt =
  (e.monOt ?? 0) + (e.tueOt ?? 0) + (e.wedOt ?? 0) +
  (e.thuOt ?? 0) + (e.friOt ?? 0) + (e.satOt ?? 0) + (e.sunOt ?? 0);
```

### Fringe Credit Calculation (per entry)

```typescript
// fringe credits = (totalSt + totalOt) * fringeRateSnapshot
// This is the DOL standard: fringe is paid on all hours worked
const fringeCreditsForEntry = (totalSt + totalOt) * entry.fringeRateSnapshot;
```

### Ownership Check Pattern (from payroll.ts)

```typescript
async function assertProjectOwner(projectId, userId, res) {
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return false; }
  if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return false; }
  return true;
}
```

### Drizzle Multi-Table Join with Filter (from compliance route pattern)

```typescript
const rows = await db
  .select({
    entry: payrollEntries,
    workerName: workers.name,
    weekNumber: payrollWeeks.payrollNumber,
    weekEndingDate: payrollWeeks.weekEndingDate,
  })
  .from(payrollEntries)
  .innerJoin(payrollWeeks, eq(payrollEntries.payrollWeekId, payrollWeeks.id))
  .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
  .where(eq(payrollWeeks.projectId, projectId))
  .orderBy(desc(payrollWeeks.weekEndingDate));
```

### Supertest Route Test Pattern (from compliance.test.ts)

```typescript
describe('GET /api/reports/:projectId/fringe-summary', () => {
  it('returns 200 with FringeSummaryRow[] shape for valid project', async () => {
    const cookie = await registerUser('rpt01-200');
    const { projectId } = await seedProjectFixture(cookie);
    const res = await supertest(app)
      .get(`/api/reports/${projectId}/fringe-summary`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
  });
});
```

### ProjectDetailPage Link Replacement

```typescript
// BEFORE (Phase 8 placeholder):
<span className="inline-block rounded border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
  Reports (coming soon)
</span>

// AFTER (Phase 9):
<Link
  to={`/projects/${project.id}/reports`}
  className="inline-block rounded border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
>
  Reports
</Link>
```

---

## Schema Findings (Research Flag Resolution)

**Research flag resolved: `fringeRateSnapshot` EXISTS.**

From `src/server/db/schema.ts`, line 144:
```
fringeRateSnapshot: real('fringe_rate_snapshot').notNull(),
```

No schema migration is needed for Phase 9. All data required by both reports is already stored:

| Report Need | Column | Table | Status |
|-------------|--------|-------|--------|
| Fringe rate at entry time | `fringe_rate_snapshot` | `payroll_entries` | EXISTS |
| Base rate at entry time | `base_rate_snapshot` | `payroll_entries` | EXISTS |
| Daily ST hours (7 cols) | `mon_st` through `sun_st` | `payroll_entries` | EXISTS |
| Daily OT hours (7 cols) | `mon_ot` through `sun_ot` | `payroll_entries` | EXISTS |
| Gross wages | `gross_wages` | `payroll_entries` | EXISTS (nullable) |
| Deductions | `deductions` | `payroll_entries` | EXISTS (default 0) |
| Net pay | `net_pay` | `payroll_entries` | EXISTS (nullable) |
| Worker name | `name` | `workers` | EXISTS |
| Week number | `payroll_number` | `payroll_weeks` | EXISTS |
| Week ending date | `week_ending_date` | `payroll_weeks` | EXISTS |

---

## Navigation / UI Entry Point

**Current state (Phase 8 output):** `ProjectDetailPage.tsx` line 115-118 contains:

```tsx
<span className="inline-block rounded border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
  Reports (coming soon)
</span>
```

**Phase 9 must:**
1. Create `ReportsPage.tsx` at route `/projects/:projectId/reports`
2. Register route in `App.tsx`
3. Replace the `<span>` placeholder in `ProjectDetailPage.tsx` with a `<Link>`

No other navigation changes are needed. The reports page is self-contained.

---

## RPT-01: Fringe Benefit Summary — Computation Design

**What the report shows (per worker for a project):**

| Worker Name | Trade | Total ST Hours | Total OT Hours | Total Hours | Fringe Rate (last entry) | Total Fringe Credits |
|-------------|-------|---------------|---------------|-------------|--------------------------|---------------------|

**Computation:**
- For each worker, sum across all payroll entries across all weeks in the project
- `totalFringeCredits = sum over entries of: (totalSt + totalOt) * fringeRateSnapshot`
- Note: `fringeRateSnapshot` may differ per week if the WD was updated — use the per-entry snapshot, not a single rate
- Display note: show "Fringe Rate" as the fringe rate from the most recent entry (or a range if it varies)
- Sort: alphabetical by worker name

**Edge cases:**
- Worker with no payroll entries: do not include (query naturally excludes them via inner join)
- grossWages being null: irrelevant for fringe summary — fringe credits are hours-based, not wages-based

---

## RPT-02: Worker Pay History — Computation Design

**What the report shows (for a specific worker on a project, all weeks descending):**

| Week # | Week Ending | ST Hours | OT Hours | Base Rate | Fringe Rate | Gross Wages | Deductions | Net Pay |
|--------|-------------|----------|----------|-----------|-------------|-------------|------------|---------|

**Computation:**
- Filter payrollEntries by workerId AND payrollWeeks.projectId
- Sum daily columns for ST and OT
- Display grossWages, deductions, netPay directly from stored values (may be null — show "—")
- Order by weekEndingDate DESC (most recent at top)

**Edge cases:**
- Worker may have entries on multiple classifications in a single week — each should appear as a separate row (or be summed per week — simpler for audit readability to show per week, not per classification)
- Decision: aggregate per week (sum hours, sum wages) for cleaner display

---

## Suggested Plan Structure

The following 4-plan breakdown follows the Wave 0 / Wave 1 / Wave 2 pattern established in prior phases:

| Plan | Content |
|------|---------|
| 09-01 | Wave 0: Test stubs — `reports.test.ts` (RPT-01 route), `reportsService.test.ts` (RPT-01, RPT-02 data shape) |
| 09-02 | Wave 1: `reportsService.ts` + `reports.ts` route — both endpoints |
| 09-03 | Wave 1: `ReportsPage.tsx` — both report sections with worker selector |
| 09-04 | Wave 2: Wire App.tsx route + ProjectDetailPage.tsx link replacement + browser checkpoint |

---

## Validation Architecture

`workflow.nyquist_validation` is not present in config.json (key absent) — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/routes/reports.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements — Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RPT-01 | GET /api/reports/:projectId/fringe-summary returns array with workerId, workerName, totalHours, totalFringeCredits | integration | `npx vitest run tests/routes/reports.test.ts` | Wave 0 |
| RPT-01 | Returns 403 when project owned by different user | integration | `npx vitest run tests/routes/reports.test.ts` | Wave 0 |
| RPT-01 | Returns 404 when project does not exist | integration | `npx vitest run tests/routes/reports.test.ts` | Wave 0 |
| RPT-02 | GET /api/reports/:projectId/worker/:workerId/pay-history returns array ordered by weekEndingDate DESC | integration | `npx vitest run tests/routes/reports.test.ts` | Wave 0 |
| RPT-02 | Pay history row has weekNumber, totalSt, totalOt, grossWages, deductions, netPay | integration | `npx vitest run tests/routes/reports.test.ts` | Wave 0 |
| RPT-02 | Returns 403 when project owned by different user | integration | `npx vitest run tests/routes/reports.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/routes/reports.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/routes/reports.test.ts` — covers RPT-01 and RPT-02 route shape + auth
- [ ] `tests/services/reportsService.test.ts` — covers getFringeSummary and getWorkerPayHistory data shape (optional — route tests may be sufficient given precedent in this codebase)

*(Existing test infrastructure — db.ts helper, supertest, vitest — covers all phase requirements. No new frameworks needed.)*

---

## Open Questions

1. **Fringe credits display: per-week rows or a single aggregated total per worker?**
   - What we know: RPT-01 requirement says "fringe credits per worker for a project" — aggregated, not per-week
   - What's unclear: whether showing a per-week breakdown within the fringe summary adds value for DOL audit purposes
   - Recommendation: Show one row per worker with total aggregated credits, not per-week breakdown. Simpler table, directly matches requirement wording. If per-week breakdown is needed, RPT-02 (pay history) already covers the week-by-week view.

2. **RPT-02 aggregation: per-week or per-week-per-classification?**
   - What we know: A worker can have N classifications per week, so N `payrollEntries` rows per week
   - What's unclear: DOL audit expectation — do auditors want to see breakdown by classification or total per week?
   - Recommendation: Aggregate to one row per week (sum hours and wages across all classifications for that worker that week). Cleaner and simpler; classification detail is visible in the WH-347 itself.

3. **PDF export scope**
   - What we know: ROADMAP success criteria says only "view" — no mention of PDF
   - What's unclear: whether "view" implies print/export capability
   - Recommendation: On-screen only for v2.0. No PDF for Phase 9. Adding browser `window.print()` via a button is trivial and can be done in Phase 9 if desired without a new library, but do not implement server-side PDF.

---

## Sources

### Primary (HIGH confidence)

- `src/server/db/schema.ts` — exact column names on payrollEntries confirmed (lines 121-157)
- `src/server/services/payrollService.ts` — existing query patterns, getPayrollEntries structure
- `src/server/services/complianceService.ts` — hour summation pattern (lines 52-57)
- `src/client/pages/ProjectDetailPage.tsx` — Reports placeholder location (lines 115-118)
- `src/client/App.tsx` — full route registry confirmed, no /reports route exists
- `src/server/index.ts` — all registered routers confirmed, no reportsRouter
- `src/server/routes/compliance.ts` — ownership check pattern, router structure
- `src/server/routes/variance.ts` — service-then-route pattern
- `vitest.config.ts` + `tests/helpers/db.ts` — test infrastructure

### Secondary (MEDIUM confidence)

- ROADMAP.md Phase 9 success criteria — "fringe credits drawn from stored fringe rate snapshots — not live wage determination data"
- STATE.md research flags — Phase 9 flag confirmed resolved (fringeRateSnapshot exists)

---

## Metadata

**Confidence breakdown:**
- Schema / data availability: HIGH — directly inspected schema.ts
- Standard stack: HIGH — no new dependencies; all existing patterns apply
- Architecture patterns: HIGH — directly modeled on existing compliance and variance routes
- Pitfalls: HIGH — derived from actual schema constraints and existing code behavior
- Navigation entry point: HIGH — read ProjectDetailPage.tsx and App.tsx directly

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable; no fast-moving dependencies)
