# Phase 8: Dashboard + UX Polish - Research

**Researched:** 2026-03-20
**Domain:** React/TypeScript frontend polish — compliance badge aggregation, navigation, missing-data warnings
**Confidence:** HIGH (all findings from direct codebase inspection)

## Summary

Phase 8 is a pure frontend-and-light-backend polish phase. The compliance engine (computeCompliance) exists and is fully functional, but it operates per-week. The dashboard needs per-project compliance status which requires aggregating across all weeks — the right strategy is a new backend endpoint that runs computeCompliance over all weeks for a project and returns a rolled-up badge state. All five requirements map to existing pages with well-understood gaps.

The project already uses: React 19, React Router v7, TanStack Query v5, Tailwind CSS v4, gold `#F5C518` as the brand accent. No new libraries are needed. Every change is isolated to existing page/component files plus one new backend route.

**Primary recommendation:** Add `GET /api/compliance/project/:projectId` backend endpoint that aggregates all weeks and returns `{ badge: 'clean' | 'violations', weekCount: number, lastWeekNumber: number | null }`. Drive DASH-01 and DASH-02 from this single endpoint. All other requirements (UX-01, UX-02, UX-03) are frontend-only changes to existing pages. UX-01 requires a small wrapper page so VarianceReportPage can be mounted as a route (see Open Question 2).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Each project card shows a compliance status badge (green = clean, yellow = warnings, red = active violations) | Requires new backend aggregation endpoint; ProjectCard.tsx must accept badge prop; DashboardPage.tsx must fetch badge data |
| DASH-02 | Each project card shows total payroll weeks submitted and the last week number | Same aggregation endpoint can return weekCount + lastWeekNumber; payrollWeeks table has payrollNumber column already |
| UX-01 | Project detail page shows clear navigation to Workers, Payroll Weeks, Reports, and Variance | ProjectDetailPage.tsx already has Workers + Payroll Weeks links; missing Reports and Variance links; VarianceReportPage takes projectId as prop not useParams — needs wrapper or refactor |
| UX-02 | Payroll weeks list shows all weeks with week number, status, and WH-347 download button per row | PayrollListPage.tsx already shows payrollNumber and isFinal; missing WH-347 download anchor per row |
| UX-03 | Worker cards show missing-data warnings (address, SSN) that block WH-347 submission | WorkersPage.tsx renders worker cards with address/ssnLast4 visible; no inline warning when these are null |
</phase_requirements>

---

## Current State Analysis

### DashboardPage.tsx

- Route: `/dashboard`
- Fetches `GET /api/projects` — returns array of Project objects
- Project interface: `{ id, name, state, county, contractType, fundingType, awardDate, status }`
- Renders `<ProjectCard>` in a 3-column grid
- **Gap for DASH-01/DASH-02:** No compliance data fetched; ProjectCard has no badge or week-count props

### ProjectCard.tsx

- Currently renders: project name, state/county, contract type badge (gray), funding type badge (gold `#F5C518`), award date
- No compliance badge, no week stats
- **Gap for DASH-01/DASH-02:** Component must accept and render new props

### ProjectDetailPage.tsx

- Route: `/projects/:id`
- Navigation section at line 90-109: has Workers link, Payroll Weeks link, OT Scenario Planner link
- **Gap for UX-01:** Missing "Reports" and "Variance" navigation links
  - Reports do not exist yet (Phase 9), so a Reports link should either be absent or greyed-out/coming-soon
  - Variance: `VarianceReportPage.tsx` exists but has no route in App.tsx. The component takes `{ projectId: string }` as a **prop** (not `useParams`). Adding a route requires a small wrapper component that calls `useParams` and passes `projectId` down.

### PayrollListPage.tsx

- Route: `/projects/:projectId/payroll`
- Fetches `GET /api/payroll/projects/:projectId/weeks` — returns `{ weeks: PayrollWeek[] }`
- PayrollWeek interface includes: `payrollNumber`, `isFinal`, `weekEndingDate`
- Currently renders: "Week Ending {date}" + "Payroll #{payrollNumber}" + "Final" badge if isFinal
- Row action: single "View" link to detail page
- **Gap for UX-02:** No WH-347 download button per row. The WH-347 export endpoint is `GET /api/export/wh347/:weekId` (plain anchor in PayrollWeekDetailPage). Adding a per-row anchor is trivial.

### WorkersPage.tsx

- Route: `/projects/:projectId/workers`
- Worker interface includes: `ssnLast4: string | null`, `address: string | null`
- Normal card view (line 322+): shows address and ssnLast4 in a `<p>` only when they are truthy — no warning when they are null
- The label "Address (required for WH-347)" appears only in the edit form, not in the card view
- **Gap for UX-03:** When `!w.address` or `!w.ssnLast4` in the card view, show an inline warning badge. No backend change needed.

### Compliance Engine

`computeCompliance(db, weekId)` in `complianceService.ts`:
- Returns `ComplianceResult | null`
- `hasViolations: boolean`, `violations[]` with `violationType: 'under-wage' | 'cwhssa-ot'`
- Currently called once per week; no project-level aggregation exists

`listPayrollWeeks(projectId)` in `payrollService.ts`:
- Returns all payroll weeks for a project ordered by `weekEndingDate DESC`
- Returns `payrollNumber` column

**Aggregation logic for DASH-01/DASH-02:**

```
For a given projectId:
1. listPayrollWeeks(projectId)  →  all weeks
2. For each week, computeCompliance(db, week.id)
3. Badge logic:
   - Any week with under-wage violations  →  'violations' (red)
   - Any week with cwhssa-ot violations   →  'violations' (red)
   - All weeks clean                      →  'clean' (green)
   - No weeks yet                         →  'clean' (green — nothing to violate)
4. weekCount = weeks.length
5. lastWeekNumber = weeks[0].payrollNumber (already sorted DESC by weekEndingDate)
```

Note: The requirements say "green = clean, yellow = warnings, red = active violations." The current compliance engine emits only `under-wage` and `cwhssa-ot` — both are hard violations. There is no "warning" violation type. The badge will be either green or red. Yellow is unreachable in Phase 8 without engine changes. **Planner should decide: implement green/red only (recommended), or define yellow as "incomplete data."**

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| react | ^19.2.4 | UI | Already in use |
| react-router-dom | ^7.13.1 | Routing | All routes in App.tsx |
| @tanstack/react-query | ^5.91.0 | Server state | Query pattern used throughout |
| tailwindcss | ^4.2.2 | Styling | Utility classes, no component library |
| express | ^5.2.1 | Backend routes | New aggregation route added here |
| drizzle-orm | ^0.45.1 | DB queries | Used in new route |
| vitest + supertest | ^4.1.0 / ^7.2.2 | Testing | Existing test infrastructure |

No new dependencies required for Phase 8.

---

## Architecture Patterns

### Recommended Project Structure

No new files except one wrapper page and the test additions. Core changes are to existing files.

```
src/
├── client/
│   ├── pages/
│   │   ├── DashboardPage.tsx            (modify — fetch badge data per project)
│   │   ├── ProjectDetailPage.tsx        (modify — add Reports + Variance nav links)
│   │   ├── PayrollListPage.tsx          (modify — add WH-347 download anchor per row)
│   │   ├── WorkersPage.tsx              (modify — add missing-data warning in card view)
│   │   └── VarianceReportPageRoute.tsx  (NEW wrapper — calls useParams, passes projectId to VarianceReportPage)
│   └── components/projects/
│       └── ProjectCard.tsx              (modify — accept badge + week stats props)
└── server/
    └── routes/
        └── compliance.ts                (modify — add GET /project/:projectId endpoint FIRST)
tests/
└── routes/
    └── compliance.test.ts               (modify — add describe block for /project/:projectId)
```

### Pattern 1: Per-Project Compliance Aggregation (Backend)

**What:** New route on complianceRouter that loops over all weeks and aggregates violations.

**When to use:** Dashboard load — called once per project when dashboard renders.

**Example structure:**
```typescript
// GET /api/compliance/project/:projectId  — MUST be added BEFORE GET /:weekId
complianceRouter.get('/project/:projectId', requireAuth, async (req, res) => {
  const projectId = req.params.projectId;
  const userId = req.user!.userId;
  const db = getDb();

  // Ownership check
  const [project] = await db.select().from(schema.projects)
    .where(eq(schema.projects.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }

  // Aggregate
  const weeks = await listPayrollWeeks(projectId);
  const weekCount = weeks.length;
  const lastWeekNumber = weeks[0]?.payrollNumber ?? null;

  let hasViolations = false;
  for (const week of weeks) {
    const result = await computeCompliance(db, week.id);
    if (result?.hasViolations) { hasViolations = true; break; }
  }

  const badge = hasViolations ? 'violations' : 'clean';
  res.json({ badge, weekCount, lastWeekNumber });
});
```

**Caution:** Route order matters in compliance.ts — `GET /project/:projectId` must come BEFORE `GET /:weekId` or the router will interpret "project" as a weekId. Add it as the first route.

### Pattern 2: Dashboard Fetches Badge Per Project (Frontend)

**What:** Each ProjectCard fetches its own compliance summary via TanStack Query.

**Recommended approach:** Fetch inside ProjectCard — each card loads independently, consistent with existing patterns.

```typescript
// Inside ProjectCard.tsx
const { data: summary } = useQuery({
  queryKey: ['compliance-summary', project.id],
  queryFn: () => api.get<{ badge: string; weekCount: number; lastWeekNumber: number | null }>(
    `/compliance/project/${project.id}`
  ),
  staleTime: 60_000,  // 1 minute — compliance data doesn't change per-render
});
```

### Pattern 3: WH-347 Download Anchor (UX-02)

Already implemented in PayrollWeekDetailPage as:
```tsx
<a href={`/api/export/wh347/${weekId}`} className="...">Download WH-347</a>
```
Replicate identically in PayrollListPage per row. The browser handles Content-Disposition attachment natively (per Phase 07 decision in STATE.md).

### Pattern 4: Missing-Data Warning (UX-03)

Inline conditional in the worker card normal view, using existing amber color system:
```tsx
{(!w.address || !w.ssnLast4) && (
  <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded mt-1">
    Missing data — WH-347 blocked
  </span>
)}
```

### Pattern 5: VarianceReportPage Route Wrapper (UX-01)

`VarianceReportPage` signature: `function VarianceReportPage({ projectId }: Props)` — takes prop, not URL param.
A wrapper is the cleanest solution without modifying the existing page component:

```tsx
// src/client/pages/VarianceReportPageRoute.tsx
import { useParams } from 'react-router-dom';
import { VarianceReportPage } from './VarianceReportPage';

export function VarianceReportPageRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <VarianceReportPage projectId={projectId} />;
}
```

Then in App.tsx:
```tsx
<Route path="/projects/:projectId/variance" element={<VarianceReportPageRoute />} />
```

### Anti-Patterns to Avoid

- **Route order collision:** Do not add `GET /project/:projectId` after `GET /:weekId` in compliance.ts. Express will match "project" as a weekId string and call computeCompliance("project") which returns 404.
- **Live compliance fetch on every render:** Use `staleTime: 60_000` in the compliance summary query to avoid N×M requests on dashboard load.
- **Inventing a yellow badge without engine support:** The compliance engine has no "warning" category. Do not fabricate yellow — it will create false impressions. Green/red only unless explicitly scoped differently.
- **Modifying VarianceReportPage's Props interface:** The existing component works; a wrapper preserves its existing consumers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WH-347 per-row download | Custom download handler | Plain `<a href="/api/export/wh347/:id">` | Already proven in PayrollWeekDetailPage; browser handles attachment |
| Compliance badge color logic | Custom color state machine | Simple `hasViolations ? 'red' : 'green'` | Engine output is binary; over-engineering hurts maintainability |
| Bulk compliance endpoint | New aggregation service | Loop over existing computeCompliance() | DRY — same logic, same test coverage |
| VarianceReportPage refactor | Rewrite to use useParams | Thin wrapper component | 3-line wrapper vs. risking regression in existing variance feature |

---

## Common Pitfalls

### Pitfall 1: Route Order in compliance.ts
**What goes wrong:** `GET /project/:projectId` placed after `GET /:weekId` — Express matches "project" as a weekId, calls computeCompliance("project"), gets null, returns 404.
**Why it happens:** Express routes match in declaration order; `:weekId` is a wildcard.
**How to avoid:** Register `/project/:projectId` before `/:weekId` in compliance.ts.
**Warning signs:** Dashboard always shows 404 for compliance summary.

### Pitfall 2: VarianceReportPage Takes Prop Not useParams
**What goes wrong:** You try to register `<VarianceReportPage />` directly as a route — it has no URL parameter access, `projectId` is always undefined.
**Why it happens:** The component was built for v1.0 before route-based navigation was standardized.
**How to avoid:** Use the `VarianceReportPageRoute` wrapper pattern above.
**Warning signs:** Variance page loads but shows empty state or fails to fetch data.

### Pitfall 3: Yellow Badge Has No Engine Support
**What goes wrong:** DASH-01 spec says yellow = warnings, but the compliance engine only emits `under-wage` and `cwhssa-ot` — both are violations (red). Yellow is never reachable.
**Why it happens:** Spec was written anticipating future softer warnings.
**How to avoid:** Implement green/red only. Document yellow as future. Don't fabricate yellow.

### Pitfall 4: N+1 Badge Fetches on Dashboard Load
**What goes wrong:** Each ProjectCard fires a compliance summary query — serial requests can delay dashboard render.
**Why it happens:** N queries triggered at mount; TanStack Query fires them in parallel but each has its own loading state.
**How to avoid:** `staleTime: 60_000` prevents re-fetches on navigate-back. For single-contractor app with few projects, this is acceptable. Note as v2.1 optimization.

---

## Code Examples

Verified from direct codebase inspection:

### Existing WH-347 Anchor Pattern (from PayrollWeekDetailPage.tsx line 137-142)
```tsx
<a
  href={`/api/export/wh347/${weekId}`}
  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800"
>
  Download WH-347
</a>
```

### Existing Amber Warning Pattern (from WorkersPage.tsx line 243-246)
```tsx
<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
  No federal wage determination found...
</div>
```

### Existing Badge Pattern (from ProjectCard.tsx line 51-53)
```tsx
<span className="inline-block text-xs font-medium px-2 py-0.5 bg-[#F5C518] text-gray-900 rounded">
  {FUNDING_TYPE_LABELS[project.fundingType] ?? project.fundingType}
</span>
```

### Compliance Badge Colors (to implement, matching design system)
```tsx
// Green — clean
<span className="inline-block text-xs font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded">
  Clean
</span>

// Red — violations
<span className="inline-block text-xs font-medium px-2 py-0.5 bg-red-100 text-red-700 rounded">
  Violations
</span>

// Gray — no weeks yet
<span className="inline-block text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded">
  No payroll
</span>
```

### Existing Navigation Link Pattern (from ProjectDetailPage.tsx line 91-95)
```tsx
<Link
  to={`/projects/${project.id}/workers`}
  className="inline-block rounded border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
>
  Workers
</Link>
```

### Coming-Soon Link Style (for Reports nav, Phase 9 pending)
```tsx
<span className="inline-block rounded border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
  Reports (coming soon)
</span>
```

---

## State of the Art

| Area | Current State | Phase 8 Change |
|------|--------------|----------------|
| Compliance engine | Per-week only (computeCompliance) | Add project-level aggregation endpoint |
| Dashboard badges | None — project cards show no compliance info | DASH-01: Add badge; DASH-02: Add week count |
| Project detail nav | Workers, Payroll Weeks, OT Scenarios | UX-01: Add Reports (greyed), Variance (with wrapper) |
| Payroll list row | View link only | UX-02: Add WH-347 anchor per row |
| Worker card | Shows data when present, silent when missing | UX-03: Show warning when address or SSN null |
| VarianceReportPage | Exists, takes prop, no route in App.tsx | Wire into App.tsx via wrapper; add nav link |

---

## Open Questions

1. **Yellow badge: what triggers it?**
   - What we know: Engine has no warning-level violations. Yellow is unreachable.
   - What's unclear: Should "incomplete data" (workers missing address/SSN) count as a yellow badge state?
   - Recommendation: Implement green/red only in Phase 8. Document yellow as `// TODO: future soft-warning state`. The UX-03 requirement already surfaces missing-data at the worker level.

2. **VarianceReportPage: wrapper or refactor?**
   - What we know: `VarianceReportPage({ projectId }: Props)` takes a prop. A 3-line wrapper page solves the routing problem without touching the existing component. Alternatively, refactor VarianceReportPage to use `useParams` internally.
   - Recommendation: Use the wrapper approach — lower regression risk. The planner may choose to refactor instead if they want to standardize all pages to useParams.

3. **Reports nav link: greyed-out or absent?**
   - What we know: Reports (RPT-01, RPT-02) are Phase 9. Phase 8 adds a Reports nav link per UX-01.
   - What's unclear: Should the nav show "Reports (coming soon)" or just omit it and add it in Phase 9?
   - Recommendation: Add the Reports link with a `coming-soon` visual treatment (lighter text, no hover state, span not Link). This satisfies UX-01's intent of "clear navigation" without creating a dead link.

---

## Validation Architecture

`workflow.nyquist_validation` is not explicitly set in `.planning/config.json` (key absent) — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --reporter=verbose tests/routes/compliance.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | GET /compliance/project/:id returns badge field | integration | `npm test -- tests/routes/compliance.test.ts` | ❌ Wave 0 |
| DASH-02 | GET /compliance/project/:id returns weekCount + lastWeekNumber | integration | `npm test -- tests/routes/compliance.test.ts` | ❌ Wave 0 |
| UX-01 | ProjectDetailPage has Reports + Variance links | manual | Browser check | N/A |
| UX-02 | PayrollListPage row has WH-347 anchor per row | manual | Browser check | N/A |
| UX-03 | Worker card shows warning when address/SSN null | manual | Browser check | N/A |

Notes: UX-01 through UX-03 are pure UI changes verified by browser checkpoint. DASH-01/DASH-02 require a new backend endpoint with automated route tests.

### Sampling Rate
- **Per task commit:** `npm test -- tests/routes/compliance.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/routes/compliance.test.ts` — add new `describe` block for `GET /api/compliance/project/:projectId` covering:
  - 200 with `{ badge, weekCount, lastWeekNumber }` shape
  - 403 when project owned by different user
  - 404 for nonexistent projectId
  - `badge === 'violations'` when a week has a seeded compliance violation
  - `badge === 'clean'` when no weeks exist
  - Existing tests in this file cover `/:weekId` — add, do not replace

*(All other test infrastructure is in place — no new framework, no new config files needed)*

---

## Sources

### Primary (HIGH confidence)
- Direct read of `src/client/pages/DashboardPage.tsx`
- Direct read of `src/client/pages/ProjectDetailPage.tsx`
- Direct read of `src/client/pages/PayrollListPage.tsx`
- Direct read of `src/client/pages/WorkersPage.tsx`
- Direct read of `src/client/pages/PayrollWeekDetailPage.tsx`
- Direct read of `src/client/pages/VarianceReportPage.tsx` — confirmed Props interface, no useParams
- Direct read of `src/client/components/projects/ProjectCard.tsx`
- Direct read of `src/server/routes/compliance.ts`
- Direct read of `src/server/services/complianceService.ts`
- Direct read of `src/server/services/payrollService.ts`
- Direct read of `src/server/db/schema.ts`
- Direct read of `src/client/App.tsx` — missing Variance route confirmed, no VarianceReportPage import
- Direct read of `.planning/config.json`
- Direct read of `vitest.config.ts`

### Secondary (MEDIUM confidence)
- TanStack Query `staleTime` pattern — standard library usage consistent with existing codebase patterns

---

## Metadata

**Confidence breakdown:**
- Current page/component state: HIGH — direct file reads, no inference
- New endpoint design: HIGH — follows exact pattern of existing complianceRouter
- Compliance aggregation logic: HIGH — computeCompliance and listPayrollWeeks APIs fully understood
- Badge color design: HIGH — follows existing badge patterns in codebase
- VarianceReportPage prop issue: HIGH — confirmed from direct file read (line 16-17: `interface Props { projectId: string }`)

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack, no external API dependencies)
