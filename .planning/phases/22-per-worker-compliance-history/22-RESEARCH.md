# Phase 22: Per-Worker Compliance History - Research

**Researched:** 2026-03-23
**Domain:** Cross-project compliance aggregation, read-only reporting page, worker identity matching
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUD-01 | User can view a per-worker compliance history page showing all violations across all projects and weeks | computeCompliance() called per-week; new service iterates all user projects, all weeks, aggregates violations filtered by worker name+ssnLast4 |
| AUD-02 | WorkersPage shows a "Compliance History" link per worker row | WorkersPage render loop identified; existing button pattern in the actions cluster at line 334–355 |
</phase_requirements>

---

## Summary

Phase 22 adds a read-only audit report: a page that shows every compliance violation ever recorded for a specific worker across all the user's projects and payroll weeks. The design is simpler than it first appears — there is no persistent violations table. Violations are computed on-demand by `computeCompliance(db, weekId)` from stored payroll entry snapshots. The batch query strategy is: load all user projects, load all payroll weeks per project, call `computeCompliance()` per week, filter the returned `violations[]` and `weekViolations[]` to those matching the target worker, annotate each with project name + week metadata, and return the flattened list.

Worker identity across projects is matched by `(name, ssnLast4)` pair — there is no global worker ID. The `workers` table is project-scoped (`workers.projectId`). The calling URL will carry the source project's worker ID to bootstrap the name+ssnLast4 lookup; the service then scans all other projects for workers sharing those two values.

The UI surface is small: a new page at `/workers/:workerId/compliance-history` (or similar), a "Compliance History" link added to the existing worker card action buttons in `WorkersPage.tsx`, a new API endpoint on the compliance router, and a new React page component. All UI primitives (Card, Badge, EmptyState, PageHeader) already exist with the exact props needed.

**Primary recommendation:** Build a `getWorkerComplianceHistory(userId, workerId)` service function that orchestrates the cross-project scan, add one GET endpoint to `compliance.ts`, add one React page, register the route in `App.tsx`, and add the link to `WorkersPage.tsx`. Two plans: Plan 01 (service + route + tests), Plan 02 (page + link + browser verification).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | existing | Cross-table joins (projects, workers, payrollWeeks) | Already in use throughout |
| Express Router | existing | New GET endpoint on complianceRouter | Matches all existing route patterns |
| React + TanStack Query | existing | Per-page data fetch with useQuery | Consistent with every other page |
| React Router v6 | existing | New route + useParams | Matches App.tsx pattern exactly |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest + supertest | existing | Integration tests for new endpoint | Same pattern as compliance.test.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| On-demand computation | Pre-computed violations table | On-demand is correct per v2.0 decision: "Violations computed on-demand from stored snapshots — never compared to live WD rates". No schema change needed. |
| name+ssnLast4 matching | Global worker ID | Workers table is project-scoped by design. Cross-project match is always by (name, ssnLast4). |

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── server/
│   ├── routes/compliance.ts          # Add GET /worker/:workerId/history
│   └── services/complianceService.ts # Add getWorkerComplianceHistory()
└── client/
    ├── pages/WorkerComplianceHistoryPage.tsx  # New page
    └── pages/WorkersPage.tsx                  # Add "Compliance History" link
```

App.tsx gets one new route entry. No new files in routes/ — the endpoint belongs on the existing `complianceRouter`.

### Pattern 1: Cross-Project Compliance Aggregation Service

**What:** New exported function `getWorkerComplianceHistory(userId, workerId)` in `complianceService.ts`. Finds the source worker by ID, reads name+ssnLast4, scans all user projects for workers with the same identity, then iterates all payroll weeks calling `computeCompliance()`.

**When to use:** Called only by the new GET route. No other caller.

**Algorithm (verified against existing schema and service contracts):**

```typescript
// Source: direct codebase inspection of complianceService.ts + schema.ts

export interface WorkerViolationHistoryEntry {
  projectId: string;
  projectName: string;
  weekId: string;
  weekEndingDate: string;
  payrollNumber: number;
  violationType: 'under-wage' | 'cwhssa-ot' | 'apprentice-ratio';
  detail?: string;                  // apprentice-ratio only
  expected?: number;                // under-wage / cwhssa-ot only
  actual?: number;
  delta?: number;
  // apprentice-ratio amounts
  apprenticeHours?: number;
  journeyworkerHours?: number;
  maxAllowedApprenticeHours?: number;
}

export interface WorkerComplianceHistory {
  workerId: string;            // source worker ID (from URL)
  workerName: string;
  ssnLast4: string | null;
  totalViolations: number;
  entries: WorkerViolationHistoryEntry[];
}

export async function getWorkerComplianceHistory(
  db: BetterSQLite3Database<typeof schema>,
  userId: string,
  workerId: string,
): Promise<WorkerComplianceHistory | null> {
  // 1. Load source worker — verify it exists and user owns its project
  // 2. Load all user's projects
  // 3. For each project, find workers matching (name, ssnLast4)
  // 4. For each matching worker, load all payroll weeks
  // 5. For each week, call computeCompliance()
  // 6. From violations[], keep entries where e.workerId matches the project-scoped worker
  // 7. From weekViolations[], include if the matching worker appeared in that week
  // 8. Annotate each violation with project name + week metadata
  // 9. Return flattened, sorted by weekEndingDate DESC
}
```

**Key implementation note on weekViolations (apprentice-ratio):** `WeekViolation` has no `workerId` field — it's a week-level violation. Include it in the history only when the target worker appears in that week's entries (i.e., the worker was an apprentice or journeyworker in a week that had a ratio violation). The planner must decide inclusion policy — safest is: include the `apprentice-ratio` violation for the target worker's row if `computeCompliance()` returns any `weekViolations` for a week where the target worker has a `payrollEntry`.

### Pattern 2: New Endpoint Registration

**What:** Add GET `/worker/:workerId/history` to `complianceRouter` BEFORE the existing `/:weekId` wildcard to prevent Express route capture.

**Critical ordering rule (from STATE.md Phase 08 decision):** Route `/project/:projectId` is already registered before `/:weekId` for the same reason. The new `/worker/:workerId/history` endpoint MUST be registered before `/:weekId`.

```typescript
// Source: direct inspection of compliance.ts — ordering rule is documented in STATE.md
// Register order in complianceRouter:
// 1. GET /project/:projectId    (existing)
// 2. GET /worker/:workerId/history   (NEW — before wildcard)
// 3. GET /:weekId               (existing wildcard)
```

### Pattern 3: React Page + Route

**What:** New `WorkerComplianceHistoryPage.tsx` using the standard `Layout + PageHeader + useQuery + Card + Badge + EmptyState` composition.

**URL pattern:** `/workers/:workerId/compliance-history`

The `workerId` in the URL is the project-scoped worker ID from `WorkersPage.tsx`. The page needs the source projectId too — either pass via URL params or query string. Looking at existing patterns: `WorkersPage` lives at `/projects/:projectId/workers`. Adding the compliance history link as `/projects/:projectId/workers/:workerId/compliance-history` keeps it under the project namespace and avoids needing a global `/workers/` route. The API endpoint resolves cross-project data server-side.

**Route addition in App.tsx:**
```tsx
// After the existing /projects/:projectId/workers route:
<Route
  path="/projects/:projectId/workers/:workerId/compliance-history"
  element={<WorkerComplianceHistoryPage />}
/>
```

**Page data fetch:**
```tsx
// Source: WorkersPage.tsx api.get pattern + reports page TanStack Query pattern
const { data, isLoading, isError } = useQuery({
  queryKey: ['worker-compliance-history', workerId],
  queryFn: () =>
    api.get<WorkerComplianceHistory>(`/compliance/worker/${workerId}/history`),
  enabled: !!workerId,
});
```

### Pattern 4: "Compliance History" Link in WorkersPage

**Location:** Worker card action buttons cluster, lines 334–355 in WorkersPage.tsx.

The existing action cluster is:
```tsx
<div className="flex items-center gap-2">
  <button /* Edit */ ... />
  {hasWd && <button /* + Trade */ ... />}
  <button /* Remove */ ... />
</div>
```

Add "Compliance History" as a `Link` (React Router) styled to match the Edit button (`text-xs text-gray-500 border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors`).

**Important:** Per CLAUDE.md — "Button renders `<button>` making nesting invalid HTML; use secondary button classes directly on `<a>` for download links". Similarly, use React Router `Link` with direct className here, not `Button` wrapping a `Link`.

```tsx
// Source: WorkersPage.tsx button style pattern + App.tsx route pattern
import { Link } from 'react-router-dom';

<Link
  to={`/projects/${projectId}/workers/${w.id}/compliance-history`}
  className="text-xs text-gray-500 border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
>
  Compliance History
</Link>
```

### Anti-Patterns to Avoid

- **N+1 test regression risk:** Per STATE.md note "Write a 20-week test fixture before any implementation to catch N+1 regressions." The service loops projects → weeks → computeCompliance(). Each `computeCompliance()` call is already two DB queries (getPayrollWeek + getPayrollEntries). For a user with 5 projects × 4 weeks, that's 40 DB calls. This is intentional and acceptable for v2.3 (same decision as Phase 7: "computeCompliance() called independently — entries fetched twice is acceptable for Phase 7; performance optimization deferred"). Flag this in plan notes, write a multi-project fixture to confirm it doesn't blow up.
- **Cross-user data leak:** The service must verify `project.userId === userId` for every project scanned, not just the source worker's project. The existing `complianceRouter` pattern does this per-request; the service helper must replicate it.
- **weekViolations without workerId:** `WeekViolation` has no `workerId`. Don't try to filter by it — check whether the target worker had entries in that week instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Violation computation | Custom SQL aggregation | `computeCompliance(db, weekId)` | Already handles under-wage, cwhssa-ot, apprentice-ratio with correct formulas. Re-implementing risks formula drift. |
| Worker identity matching | Fuzzy name matching | Exact `(name, ssnLast4)` equality | The requirement specifies this exactly. ssnLast4 disambiguates common names. |
| Currency formatting | Custom formatter | `n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })` | Already the project's `fmt()` pattern in WorkersPage |
| Loading/error states | Custom spinner | `LoadingSpinner` component + existing error pattern | Consistent with every other page |

**Key insight:** The violation computation logic is entirely owned by `complianceService.ts`. This phase's new code is purely orchestration (which weeks to scan, which violations to keep) and presentation.

---

## Common Pitfalls

### Pitfall 1: Express Route Order — wildcard capture
**What goes wrong:** Registering `GET /worker/:workerId/history` AFTER `GET /:weekId` causes Express to match the literal string "worker" as a weekId, returning 404.
**Why it happens:** Express matches routes in declaration order; `/:weekId` is a catch-all segment.
**How to avoid:** Register `/worker/:workerId/history` before `/:weekId`. This is explicitly documented in STATE.md for the existing `project/:projectId` endpoint.
**Warning signs:** Route returns 404 or unexpected compliance result for `weekId = "worker"`.

### Pitfall 2: Missing workerId in weekViolation type
**What goes wrong:** Trying to include `weekViolations` in the history and filtering `v.workerId === targetWorkerId` — `WeekViolation` has no `workerId` field.
**Why it happens:** `WeekViolation` is an aggregate over the entire week, not per-entry.
**How to avoid:** Check whether the target worker has any `payrollEntry` for the week using the entry list already loaded by `computeCompliance()`. If the worker appears in that week, attach the week-level violation.

### Pitfall 3: Scanning other users' projects
**What goes wrong:** Loading ALL workers with matching name+ssnLast4 from the entire database, not scoped to the authenticated user's projects.
**Why it happens:** The match query joins across workers → projects but omits `WHERE projects.userId = userId`.
**How to avoid:** Filter projects by `userId` before scanning workers. Each project ownership check is mandatory.

### Pitfall 4: Workers with no ssnLast4
**What goes wrong:** Matching workers with `ssnLast4 = NULL` across projects — two different workers named "John Smith" with no SSN match incorrectly.
**Why it happens:** SQL `NULL = NULL` is false, but application-level logic may not guard this.
**How to avoid:** Only match on ssnLast4 when it is non-null on the source worker. When `ssnLast4` is null, match only on exact name within the source project (same-project-only history). Document this behavior clearly in the API response.

### Pitfall 5: N+1 not caught without a multi-project fixture
**What goes wrong:** Service works in tests with a single project but degrades badly with 10+ projects in production.
**Why it happens:** Each `computeCompliance()` call is 2 DB queries; N projects × M weeks × 2 = potentially 100+ queries.
**How to avoid:** Write a test fixture with at least 3 projects and 4-5 weeks each before implementation, as recommended in STATE.md research flags for Phase 22. Confirm the endpoint responds in < 500ms under this fixture.

---

## Code Examples

Verified patterns from official sources (direct codebase inspection):

### Cross-Project Drizzle Query Pattern
```typescript
// Source: compliance.ts GET /project/:projectId — ownership check pattern
const userProjects = await db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.userId, userId));

// Then per project:
const workerRows = await db
  .select()
  .from(schema.workers)
  .where(
    and(
      eq(schema.workers.projectId, project.id),
      eq(schema.workers.name, sourceWorker.name),
      eq(schema.workers.ssnLast4, sourceWorker.ssnLast4),
    )
  );
```

### computeCompliance() Call Contract
```typescript
// Source: complianceService.ts — existing signature
const result = await computeCompliance(db, week.id);
// result is ComplianceResult | null
// result.violations[] — per-entry violations (has workerId, violationType, expected, actual, delta)
// result.weekViolations[] — week-level violations (no workerId; apprentice-ratio only currently)
// result.hasViolations — boolean shortcut
```

### ComplianceViolation Fields (for UI display)
```typescript
// Source: complianceService.ts ComplianceViolation interface
interface ComplianceViolation {
  entryId: string;
  workerId: string;          // project-scoped worker ID — use for filtering
  workerName: string;
  violationType: 'under-wage' | 'cwhssa-ot';
  expected: number;          // what the worker should have been paid
  actual: number;            // what grossWages recorded
  delta: number;             // actual - expected (negative = underpayment)
}
```

### Badge Variants for Violation Types
```typescript
// Source: Badge.tsx + existing PayrollWeekDetailPage pattern
// under-wage   → <Badge variant="violation">Under-wage</Badge>
// cwhssa-ot    → <Badge variant="violation">CWHSSA OT</Badge>
// apprentice-ratio → <Badge variant="warning">Apprentice Ratio</Badge>
```

### Test Fixture Pattern (multi-project)
```typescript
// Source: compliance.test.ts seedProjectWithViolation pattern — extend to multiple projects
async function seedMultiProjectWorkerHistory(cookie: string) {
  // Create project A, add worker "Jane Doe" SSN 1234, add violation week
  // Create project B, add worker "Jane Doe" SSN 1234, add clean week
  // Create project C, different worker — should NOT appear in results
  // Returns { workerId: string (from project A), name: 'Jane Doe', ssnLast4: '1234' }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Live WD rate comparison | Snapshot-based compliance check | v2.0 Phase 7 | computeCompliance() never makes live WD lookups — safe for historical queries regardless of WD changes |
| Project-level compliance only | Week-level + worker-level violations | v2.2 Phase 15 | WeekViolation (apprentice-ratio) exists alongside entry-level ComplianceViolation |

**Deprecated/outdated:**
- Nothing deprecated in scope.

---

## Open Questions

1. **WeekViolation inclusion policy for the history page**
   - What we know: `WeekViolation` (apprentice-ratio) is week-scoped, no `workerId`. If Jane Doe is an apprentice in a week that has a ratio violation, should her history page show that violation?
   - What's unclear: Whether it's useful to attribute a week-level violation to an individual worker's history.
   - Recommendation: Include `weekViolations` in the history if the target worker had any `payrollEntry` in that week. This is conservative (shows the worker was present during a ratio violation) and useful for audit purposes. The planner should confirm this inclusion policy.

2. **ssnLast4 = null matching scope**
   - What we know: Two different "John Smith" workers on different projects with no SSN would incorrectly merge into one history.
   - What's unclear: Whether the requirement expects cross-project matching even when ssnLast4 is null.
   - Recommendation: When `ssnLast4` is null on the source worker, only return history from the source project. Document this in the API response with a `crossProjectMatchLimited: true` flag or similar.

3. **URL structure: project-scoped vs global worker route**
   - What we know: All existing worker routes are under `/projects/:projectId/`. A global `/workers/:workerId/compliance-history` route would require a different ownership-check path.
   - Recommendation: Use `/projects/:projectId/workers/:workerId/compliance-history` — consistent with existing route namespace, projectId provides an additional ownership verification point.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/routes/compliance.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUD-01 | GET /compliance/worker/:workerId/history returns all violations across multiple projects | integration | `npx vitest run tests/routes/compliance.test.ts` | ❌ Wave 0 |
| AUD-01 | Returns empty entries array for worker with no violations | integration | `npx vitest run tests/routes/compliance.test.ts` | ❌ Wave 0 |
| AUD-01 | Returns 403 for worker owned by a different user | integration | `npx vitest run tests/routes/compliance.test.ts` | ❌ Wave 0 |
| AUD-01 | Returns 404 for non-existent workerId | integration | `npx vitest run tests/routes/compliance.test.ts` | ❌ Wave 0 |
| AUD-01 | Cross-project identity match uses name+ssnLast4 (not project-scoped ID) | integration | `npx vitest run tests/routes/compliance.test.ts` | ❌ Wave 0 |
| AUD-01 | Worker with ssnLast4=null does not merge across projects | integration | `npx vitest run tests/routes/compliance.test.ts` | ❌ Wave 0 |
| AUD-02 | "Compliance History" link renders per worker row | manual browser | N/A | N/A |
| AUD-02 | Clicking link navigates to correct URL with workerId | manual browser | N/A | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/routes/compliance.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New `describe('GET /api/compliance/worker/:workerId/history', ...)` block in `tests/routes/compliance.test.ts` — covers AUD-01 (all 6 cases above)
- [ ] `seedMultiProjectWorkerHistory()` fixture in same file — 3 projects, 1 shared worker identity, covering violation + clean weeks

*(Existing `tests/helpers/db.ts` and `tests/routes/compliance.test.ts` infrastructure covers everything else — no new test files needed.)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `src/server/services/complianceService.ts` — violation types, ComplianceResult shape, computeCompliance() signature
- Direct codebase inspection of `src/server/db/schema.ts` — workers table is project-scoped, no global worker ID, ssnLast4 is nullable
- Direct codebase inspection of `src/client/pages/WorkersPage.tsx` — action button cluster location (lines 334–355), Link import pattern
- Direct codebase inspection of `src/client/App.tsx` — route registration pattern under ProtectedRoute
- Direct codebase inspection of `src/server/routes/compliance.ts` — route ordering rule, ownership check pattern
- Direct codebase inspection of `src/server/index.ts` — complianceRouter registered at `/api/compliance`
- Direct codebase inspection of `src/client/components/ui/` — Badge, EmptyState, Card, PageHeader props

### Secondary (MEDIUM confidence)
- STATE.md Decisions section — v2.0 "Violations computed on-demand from stored snapshots" (locked decision), Phase 08 "Route /project/:projectId registered before /:weekId" (ordering pattern), Phase 22 research flag "Write a 20-week test fixture before any implementation"

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries and patterns verified by direct codebase inspection
- Architecture: HIGH — service contract, route pattern, and UI component props all verified; open questions are design decisions, not unknowns
- Pitfalls: HIGH — route ordering and N+1 risks verified against existing STATE.md decisions and code patterns

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable codebase; violations table design is unlikely to change)
