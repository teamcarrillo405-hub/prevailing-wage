# Architecture Research

**Domain:** Prevailing wage compliance — adding compliance engine, report generation, and dashboard UX to existing Express/React app
**Researched:** 2026-03-19
**Confidence:** HIGH — based on direct codebase inspection, not external research

---

## Existing Architecture (Baseline)

Before describing what to add, the integration decisions depend on what already exists.

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        React Client                               │
│  DashboardPage  ProjectDetailPage  PayrollListPage  PayrollEntryPage │
│  (project list) (project detail)   (week list)     (entry form)  │
│            PayrollEntryPage → PayrollWeekForm                    │
└──────────────────┬───────────────────────────────────────────────┘
                   │ fetch via api.ts (proxy → :4099)
┌──────────────────┴───────────────────────────────────────────────┐
│                       Express Server                              │
│  /api/auth   /api/projects  /api/projects/:id/workers            │
│  /api/wages  /api/payroll   /api/ot-thresholds                   │
│  /api/export /api/gsa       /api/union     /api/variance         │
└──────────────────┬───────────────────────────────────────────────┘
                   │
┌──────────────────┴───────────────────────────────────────────────┐
│                      Services Layer                               │
│  payrollService.ts   varianceService.ts   calculations.ts (pure) │
│  wageCache.ts        wageLookup.ts         wh347Generator.ts     │
│  variancePdf.ts      csvExporter.ts        otCalculator.ts       │
└──────────────────┬───────────────────────────────────────────────┘
                   │ Drizzle ORM
┌──────────────────┴───────────────────────────────────────────────┐
│                         SQLite                                    │
│  users  projects  workers  workerClassifications                  │
│  wageDeterminations  wageClassifications  payrollWeeks            │
│  payrollEntries  otThresholds  unionTradeConfigs  gsaRates        │
│  projectBudgets                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Key Existing Patterns

The codebase follows consistent patterns throughout — any new code must follow these exactly:

1. **Router files** live in `src/server/routes/` and export a named `*Router`
2. **Service files** live in `src/server/services/` — pure functions and db-reading functions, no HTTP concerns
3. **Pure calculation functions** live in `src/server/services/calculations.ts` — no DB imports, no HTTP
4. **All routes** use `requireAuth` middleware and the `validate(Schema)` middleware pattern
5. **All PDF generation** uses pdf-lib (already installed); no new PDF libraries
6. **All DB queries** use Drizzle ORM; never raw SQL strings
7. **React pages** use `@tanstack/react-query` for server state — `useQuery` for reads, `useMutation` for writes
8. **No new tables** should modify existing columns — add-only schema changes only

---

## Integration Architecture: What to Add

### System Overview After v2.0

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Client (v2.0)                           │
│                                                                      │
│  DashboardPage*          PayrollListPage*       PayrollWeekPage (new)│
│  (+ compliance badges)   (+ WH-347 button)      (week view + actions)│
│                                                                      │
│  WorkerPayHistoryPage    FringeSummaryPage                           │
│  (new)                   (new)                                       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                    Express Server (v2.0)                             │
│  (all existing routes unchanged)                                     │
│                                                                      │
│  /api/compliance/projects/:id    (NEW — project-level summary)       │
│  /api/compliance/weeks/:weekId   (NEW — week-level violations)       │
│  /api/reports/worker-history/:id (NEW — worker pay history)         │
│  /api/reports/fringe/:projectId  (NEW — fringe benefit summary)     │
│  /api/export/wh347/:weekId       (EXISTING — add UI entry point)    │
│  /api/export/statement/:weekId   (NEW — Statement of Compliance PDF) │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                    Services Layer (v2.0)                             │
│  (all existing services unchanged)                                   │
│                                                                      │
│  complianceEngine.ts (NEW)   statementPdf.ts (NEW)                  │
│  workerHistoryService.ts (NEW)  fringeService.ts (NEW)              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                         SQLite (v2.0)                                │
│  (all existing tables unchanged)                                     │
│  No new tables required — all compliance derived from existing data  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### New Server Files

| File | Responsibility | Reads From |
|------|---------------|------------|
| `src/server/services/complianceEngine.ts` | Pure compliance checks — runs all violation rules, returns typed violations | payrollEntries, workerClassifications, wageClassifications, otThresholds |
| `src/server/routes/compliance.ts` | HTTP layer for compliance queries — project summary and per-week detail | complianceEngine.ts |
| `src/server/services/statementPdf.ts` | Generates standalone Statement of Compliance PDF via pdf-lib | Called by export route |
| `src/server/services/workerHistoryService.ts` | Aggregates payrollEntries across all weeks per worker | payrollEntries, payrollWeeks |
| `src/server/services/fringeService.ts` | Aggregates fringeRateSnapshot * hours per worker across weeks | payrollEntries |
| `src/server/routes/reports.ts` | HTTP layer for worker history and fringe summary | workerHistoryService.ts, fringeService.ts |

### Modified Server Files

| File | Modification | Why |
|------|-------------|-----|
| `src/server/routes/export.ts` | Add `GET /api/export/statement/:weekId` route | Statement of Compliance is a new export type alongside WH-347 |
| `src/server/index.ts` | Register `/api/compliance` and `/api/reports` routers | Wire up new routes |

### New Client Files

| File | Responsibility |
|------|---------------|
| `src/client/pages/PayrollWeekPage.tsx` | New page at `/projects/:projectId/payroll/:weekId` — shows week detail, compliance flags, WH-347 button, Statement button |
| `src/client/pages/WorkerPayHistoryPage.tsx` | Worker pay history table at `/projects/:projectId/workers/:workerId/history` |
| `src/client/pages/FringeSummaryPage.tsx` | Fringe benefit summary at `/projects/:projectId/fringe` |
| `src/client/components/compliance/ComplianceBadge.tsx` | Red/yellow/green pill indicator, reused in dashboard and week view |
| `src/client/components/compliance/ViolationsList.tsx` | List of compliance violations with severity and description |

### Modified Client Files

| File | Modification | Why |
|------|-------------|-----|
| `src/client/pages/DashboardPage.tsx` | Fetch compliance summary per project; pass to ProjectCard | Add compliance status to each card |
| `src/client/components/projects/ProjectCard.tsx` | Accept and render `complianceStatus` prop (red/yellow/green badge) | Dashboard compliance indicator |
| `src/client/pages/PayrollListPage.tsx` | Add "View" link to `PayrollWeekPage`; show compliance badge per week row | WH-347 one-click access |
| `src/client/App.tsx` | Register new routes: PayrollWeekPage, WorkerPayHistoryPage, FringeSummaryPage | Make pages reachable |

---

## Compliance Engine Design

### Where It Lives: Service, Not Middleware

The compliance engine belongs in `src/server/services/complianceEngine.ts` as a pure-ish service (reads DB, returns typed results). It must NOT be:

- **Route middleware** — compliance is a query, not a request gate. Middleware runs on every request; compliance is an on-demand report.
- **Computed on payroll save** — don't write violation state to the DB. The snapshot model (rate locked at entry time) already handles audit; violations can always be recomputed from existing data.
- **Stored results** — no `complianceViolations` table. Compliance is computed on-demand from payrollEntries + wageClassifications. This keeps schema simple and means violations automatically update when payroll is corrected.

**Rationale for on-demand computation:** SQLite is fast enough for a single project's payroll data (hundreds of rows at most). The variance service already does a similar multi-table aggregation with no performance issues. Compliance checks follow the same pattern.

### Compliance Check Types

The engine runs four independent checks. Each returns a typed array of violations:

```
ViolationSeverity: 'error' | 'warning'

ViolationType:
  'UNDER_WAGE'         — baseRateSnapshot < wageClassification.baseRate for worker's trade
  'OT_MISCALCULATION'  — grossWages doesn't match expected CWHSSA calculation (>= $0.01 delta)
  'APPRENTICE_RATIO'   — apprentice count exceeds allowed ratio for a given trade on a given week
  'MISSING_DATA'       — worker lacks address or ssnLast4 required for WH-347

Violation shape: {
  type: ViolationType
  severity: ViolationSeverity
  weekId?: string
  workerId: string
  workerName: string
  message: string        // human-readable description
  detail?: object        // type-specific data (e.g. actualRate, requiredRate)
}
```

Each check function is independently exported from complianceEngine.ts:

```typescript
checkUnderWageViolations(db, projectId): Promise<Violation[]>
checkOtViolations(db, projectId): Promise<Violation[]>
checkApprenticeRatioViolations(db, projectId): Promise<Violation[]>
checkMissingDataViolations(db, projectId): Promise<Violation[]>

// Aggregate: runs all four, returns combined array + rollup status
runProjectCompliance(db, projectId): Promise<ComplianceResult>

// Week-scoped: runs under-wage + OT + missing data for a single week
runWeekCompliance(db, weekId): Promise<ComplianceResult>
```

`checkApprenticeRatio` can reuse the existing `checkApprenticeRatio()` pure function already in `calculations.ts`. The engine just handles the DB query to feed it.

### Project-Level Compliance Status (Dashboard)

```
ComplianceStatus: 'green' | 'yellow' | 'red'

Rollup rule:
  red    — any violation with severity 'error'
  yellow — any violation with severity 'warning', no errors
  green  — no violations

ComplianceResult: {
  status: ComplianceStatus
  errorCount: number
  warningCount: number
  violations: Violation[]
}
```

The dashboard calls `GET /api/compliance/projects/:id` which calls `runProjectCompliance()`. The response is a `ComplianceResult`. The `ProjectCard` renders the badge using the `status` field only — it does not list individual violations.

---

## Data Flow

### Dashboard Compliance Flow

```
DashboardPage mounts
    ↓
useQuery(['projects']) → GET /api/projects
    ↓
useQuery(['compliance', projectId], for each project)
    → GET /api/compliance/projects/:id
    → complianceEngine.runProjectCompliance(db, projectId)
    → reads payrollEntries + workerClassifications + wageClassifications
    → returns { status, errorCount, warningCount }
    ↓
ProjectCard renders with ComplianceBadge (green/yellow/red pill)
```

**Performance note:** The dashboard fires N parallel compliance queries (one per project). For a typical GC with 5-20 active projects this is fine. If it becomes slow, batch into a single `GET /api/compliance/dashboard` endpoint that returns all project statuses in one query.

### Payroll Week View + PDF Generation Flow

```
User navigates to /projects/:projectId/payroll/:weekId
    ↓
PayrollWeekPage mounts
    ↓
useQuery(['payroll-week', weekId]) → GET /api/payroll/weeks/:id (existing)
useQuery(['compliance-week', weekId]) → GET /api/compliance/weeks/:weekId (new)
    ↓
Page renders: week summary + worker rows + violation list + action buttons
    ↓
User clicks "Download WH-347"
    → window.open(`/api/export/wh347/${weekId}`) (existing route, no change)
    → streams PDF
    ↓
User clicks "Download Statement of Compliance"
    → window.open(`/api/export/statement/${weekId}`) (new route)
    → statementPdf.ts generates PDF
    → streams PDF
```

### Worker Pay History Flow

```
User navigates to /projects/:projectId/workers/:workerId/history
    ↓
WorkerPayHistoryPage mounts
    ↓
useQuery(['worker-history', workerId])
    → GET /api/reports/worker-history/:workerId
    → workerHistoryService.ts joins payrollEntries + payrollWeeks
    → returns { worker, weeks: [{ weekEndingDate, payrollNumber, totalSt, totalOt, grossWages, netPay }] }
    ↓
Page renders sortable table + totals row
```

### Fringe Benefit Summary Flow

```
User navigates to /projects/:projectId/fringe
    ↓
FringeSummaryPage mounts
    ↓
useQuery(['fringe-summary', projectId])
    → GET /api/reports/fringe/:projectId
    → fringeService.ts aggregates fringeRateSnapshot * hours per worker
    → returns { workers: [{ workerId, workerName, totalFringeHours, totalFringeDollars }] }
    ↓
Page renders summary table
```

---

## Recommended Project Structure (v2.0 additions)

```
src/
├── server/
│   ├── routes/
│   │   ├── compliance.ts         NEW — GET /api/compliance/projects/:id, /weeks/:weekId
│   │   ├── reports.ts            NEW — GET /api/reports/worker-history/:id, /fringe/:projectId
│   │   └── export.ts             MODIFIED — add statement/:weekId route
│   ├── services/
│   │   ├── complianceEngine.ts   NEW — all violation check functions
│   │   ├── statementPdf.ts       NEW — Statement of Compliance PDF via pdf-lib
│   │   ├── workerHistoryService.ts NEW — cross-week aggregation per worker
│   │   └── fringeService.ts      NEW — fringe totals per worker per project
│   └── index.ts                  MODIFIED — register compliance and reports routers
├── client/
│   ├── pages/
│   │   ├── PayrollWeekPage.tsx   NEW — /projects/:projectId/payroll/:weekId
│   │   ├── WorkerPayHistoryPage.tsx NEW
│   │   └── FringeSummaryPage.tsx NEW
│   ├── components/
│   │   ├── compliance/
│   │   │   ├── ComplianceBadge.tsx  NEW — green/yellow/red pill
│   │   │   └── ViolationsList.tsx   NEW — violation rows with severity
│   │   └── projects/
│   │       └── ProjectCard.tsx   MODIFIED — accepts complianceStatus prop
│   └── pages/
│       ├── DashboardPage.tsx     MODIFIED — fetch + pass compliance status
│       └── PayrollListPage.tsx   MODIFIED — link to PayrollWeekPage, show badges
```

---

## Architectural Patterns

### Pattern 1: On-Demand Compliance Computation

**What:** Compliance checks are computed fresh on each API request from raw payroll data. No violation cache, no stored results.

**When to use:** Always, for this data scale. The compliance engine reads at most a few hundred rows per project. SQLite handles this in under 10ms.

**Trade-offs:** Simple — no sync issues between stored violations and updated payroll. Slightly more CPU per request than cached, but negligible at this scale.

**Example:**
```typescript
// src/server/routes/compliance.ts
router.get('/projects/:id', async (req, res) => {
  const db = getDb();
  const result = await runProjectCompliance(db, req.params.id);
  res.json(result);
});
```

### Pattern 2: Compliance Engine as Independent Service

**What:** complianceEngine.ts takes `db` and `projectId`/`weekId` as parameters. It does not import from routes, does not read `req`, does not write HTTP responses.

**When to use:** Always. Matches the existing pattern in varianceService.ts, which also takes `db` as a parameter.

**Trade-offs:** Testable in isolation. Can be called from multiple routes. No coupling to Express.

**Example:**
```typescript
// Matches the varianceService.ts pattern exactly:
export async function runProjectCompliance(
  db: BetterSQLite3Database<typeof schema>,
  projectId: string,
): Promise<ComplianceResult>
```

### Pattern 3: PDF Routes in Existing export.ts

**What:** The Statement of Compliance PDF route lives in `src/server/routes/export.ts` alongside the existing WH-347 route — it's another export type, not a separate concern.

**When to use:** Because the Statement of Compliance is conceptually the same as WH-347 — take a payroll week, generate a PDF, stream it. Both share the ownership check pattern.

**Trade-offs:** Keeps all PDF download routes in one file. Slightly larger file, but avoids creating a near-duplicate route structure.

### Pattern 4: Separate PayrollWeekPage from PayrollListPage

**What:** Create a new `PayrollWeekPage` at `/projects/:projectId/payroll/:weekId` instead of expanding `PayrollListPage`.

**When to use:** The current `PayrollListPage` only lists weeks. A "view week" page needs substantially different data (compliance results, entry detail, action buttons). These are separate concerns.

**Trade-offs:** Adds a new page file but keeps each page focused. The `PayrollListPage` "View" link changes from navigating directly to entry form, to navigating to the new week view page.

---

## Anti-Patterns

### Anti-Pattern 1: Storing Violation State in the Database

**What people do:** Create a `complianceViolations` table, write violations when payroll is saved, read them for display.

**Why it's wrong:** Creates a sync problem — if payroll entries are corrected, stored violations may be stale. The existing `baseRateSnapshot`/`fringeRateSnapshot` design was specifically chosen to make compliance re-derivable at any time. Don't fight the existing design.

**Do this instead:** Compute violations on-demand in `complianceEngine.ts`. The data is always current.

### Anti-Pattern 2: Compliance as Route Middleware

**What people do:** Add a compliance-check middleware to payroll save routes that blocks the request if violations exist.

**Why it's wrong:** Davis-Bacon compliance is a reporting requirement, not an entry gate. Contractors must be able to enter payroll even with under-wage workers (to correct later). Blocking entry breaks the core workflow and misrepresents how compliance works.

**Do this instead:** Show compliance violations as warnings/errors in the UI. Let the user decide whether to generate the WH-347 despite violations. The compliance check informs; it does not block.

### Anti-Pattern 3: Embedding WH-347 Logic in the Page Component

**What people do:** Put the PDF generation trigger directly in a React component via a `useMutation` that POSTs to generate a PDF and returns binary data.

**Why it's wrong:** The existing `GET /api/export/wh347/:weekId` pattern streams the PDF as a download using `window.open()`. This is simpler, avoids binary data handling in React, and matches how browsers handle file downloads naturally.

**Do this instead:** Use `window.open('/api/export/wh347/${weekId}')` and `window.open('/api/export/statement/${weekId}')` in the PayrollWeekPage action buttons. No mutation needed.

### Anti-Pattern 4: Dashboard Fetching Compliance Inside ProjectCard

**What people do:** Put the compliance `useQuery` call inside `ProjectCard` so each card is self-contained.

**Why it's wrong:** N components each with their own query = N waterfall renders, makes it hard to show a loading state for the whole dashboard, and couples a display component to a data fetch.

**Do this instead:** Fetch compliance data at the `DashboardPage` level alongside the projects query. Pass `complianceStatus` as a prop to `ProjectCard`. This follows the existing pattern where `ProjectCard` is a pure display component that receives all its data from props.

---

## Integration Points

### Existing Boundaries That Must Not Change

| Boundary | Rule |
|----------|------|
| `calculations.ts` | Pure functions only — no DB imports. The compliance engine calls these functions but lives in `complianceEngine.ts`. |
| `payrollService.ts` | No compliance logic added here. It stays a CRUD service for payroll weeks and entries. |
| `export.ts` WH-347 route | The existing route signature and behavior does not change. The UI adds a button that calls the existing route. |
| DB schema existing tables | No column modifications to existing tables. |

### New Boundaries Created

| Boundary | Communication |
|----------|---------------|
| `complianceEngine.ts` ↔ `compliance.ts` route | Direct function call; engine takes `(db, id)` parameters |
| `complianceEngine.ts` ↔ `calculations.ts` | Direct import; engine feeds DB data into pure calculation functions |
| `statementPdf.ts` ↔ `export.ts` route | Direct function call; same pattern as `wh347Generator.ts` ↔ `export.ts` |
| `DashboardPage` ↔ `ComplianceBadge` | Props — `status: 'green' | 'yellow' | 'red'` |
| `PayrollWeekPage` ↔ `ViolationsList` | Props — `violations: Violation[]` |

---

## Suggested Build Order

Build order respects dependencies: services before routes, routes before pages, shared components before pages that use them.

| Step | What | New vs Modified | Depends On |
|------|------|----------------|-----------|
| 1 | `complianceEngine.ts` (service) | NEW | Existing schema, calculations.ts |
| 2 | `compliance.ts` (route) | NEW | complianceEngine.ts |
| 3 | Register compliance router in `index.ts` | MODIFIED | compliance.ts |
| 4 | `ComplianceBadge.tsx` + `ViolationsList.tsx` | NEW | None |
| 5 | `DashboardPage.tsx` + `ProjectCard.tsx` | MODIFIED | ComplianceBadge.tsx, compliance route |
| 6 | `PayrollWeekPage.tsx` | NEW | compliance route, existing payroll route, ComplianceBadge, ViolationsList |
| 7 | `PayrollListPage.tsx` | MODIFIED | PayrollWeekPage (for link target) |
| 8 | `statementPdf.ts` (service) | NEW | pdf-lib (already installed) |
| 9 | Statement of Compliance route in `export.ts` | MODIFIED | statementPdf.ts |
| 10 | `workerHistoryService.ts` + `fringeService.ts` | NEW | Existing schema |
| 11 | `reports.ts` (route) + register in `index.ts` | NEW + MODIFIED | workerHistoryService.ts, fringeService.ts |
| 12 | `WorkerPayHistoryPage.tsx` + `FringeSummaryPage.tsx` | NEW | reports route |
| 13 | Register new pages in `App.tsx` | MODIFIED | All new pages |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 contractor, 1-30 projects | Current design handles this. On-demand compliance computation is fine. |
| Multi-user SaaS (future) | Compliance queries already scope to `projectId`; adding `userId` ownership checks follows the existing `assertProjectOwner` pattern. No architecture change needed, just auth scoping. |
| Large projects (500+ workers) | Compliance computation may slow. Batch the under-wage check to use a single JOIN query rather than N individual lookups. Not a concern for v2.0 scope. |

---

## Sources

- Direct inspection of `src/server/services/calculations.ts` — `checkApprenticeRatio()` already implemented as pure function
- Direct inspection of `src/server/services/varianceService.ts` — establishes the on-demand aggregation pattern with `(db, projectId)` signature
- Direct inspection of `src/server/routes/export.ts` — establishes the PDF streaming pattern via `window.open()` equivalent on client
- Direct inspection of `src/server/services/wh347Generator.ts` — confirms pdf-lib is the PDF tool; Statement of Compliance uses same approach
- Direct inspection of `src/client/pages/DashboardPage.tsx` + `ProjectCard.tsx` — confirms card is props-driven, correct place for compliance data

---

*Architecture research for: HCC Prevailing Wage v2.0 — Compliance + Reporting integration*
*Researched: 2026-03-19*
