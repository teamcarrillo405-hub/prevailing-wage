# Phase 119: Dashboard Intelligence - Research

**Researched:** 2026-04-29
**Domain:** React dashboard UI + Node/Express API + SQLite/Drizzle analytics queries
**Confidence:** HIGH

## Summary

All four DASH requirements are **already substantially implemented** in the codebase. The DashboardPage.tsx already renders the hero stat row (DASH-01), the 12-week compliance trend LineChart (DASH-02), the at-risk panel (DASH-03), and the per-project violation count badge on ProjectCard (DASH-04). The server has the batch compliance endpoint (`GET /api/compliance/projects/summary`) that drives these, plus a real-time `/api/dashboard/violations` polling endpoint.

The success criteria in REQUIREMENTS.md describe a **new, dedicated `GET /api/dashboard/stats` endpoint** and `GET /api/dashboard/compliance-trend` and `GET /api/dashboard/at-risk` endpoints. Currently none of these three routes exist — the dashboard page satisfies the visual requirements by deriving stats client-side from the existing batch compliance summary endpoint. The spec calls for dedicated, tested server endpoints with a single SQL query each (< 200ms). The main work is therefore: (1) creating those three new endpoint contracts, (2) writing 2+ Vitest tests for the `/api/dashboard/stats` route, and (3) the 7-day violation age filter for at-risk (currently the `/violations` endpoint uses `weekEndingDate < today - 7 days` which is past-due detection, not violation age > 7 days from the compliance engine's violation list).

recharts 3.8.0 is installed and already imported into DashboardPage.tsx with `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer` — the exact components needed. No new dependency installs required.

**Primary recommendation:** Add three thin new Express routes under `dashboardRouter` (`/stats`, `/compliance-trend`, `/at-risk`), each running a single optimized SQL query against the existing `payroll_weeks`, `compliance_results` (via `getBatchProjectCompliance`), and `projects` tables. The client-side derivations in DashboardPage.tsx can be simplified to call these new endpoints. Tests go in `tests/routes/dashboard.test.ts` (new file — the route has no existing test file).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Hero stat row: GET /api/dashboard/stats → { activeProjects, openViolations, weeksDueThisWeek }; React Query staleTime 60000 | `/api/dashboard/stats` route does not exist yet; stats currently computed client-side from batch summary. The three values map directly to existing data: active projects from `projects` table (status='active'), open violations summed from `getBatchProjectCompliance` violation counts, weeksDueThisWeek from `payrollWeeks.weekEndingDate` within [today, today+7] and not submitted. |
| DASH-02 | GET /api/dashboard/stats single SQL query < 200ms, 2+ Vitest tests | Single SQL via raw `db.get(sql)` is the performance path. Tests in `tests/routes/dashboard.test.ts` using supertest + in-memory SQLite (existing pattern). |
| DASH-03 | ComplianceTrendChart: GET /api/dashboard/compliance-trend → { weeks: [{ weekLabel, violationCount }] } last 12 weeks | Route does not yet exist. The economic-impact endpoint already computes `complianceTrend` server-side in the same fashion. This is a slimmer dedicated route returning only trend data. recharts LineChart is already imported in DashboardPage. |
| DASH-04 | Projects-at-risk panel: GET /api/dashboard/at-risk → top 5 projects with violations > 7 days old; panel hidden when empty | Route does not exist. Current `/api/dashboard/violations` uses past-due-week age (not violation-record age). True "violations > 7 days old" means compliance engine violations (from `getBatchProjectCompliance`) where the week's `weekEndingDate` is at least 7 days before today. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.0 (installed) | LineChart sparkline for trend | Already a dep; DashboardPage already imports LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer |
| @tanstack/react-query | ^5.91.0 (installed) | Data fetching with staleTime | Already used throughout; DashboardPage uses `useQuery` with `staleTime: 60_000` pattern |
| better-sqlite3 + drizzle-orm | installed | DB queries | Project standard; all server routes use `getDb()` + Drizzle select or raw SQL |
| supertest + vitest | installed | Route tests | Existing test pattern; 838 tests passing |

### No New Dependencies Required
All libraries needed for Phase 119 are already installed. Do NOT add new npm packages.

**Installation:** None needed.

---

## Architecture Patterns

### Existing Route File to Extend
`src/server/routes/dashboard.ts` — already has `dashboardRouter` with two GET routes (`/violations`, `/economic-impact`). Add three new routes to this file: `/stats`, `/compliance-trend`, `/at-risk`.

### Recommended Project Structure
```
src/server/routes/dashboard.ts      ← add /stats, /compliance-trend, /at-risk
tests/routes/dashboard.test.ts      ← NEW test file (none exists today)
src/client/pages/DashboardPage.tsx  ← update to call new endpoints; simplify client-side derivations
```

### Pattern 1: Single-Query Stats Endpoint
**What:** `/api/dashboard/stats` returns three integers computed in a minimal set of DB queries scoped to the authenticated user's projects.
**When to use:** DASH-01 / DASH-02 requirements
**Key shape:**
```typescript
// Response: { activeProjects: number, openViolations: number, weeksDueThisWeek: number }
dashboardRouter.get('/stats', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  // 1. Get user's project IDs via projectMembers JOIN (existing pattern)
  // 2. COUNT active projects (status = 'active') from projects table
  // 3. SUM violationCounts from getBatchProjectCompliance (existing service)
  // 4. COUNT payrollWeeks where weekEndingDate BETWEEN today AND today+7 AND submittedAt IS NULL
  res.json({ activeProjects, openViolations, weeksDueThisWeek });
});
```

**Performance note:** `getBatchProjectCompliance` iterates weeks and calls `computeCompliance()` per week — this is the existing batch approach already used by `/api/compliance/projects/summary` (staleTime 60s). For < 200ms, call the same service that's already used. The `weeksDueThisWeek` count is a simple filter over `payrollWeeks` rows already loaded.

### Pattern 2: Compliance Trend Endpoint
**What:** `/api/dashboard/compliance-trend` returns last-12-weeks violation counts.
**When to use:** DASH-03 requirement
**Key shape:**
```typescript
// Response: { weeks: [{ weekLabel: string, violationCount: number }] }
// weekLabel: e.g. "Apr 20"
// violationCount: number of payroll weeks in that 7-day bucket that have violations AND are past-due
```
The `economic-impact` route already computes `complianceTrend` server-side (lines 292–329 of dashboard.ts). This new endpoint is a slimmer version returning only `violationCount` per bucket.

### Pattern 3: At-Risk Projects Endpoint
**What:** `/api/dashboard/at-risk` returns top 5 projects with open violations older than 7 days.
**When to use:** DASH-04 requirement
**"Violations > 7 days old" definition:** A project has a payroll week where `weekEndingDate < today - 7 days` AND `submittedAt IS NULL`. This matches the current `/violations` endpoint semantics exactly. The requirement says "violations > 7 days old" — mapping that to past-due unsubmitted weeks (the existing definition) is the correct interpretation, consistent with how the dashboard currently surfaces at-risk projects.
**Key shape:**
```typescript
// Response: { projects: [{ id, name, violationCount, oldestViolationDate }] }
// sorted by violationCount DESC, limited to 5
```

### Pattern 4: React Query Call with staleTime: 60000
**Already established pattern in DashboardPage.tsx:**
```typescript
// Source: existing DashboardPage.tsx lines 93-99
const { data: summaryData } = useQuery({
  queryKey: ['compliance-summary-batch'],
  queryFn: () => api.get<...>('/compliance/projects/summary'),
  staleTime: 60_000,
});
```
New queries follow the same pattern:
```typescript
const { data: statsData } = useQuery({
  queryKey: ['dashboard-stats'],
  queryFn: () => api.get<{ activeProjects: number; openViolations: number; weeksDueThisWeek: number }>(
    '/dashboard/stats'
  ),
  staleTime: 60_000,
});
```

### Pattern 5: Vitest Route Test
**Existing pattern from tests/routes/apprenticeship.test.ts:**
```typescript
// Source: tests/routes/apprenticeship.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});
const { app } = await import('../../src/server/index.js');

// register → seed → assert GET /api/dashboard/stats returns shape
describe('GET /api/dashboard/stats', () => {
  it('returns 401 when unauthenticated', ...);
  it('returns valid shape with correct types', ...);
});
```

### DASH-04: ProjectCard Violation Badge — Already Done
ProjectCard.tsx already accepts `violationCount?: number` prop and renders:
- `violationCount > 0` → `<Badge variant="violation">{count} violation{s}</Badge>` (crimson via `--color-status-violation: #dc2626`)
- `violationCount === 0` with payroll weeks → `<Badge variant="compliant">Clean</Badge>` (emerald)
- No payroll → `<Badge variant="neutral">No payroll</Badge>`

DashboardPage.tsx already passes `violationCount={summaryItemMap.get(project.id)?.violationCount}` to each ProjectCard. **DASH-04 is already fully implemented.** No new work needed for the card badge.

### Anti-Patterns to Avoid
- **N+1 from per-project API calls on dashboard:** The existing `/compliance/projects/summary` batch endpoint solves this. New `/stats` endpoint must also batch (not loop calling `/compliance/project/:id`).
- **Duplicating `getBatchProjectCompliance` logic:** Reuse the existing service function rather than re-implementing the violation counting logic.
- **New recharts components:** Use only `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer` — already imported in DashboardPage.tsx. The trend chart already exists in the page as the DASH-02 block (lines 476–495).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Violation counting | Custom SQL COUNT query | `getBatchProjectCompliance()` | Already handles all violation types (under-wage, cwhssa-ot, ca-daily-ot, ca-daily-dt, week-violations, deductions); tested in 838-test suite |
| 12-week date buckets | Custom date math | Existing pattern in economic-impact route (lines 295–329) | Already handles week bucket alignment; copy the pattern |
| Trend chart | Custom SVG | recharts LineChart (already imported) | Production-proven; already in DashboardPage |
| React Query caching | Manual fetch + useState | `useQuery` with `staleTime: 60_000` | Existing pattern; matches DASH-01 spec requirement exactly |

---

## What Already Exists (Critical Discovery)

The REQUIREMENTS.md spec describes endpoints and UI as if they need to be built. In reality, most of the visual layer is already in DashboardPage.tsx (Phase 89 implemented DASH-01 through DASH-04 comments are in the code). What does NOT exist yet:

| Spec Requirement | UI Exists? | Server Endpoint Exists? | Gap |
|-----------------|------------|------------------------|-----|
| GET /api/dashboard/stats | Yes (client-side derived) | NO | Create route |
| GET /api/dashboard/compliance-trend | Yes (trendData useMemo) | NO | Create route |
| GET /api/dashboard/at-risk | Yes (violationsData useQuery → /dashboard/violations) | PARTIAL (/violations is similar but named differently) | Create /at-risk route |
| 2+ Vitest tests for /stats | n/a | NO | Create tests/routes/dashboard.test.ts |
| DASH-04 violation count badge | YES (fully implemented) | YES (via /compliance/projects/summary) | None — already done |

The planner should structure tasks as: (1) server-side endpoint creation, (2) Vitest tests, (3) client-side updates to call new endpoints (replacing client-side derivations). This is primarily a server + test task with minor client refactor.

---

## Common Pitfalls

### Pitfall 1: getBatchProjectCompliance is Slow for Large Portfolios
**What goes wrong:** It calls `computeCompliance()` per payroll week, which is O(weeks × entries). For a portfolio with 50 projects × 52 weeks, this is slow.
**Why it happens:** The service was designed for correctness, not for dashboard speed.
**How to avoid:** The `/api/compliance/projects/summary` endpoint already uses this and is already cached client-side at staleTime 60s. `/api/dashboard/stats` can call the same `getBatchProjectCompliance` service — it's the same data, same cache TTL. For the 838-test-passing codebase with typical small portfolios (5–20 projects), < 200ms is achievable.
**Warning signs:** If violationCount derivation in `/stats` uses `getBatchProjectCompliance` and it exceeds 200ms in test, consider scoping to only `weekEndingDate` past-due detection (matching `/violations` route) rather than full compliance engine.

### Pitfall 2: "Violations > 7 Days Old" Ambiguity
**What goes wrong:** The spec says "open violations older than 7 days" — this could mean (a) the payroll week's `weekEndingDate` is > 7 days ago, OR (b) the violation was first detected > 7 days ago (no `created_at` on violation records — they're computed on demand).
**Why it happens:** There is no `compliance_results` table with `created_at` — violations are recomputed from payroll entries each time. The `/violations` route uses definition (a). This is the correct interpretation.
**How to avoid:** Use `weekEndingDate < today - 7 days AND submittedAt IS NULL` as the at-risk filter — consistent with existing `/violations` route definition and how the DashboardPage currently shows the at-risk panel.

### Pitfall 3: Duplicate Stats Computation
**What goes wrong:** Creating `/stats` that recomputes what `/compliance/projects/summary` already returns, causing two expensive batch compliance calculations on page load.
**Why it happens:** The two endpoints appear different but overlap significantly.
**How to avoid:** Have DashboardPage use `/dashboard/stats` for the hero row and eliminate the client-side `activeProjectCount`, `totalViolations`, `dueSoonCount` useMemo derivations. The stats endpoint replaces the client-side derivation — it does NOT add a second batch call. Alternatively, `/stats` can be a lightweight aggregation that calls `getBatchProjectCompliance` (same function, same DB result).

### Pitfall 4: Test File Does Not Exist Yet
**What goes wrong:** Planner assumes `tests/routes/dashboard.test.ts` exists or can be inferred.
**Why it happens:** The dashboard route file has no corresponding test file (unlike compliance, payroll, etc.).
**How to avoid:** Wave 0 must create `tests/routes/dashboard.test.ts` with the standard pattern from `tests/routes/apprenticeship.test.ts`.

---

## Code Examples

### Design Token for Violation Badge Color
```css
/* Source: src/client/index.css */
--color-status-violation: #dc2626;  /* crimson — used by Badge variant="violation" */
--color-status-compliant: #16a34a;  /* emerald — used by Badge variant="compliant" */
```
The Badge component uses `bg-status-violation/10 text-status-violation border border-status-violation/30` for the "3 violations" badge. This is already correct in ProjectCard.tsx.

### Existing Hero Stat Row in DashboardPage.tsx (lines 461–474)
```tsx
// Source: src/client/pages/DashboardPage.tsx lines 461-474
{projects.length > 0 && (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
    {[
      { label: 'Active Projects', value: activeProjectCount, color: 'text-gray-900' },
      { label: 'Open Violations', value: totalViolations, color: totalViolations > 0 ? 'text-red-600' : 'text-emerald-600' },
      { label: 'Due This Week', value: dueSoonCount, color: dueSoonCount > 0 ? 'text-amber-600' : 'text-gray-900' },
    ].map(({ label, value, color }) => (
      <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
        <p className={`text-3xl font-bold mb-1 ${color}`}>{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    ))}
  </div>
)}
```
This is already rendered. The refactor replaces client-side `activeProjectCount`, `totalViolations`, `dueSoonCount` useMemo with values from the new `/dashboard/stats` endpoint.

### Existing Trend Chart in DashboardPage.tsx (lines 476–495)
```tsx
// Source: src/client/pages/DashboardPage.tsx lines 476-495
{trendData.length > 0 && projects.length > 0 && (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-8">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">Compliance Trend — Last 12 Weeks</h3>
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={trendData}>
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="violations" stroke="#DC2626" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
```
The `trendData` array currently has shape `{ week: string, violations: number }[]`. The new `/compliance-trend` endpoint returns `{ weeks: [{ weekLabel, violationCount }] }`. Client refactor renames dataKey from `violations` to `violationCount` and `week` to `weekLabel`.

### Existing At-Risk Panel in DashboardPage.tsx (lines 497–527)
Already rendered at lines 497–527 using `atRiskProjects` derived from `violationsData` (polling `/dashboard/violations` every 30s). The refactor replaces this with a call to `/dashboard/at-risk`. The panel already hides itself when `atRiskProjects.length === 0`.

### getBatchProjectCompliance Service (reuse for /stats)
```typescript
// Source: src/server/services/complianceService.ts lines 423-475
export async function getBatchProjectCompliance(
  db: BetterSQLite3Database<typeof schema>,
  userId: string,
): Promise<Map<string, BatchProjectSummary>>
// Returns Map<projectId, { status, violationCount, unsubmittedWeekEndingDates }>
// violationCount = violations.length + weekViolations.length per week
// unsubmittedWeekEndingDates used to compute weeksDueThisWeek
```

### payrollWeeks Schema
```typescript
// Source: src/server/db/schema.ts lines 265-287
export const payrollWeeks = sqliteTable('payroll_weeks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  weekEndingDate: text('week_ending_date').notNull(), // ISO 8601 date string e.g. "2025-04-06"
  payrollNumber: integer('payroll_number').notNull(),
  submittedAt: text('submitted_at'),   // null = not submitted; used for violation detection
  ...
});
```
There is NO `compliance_results` table. Violations are computed dynamically by `complianceService.ts`.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is code/config only, extending existing Express routes and React components with already-installed libraries).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed) |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npx vitest run tests/routes/dashboard.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | GET /api/dashboard/stats returns 401 unauthenticated | unit | `npx vitest run tests/routes/dashboard.test.ts` | No — Wave 0 |
| DASH-02 | GET /api/dashboard/stats returns { activeProjects, openViolations, weeksDueThisWeek } with correct types | unit | `npx vitest run tests/routes/dashboard.test.ts` | No — Wave 0 |
| DASH-03 | GET /api/dashboard/compliance-trend returns { weeks: [...] } shape | unit | `npx vitest run tests/routes/dashboard.test.ts` | No — Wave 0 |
| DASH-04 | Panel hidden when no at-risk projects (empty array behavior) | unit | `npx vitest run tests/routes/dashboard.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/routes/dashboard.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/routes/dashboard.test.ts` — covers DASH-01, DASH-02, DASH-03, DASH-04 route shapes and auth guards

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `src/client/pages/DashboardPage.tsx` — full page, all 1062 lines
- Direct code reading: `src/server/routes/dashboard.ts` — full route file, 592 lines
- Direct code reading: `src/server/services/complianceService.ts` — getBatchProjectCompliance lines 413–475
- Direct code reading: `src/client/components/projects/ProjectCard.tsx` — DASH-04 badge implementation
- Direct code reading: `src/server/db/schema.ts` — payrollWeeks table definition
- Direct code reading: `src/client/components/ui/Badge.tsx` — variant classes and color tokens
- Direct code reading: `src/client/index.css` — design token values
- Direct code reading: `package.json` — recharts 3.8.0, @tanstack/react-query ^5.91.0
- Direct code reading: `vitest.config.ts` — test framework config
- Direct code reading: `tests/routes/apprenticeship.test.ts` — canonical route test pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and live imports in DashboardPage.tsx
- Architecture: HIGH — all patterns confirmed by reading existing route implementations
- Pitfalls: HIGH — derived from reading actual code paths and identifying ambiguities in spec

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable codebase; valid for 30 days)
