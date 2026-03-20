# Phase 7: Compliance Engine + Payroll Week View - Research

**Researched:** 2026-03-20
**Domain:** Compliance calculation services, payroll week detail page, WH-347 one-click download
**Confidence:** HIGH — all findings verified directly from codebase

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | System flags payroll entries where rate paid is below prevailing wage | `baseRateSnapshot` + `fringeRateSnapshot` in `payrollEntries` are the frozen comparators; `grossWages` is the amount paid; formula is `grossWages < totalSt * baseRateSnapshot + totalOt * baseRateSnapshot * 1.5 + totalHours * fringeRateSnapshot` |
| COMP-02 | System flags payroll weeks where gross wages don't match CWHSSA OT formula | `calculateCwhssaOt()` already implements the exact CWHSSA formula; `getOrDefaultThreshold()` is confirmed to return 40-hour default when no row exists; compliance engine calls the existing service |
| WH347-03 | User downloads WH-347 from payroll week view with one click | `GET /api/export/wh347/:weekId` already exists and is fully functional; the new PayrollWeekDetailPage simply needs an anchor tag pointing to this route |
| WH347-04 | WH-347 generates multiple pages when week has more than 8 workers | Already implemented in Phase 6 (`fillWh347()` chunks workers into groups of 8); this requirement is functionally met — the payroll week detail page must surface the existing endpoint, not change the generator |
</phase_requirements>

---

## Summary

Phase 7 has four requirements, and the codebase is already well-equipped for all of them. The core math (CWHSSA OT formula) exists as a pure function `calculateCwhssaOt()` in `calculations.ts`. The threshold lookup `getOrDefaultThreshold()` in `otCalculator.ts` is confirmed to return a 40-hour CWHSSA default when no `otThresholds` row exists for a project. The WH-347 export endpoint (`GET /api/export/wh347/:weekId`) is fully implemented and already handles multi-page output from Phase 6. The existing `GET /api/payroll/weeks/:id` route returns `{ week, entries }` — everything the detail page needs.

The primary new work is: (1) a `complianceService.ts` modeled after `varianceService.ts`, (2) a `GET /api/compliance/:weekId` route, (3) a `PayrollWeekDetailPage.tsx` component that shows entries + violations + a WH-347 download button, and (4) a new React route wired into `App.tsx`. The compliance engine is purely computational — no new schema columns are needed.

**Primary recommendation:** Build `complianceService.ts` as a pure function that accepts entries + threshold, delegates to existing `calculateCwhssaOt()`, and returns typed violation objects. Wire to a dedicated `/api/compliance/:weekId` route. Build `PayrollWeekDetailPage.tsx` using React Query and the existing `api.get()` helper. WH-347 download is a plain `<a href="/api/export/wh347/:weekId">` anchor.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | DB query builder | Already in use across all services |
| better-sqlite3 | ^12.8.0 | SQLite driver | Project standard; test helper uses `:memory:` instance |
| zod | ^4.3.6 | Route input validation | Already used in every route |
| vitest | ^4.1.0 | Test runner | Configured in `vitest.config.ts`; setupFiles runs in-memory DB migration |
| supertest | ^7.2.2 | HTTP integration tests | Pattern established in `payrollService.test.ts` and `workers.test.ts` |
| @tanstack/react-query | ^5.91.0 | Client data fetching | Already used in all pages |
| react-router-dom | ^7.13.1 | Client routing | Already used; new route added to App.tsx |

No new dependencies required for this phase.

---

## Architecture Patterns

### Recommended File Structure (new files only)

```
src/server/services/
└── complianceService.ts        # new — pure computation, accepts db + weekId

src/server/routes/
└── compliance.ts               # new — GET /api/compliance/:weekId

src/client/pages/
└── PayrollWeekDetailPage.tsx   # new — /projects/:projectId/payroll/:weekId

tests/services/
└── complianceService.test.ts   # new — unit + integration tests

tests/routes/
└── compliance.test.ts          # new — route contract tests
```

Existing files touched:
- `src/server/index.ts` — register `complianceRouter` under `/api/compliance`
- `src/client/App.tsx` — add route `/projects/:projectId/payroll/:weekId`

### Pattern 1: Compliance Service — Mirror varianceService.ts

`complianceService.ts` follows the same pattern as `varianceService.ts`:
- Accepts `db: BetterSQLite3Database<typeof schema>` and `weekId: string`
- Fetches payroll entries with a single query (joined to workers, workerClassifications)
- Calls `getOrDefaultThreshold(projectId)` to get the OT threshold
- Delegates all math to `calculateCwhssaOt()` from `calculations.ts`
- Returns a typed result object with violation arrays

```typescript
// Source: pattern from src/server/services/varianceService.ts + calculations.ts

export interface ComplianceViolation {
  workerId: string;
  workerName: string;
  violationType: 'under-wage' | 'cwhssa-ot';
  expected: number;   // what the correct amount should be
  actual: number;     // what was recorded
  delta: number;      // actual - expected (negative = underpayment)
  entryId: string;
}

export interface ComplianceResult {
  weekId: string;
  projectId: string;
  violations: ComplianceViolation[];
  hasViolations: boolean;
  // Flags used by WH-347 Statement of Compliance (Phase 7 TODO in export.ts)
  certProperPayment: boolean;   // true when no under-wage violations
  certAccuratePayroll: boolean; // true when no CWHSSA-OT violations
}

export async function computeCompliance(
  db: BetterSQLite3Database<typeof schema>,
  weekId: string,
): Promise<ComplianceResult | null>
```

### Pattern 2: CWHSSA OT Violation Formula

The CWHSSA formula is already implemented. The compliance engine applies it per entry:

```typescript
// Source: src/server/services/calculations.ts (calculateCwhssaOt)
// Source: src/server/services/otCalculator.ts (getOrDefaultThreshold)

// For each payrollEntry in the week:
const totalSt = monSt + tueSt + wedSt + thuSt + friSt + satSt + sunSt;
const totalOt = monOt + tueOt + wedOt + thuOt + friOt + satOt + sunOt;
const totalHours = totalSt + totalOt;

// CWHSSA expected pay (fringe is NOT multiplied for OT — this is the legal rule):
//   straightTimeBasePay = totalHours * baseRateSnapshot
//   overtimePremium     = totalOt * 0.5 * baseRateSnapshot
//   totalFringePay      = totalHours * fringeRateSnapshot
//   expectedGross       = straightTimeBasePay + overtimePremium + totalFringePay
const result = calculateCwhssaOt({
  baseRate: entry.baseRateSnapshot,
  fringeRate: entry.fringeRateSnapshot,
  totalHoursWorked: totalHours,
  overtimeHours: totalOt,   // stored OT hours from the entry
});
const expectedGross = result.totalWeeklyCost;
```

**Key insight on OT hours:** The `payrollEntries` table stores DAILY OT hours in `monOt` through `sunOt`. The OT hours to use in the CWHSSA formula are the SUM of these daily OT columns — they represent hours the worker actually worked at OT rate. The compliance engine does NOT need to re-derive OT from total hours vs. threshold; the stored OT columns are authoritative (they were entered by the user).

### Pattern 3: Under-Wage Violation Formula

```typescript
// COMP-01: under-wage check
// Expected minimum gross = all hours at base rate + (OT hours * 0.5 * base) + all hours * fringe
// This is the same as the CWHSSA formula above.
// If grossWages is null, skip the under-wage check (no gross was recorded).
if (entry.grossWages != null) {
  const delta = entry.grossWages - result.totalWeeklyCost;
  if (delta < -0.01) {  // tolerance: $0.01 for floating point
    violations.push({
      violationType: 'under-wage',
      expected: result.totalWeeklyCost,
      actual: entry.grossWages,
      delta,
      ...
    });
  }
}
```

### Pattern 4: Compliance Route — Mirror variance.ts

```typescript
// Source: pattern from src/server/routes/variance.ts
// GET /api/compliance/:weekId

complianceRouter.get('/:weekId', requireAuth, async (req, res) => {
  const weekId = req.params.weekId as string;
  const db = getDb();
  const result = await computeCompliance(db, weekId);
  if (!result) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }
  // Ownership check: verify project.userId matches req.user.userId
  res.json(result);
});
```

### Pattern 5: PayrollWeekDetailPage — New React Page

Route: `/projects/:projectId/payroll/:weekId`

This page:
1. Calls `GET /api/payroll/weeks/:weekId` via `api.get()` — returns `{ week, entries }`
2. Calls `GET /api/compliance/:weekId` via `api.get()` — returns `ComplianceResult`
3. Renders a table of workers with hours, rates, grossWages
4. Renders violation flags alongside offending entries
5. Provides `<a href={`/api/export/wh347/${weekId}`}>Download WH-347</a>` anchor

```typescript
// Source: pattern from src/client/pages/PayrollListPage.tsx + VarianceReportPage.tsx

export function PayrollWeekDetailPage() {
  const { projectId, weekId } = useParams<{ projectId: string; weekId: string }>();

  const { data: weekData } = useQuery({
    queryKey: ['payroll-week', weekId],
    queryFn: () => api.get<{ week: PayrollWeek; entries: PayrollEntryRow[] }>(`/payroll/weeks/${weekId}`),
    enabled: !!weekId,
  });

  const { data: complianceData } = useQuery({
    queryKey: ['compliance', weekId],
    queryFn: () => api.get<ComplianceResult>(`/compliance/${weekId}`),
    enabled: !!weekId,
  });

  // ...render entries table with inline violation flags
  // WH-347 button:
  return (
    <a href={`/api/export/wh347/${weekId}`}>
      Download WH-347
    </a>
  );
}
```

### Pattern 6: PayrollListPage Link to Detail (already points to correct route)

`PayrollListPage.tsx` already links to `/projects/${projectId}/payroll/${week.id}` — this route is currently unregistered in `App.tsx`. Adding the detail page registers it and the link becomes active immediately.

### Pattern 7: WH-347 Multi-Page — Already Done in Phase 6

`fillWh347()` already chunks workers into groups of 8 and generates the correct number of page pairs. WH347-04 is already satisfied by the Phase 6 implementation. The compliance engine in Phase 7 does not need to touch `wh347Generator.ts`.

### Anti-Patterns to Avoid

- **Do not re-derive OT from total hours in the compliance check.** The stored `monOt`–`sunOt` columns are authoritative. Calling `applyOtThreshold()` again risks inconsistency if the threshold changed after entry.
- **Do not read from wageClassifications for compliance.** The `baseRateSnapshot` and `fringeRateSnapshot` on `payrollEntries` are the frozen values to use. This is explicitly stated in the `varianceService.ts` comment ("NEVER reads from wageClassifications").
- **Do not expose the compliance endpoint without ownership verification.** The route must verify that the payroll week's project belongs to the authenticated user, same as `GET /api/payroll/weeks/:id` does.
- **Do not add a compliance boolean column to the payroll schema.** Violations are computed on-demand from stored snapshots (STATE.md decision: "Violations computed on-demand from stored snapshots").
- **Do not change fillWh347().** WH347-04 is already done. The detail page just needs to anchor to `/api/export/wh347/:weekId`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CWHSSA OT math | Custom overtime calculation | `calculateCwhssaOt()` in `calculations.ts` | Already tested, pure function, handles the fringe-excluded-from-OT-multiplier rule correctly |
| OT threshold lookup | Direct DB query | `getOrDefaultThreshold()` in `otCalculator.ts` | Already returns CWHSSA 40-hour default when no row exists — research flag resolved |
| WH-347 PDF generation | Custom PDF logic | Existing `GET /api/export/wh347/:weekId` | Multi-page already works from Phase 6 |
| DB test setup | Custom in-test DB | `(globalThis as any).__testDb` from `tests/helpers/db.ts` | setupFiles in vitest.config.ts runs migration on `:memory:` SQLite before each test file |
| Client data fetching | Custom fetch wrapper | `api.get()` from `src/client/lib/api.ts` + React Query | Consistent auth cookie handling, standard query keys |

---

## Resolved Research Flags

### Flag 1: Exact column names for daily ST/OT hours in payrollEntries

**RESOLVED — HIGH confidence (read directly from schema.ts)**

The `payrollEntries` table has 14 daily hours columns:
- Straight-time: `monSt`, `tueSt`, `wedSt`, `thuSt`, `friSt`, `satSt`, `sunSt` (all `real`, default 0)
- Overtime: `monOt`, `tueOt`, `wedOt`, `thuOt`, `friOt`, `satOt`, `sunOt` (all `real`, default 0)

Additional fields for compliance: `baseRateSnapshot` (real, required), `fringeRateSnapshot` (real, required), `grossWages` (real, nullable).

The apprentice ratio daily-loop query (COMP-03, deferred to v2.1) would need to sum workers with `laborType = 'apprentice'` or `journeyworker` per trade per day using the daily columns. That is out of scope for Phase 7.

### Flag 2: getOrDefaultThreshold() handles missing rows for CWHSSA 40-hour default

**RESOLVED — HIGH confidence (read directly from otCalculator.ts lines 61-72)**

```typescript
// Source: src/server/services/otCalculator.ts

export async function getOrDefaultThreshold(projectId: string): Promise<OtThreshold> {
  const row = await getOtThreshold(projectId);
  if (!row) return DEFAULT_THRESHOLD;  // <-- explicit missing-row guard
  ...
}

const DEFAULT_THRESHOLD: OtThreshold = {
  weeklyOtThreshold: 40,
  dailyOtThreshold: null,
  dailyDtThreshold: null,
  otMultiplier: 1.5,
  dtMultiplier: 2.0,
  source: 'cwhssa',
};
```

When no `otThresholds` row exists for a project, `getOrDefaultThreshold()` returns `weeklyOtThreshold: 40` with no daily thresholds — exactly the CWHSSA standard. The compliance engine can call this directly.

---

## Common Pitfalls

### Pitfall 1: CWHSSA Fringe Exclusion from OT Multiplier
**What goes wrong:** Multiplying fringe by 1.5 for overtime hours, producing inflated expected values and false under-wage violations.
**Why it happens:** Standard overtime intuition is to multiply everything at 1.5x.
**How to avoid:** `calculateCwhssaOt()` already implements the correct rule: fringe is paid at 1.0x for ALL hours, no OT premium. Always delegate to this function.
**Warning signs:** Expected gross is significantly higher than the worker's actual gross even for compliant payroll; test with a known-clean 44-hour week.

### Pitfall 2: Using Stored OT Columns vs. Re-Deriving OT
**What goes wrong:** Computing OT as `max(0, totalHours - 40)` instead of summing `monOt...sunOt` — these can diverge if the project uses a CBA daily OT threshold or if the user manually entered OT hours.
**Why it happens:** Easier to re-derive than to trust stored values.
**How to avoid:** Sum `monOt + tueOt + wedOt + thuOt + friOt + satOt + sunOt` from the entry row — these are what the user entered and what the WH-347 shows.
**Warning signs:** False violations on projects with CBA daily OT thresholds where OT kicks in at 8 hours/day rather than 40 hours/week.

### Pitfall 3: Checking grossWages When It's null
**What goes wrong:** Treating `null` grossWages as a $0 violation.
**Why it happens:** `grossWages` is nullable (schema: `real('gross_wages')` — no `.notNull()`).
**How to avoid:** Skip the under-wage check entirely when `entry.grossWages == null`. Null means the user did not record gross wages, not that they paid $0.
**Warning signs:** Every entry without grossWages shows as a violation.

### Pitfall 4: Floating Point Exact Equality in Violation Detection
**What goes wrong:** Minor floating point rounding (e.g., $0.001) triggers false violations.
**Why it happens:** JavaScript floating point arithmetic.
**How to avoid:** Use a tolerance of $0.01 when comparing `actual` vs `expected`. Flag only when `delta < -0.01`.

### Pitfall 5: WH-347 Download as POST Instead of Anchor
**What goes wrong:** Trying to download the PDF via `fetch()` and triggering a file save with JavaScript — complex and fragile.
**Why it happens:** SPA instinct to do everything through the API client.
**How to avoid:** Use a plain `<a href="/api/export/wh347/:weekId" download>` anchor. The route sets `Content-Disposition: attachment` headers. The browser handles the download natively with no JavaScript required.

### Pitfall 6: Missing Ownership Check in Compliance Route
**What goes wrong:** Any authenticated user can call `/api/compliance/:weekId` for any week.
**Why it happens:** Forgetting to verify project ownership after loading the week.
**How to avoid:** Mirror `payroll.ts` `assertProjectOwner()` pattern — load week, then load project, verify `project.userId === req.user.userId`.

---

## Code Examples

### Compliance Service — Core Violation Loop

```typescript
// Source: pattern from src/server/services/varianceService.ts
//         math from src/server/services/calculations.ts

const entries = await getPayrollEntries(weekId); // returns enriched rows with workerName, laborType
const threshold = await getOrDefaultThreshold(projectId); // 40-hr CWHSSA default if no row

const violations: ComplianceViolation[] = [];

for (const row of entries) {
  const e = row.entry;
  const totalSt = e.monSt + e.tueSt + e.wedSt + e.thuSt + e.friSt + e.satSt + e.sunSt;
  const totalOt = e.monOt + e.tueOt + e.wedOt + e.thuOt + e.friOt + e.satOt + e.sunOt;
  const totalHours = totalSt + totalOt;

  const result = calculateCwhssaOt({
    baseRate: e.baseRateSnapshot,
    fringeRate: e.fringeRateSnapshot,
    totalHoursWorked: totalHours,
    overtimeHours: totalOt,
  });

  // COMP-01: under-wage check (only when grossWages was recorded)
  if (e.grossWages != null) {
    const delta = e.grossWages - result.totalWeeklyCost;
    if (delta < -0.01) {
      violations.push({ violationType: 'under-wage', expected: result.totalWeeklyCost,
                        actual: e.grossWages, delta, workerId: e.workerId,
                        workerName: row.workerName, entryId: e.id });
    }
  }

  // COMP-02: CWHSSA OT accuracy check (only when grossWages was recorded)
  if (e.grossWages != null) {
    const delta = e.grossWages - result.totalWeeklyCost;
    if (Math.abs(delta) > 0.01 && totalOt > 0) {
      violations.push({ violationType: 'cwhssa-ot', expected: result.totalWeeklyCost,
                        actual: e.grossWages, delta, workerId: e.workerId,
                        workerName: row.workerName, entryId: e.id });
    }
  }
}
```

**Note on COMP-01 vs COMP-02:** Both checks compare `grossWages` to `expectedGross`. They differ in semantics: COMP-01 flags any underpayment (delta < -0.01), COMP-02 flags gross mismatch on entries with OT hours (Math.abs(delta) > 0.01 AND totalOt > 0). In practice, the same formula catches both — the violation type communicates the nature to the user.

### Compliance Route Registration

```typescript
// src/server/index.ts addition
import { complianceRouter } from './routes/compliance.js';
app.use('/api/compliance', complianceRouter);
```

### App.tsx New Route

```typescript
// src/client/App.tsx addition
import { PayrollWeekDetailPage } from './pages/PayrollWeekDetailPage.js';

// Inside <Routes>:
<Route path="/projects/:projectId/payroll/:weekId" element={<PayrollWeekDetailPage />} />
```

**Note:** This route must come BEFORE any catch-all wildcard. The `new` path (`/projects/:projectId/payroll/new`) must remain above `/:weekId` since React Router v6+ matches in order and `new` is a string that would match the `:weekId` segment.

### WH-347 Download Button

```tsx
// src/client/pages/PayrollWeekDetailPage.tsx
<a
  href={`/api/export/wh347/${weekId}`}
  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800"
>
  Download WH-347
</a>
```

No JavaScript needed. The route already sets `Content-Disposition: attachment; filename="wh347-{number}.pdf"`.

### Test Pattern (Service Level)

```typescript
// tests/services/complianceService.test.ts
// Source: pattern from tests/services/payrollService.test.ts

import { computeCompliance } from '../../src/server/services/complianceService.js';

describe('computeCompliance', () => {
  it('COMP-01: flags entry where grossWages < expected', async () => {
    const db = (globalThis as any).__testDb;
    // seed via supertest (same pattern as payrollService.test.ts seedProjectAndWorker)
    // ...
    const result = await computeCompliance(db, weekId);
    expect(result?.violations).toHaveLength(1);
    expect(result?.violations[0].violationType).toBe('under-wage');
  });

  it('returns no violations for a correctly paid straight-time entry', async () => {
    // ...
    const result = await computeCompliance(db, weekId);
    expect(result?.violations).toHaveLength(0);
    expect(result?.hasViolations).toBe(false);
  });

  it('certProperPayment is false when under-wage violation exists', async () => {
    // ...
    expect(result?.certProperPayment).toBe(false);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WH-347 hardcoded to 8 workers | Multi-page via `copyPages()` + `addPage()` | Phase 6 (2026-03-20) | WH347-04 is already satisfied — do not re-implement |
| `certProperPayment` hardcoded to `true` | Will be driven by compliance engine output | Phase 7 — this phase | TODOs in export.ts lines 159-160 must be resolved |
| No payroll week detail page | New `PayrollWeekDetailPage.tsx` | Phase 7 — this phase | PayrollListPage already links to the route — just needs to be registered |

**TODOs in export.ts that Phase 7 resolves:**
- Line 104: `// TODO Phase 7: replace with compliance engine output once engine is built.`
- Line 159: `certProperPayment: true,  // TODO Phase 7: derive from compliance engine`
- Line 160: `certAccuratePayroll: true, // TODO Phase 7: derive from compliance engine`

When Phase 7 is complete, `export.ts` should call `computeCompliance()` and use `result.certProperPayment` and `result.certAccuratePayroll` to fill those fields on the Statement of Compliance.

---

## Open Questions

1. **Should under-wage and CWHSSA OT produce separate violation types or one?**
   - What we know: COMP-01 and COMP-02 are described separately in requirements; both compare grossWages to expectedGross.
   - What's unclear: In practice, any underpayment on a week with OT would trigger both. Should the engine deduplicate?
   - Recommendation: Emit one violation per entry, type = `'under-wage'` when delta < -0.01 AND no OT, type = `'cwhssa-ot'` when totalOt > 0 (OT present). This matches the requirement language — COMP-02 specifically mentions "gross wages don't match the CWHSSA formula" implying OT is present.

2. **Should compliance results be shown inline with entries or in a separate violations panel?**
   - What we know: The success criterion says "a list of compliance violations for that week, each identifying the worker and the nature of the violation" — a separate panel is explicitly described.
   - Recommendation: Render violations as a distinct section below the entries table. Use red badge on the entry row to cross-reference.

3. **Does export.ts need to be updated in Phase 7 or can the TODO comments wait?**
   - What we know: The export.ts TODOs explicitly say "TODO Phase 7" and hardcode `certProperPayment: true`.
   - Recommendation: Update export.ts in Phase 7. The compliance engine will exist; calling it from the export route to derive the Statement of Compliance booleans is the correct completion of COMP-01/COMP-02.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --testPathPattern=compliance` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Entry with grossWages < expected gross is flagged as `under-wage` | unit | `npm test -- tests/services/complianceService.test.ts` | Wave 0 |
| COMP-01 | Entry with null grossWages is NOT flagged | unit | `npm test -- tests/services/complianceService.test.ts` | Wave 0 |
| COMP-01 | Clean ST entry with correct grossWages has no violations | unit | `npm test -- tests/services/complianceService.test.ts` | Wave 0 |
| COMP-02 | Entry with OT and incorrect grossWages is flagged as `cwhssa-ot` | unit | `npm test -- tests/services/complianceService.test.ts` | Wave 0 |
| COMP-02 | CWHSSA fringe is NOT multiplied for OT hours | unit | `npm test -- tests/services/complianceService.test.ts` | Wave 0 |
| COMP-02 | `certProperPayment` false when under-wage violation | unit | `npm test -- tests/services/complianceService.test.ts` | Wave 0 |
| WH347-03 | `GET /api/compliance/:weekId` returns violations array | integration | `npm test -- tests/routes/compliance.test.ts` | Wave 0 |
| WH347-03 | Compliance route returns 403 for unowned week | integration | `npm test -- tests/routes/compliance.test.ts` | Wave 0 |
| WH347-04 | Already tested in Phase 6 `wh347.test.ts` | existing | `npm test -- tests/services/wh347.test.ts` | Exists |

### Sampling Rate
- **Per task commit:** `npm test -- tests/services/complianceService.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/services/complianceService.test.ts` — covers COMP-01, COMP-02
- [ ] `tests/routes/compliance.test.ts` — covers WH347-03 route contract

*(Existing test infrastructure: `vitest.config.ts`, `tests/helpers/db.ts`, and `:memory:` SQLite setup are all present — no framework install needed.)*

---

## Sources

### Primary (HIGH confidence)
- `src/server/db/schema.ts` — exact column names for `payrollEntries` (all 14 daily hours columns, `baseRateSnapshot`, `fringeRateSnapshot`, `grossWages`)
- `src/server/services/calculations.ts` — `calculateCwhssaOt()` implementation and `CwhssaOtResult` interface
- `src/server/services/otCalculator.ts` — `getOrDefaultThreshold()` confirmed to return 40-hour CWHSSA default when no row exists
- `src/server/services/varianceService.ts` — full pattern to mirror for `complianceService.ts`
- `src/server/routes/export.ts` — WH-347 route confirmed working, TODOs identified for Phase 7 completion
- `src/server/routes/payroll.ts` — `GET /api/payroll/weeks/:id` returns `{ week, entries }` — no new endpoint needed for detail page data
- `src/client/pages/PayrollListPage.tsx` — already links to `/projects/:projectId/payroll/:weekId` — route not yet registered
- `src/client/App.tsx` — current routes; `/projects/:projectId/payroll/new` must come before `/:weekId` pattern
- `vitest.config.ts` + `tests/helpers/db.ts` — test infrastructure confirmed operational

### Secondary (MEDIUM confidence)
- None needed — all research resolved from codebase directly.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and existing service files
- Architecture: HIGH — derived from confirmed codebase patterns in varianceService, otCalculator, and export route
- Pitfalls: HIGH — identified from direct code inspection of nullable fields, floating point comparisons, and existing TODO comments
- Research flags: HIGH — both flags resolved by direct code reading

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable codebase; schema changes would invalidate column name findings)
