# Project Research Summary

**Project:** HCC Prevailing Wage — v2.3 Contractor Workflow Efficiency + Audit Readiness
**Domain:** Davis-Bacon certified payroll compliance tooling — contractor-facing SaaS
**Researched:** 2026-03-23
**Confidence:** HIGH

## Executive Summary

This is a v2.3 increment to an existing, fully-functional prevailing wage compliance application. The core features already shipped: WH-347 PDF generation (January 2025 revision), compliance checking against frozen rate snapshots, worker management, and a project dashboard. Version 2.3 adds six workflow efficiency and audit readiness features — copy previous payroll week, WH-347 submission tracking, payroll amendment workflow, project archiving, dashboard search/filter, and per-worker compliance history. All six are extensions of existing data shapes and patterns; no new libraries are required.

The recommended implementation approach is additive and constraint-respecting: a single add-only DB migration (4 columns on `payrollWeeks`), new routes and service functions following established patterns, and UI additions to existing pages plus one new page for per-worker compliance history. The existing stack — React 19, Express, Drizzle/SQLite, TanStack Query, pdf-lib — covers every technical need. The `projects.status` column (`'active' | 'closed'`) already exists in `schema.ts`, meaning project archiving requires zero schema work. The amendment workflow's key architecture decision — extending `payrollWeeks` with `amendment_number` and `original_week_id` rather than creating a `payroll_amendments` table — is correct and protects all downstream consumers (compliance, export, reports) from join complexity.

The primary risks are compliance and audit-trail risks, not technical risks. Three implementation patterns are non-negotiable and must not be deferred to later phases: (1) the copy route must re-fetch live wage rates per classification rather than cloning source snapshots, (2) submission tracking must include a server-side edit lock on submitted weeks — a UI disable alone is not a security boundary, and (3) amendments must create a new `payrollWeeks` row rather than updating entries in place. Violating any of these three compromises the certified payroll audit trail, which is a federal records falsification exposure under 29 CFR Part 3. All other pitfalls have lower stakes and clear, well-documented prevention strategies.

---

## Key Findings

### Recommended Stack

No new dependencies are needed. All 6 features in v2.3 are CRUD operations, SQL aggregations, and client-side filtering on existing data shapes. The existing stack provides every capability required.

**Core technologies and their v2.3 roles:**
- **drizzle-orm ^0.45.1**: One add-only migration — 4 nullable/defaulted columns on `payrollWeeks` (`submitted_at`, `submitted_to`, `amendment_number`, `original_week_id`). Manual journal registration in `meta/_journal.json` required; next `idx` is 5.
- **pdf-lib ^1.17.1**: Amended WH-347 label via string assembly in `export.ts` — the `payrollNumber` field already accepts strings; no coordinate changes needed.
- **TanStack Query ^5.91.0**: `useMutation` for copy/submit/amend/archive actions; `invalidateQueries` for cache sync. Existing query key patterns apply directly.
- **React 19 + TailwindCSS v4**: One new page (`WorkerViolationsPage`); extensions to 9 existing pages. Existing `Badge`, `Card`, `Button`, `PageHeader` components cover all UI needs.
- **React Router DOM ^7.13.1**: One new route (`/workers/:workerId/violations`). Dashboard filter state must use `useSearchParams` — not `useState` — to survive back-navigation.
- **better-sqlite3 ^12.8.0**: No changes. SQLite is appropriate for this single-user app; max dataset size is hundreds of rows.

**What NOT to add:** `@tanstack/react-table`, any date picker library, `immer`, `react-pdf`, pagination libraries, `lodash`. Each adds complexity without solving a real problem at this dataset scale.

---

### Expected Features

**v2.3 scope (all 6 must ship):**
- **Copy Previous Payroll Week** — pre-fill a new week from prior week's worker/hour data; requires live rate re-fetch (not snapshot copy) for compliance integrity; returns `{ copied, skipped, skippedWorkers }` with UI warning for omitted entries
- **WH-347 Submission Tracking** — record `submitted_at`, `submitted_to`; add server-side edit lock (`checkWeekEditable()`) on submitted weeks; submission panel on PayrollWeekDetailPage; submitted badges on PayrollListPage
- **Payroll Amendment Workflow** — create a new `payrollWeeks` row with `amendment_number` and `original_week_id`; "N (AMENDED M)" label in WH-347 payroll number string field; `UNIQUE(original_week_id, amendment_number)` constraint prevents double-submission
- **Project Completion / Archive** — `status = 'closed'` via existing column; server-side `?status=` filter on `GET /api/projects`; compliance pre-check before archive confirmation (409 if open violations, with explicit user acknowledgment)
- **Dashboard Search + Filter** — client-side `useMemo` filter on name + fundingType; URL params (`useSearchParams`) for filter state persistence; compliance filter deferred to v2.4 (requires batch summary endpoint)
- **Per-Worker Compliance History** — cross-project view joined on `(name, ssnLast4, userId)`; batch entry load (not N+1 per week); snapshot-only compliance computation; new `WorkerViolationsPage` at `/workers/:workerId/violations`

**Explicitly deferred:**
- Dashboard compliance filter (requires `GET /api/compliance/projects/summary` batch endpoint — not in v2.3 scope)
- State-specific forms (CA DIR, WA L&I)
- Auto-submit to agency portal
- Payroll/QuickBooks integration

---

### Architecture Approach

The system is a React/Vite client communicating with an Express server over a REST API, backed by Drizzle ORM on SQLite. All v2.3 features fit within the existing three-layer boundary: client pages → server routes → services + ORM. No new layers, no new infrastructure.

**Major components and v2.3 changes:**
1. **`schema.ts`** (MODIFIED) — 4 new columns on `payrollWeeks`; one migration file
2. **`payrollService.ts`** (MODIFIED) — `copyPayrollWeek()` with live rate re-fetch; `createAmendedWeek()` as new row with bulk entry copy
3. **`reportsService.ts`** (MODIFIED) — `getWorkerViolations(workerId, userId)` with cross-project join on `(name, ssnLast4)` and batch compliance computation
4. **`routes/payroll.ts`** (MODIFIED) — `POST /weeks/copy`, `POST /weeks/:id/submit`, `DELETE /weeks/:id/submit`, `POST /weeks/:id/amend`; `checkWeekEditable()` guard on all entry write routes
5. **`routes/projects.ts`** (MODIFIED) — `?status=` query param defaulting to `active`; compliance pre-check before archive
6. **`routes/export.ts`** (MODIFIED) — amended payroll number label string assembly
7. **`DashboardPage.tsx`** (MODIFIED) — search/filter bar, `useSearchParams`, archive toggle, `useMemo`-filtered list
8. **`WorkerViolationsPage.tsx`** (NEW) — `/workers/:workerId/violations`, compliance history table with project/week context

**DB migration:** One file — `0009_payroll_week_submission_amendment.sql` — with 4 `ALTER TABLE` statements. Registered at `idx: 5` in `meta/_journal.json`. No migration needed for archive (`status` column exists), copy (no schema changes), or worker history (all data exists).

---

### Critical Pitfalls

1. **Stale rate snapshots in copy operation** — The copy route must call `wageLookup.ts` for fresh rates per classification. Never clone `baseRateSnapshot`/`fringeRateSnapshot` from the source week. Entries where rate lookup fails must be omitted with a warning — not defaulted to zero. Recovery cost if violated: HIGH (requires amendment weeks + agency renotification).

2. **No server-side edit lock on submitted weeks** — `checkWeekEditable()` is non-negotiable on `PUT /api/payroll/entries/:id` and `POST /api/payroll/entries`. Ships in the same phase as submission tracking — never deferred. A UI disable is not a security boundary; any API caller bypasses it.

3. **Amendment corrupts original audit trail** — `POST /weeks/:id/amend` must create a NEW `payrollWeeks` row. Never call `upsertPayrollEntry()` with the original `payrollWeekId`. The original row must become read-only once an amendment exists. 29 CFR Part 3 requires both original and amendment to be preserved.

4. **Project hard-delete violates federal records retention** — No DELETE endpoint for projects. Archive is status-only: `UPDATE projects SET status = 'closed'`. Federal regulation requires certified payroll records for 3 years post-completion.

5. **Worker history cross-project disambiguation** — Worker identity join must use `(name, ssnLast4, userId)` across projects, not `WHERE worker_id = ?`. A single-ID query silently gives a project-scoped view while the UX implies cross-project. Workers with identical names but different SSNs must not be merged.

6. **Migration not registered in `_journal.json`** — If the SQL migration file exists but is not in the journal, Drizzle silently skips it. TypeScript types include the new columns; runtime values are `undefined`. Verify post-migration: `SELECT sql FROM sqlite_master WHERE name = 'payroll_weeks'`.

---

## Implications for Roadmap

Based on the combined research, 6 phases are recommended — each scoped to minimize re-work across shared files and ordered by hard dependencies.

---

### Phase 1: DB Migration + Project Archive

**Rationale:** The migration is a prerequisite for submission tracking and amendments; it must be first. Project archive uses the already-existing `status` column and shares `DashboardPage.tsx` work with the search/filter phase — combining them in Phase 1 and 2 avoids touching the same file twice.

**Delivers:** Migration `0009` with 4 new `payrollWeeks` columns; `GET /api/projects` filtered to `status=active` by default; archive/restore button on `ProjectDetailPage`; "Show Archived" toggle on `DashboardPage`; archived badge on `ProjectCard`; compliance pre-check before archive (409 if open violations).

**Addresses:** Feature 4 (project archive); migration prerequisite for Features 2 and 3.

**Avoids:** Pitfall 6 (hard-delete — no DELETE route for projects). Pitfall 7 (archive with open violations — pre-check required). Pitfall 13 (migration journal — verify columns immediately after migration).

**Research flag:** Standard patterns. Skip research-phase.

---

### Phase 2: Dashboard Search + Filter

**Rationale:** Shares `DashboardPage.tsx` with Phase 1 (archive toggle already touches this file). Client-side filter with `useMemo` is the simplest feature in v2.3 — zero server changes, immediate contractor-visible value.

**Delivers:** Search by name, filter by funding type, `useSearchParams`-based URL param persistence, zero-results EmptyState.

**Addresses:** Feature 5.

**Avoids:** Pitfall 11 (filter state lost on navigation — `useSearchParams` required from day one). Pitfall 12 (per-keystroke server queries — client-side filtering over cached data).

**Research flag:** Standard patterns. Skip research-phase.

---

### Phase 3: WH-347 Submission Tracking

**Rationale:** Depends on Phase 1 migration (new `submitted_at`, `submitted_to` columns). Establishes submission status as a prerequisite for the Amendment Workflow's "Amend" button trigger.

**Delivers:** `POST /submit` and `DELETE /submit` routes; submission panel (Card) on `PayrollWeekDetailPage`; submitted/not-submitted badges on `PayrollListPage`; server-side `checkWeekEditable()` guard on all payroll entry write routes; `PayrollWeek` TypeScript interface extended.

**Addresses:** Feature 2.

**Avoids:** Pitfall 3 (no edit lock — ships in same phase as submission tracking, never deferred). Security requirement: `submittedAt` set server-side only, never accepted from request body.

**Research flag:** Standard patterns. Skip research-phase.

---

### Phase 4: Copy Previous Payroll Week

**Rationale:** The bulk entry copy logic validated here is reused by the Amendment Workflow in Phase 5. Building and testing it first ensures the pattern is correct before it is extended.

**Delivers:** `POST /api/payroll/weeks/copy` route; live rate re-fetch per classification via `wageLookup.ts`; "Copy from previous week" option in `PayrollEntryPage` new-week form; copy response with `{ copied, skipped, skippedWorkers }`; UI warning for skipped entries; strict field allowlist (no submission flags, no rate snapshot carry-over).

**Addresses:** Feature 1.

**Avoids:** Pitfall 1 (stale rate snapshots — rate re-fetch is mandatory). Pitfall 2 (submission flags copied to new week — `submittedAt` must be null on copy output regardless of source week state).

**Research flag:** Review `wageLookup.ts` before building the copy route. Confirm the per-classification lookup is batchable and that graceful per-classification failure (omit entry, not default to zero) is supported by the existing function signature.

---

### Phase 5: Payroll Amendment Workflow

**Rationale:** Depends on Phase 1 migration (`amendment_number`, `original_week_id` columns), Phase 3 submission tracking ("Amend" button only surfaces when `submittedAt` is not null), and Phase 4 copy-entries pattern (bulk entry creation reused for amendment).

**Delivers:** `POST /api/payroll/weeks/:id/amend` route; new `payrollWeeks` row with `amendment_number + 1` and `original_week_id`; `UNIQUE(original_week_id, amendment_number)` DB constraint; "N (AMENDED M)" label in WH-347 via `export.ts` string assembly; amendment badge on `PayrollListPage`; "Amend This Week" button on `PayrollWeekDetailPage`.

**Addresses:** Feature 3.

**Avoids:** Pitfall 4 (in-place amendment — new row mandatory). Pitfall 5 (amendment numbering conflict — unique constraint in migration). Pitfall 14 (PDF coordinate mismatch — amendment label in `payrollNumber` string field, not a coordinate overlay).

**Research flag:** Verify `wh347Data.payrollNumber` type accepts string values in `wh347Generator.ts` before implementing. Confirm `export.ts` amendment label assembly does not require `fillWh347()` changes.

---

### Phase 6: Per-Worker Compliance History

**Rationale:** Fully independent of all other features — read-only reporting with no schema changes. Placed last because it requires the most implementation care (cross-project join, batch compliance, N+1 avoidance, worker disambiguation).

**Delivers:** `GET /api/reports/workers/:workerId/violations` route; `getWorkerViolations(workerId, userId)` in `reportsService.ts` using `(name, ssnLast4)` cross-project join and batch entry load; `WorkerViolationsPage` at `/workers/:workerId/violations`; "Compliance History" link per worker row on `WorkersPage`.

**Addresses:** Feature 6.

**Avoids:** Pitfall 8 (live rate re-computation instead of snapshot — history route must not import `wageLookup.ts`). Pitfall 9 (N+1 queries — batch all entries in one query, run compliance in memory, not per-week loop). Pitfall 10 (worker disambiguation — join on `(name, ssnLast4)`, not `worker_id`).

**Research flag:** Review `complianceService.computeCompliance()` function signature before designing `getWorkerViolations()`. Confirm the batch-entries-then-compute-in-memory approach is compatible with the existing function's input contract.

---

### Phase Ordering Rationale

- **Migration first** — submission tracking (Phase 3) and amendment (Phase 5) cannot start without the new columns
- **Archive alongside migration** — zero schema work needed; shares `DashboardPage.tsx` with search/filter
- **Search/filter immediately after archive** — both modify `DashboardPage.tsx`; combine the file touch into two sequential phases rather than revisiting
- **Submission tracking before amendment** — "Amend" button is gated on `submittedAt` not null; Phase 3 must complete first
- **Copy before amendment** — bulk entry copy pattern built in Phase 4 is reused in Phase 5; validate once, extend once
- **Worker history last** — independent read-only feature; highest implementation complexity; no downstream dependencies

---

### Research Flags

Phases needing deeper review before implementation:

- **Phase 4 (Copy Previous Week):** Review `wageLookup.ts` — confirm the per-classification lookup supports graceful failure per entry (omit vs. default to zero). This is the highest-risk implementation decision in v2.3.
- **Phase 5 (Amendment Workflow):** Verify `wh347Data.payrollNumber` type in `wh347Generator.ts` accepts string values. Confirm `export.ts` string assembly approach before writing any route code.
- **Phase 6 (Per-Worker Compliance History):** Review `complianceService.computeCompliance()` input contract before designing the batch query. Write a 20-week test fixture before any implementation to catch N+1 regressions.

Phases with standard patterns (skip research-phase):
- **Phase 1 (DB Migration + Archive):** Add-only migration; `status` column already exists. Standard Drizzle journal pattern.
- **Phase 2 (Dashboard Search):** Client-side `useMemo` + `useSearchParams`. No novel patterns.
- **Phase 3 (Submission Tracking):** PATCH route + status panel + edit lock guard. All established patterns in the codebase.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions read directly from `package.json`. Feature-by-feature analysis confirms zero new library requirements. |
| Features | HIGH | Regulatory requirements grounded in 29 CFR Part 3, Part 5, CWHSSA, and WH-347 Jan 2025 revision. v2.3 scope validated against shipped v2.0/v2.1/v2.2 functionality. |
| Architecture | HIGH | Based on direct codebase analysis of schema, routes, services, client pages, and migration journal. No inference required — all affected files read directly. |
| Pitfalls | HIGH | Derived from direct codebase audit (exact functions and routes at risk identified) plus federal regulatory analysis (29 CFR records retention). Recovery costs quantified. |

**Overall confidence:** HIGH

### Gaps to Address

- **Rate re-fetch batch pattern:** `wageLookup.ts` was not read during research. The batch-per-classification approach and its failure mode (classification not found → omit, not default) need confirmation against the actual function signature before Phase 4 begins.

- **`wh347Data.payrollNumber` type:** STACK.md asserts this field accepts string values. Verify in `wh347Generator.ts` type definitions at the start of Phase 5.

- **`_journal.json` next index:** ARCHITECTURE.md states `idx: 5` is next. Verify at migration time — if any development migration was added since research, the index will differ.

- **Dashboard compliance filter scope:** Explicitly deferred from v2.3. Requires a `GET /api/compliance/projects/summary?projectIds=...` batch endpoint. Name this as a v2.4 item during roadmap planning to prevent scope creep.

---

## Sources

### Primary (HIGH confidence)

- `package.json` — all installed library versions, read directly
- `src/server/db/schema.ts` — full table structure; `projects.status` column confirmed existing at `'active' | 'closed'`
- `src/server/db/migrations/meta/_journal.json` — migration sequence; next `idx` determined as 5
- `src/server/routes/payroll.ts`, `projects.ts`, `export.ts`, `reports.ts` — existing route patterns confirmed
- `src/server/services/payrollService.ts`, `complianceService.ts`, `reportsService.ts`, `wh347Generator.ts` — service function signatures
- `src/client/pages/DashboardPage.tsx`, `PayrollListPage.tsx`, `PayrollWeekDetailPage.tsx` — existing component structure
- `.planning/PROJECT.md` — stack constraints, key decisions, migration workflow, rate snapshot immutability rules

### Secondary (MEDIUM-HIGH confidence)

- DOL WH-347 Instructions (January 2025 revision) — amendment marking requirements, form field structure
- 29 CFR Part 3 (Copeland Act) — 3-year records retention requirement post-project-completion
- 29 CFR Part 5 (Davis-Bacon) — weekly certified payroll submission requirements, CWHSSA OT rules
- Test suite analysis: `tests/routes/compliance.test.ts`, `tests/routes/payroll.test.ts` — identified test coverage gaps for new features

### Tertiary (MEDIUM confidence)

- STACK.md v2.1 prior research — `lucide-react` icons, `Badge`/`Card` primitives confirmed installed; used as corroborating reference

---

*Research completed: 2026-03-23*
*Ready for roadmap: yes*
