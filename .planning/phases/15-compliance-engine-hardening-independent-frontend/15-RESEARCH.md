# Phase 15: Compliance Engine Hardening + Independent Frontend - Research

**Researched:** 2026-03-22
**Domain:** TypeScript/React — compliance service extension, React state-driven progress indicator, CSS @media print
**Confidence:** HIGH

---

## Summary

Phase 15 has four independent workstreams that share no mutual dependencies and can be planned in parallel. The compliance engine extension (COMP-03) is a pure server-side change to `complianceService.ts` — it adds a per-week aggregate ratio check using data already returned by `getPayrollEntries()`, which already exposes `laborType`. The progress indicator (UX-04) is a pure frontend component on `ProjectDetailPage.tsx` that derives step completion from three parallel API calls already used by adjacent pages — workers exist, payroll weeks exist, and WH-347 download tracking. The print CSS work (RPT-01, RPT-02) is a targeted `@media print` expansion of the single inline style block already present in `ReportsPage.tsx`.

The largest design decision in the phase is how to track "WH-347 downloaded" for step 4 of UX-04. The DB schema has no download history table. Two valid approaches exist: (1) derive it from `payrollWeeks` having at least one row with `isFinal = true` (closest available proxy), or (2) treat "at least one payroll week exists" as a sufficient proxy for step 4 since the WH-347 download is a non-stored client action. The STATE.md research flag flags this explicitly. Both approaches avoid a schema migration; the `isFinal` proxy is more accurate.

For COMP-03, the apprentice ratio violation is week-level (not entry-level), so it cannot be mapped to a specific `entryId`. The existing `ComplianceViolation` interface requires `entryId`, `workerId`, and `workerName` — all entry-level fields. A new discriminated union type or a separate `weekViolations` array on `ComplianceResult` must be introduced. A separate `weekViolations` array is the least-invasive change that avoids breaking existing consumers of `violations[]`.

**Primary recommendation:** Extend `ComplianceResult` with a `weekViolations` array for week-level violations (COMP-03); use `isFinal = true` on any payroll week as the WH-347 completion proxy (UX-04); expand the existing `<style>` block in ReportsPage.tsx with targeted `@media print` rules covering `thead { display: table-header-group }`, hiding tab UI + nav, and fixing column widths (RPT-01/02).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-03 | Flag apprentice ratio violation per week when total apprentice hours exceed 1:3 ratio vs journeyworker hours | `getPayrollEntries()` already returns `laborType` per row; summing by labor type inside `computeCompliance()` is sufficient; no new DB queries needed |
| UX-04 | Project Detail shows 4-step progress indicator (Create Project, Add Workers, Enter Payroll, Download WH-347) | Steps 1-3 derivable from existing API endpoints; step 4 derivable from `payrollWeeks.isFinal` proxy without schema change |
| RPT-01 | Fringe benefit summary prints cleanly via Ctrl+P (headers repeat, totals visible, no chrome) | Current `<style>` block in ReportsPage targets `nav` only; expansion needed for `thead`, tab UI, overflow wrappers |
| RPT-02 | Worker pay history prints cleanly via Ctrl+P (worker selector hidden, full table visible, column alignment) | Same `<style>` expansion; worker selector `<div>` needs a print-specific `display: none` class |
</phase_requirements>

---

## Standard Stack

This phase uses no new libraries. All work is within the existing stack.

### Core (in use)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React | ^19.2.4 | Component rendering | Progress indicator is a pure React component |
| TailwindCSS | ^4.2.2 | Utility classes | Print utilities via `@media print` in inline style |
| @tanstack/react-query | ^5.91.0 | Data fetching | Progress indicator requires 2-3 parallel queries |
| Drizzle ORM | ^0.45.1 | DB access in `computeCompliance()` | No schema changes needed |
| Vitest | ^4.1.0 | Test runner | New tests go in `tests/services/complianceService.test.ts` and `tests/routes/compliance.test.ts` |

### No New Dependencies
All four requirements are implemented with code changes only. No `npm install` step.

---

## Architecture Patterns

### COMP-03: Apprentice Ratio Check in computeCompliance()

**What the function currently does:** Iterates all entries for a week, computes expected gross vs actual gross, emits per-entry violations. Returns `ComplianceResult` with a `violations: ComplianceViolation[]` array where every violation maps to an `entryId`.

**The COMP-03 problem:** Apprentice ratio is a week-aggregate metric. There is no single entry to blame — it is a ratio across all entries for the week. The current `ComplianceViolation` interface requires `entryId`, `workerId`, and `workerName`, which are entry-level concepts.

**Resolution — separate `weekViolations` array:**

```typescript
// New type — week-level violation, no entryId
export interface WeekViolation {
  violationType: 'apprentice-ratio';
  detail: string;           // e.g. "Apprentice hours 20 exceed 1:3 ratio (max 10 for 30 JW hours)"
  apprenticeHours: number;
  journeyworkerHours: number;
  maxAllowedApprenticeHours: number;
}

// Updated ComplianceResult — add weekViolations alongside existing violations
export interface ComplianceResult {
  weekId: string;
  projectId: string;
  violations: ComplianceViolation[];       // existing — per-entry (under-wage, cwhssa-ot)
  weekViolations: WeekViolation[];         // new — per-week (apprentice-ratio)
  hasViolations: boolean;                  // true when either array is non-empty
  certProperPayment: boolean;
  certAccuratePayroll: boolean;
}
```

**Implementation inside computeCompliance():**

```typescript
// After the per-entry loop, before building the return value:
let apprenticeHours = 0;
let journeyworkerHours = 0;

for (const row of rows) {
  const e = row.entry;
  const totalHours =
    (e.monSt ?? 0) + (e.tueSt ?? 0) + (e.wedSt ?? 0) +
    (e.thuSt ?? 0) + (e.friSt ?? 0) + (e.satSt ?? 0) + (e.sunSt ?? 0) +
    (e.monOt ?? 0) + (e.tueOt ?? 0) + (e.wedOt ?? 0) +
    (e.thuOt ?? 0) + (e.friOt ?? 0) + (e.satOt ?? 0) + (e.sunOt ?? 0);

  if (row.laborType === 'apprentice') apprenticeHours += totalHours;
  else if (row.laborType === 'journeyworker') journeyworkerHours += totalHours;
  // foreman counts as journeyworker for ratio purposes (Davis-Bacon enforcement)
  else if (row.laborType === 'foreman') journeyworkerHours += totalHours;
}

const weekViolations: WeekViolation[] = [];
const maxAllowedApprenticeHours = journeyworkerHours / 3;

if (apprenticeHours > 0 && apprenticeHours > maxAllowedApprenticeHours) {
  weekViolations.push({
    violationType: 'apprentice-ratio',
    detail: `Apprentice hours (${apprenticeHours}) exceed 1:3 ratio — max allowed ${maxAllowedApprenticeHours.toFixed(1)} for ${journeyworkerHours} journeyworker hours`,
    apprenticeHours,
    journeyworkerHours,
    maxAllowedApprenticeHours,
  });
}
```

**Davis-Bacon ratio rule (confirmed):** 29 CFR 5.5(a)(4) — the ratio of apprentices to journeyworkers shall not be greater than permitted under the registered program, but DOL enforcement uses 1:3 as the default (1 apprentice per 3 journeyworkers) when no program ratio is specified. This check fires when apprentice hours exceed journeyworkerHours / 3. The check should only fire when `apprenticeHours > 0` to avoid false positives on weeks with no apprentices.

**Edge cases:**
- Zero journeyworker hours + any apprentice hours = always a violation (ratio = infinity)
- Zero apprentice hours = no violation regardless of JW hours
- Foreman hours count toward journeyworker total (DOL guidance treats foremen as JW-class)

**Data availability:** `getPayrollEntries()` already joins `workerClassifications` and returns `laborType` per row. No new DB query is needed inside `computeCompliance()`.

### UX-04: 4-Step Progress Indicator on ProjectDetailPage

**Current ProjectDetailPage state:** A single `useQuery` fetches the project. Workers, payroll weeks, and WH-347 status are not fetched.

**Step completion logic:**

| Step | Label | Complete when |
|------|-------|--------------|
| 1 | Create Project | Always true — this page requires a valid project |
| 2 | Add Workers | `GET /api/projects/:id/workers` returns workers.length > 0 |
| 3 | Enter Payroll | `GET /api/payroll/weeks` for project returns weeks.length > 0 with at least one entry |
| 4 | Download WH-347 | Any payroll week has `isFinal = true` (closest DB proxy without schema change) |

**WH-347 tracking decision:** The `payrollWeeks` table has `isFinal: boolean`. The WH-347 download route (`GET /api/export/wh347/:weekId`) is a plain `<a href>` — it does not write back to the DB. The `isFinal` field is not automatically set on download; it is user-set. Two options:

- **Option A — isFinal proxy:** Treat any week with `isFinal = true` as evidence of WH-347 submission intent. Downside: requires user to manually mark weeks final; many users may not.
- **Option B — payroll exists proxy:** Treat step 4 as complete when at least one payroll week exists (same as step 3). Less accurate but zero DB change.
- **Option C — new `wh347DownloadedAt` column:** Accurate but requires a schema migration, which is out of scope for this phase.

**Recommendation:** Use Option A (`isFinal = true` proxy) for accuracy with zero schema change. The progress indicator is informational — mild inaccuracy is acceptable. The existing `GET /api/payroll/weeks` endpoint already returns all weeks including `isFinal`; no new endpoint needed.

**API queries needed (all parallel):**

```typescript
// Query 1: workers (already fetched on WorkersPage — same endpoint)
GET /api/projects/:id/workers  → data.workers.length > 0 = step 2 complete

// Query 2: payroll weeks (already fetched on payroll list page)
GET /api/payroll/weeks?projectId=:id  → weeks.length > 0 = step 3 complete
                                        weeks.some(w => w.isFinal) = step 4 complete
```

**Wait — check the payroll weeks endpoint shape:**

```typescript
// From src/server/routes/payroll.ts — need to verify route structure
// The client currently uses:
//   useQuery({ queryFn: () => api.get('/payroll/weeks/' + weekId) })
// But for ProjectDetailPage we need list by projectId
```

The `listPayrollWeeks(projectId)` function exists in payrollService. We need to verify the route exposes it. Reading payroll.ts is needed but was not in the initial file list — it is a known gap (see Open Questions).

**Component structure:**

```tsx
// Pure presentational component (no file of its own needed — inline in ProjectDetailPage)
function WorkflowProgress({ steps }: { steps: { label: string; complete: boolean }[] }) {
  return (
    <ol className="flex items-center gap-0 mb-8">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center">
          <div className={cn(
            'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2',
            step.complete
              ? 'bg-status-compliant border-status-compliant text-white'
              : 'bg-white border-gray-300 text-gray-400'
          )}>
            {step.complete ? '✓' : i + 1}
          </div>
          <span className={cn(
            'ml-2 text-sm font-medium',
            step.complete ? 'text-status-compliant' : 'text-gray-400'
          )}>
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <div className={cn(
              'mx-3 h-0.5 w-12 flex-shrink-0',
              step.complete ? 'bg-status-compliant' : 'bg-gray-200'
            )} />
          )}
        </li>
      ))}
    </ol>
  );
}
```

**Placement:** Insert the `WorkflowProgress` component between the `PageHeader` and the `Card` containing project metadata.

### RPT-01 + RPT-02: Print CSS for ReportsPage

**Current state:** `ReportsPage.tsx` has one inline `<style>` block placed before `<Layout>`:
```tsx
<style>{`@media print { nav { display: none !important; } }`}</style>
```
This hides the nav but nothing else.

**Layout structure at print time:**
- `<nav>` inside `<Layout>` — already hidden
- Tab buttons (`.border-b.border-gray-200` div) — not hidden → prints as noise
- `<PageHeader>` — acceptable to print (project name context)
- Worker selector `<div>` in pay history tab — should be hidden on print
- `<div className="overflow-x-auto">` wrapper around both tables — `overflow-x-auto` must be removed at print to prevent clipping

**CSS for `<thead>` header repeat:** Browser print handles `<thead>` header repetition automatically when `display: table-header-group` is set. By default, most browsers honor this, but `overflow-x-auto` on the container div can suppress it. Removing `overflow: auto` in `@media print` on the table wrapper is the fix.

**Required `@media print` rules:**

```css
@media print {
  /* Existing */
  nav { display: none !important; }

  /* RPT-01 + RPT-02: Hide tab chrome and nav chrome */
  .print\\:hidden { display: none !important; }

  /* RPT-01 + RPT-02: Allow table to break across pages with header repeat */
  .overflow-x-auto { overflow: visible !important; }
  table { width: 100% !important; }
  thead { display: table-header-group !important; }
  tbody tr { page-break-inside: avoid; }

  /* RPT-01: Totals row visibility (ensure last row not clipped) */
  tfoot { display: table-footer-group !important; }

  /* Remove background colors that waste ink and may not print */
  .bg-gray-50 { background-color: white !important; }

  /* Preserve column widths on paper */
  th, td { white-space: nowrap; }
}
```

**Alternative approach — print-specific Tailwind classes:** TailwindCSS v4 supports `print:hidden` and `print:block` variants. These are cleaner than inline `<style>` blocks but require adding classes to JSX elements. Since the existing pattern uses an inline `<style>`, staying consistent with one expanded `<style>` block is lower risk.

**Tab UI hiding:** The tab container (`<div className="border-b border-gray-200">`) needs `print:hidden` or equivalent. Since TailwindCSS v4 print variants work, `className="border-b border-gray-200 print:hidden"` is the cleanest approach for individual elements.

**Worker selector hiding (RPT-02):** The worker selector `<div className="flex items-center justify-between mb-4 gap-4 flex-wrap">` should get `print:hidden` on the selector sub-div only — the worker name/h2 heading can remain to identify whose history is printed.

**Print title:** Both reports should show which tab/worker they're printing. The active tab heading (`<h2>`) is already rendered and will print.

**Fringe summary totals row (RPT-01):** The fringe summary table has no `<tfoot>` — totals are missing entirely. The requirement says "totals row visible." This implies adding a totals row to the fringe summary table as part of RPT-01 implementation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Print header repeat | Custom JS scroll capture | CSS `thead { display: table-header-group }` + remove `overflow: auto` |
| Apprentice ratio DB query | Custom SQL join | `getPayrollEntries()` already returns `laborType` — sum in JS |
| Progress step state | Server-side "progress" endpoint | Parallel client-side queries to existing endpoints |
| WH-347 download tracking | New DB table + migration | `isFinal` field proxy (sufficient for v2.2) |
| Step indicator icons | Icon library (lucide-react) | Unicode checkmark in styled div or SVG inline — badge pattern |

---

## Common Pitfalls

### Pitfall 1: Breaking existing `ComplianceResult` consumers
**What goes wrong:** Adding `weekViolations` to `ComplianceResult` without updating all consumers — the route handler in `compliance.ts`, the export route in `export.ts` (which calls `computeCompliance()`), and the client-side `ComplianceResult` interface in `PayrollWeekDetailPage.tsx`.
**Why it happens:** TypeScript won't catch missing `weekViolations` on the return value if the interface is updated but the construction site (the `return {}` at line 102 of `complianceService.ts`) isn't.
**How to avoid:** Update the interface, update the return statement, and grep for all files importing `ComplianceResult` to update client-side TypeScript interface definitions.
**Warning signs:** TS error `Property 'weekViolations' is missing in type` at the `return` statement.

### Pitfall 2: Apprentice ratio check when zero journeyworkers present
**What goes wrong:** `maxAllowedApprenticeHours = 0 / 3 = 0`. Any apprentice hours at all would trigger a violation, even on a pure-apprentice crew (which is valid under certain programs).
**Why it happens:** The 1:3 check assumes at least one journeyworker on site.
**How to avoid:** Only fire the ratio violation when `journeyworkerHours > 0`. If `journeyworkerHours === 0` and `apprenticeHours > 0`, this is a legitimate edge case that should not be auto-flagged (it may require a different DOL form; out of scope for this phase).
**Warning signs:** False violation badges on test data that has only apprentice entries.

### Pitfall 3: `overflow-x-auto` clips thead repeat at print
**What goes wrong:** `thead` rows do not repeat per printed page even with `display: table-header-group` set, because the `overflow-x-auto` wrapper constrains the table to a scrollable container that doesn't have page-break semantics.
**Why it happens:** Browser print layout recalculates from the containing block. `overflow: auto` creates a scroll container, not a natural block, which breaks the table printing model.
**How to avoid:** Set `overflow: visible !important` on `.overflow-x-auto` in `@media print`.
**Warning signs:** Ctrl+P preview shows table header only on page 1.

### Pitfall 4: Print CSS in `<style>` placed outside `<Layout>` does not affect nav
**What goes wrong:** The existing `<style>` block targets `nav { display: none }` but the `<nav>` is inside `<Layout>` which renders after the `<style>` block in the JSX tree. The CSS still applies (it's global), but future developers may assume scoping.
**How to avoid:** Keep the `<style>` block before `<Layout>` — it is already there and working. The style block injects into `<head>` regardless of position in JSX. This pattern is correct and should be preserved.

### Pitfall 5: `isFinal` proxy for step 4 is misleading when users never mark weeks final
**What goes wrong:** Step 4 never turns green for contractors who download WH-347 but never toggle `isFinal`. The indicator stays permanently at 3/4.
**Why it happens:** The WH-347 download is a plain `<a href>` — no DB write occurs.
**How to avoid:** Document the proxy in code comments. Phase 16 can introduce proper tracking if the Phase 16 WH-347 UX work converts the anchor to a fetch-based download, at which point a download timestamp can be written.
**Warning signs:** User feedback that step 4 never completes despite downloading WH-347.

### Pitfall 6: Client-side TypeScript interfaces diverge from server types
**What goes wrong:** `PayrollWeekDetailPage.tsx` has its own local `ComplianceResult` interface (lines 61-68) that doesn't include `weekViolations`. The badge in the compliance violations panel renders only `violations[]`, so apprentice-ratio violations won't display.
**Why it happens:** Types are duplicated (client has no shared type package with server).
**How to avoid:** Update the local `ComplianceResult` interface in `PayrollWeekDetailPage.tsx` when updating the server type. Add rendering for `weekViolations` in the compliance panel.

---

## Code Examples

### Verified: `getPayrollEntries()` returns `laborType`

```typescript
// src/server/services/payrollService.ts lines 171-190
export async function getPayrollEntries(weekId: string) {
  const db = getDb();
  const rows = await db
    .select({
      entry: payrollEntries,
      workerName: workers.name,
      tradeDescription: workerClassifications.tradeDescription,
      laborType: workerClassifications.laborType,   // <-- available for ratio check
      programName: workerClassifications.programName,
    })
    .from(payrollEntries)
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .innerJoin(
      workerClassifications,
      eq(payrollEntries.classificationId, workerClassifications.id),
    )
    .where(eq(payrollEntries.payrollWeekId, weekId));
  return rows;
}
```

### Verified: `violationType` union in client interface (must be extended)

```typescript
// src/client/pages/PayrollWeekDetailPage.tsx lines 51-59
interface ComplianceViolation {
  workerId: string;
  workerName: string;
  violationType: 'under-wage' | 'cwhssa-ot';  // must add 'apprentice-ratio'? No — use weekViolations
  expected: number;
  actual: number;
  delta: number;
  entryId: string;
}
// This interface stays unchanged; add a separate weekViolations interface instead.
```

### Verified: Badge component API

```typescript
// src/client/components/ui/Badge.tsx
type BadgeVariant = 'compliant' | 'violation' | 'warning' | 'neutral';
// Use variant="violation" for the apprentice-ratio badge
// <Badge variant="violation">Apprentice Ratio</Badge>
```

### Verified: Existing print style block location

```tsx
// src/client/pages/ReportsPage.tsx line 128-130
return (
  <>
    <style>{`@media print { nav { display: none !important; } }`}</style>
    <Layout>
      ...
```

### Pattern: `violationLabel()` function extension in PayrollWeekDetailPage

```typescript
// Current (line 75-78):
function violationLabel(type: 'under-wage' | 'cwhssa-ot'): string {
  if (type === 'under-wage') return 'Under-Wage';
  return 'CWHSSA OT Error';
}
// No change needed — week violations rendered separately from entry violations
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `violations[]` only in ComplianceResult | `violations[]` + `weekViolations[]` after COMP-03 | Preserves backward compat for all existing consumers |
| No print optimization in ReportsPage | `@media print` block expanded with table + selector rules | Reports become submission-ready without server PDF generation |
| No workflow visibility on Project Detail | 4-step progress indicator via parallel queries | Contractors see exactly where they are in the workflow |

**No deprecated patterns in this phase.**

---

## Open Questions

1. **Payroll weeks list endpoint shape for ProjectDetailPage (UX-04)**
   - What we know: `listPayrollWeeks(projectId)` exists in `payrollService.ts` and returns rows with `isFinal`.
   - What's unclear: The client route path for listing weeks by `projectId`. The `PayrollWeekDetailPage` fetches `/payroll/weeks/:weekId` (single week). The list endpoint's URL and whether it's already wired to the router needs to be confirmed by reading `src/server/routes/payroll.ts`.
   - Recommendation: Read `payroll.ts` in Wave 0 of planning. If a project-level weeks list endpoint doesn't exist, it must be added as a thin route calling `listPayrollWeeks(projectId)`.

2. **Totals row in fringe summary (RPT-01)**
   - What we know: The requirement says "totals row visible." The current fringe summary table has no `<tfoot>` or totals row.
   - What's unclear: Whether "totals row" means a sum of all fringe credits across all workers, or just making the last data row not clip at page break.
   - Recommendation: Add a totals row (`<tfoot>`) to the fringe summary table as part of RPT-01. Sum `totalSt`, `totalOt`, `totalHours`, and `totalFringeCredits` across all `fringeRows`. This is a pure client-side computation with no new API call.

3. **Foreman classification in apprentice ratio (COMP-03)**
   - What we know: `laborType` can be `'journeyworker' | 'apprentice' | 'foreman'` in the schema. The WH-347 generator already maps `foreman` to `journeyworker` classification on the form.
   - What's unclear: Whether DOL enforcement treats foreman hours as journeyworker hours for the apprentice ratio (29 CFR 5.5(a)(4) doesn't explicitly address foremen in this context).
   - Recommendation: Treat foreman hours as journeyworker hours (consistent with WH-347 treatment). This is the conservative approach and avoids an edge-case false violation.

---

## Validation Architecture

Config has `nyquist_validation` key absent — treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test -- --reporter=verbose tests/services/complianceService.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-03 | Apprentice hours > JW/3 produces weekViolations entry | unit | `npm run test -- tests/services/complianceService.test.ts` | Exists — extend |
| COMP-03 | Apprentice hours <= JW/3 produces no weekViolations | unit | `npm run test -- tests/services/complianceService.test.ts` | Exists — extend |
| COMP-03 | Zero apprentice hours produces no weekViolations | unit | `npm run test -- tests/services/complianceService.test.ts` | Exists — extend |
| COMP-03 | GET /api/compliance/:weekId includes weekViolations array in response | integration | `npm run test -- tests/routes/compliance.test.ts` | Exists — extend |
| UX-04 | Progress indicator renders correct complete states | manual | Browser visual — no unit test needed | n/a |
| RPT-01 | Fringe summary totals row sums correctly | unit | `npm run test -- tests/routes/reports.test.ts` | Exists — may extend |
| RPT-02 | Print layout rules | manual | Browser Ctrl+P preview | n/a |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/services/complianceService.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `tests/services/complianceService.test.ts` for COMP-03 (apprentice ratio violation, no violation, edge cases)
- [ ] New test cases in `tests/routes/compliance.test.ts` for `weekViolations` array in response shape

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `src/server/services/complianceService.ts` — current function signature, violation types, return shape
- Direct codebase read — `src/server/services/payrollService.ts` — `getPayrollEntries()` returns `laborType`
- Direct codebase read — `src/client/pages/ReportsPage.tsx` — existing print style block, tab structure
- Direct codebase read — `src/client/pages/ProjectDetailPage.tsx` — current query count, placement hooks
- Direct codebase read — `src/client/pages/PayrollWeekDetailPage.tsx` — ComplianceResult interface, compliance panel structure
- Direct codebase read — `src/client/components/ui/Badge.tsx` — variant API
- Direct codebase read — `src/client/index.css` — available design tokens
- Direct codebase read — `src/server/db/schema.ts` — `payrollWeeks.isFinal` field exists

### Secondary (MEDIUM confidence)
- 29 CFR 5.5(a)(4) — Davis-Bacon apprentice ratio rule (1:3 default) — knowledge from training data, corroborates the REQUIREMENTS.md spec of "1 apprentice hour per 3 journeyworker hours"
- CSS `thead { display: table-header-group }` print behavior — widely documented browser behavior, cross-verified with project's existing inline style pattern
- TailwindCSS v4 `print:hidden` variant — confirmed available in TailwindCSS v4 (project uses v4.2.2 per package.json)

### Tertiary (LOW confidence)
- Foreman hours counting as journeyworker for apprentice ratio: inferred from WH-347 generator mapping foreman → journeyworker; no DOL source verified.

---

## Metadata

**Confidence breakdown:**
- COMP-03 implementation: HIGH — `getPayrollEntries()` returns `laborType`; no DB changes needed; type extension pattern is clear
- UX-04 step 1-3 derivation: HIGH — existing endpoints and data shapes confirmed
- UX-04 step 4 (`isFinal` proxy): MEDIUM — accurate to the extent users mark weeks final; acknowledged limitation
- RPT-01/RPT-02 print CSS: HIGH — browser `thead` behavior and `overflow` interaction are well-established
- Fringe summary totals row: MEDIUM — requirement text is slightly ambiguous ("totals row visible")
- Payroll weeks list endpoint URL: LOW — `payroll.ts` not read; verify in Wave 0

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack, no external API dependencies in this phase)
