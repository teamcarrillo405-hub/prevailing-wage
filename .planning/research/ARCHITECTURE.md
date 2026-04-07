# Architecture Patterns — v5.0 Integration Analysis

**Project:** HCC Prevailing Wage
**Researched:** 2026-04-07
**Scope:** How TX/FL/MA/NJ state forms, subcontractor tracking, and enhanced reporting integrate with the existing v4.0 architecture.
**Phase numbering:** Continues from Phase 46 (next = Phase 47).

---

## 1. State Gate Pattern — How It Works Today

Every state-specific PDF route in `src/server/routes/export.ts` follows an identical 8-step pattern:

```
1. Load payroll week by weekId
2. Verify project access via assertProjectAccess(db, week.projectId, userId)
3. STATE GATE: if (project.state !== 'XX') return 400
4. Load payroll entries
5. Map entries to StateWorkRow[]
6. Build StateData object
7. Generate PDF (template overlay OR programmatic draw)
8. Stream response as attachment + best-effort audit log
```

The state gate is always step 3 — after access check, before any data load. Never check state before assertProjectAccess (that would leak project existence).

**Existing state gates:**
- `/api/export/a1131/:weekId` — `project.state !== 'CA'` → 400
- `/api/export/f700/:weekId` — `project.state !== 'WA'` → 400
- `/api/export/pw12/:weekId` — `project.state !== 'NY'` → 400
- `/api/export/il-transcript/:weekId` — `project.state !== 'IL'` → 400

**New state gates to add (same pattern):**
- `/api/export/tx-cpr/:weekId` — `project.state !== 'TX'` → 400
- `/api/export/fl-cpr/:weekId` — `project.state !== 'FL'` → 400
- `/api/export/ma-cpr/:weekId` — `project.state !== 'MA'` → 400
- `/api/export/nj-cpr/:weekId` — `project.state !== 'NJ'` → 400

---

## 2. State Forms (TX, FL, MA, NJ)

### 2a. PDF Generator Strategy — IL is the Best Template

Two patterns exist in the codebase:

| Generator | Approach | When to Use |
|-----------|----------|-------------|
| `wh347Generator.ts`, `a1131Generator.ts`, `f700Generator.ts` | Template overlay — `pdf-lib` draws text coordinates onto an official PDF template file in `/assets/` | When the state provides an official fillable PDF form |
| `pw12Generator.ts`, `ilPdfGenerator.ts` | Programmatic draw — `PDFDocument.create()` draws everything from scratch | When the state does NOT provide an official PDF template |

For TX, FL, MA, NJ: these states do not have universally-available official PDF templates the way CA's A-1-131 does. **Use `ilPdfGenerator.ts` as the code template** — it is the most recent programmatic draw generator, has the cleanest structure (header block + worker table + affidavit page 2), and its `IlPdfInput` interface covers all fields any new state form will need.

**Key structural elements from `ilPdfGenerator.ts` to reuse:**
- `PDFDocument.create()` with letter-portrait dimensions (612 x 792 pt)
- Page 1: header block + worker table
- Page 2 (always separate): affidavit / statement of compliance
- Separate typed input interface per generator (e.g., `TxCprInput`, `FlCprInput`)

Note: if a state does provide a downloadable official PDF template, switch to the template-overlay pattern instead — the state gate route and data-mapping logic remain identical either way.

### 2b. DB Columns Needed Per State

Follow the existing pattern: add nullable state-specific columns to the `projects` table. Pattern confirmed in schema.ts — CA added `cslbLicense`, `wcPolicyNumber`; WA added `ubiNumber`, `lniCertificate`, `wcAccount`; NY added `nyprcNumber`, `nysContractorRegNumber`.

**New projects table columns per state:**

| State | Column | Type | Label in UI |
|-------|--------|------|-------------|
| TX | `txdotProjectId` | `text` nullable | TxDOT Project ID |
| TX | `txContractorLicense` | `text` nullable | TX Contractor License # |
| FL | `flDbeNumber` | `text` nullable | FL DBE/MBE Number |
| FL | `flContractId` | `text` nullable | FL Contract ID |
| MA | `maDlsProjectId` | `text` nullable | MA DLS Project ID |
| MA | `maSicCode` | `text` nullable | MA SIC/Trade Code |
| NJ | `njPwcNumber` | `text` nullable | NJ PWC Registration # |
| NJ | `njContractId` | `text` nullable | NJ Contract ID |

All nullable — a TX project that hasn't filled in TxDOT Project ID still generates a form with a blank field, consistent with how WA's `ubiNumber` works.

**payroll_weeks table columns (submission tracking):**

Each new state gets its own nullable submission timestamp column, matching `caEcprSubmittedAt`, `waLniSubmittedAt`, `nyMpwrSubmittedAt`, `ilIdolSubmittedAt`:
- `txCprSubmittedAt text` (nullable)
- `flCprSubmittedAt text` (nullable)
- `maCprSubmittedAt text` (nullable)
- `njCprSubmittedAt text` (nullable)

### 2c. Phase Structure — One Phase Per State, Not Shared

**Recommendation: individual phases per state, NOT a shared "multi-state schema" phase.**

Rationale from existing precedent: CA (Phase 24), WA (Phase 25), NY (Phase 40), IL (Phases 42-43) were each individual phases. A shared schema phase followed by 4 form phases creates a sequential dependency that forces the schema migration to land before any of the 4 forms can be built or tested. Individual phases give each state a self-contained deliverable (migration + generator + route + UI trigger + test).

The schema columns for each state are small (2 columns on projects + 1 column on payroll_weeks) and add no risk to other states.

---

## 3. Subcontractor Tracking

### 3a. New Tables Required

Two new tables in `src/server/db/schema.ts`:

**`subcontractors` table** — one row per sub added to a project:

```
id text PK
projectId text FK → projects.id CASCADE DELETE
companyName text NOT NULL
contactName text
contactEmail text
licenseNumber text         -- state contractor license if applicable
fein text                  -- federal employer ID (for form affidavits)
createdByUserId text FK → users.id
createdAt text NOT NULL
updatedAt text NOT NULL
```

This is **per-project, not global**. Rationale: subs have different license numbers and contacts by project; a GC using the same sub on two projects may have different contacts per contract. Also, `assertProjectAccess` scopes all data to project membership — a global subs table would require a separate access layer that doesn't exist.

**`subcontractor_cprs` table** — weekly CPR receipt tracking per sub per payroll week:

```
id text PK
subcontractorId text FK → subcontractors.id CASCADE DELETE
payrollWeekId text FK → payroll_weeks.id CASCADE DELETE
status text NOT NULL DEFAULT 'pending'  -- 'pending' | 'received' | 'rejected'
receivedAt text                         -- nullable; set when status = 'received'
notes text                              -- optional GC notes
createdByUserId text FK → users.id
createdAt text NOT NULL
updatedAt text NOT NULL
UNIQUE INDEX on (subcontractorId, payrollWeekId)
```

The IL Certified Transcript affidavit already has a `subcontractors: Array<{ name: string; address: string }>` field in `IlPdfInput` that is currently passed as an empty array — once subs are tracked, this can be populated automatically when generating the IL form.

### 3b. API Routes

New router file: `src/server/routes/subcontractors.ts`

```
POST   /api/projects/:projectId/subcontractors                      -- add sub to project
GET    /api/projects/:projectId/subcontractors                      -- list all subs
DELETE /api/projects/:projectId/subcontractors/:subId               -- remove sub

POST   /api/projects/:projectId/subcontractors/:subId/cprs/:weekId  -- mark CPR received/rejected
GET    /api/projects/:projectId/subcontractors/:subId/cprs          -- CPR history for a sub
```

All routes call `assertProjectAccess(db, projectId, userId)` before any data access. Pattern is identical to workers routes.

### 3c. UI Placement — Tab on ProjectDetailPage

Add a new **"Subcontractors" tab on `ProjectDetailPage.tsx`**, not a new top-level page.

Rationale: subcontractor compliance is project-scoped, just like workers and payroll. The existing 4-step workflow progress indicator (Create → Workers → Payroll → WH-347) can grow to include a "Subs" indicator, or the subs panel lives below the existing tabs without modifying the step count.

A standalone page would require new routing, navigation updates, and breadcrumbs — unnecessary complexity for a per-project feature.

The client component is `SubcontractorPanel.tsx` embedded in `ProjectDetailPage.tsx`.

### 3d. Audit Trail Extension

Subcontractor actions write to `audit_logs` following the existing `insertAuditLog()` pattern from `auditService.ts`:

- `subcontractor.created` — meta: `{ companyName, subId }`
- `subcontractor.removed` — meta: `{ companyName, subId }`
- `subcontractor_cpr.received` — meta: `{ companyName, weekEnding, payrollNumber }`
- `subcontractor_cpr.rejected` — meta: `{ companyName, weekEnding, reason }`

Add corresponding `ACTION_LABELS` entries in `ProjectActivityPage.tsx` alongside the existing worker/payroll labels.

---

## 4. Enhanced Reporting

### 4a. Audit Log CSV Export

**New route on the existing audit router (`src/server/routes/audit.ts`):**

```
GET /api/audit/:projectId/csv
```

This is a new route, not a modification to the existing `GET /api/audit/:projectId` paginator. The paginated route is consumed by `ProjectActivityPage.tsx` for display — adding CSV logic there would give it two responsibilities.

Route behavior:
1. Same `assertProjectAccess` guard
2. Accepts the same `from`, `to`, `entityType` query params as the paginator (no page/limit — export all matching rows)
3. Flattens the JSON `meta` column into columns (createdAt, userEmail, entityType, action, meta flattened)
4. Streams a UTF-8 BOM CSV (matching the existing pattern in `csvExporter.ts` — BOM for Excel compatibility)
5. Filename: `activity-log-{projectId}-{date}.csv`

**Register route before the `/:projectId` wildcard** in `audit.ts` — per the established "specific before wildcard" routing rule from project decisions. The path `/api/audit/:projectId/csv` does not conflict because the existing wildcard is `/:projectId` at the router level, but the sub-path `csv` must be registered first in the router.

**Download button location:** `ProjectActivityPage.tsx` page header toolbar, next to the existing filters. Natural placement — the user is already scoped to a project's activity log.

### 4b. Multi-Project Compliance PDF

**New route on the export router (`src/server/routes/export.ts`):**

```
GET /api/export/compliance-summary
```

Not a `:weekId` route — this is cross-project, user-scoped. Queries all active projects the user has access to via the `project_members` join (same join used by the dashboard compliance batch endpoint), plus their latest payroll week status and compliance result.

Generator: new `src/server/services/complianceSummaryPdfGenerator.ts` using `PDFDocument.create()` — same programmatic-draw approach as `ilPdfGenerator.ts`.

No state gate needed — this is an account-level report not tied to any specific state form.

**Download button location:** `DashboardPage.tsx` page header as a secondary action ("Download Compliance Summary"). Not on `ReportsPage.tsx` because `ReportsPage` is project-scoped (`useParams projectId`) and this report is account-scoped (all projects).

### 4c. Enhanced Fringe Report

**Modify `src/server/services/reportsService.ts`** — add a new exported function `getEnhancedFringeSummary()` alongside the existing `getFringeSummary()`. Do NOT modify `getFringeSummary()` — its shape is frozen by the existing `ReportsPage.tsx` client interface.

The enhanced function leverages data already stored in the schema:
- Fund type breakdown: `fringeHealthWelfare`, `fringePension`, `fringeVacation`, `fringeTraining` (already on `payrollEntries`, added in Phase 29)
- Union local grouping: `workers.unionLocal` (added Phase 39)
- JW vs apprentice split: `workerClassifications.laborType`

New route: `GET /api/projects/:projectId/reports/fringe-enhanced` — parallel to the existing `GET /api/projects/:projectId/reports/fringe-summary`.

**Download button location:** New third tab `'fringeEnhanced'` on `ReportsPage.tsx` alongside the existing `'fringe'` and `'payHistory'` tabs. The print/CSV download lives within that tab, consistent with how the existing fringe summary works.

---

## 5. File Map — New vs Modified

### New Files

| File | Purpose |
|------|---------|
| `src/server/services/txCprGenerator.ts` | TX certified payroll PDF (programmatic draw, based on ilPdfGenerator.ts) |
| `src/server/services/flCprGenerator.ts` | FL certified payroll PDF |
| `src/server/services/maCprGenerator.ts` | MA certified payroll PDF |
| `src/server/services/njCprGenerator.ts` | NJ certified payroll PDF |
| `src/server/services/complianceSummaryPdfGenerator.ts` | Multi-project compliance summary PDF |
| `src/server/routes/subcontractors.ts` | CRUD + CPR tracking routes for subcontractors |
| `src/client/components/SubcontractorPanel.tsx` | Panel component for ProjectDetailPage |

### Modified Files

| File | Change |
|------|--------|
| `src/server/db/schema.ts` | Add state-specific columns to `projects`; add submission timestamps to `payroll_weeks`; add `subcontractors` and `subcontractor_cprs` tables |
| `src/server/routes/export.ts` | Add 4 new state PDF routes + compliance-summary route |
| `src/server/routes/audit.ts` | Add `GET /api/audit/:projectId/csv` route (before `/:projectId` wildcard) |
| `src/server/services/reportsService.ts` | Add `getEnhancedFringeSummary()` function |
| `src/client/pages/ProjectDetailPage.tsx` | Add Subcontractors tab / SubcontractorPanel |
| `src/client/pages/ReportsPage.tsx` | Add fringe-enhanced tab + download button |
| `src/client/pages/ProjectActivityPage.tsx` | Add CSV download button + new ACTION_LABELS entries for sub events |
| `src/client/pages/DashboardPage.tsx` | Add compliance-summary PDF download button |
| `drizzle/meta/_journal.json` | Register each new migration file (manual step per project constraint) |

---

## 6. Suggested Phase Build Order (Phase 47–58)

State forms (47-51) are independent of each other and of subcontractor tracking (52-54). Reporting (55-57) depends only on having live data from prior phases. All four state form phases can technically be built in parallel — sequential ordering below reflects single-developer delivery focus.

| Phase | Feature | Key Files | Dependency |
|-------|---------|-----------|------------|
| 47 | TX Certified Payroll PDF | schema.ts (TX cols), txCprGenerator.ts, export.ts, PayrollWeekDetailPage.tsx | Phase 46 |
| 48 | FL Certified Payroll PDF | schema.ts (FL cols), flCprGenerator.ts, export.ts | Phase 46 |
| 49 | MA Certified Payroll PDF | schema.ts (MA cols), maCprGenerator.ts, export.ts | Phase 46 |
| 50 | NJ Certified Payroll PDF | schema.ts (NJ cols), njCprGenerator.ts, export.ts | Phase 46 |
| 51 | CA A-1-131 Gap Close | a1131Generator.ts, export.ts (modify existing route) | Phase 24 gap |
| 52 | Subcontractor Schema + API | schema.ts (new tables), subcontractors.ts route, auditService.ts | Phase 46 |
| 53 | Subcontractor UI | SubcontractorPanel.tsx, ProjectDetailPage.tsx | Phase 52 |
| 54 | Subcontractor → State Form Integration | ilPdfGenerator.ts, tx/fl/ma/njCprGenerator.ts | Phase 53 |
| 55 | Audit Log CSV Export | audit.ts (new route), ProjectActivityPage.tsx | Phase 46 |
| 56 | Enhanced Fringe Report | reportsService.ts (new fn), reports route, ReportsPage.tsx | Phase 46 |
| 57 | Multi-Project Compliance PDF | complianceSummaryPdfGenerator.ts, export.ts, DashboardPage.tsx | Phase 52 (needs sub data) |
| 58 | v5.0 Integration + Polish | PROJECT.md update, cross-cutting cleanup, final test pass | All prior phases |

**Phase ordering rationale:**
- TX first (Phase 47): largest prevailing wage construction market; validates the new state form pattern before the other three.
- State forms (47-50) before sub tracking (52-53): forms are purely additive exports; sub tracking requires a new table join into form generation (Phase 54).
- CA gap (51) after new states: doesn't block anything; placed to avoid interrupting the state form rhythm.
- Reporting (55-57) at the end: benefits from all prior data being live in the system; reporting phases have no upstream blockers.
- Phase 58 as buffer: cross-cutting actions (ACTION_LABELS, audit events, filename consistency) are easier to finalize when all features exist.

---

## 7. State Gate Code Template (Phases 47-50)

Copy from the `a1131` route in `export.ts` (lines 253-360). Substitute state code and generator call. The structure is identical for all four new states:

```typescript
// ── GET /api/export/tx-cpr/:weekId ──────────────────────────────────────────
// Texas TxDOT Form 1184 — state-gated to TX projects only

router.get('/tx-cpr/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  const week = await getPayrollWeek(weekId);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // State gate — TX CPR is TX-only
  if (project.state !== 'TX') {
    res.status(400).json({ error: 'TX Certified Payroll is only available for Texas projects' });
    return;
  }

  const entries = await getPayrollEntries(weekId);
  // ... map entries, build TxCprInput using project.txdotProjectId etc.
  // ... call fillTxCpr()
  // ... set Content-Type: application/pdf, stream response
  // ... best-effort audit log with action: 'tx_cpr.downloaded'
});
```

For programmatic-draw generators: no `/assets/` template file needed. For any state that does provide an official downloadable PDF template, use the template-overlay pattern from `a1131Generator.ts` instead — the route skeleton stays identical.

---

## 8. Key Architectural Constraints for v5.0

| Constraint | v5.0 Implication |
|-----------|-----------------|
| `assertProjectAccess` before all data access | All new routes (sub CRUD, CSV export, new PDF routes) call this before any DB query — never skip |
| Add-only schema migrations, never drop columns | All new project/payroll_weeks columns are nullable; subcontractors/subcontractor_cprs are new tables |
| State gate always after access check, never before | `project.state !== 'XX'` is step 3; `assertProjectAccess` is step 2 — order cannot be swapped |
| Rate snapshots frozen | No new report reads live wage determinations — always `fringeRateSnapshot`/`baseRateSnapshot` from `payrollEntries` |
| Design tokens, no hardcoded hex | All new client components use `@theme` token classes |
| Manual migration journal registration | Each new migration SQL file must be manually added to `drizzle/meta/_journal.json` |
| `Button` has no `asChild` prop | PDF download links in new pages use secondary button classes on `<a>` elements directly |
| Route ordering: specific before wildcard | New audit CSV route `/api/audit/:projectId/csv` must register before `/:projectId` in audit router |

---

## Sources

- Direct code analysis: `src/server/routes/export.ts` — full state gate pattern, all existing state routes
- Direct code analysis: `src/server/db/schema.ts` — existing state-specific columns, table structure, audit_logs shape
- Direct code analysis: `src/server/services/ilPdfGenerator.ts`, `pw12Generator.ts` — programmatic draw pattern
- Direct code analysis: `src/server/routes/audit.ts` — paginated audit log structure, query param handling
- Direct code analysis: `src/server/services/reportsService.ts` — getFringeSummary function shape and joins
- Direct code analysis: `src/client/pages/ReportsPage.tsx` — tab pattern, query hooks
- Direct code analysis: `src/client/pages/ProjectActivityPage.tsx` — ACTION_LABELS pattern, audit log display
- `C:/Users/glcar/prevailing-wage/.planning/PROJECT.md` — v5.0 feature targets, phase history, architectural decisions table
