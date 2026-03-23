# Stack Research

**Domain:** Contractor workflow efficiency + audit readiness (v2.3 additions to existing compliance app)
**Researched:** 2026-03-23
**Confidence:** HIGH

---

## Verdict: No New Libraries Required

All 6 features in v2.3 are CRUD operations, SQL aggregations, and client-side filtering on existing data shapes. The existing stack covers every technical need. Adding libraries would be over-engineering.

---

## Context: Confirmed Installed Stack

Read directly from `package.json` — these are production-pinned versions.

| Technology | Installed Version | Relevant Capability |
|------------|------------------|---------------------|
| React 19 | ^19.2.4 | UI components, hooks |
| TailwindCSS v4 | ^4.2.2 | Styling, design tokens |
| TanStack Query | ^5.91.0 | Server state, cache invalidation |
| react-hook-form + zod | ^7.71.2 / ^4.3.6 | Form validation |
| drizzle-orm | ^0.45.1 | DB queries, add-only migrations |
| better-sqlite3 | ^12.8.0 | SQLite driver |
| pdf-lib | ^1.17.1 | WH-347 PDF generation |
| react-router-dom | ^7.13.1 | Client-side routing |
| lucide-react | ^0.577.0 | SVG icons |
| vitest | ^4.1.0 | Test runner (188 passing) |

---

## Feature-by-Feature Stack Analysis

### Feature 1: Copy Previous Payroll Week

**What it needs:** Read prior week's payroll entries, POST to create a new week pre-filled with those hours.

**Existing tools cover it:**
- `payrollService.ts` already has `getPayrollEntries(weekId)` and `createPayrollWeek()` — the copy operation is a service-layer function that reads one week and writes another
- `payrollWeeks` and `payrollEntries` tables in Drizzle schema already have all needed columns
- TanStack Query `useMutation` handles the POST + cache invalidation on success
- react-hook-form is not needed — this is a one-click action with a confirmation modal, not a form

**New code needed:** One new POST route (`POST /api/payroll/weeks/:weekId/copy`), one new service function, one button + modal on `PayrollListPage`.

**No new libraries.**

---

### Feature 2: WH-347 Submission Tracking

**What it needs:** Store submitted date, agency name, submitter on a payroll week. Display on Payroll Week Detail and list.

**Existing tools cover it:**
- `payrollWeeks` schema needs 3 new nullable columns: `submittedAt` (text ISO date), `submissionAgency` (text), `submittedBy` (text) — add-only Drizzle migration
- PATCH route on `/api/payroll/weeks/:weekId` (or new `/submit`) updates these columns
- TanStack Query `invalidateQueries` propagates the change to PayrollListPage and PayrollWeekDetailPage
- Badge component (existing `ui/Badge.tsx`) renders "Submitted" vs "Not Submitted" status

**Migration note:** `projects.status` column already exists in schema.ts as `'active' | 'closed'` — submission tracking columns follow the same pattern.

**No new libraries.**

---

### Feature 3: Payroll Amendment Workflow

**What it needs:** Mark a submitted week as amended, flag the regenerated WH-347 PDF as "CORRECTED."

**Existing tools cover it:**
- New columns on `payrollWeeks`: `isAmended` (boolean integer), `amendmentReason` (text nullable), `originalSubmittedAt` (text nullable — preserve original date when amending)
- `fillWh347()` in `src/server/services/wh347Service.ts` (or equivalent) already renders PDF via coordinate overlay — pass an `isAmended: boolean` flag to conditionally render "CORRECTED" text overlay using existing `pdf-lib` `drawText()` call
- Amendment creates no new week row — it updates the existing week's data and regenerates the PDF from the same `weekId`
- Zod schema on PATCH route validates `amendmentReason` is present when `isAmended: true`

**Critical constraint (from PROJECT.md):** Rate snapshots on `payrollEntries` are immutable. Amendment allows editing hours/deductions but `baseRateSnapshot` and `fringeRateSnapshot` stay frozen to original entry values. The compliance engine re-runs on amended data using those frozen snapshots.

**No new libraries.**

---

### Feature 4: Project Completion / Archive

**What it needs:** Set project status to `'closed'`, filter closed projects off the active dashboard.

**Status: Schema already has this field.**

From `schema.ts` line 30:
```typescript
status: text('status').notNull().default('active').$type<'active' | 'closed'>(),
```

The column exists. No migration needed — it was added in a prior phase.

**Remaining work:**
- PATCH route on `/api/projects/:projectId` to set `status: 'closed'`
- Dashboard query already fetches all projects — add `.where(eq(projects.status, 'active'))` filter server-side, or filter client-side from the TanStack Query cache (client-side preferred since data is already loaded)
- "Show Archived" toggle on DashboardPage uses local `useState` to show/hide closed projects without a new network request
- "Archive Project" button on ProjectDetailPage with confirmation modal (same pattern as WH-347 preflight modal already implemented in v2.2)

**No migration needed. No new libraries.**

---

### Feature 5: Dashboard Search + Filter

**What it needs:** Search projects by name, filter by compliance status badge and funding type.

**Existing tools cover it:**
- Data is already in TanStack Query cache on `DashboardPage` — all projects fetched on load
- Filter logic is pure `Array.filter()` + `String.includes()` in a `useMemo()` — zero network requests, no server changes
- Compliance badge data is already fetched per `ProjectCard` (see `compliance.ts` route) — join by `projectId` in the memo
- react-hook-form is not needed — search input is a single uncontrolled `<input>` with `onChange` updating a `useState` string
- `lucide-react` `Search` icon already installed for the search input adornment

**Implementation pattern:**
```typescript
// In DashboardPage — pure client-side, no new dependencies
const [search, setSearch] = useState('');
const [fundingFilter, setFundingFilter] = useState<string>('all');
const [complianceFilter, setComplianceFilter] = useState<string>('all');

const filtered = useMemo(() =>
  projects
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => fundingFilter === 'all' || p.fundingType === fundingFilter)
    .filter(p => complianceFilter === 'all' || complianceBadges[p.id] === complianceFilter),
  [projects, search, fundingFilter, complianceFilter, complianceBadges]
);
```

**No new libraries. No server changes.**

---

### Feature 6: Per-Worker Compliance History

**What it needs:** Aggregate all violations for a worker across all projects and weeks — worker-centric audit view.

**Existing tools cover it:**
- Drizzle ORM supports the required JOIN: `payrollEntries` → `payrollWeeks` → `projects` → filter by `workerId`
- `computeCompliance()` in `complianceService.ts` already runs per-week — new service function iterates worker's weeks and collects violations
- New route: `GET /api/workers/:workerId/compliance-history` — returns array of `{ weekId, weekEndingDate, projectName, violations[] }`
- New page: `WorkerComplianceHistoryPage` at `/workers/:workerId/compliance` — a new route in `App.tsx`
- TanStack Query `useQuery` fetches on mount; no polling needed (audit view is read-only)
- Existing `Badge` component renders violation/compliant status per row
- Existing `Card` and `PageHeader` components handle layout

**Performance note:** For the single-user SQLite app, iterating weeks per worker is fine. Worker count per project is typically 5-30; weeks are typically 10-52 per project. Total rows are in the hundreds, not millions. No pagination needed.

**No new libraries.**

---

## Recommended Stack for v2.3

### Core Technologies (No Changes)

| Technology | Version | Role in v2.3 |
|------------|---------|--------------|
| Node.js + Express | existing | New routes for copy, submit, amend, archive, compliance history |
| TypeScript | ^5.9.3 | Type safety for new request/response shapes |
| drizzle-orm | ^0.45.1 | Schema migrations (3 new columns on `payrollWeeks`) + new queries |
| better-sqlite3 | ^12.8.0 | No changes |
| pdf-lib | ^1.17.1 | "CORRECTED" text overlay on amended WH-347 — uses existing `drawText()` |
| React 19 + Vite | existing | New pages (WorkerComplianceHistoryPage), new components (search bar, submit modal) |
| TanStack Query | ^5.91.0 | `useMutation` for copy/submit/amend/archive, `invalidateQueries` for cache sync |
| TailwindCSS v4 | ^4.2.2 | No new tokens needed; existing `Badge`, `Card`, `Button`, `PageHeader` cover all UI |
| zod | ^4.3.6 | Validation schemas for new PATCH/POST endpoints |
| react-hook-form | ^7.71.2 | Amendment reason field (single text input — can use `useState` instead if preferred) |
| lucide-react | ^0.577.0 | `Search` icon for dashboard search input, `CheckCircle` for submitted badge |
| vitest | ^4.1.0 | Tests for new service functions (copy, submit, amend, compliance history aggregation) |

### New Libraries: None

---

## DB Schema Changes Required

Three columns on `payrollWeeks` — add-only migration following existing pattern.

```sql
-- Migration: submission tracking + amendment workflow
ALTER TABLE payroll_weeks ADD COLUMN submitted_at TEXT;
ALTER TABLE payroll_weeks ADD COLUMN submission_agency TEXT;
ALTER TABLE payroll_weeks ADD COLUMN submitted_by TEXT;
ALTER TABLE payroll_weeks ADD COLUMN is_amended INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payroll_weeks ADD COLUMN amendment_reason TEXT;
ALTER TABLE payroll_weeks ADD COLUMN original_submitted_at TEXT;
```

Register in `src/server/db/migrations/meta/_journal.json` per PROJECT.md migration workflow.

`projects.status` column (`'active' | 'closed'`) already exists in schema.ts — **no migration needed**.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@tanstack/react-table` | Dashboard search/filter is client-side `Array.filter()` on ~10-50 projects. TanStack Table adds complexity for a use case that needs 10 lines of `useMemo`. | `useState` + `useMemo` in `DashboardPage` |
| Any date picker library (`react-datepicker`, etc.) | Submission date is the current date (auto-set on submit action) or a simple `<input type="date">`. No calendar UI needed. | Native `<input type="date">` styled with Tailwind |
| `immer` or additional state management | All state is server state managed by TanStack Query. No complex client state mutations. | TanStack Query cache + `useState` for filter/search UI state |
| `react-pdf` or `pdfjs-dist` | PDF viewing in-browser is not a feature. PDF download via pdf-lib is already working. | Existing pdf-lib download flow |
| Pagination library | Worker compliance history and project lists are small datasets (SQLite single-user app). Max ~50 projects, ~30 workers/project, ~52 weeks/project. | Render all rows; add browser scroll |
| `lodash` or `ramda` | No complex data transformations. Filter/sort operations are 1-3 lines of native array methods. | Native `Array.filter()`, `Array.sort()`, `String.includes()` |

---

## New Routes Summary

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/payroll/weeks/:weekId/copy` | Copy prior week entries into a new week |
| PATCH | `/api/payroll/weeks/:weekId/submit` | Mark week submitted (sets submittedAt, agency, submittedBy) |
| PATCH | `/api/payroll/weeks/:weekId/amend` | Mark week amended (sets isAmended, amendmentReason, preserves originalSubmittedAt) |
| PATCH | `/api/projects/:projectId/archive` | Set project status to 'closed' |
| GET | `/api/workers/:workerId/compliance-history` | Aggregate violations across all weeks for one worker |

Dashboard search/filter (Feature 5) requires no new server routes — fully client-side.

---

## New Pages Summary

| Page | Route | Feature |
|------|-------|---------|
| `WorkerComplianceHistoryPage` | `/workers/:workerId/compliance` | Feature 6 — per-worker audit view |

Remaining features (1-5) extend existing pages: PayrollListPage, PayrollWeekDetailPage, ProjectDetailPage, DashboardPage.

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| drizzle-orm | ^0.45.1 | `ALTER TABLE ... ADD COLUMN` migrations work with existing `meta/_journal.json` pattern — manually register new migration file |
| pdf-lib | ^1.17.1 | `drawText()` supports arbitrary text overlay at coordinates — "CORRECTED" stamp follows same pattern as existing WH-347 field overlays |
| TanStack Query | ^5.91.0 | `invalidateQueries({ queryKey: ['payrollWeeks', weekId] })` pattern already used in codebase — same for new mutations |
| zod | ^4.3.6 | Zod v4 — already installed; new schemas for amendment reason, submission fields follow existing `CreateWeekSchema` pattern |

---

## Sources

- `package.json` — all installed versions read directly (HIGH confidence)
- `src/server/db/schema.ts` — `projects.status` already `'active' | 'closed'`; `payrollWeeks` columns confirmed (HIGH confidence)
- `src/server/routes/compliance.ts` — `computeCompliance(db, weekId)` API confirmed, per-worker aggregation follows same pattern (HIGH confidence)
- `src/server/routes/payroll.ts` — `createPayrollWeek`, `getPayrollEntries` service functions confirmed (HIGH confidence)
- `.planning/PROJECT.md` — constraints confirmed: add-only migrations, no new UI frameworks, rate snapshots immutable, pdf-lib for all PDF work (HIGH confidence)
- Previous STACK.md (v2.1) — confirmed `lucide-react` installed, `Badge`/`Card`/`Button`/`PageHeader` primitives exist (HIGH confidence)

---

*Stack research for: HCC Prevailing Wage v2.3 — Contractor Workflow Efficiency + Audit Readiness*
*Researched: 2026-03-23*
