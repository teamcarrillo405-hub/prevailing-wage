# Domain Pitfalls — v5.0 Milestone

**Domain:** Adding state forms, subcontractor tracking, and enhanced reporting to an existing multi-state prevailing wage compliance app
**Researched:** 2026-04-07
**Scope:** Pitfalls specific to adding these features to THIS codebase (v4.0 complete, 387+ tests)

---

## Section 1: Adding 4 New State Forms (TX, FL, MA, NJ)

### CRITICAL — Pitfall 1.1: State Detection Combinatorial Explosion in PayrollWeekDetailPage

**What goes wrong:** The existing pattern in `PayrollWeekDetailPage.tsx` declares four separate booleans at lines 461-464:
```
const isCA = project.state === 'CA';
const isWA = project.state === 'WA';
const isNY = project.state?.toUpperCase() === 'NY';
const isIL = project.state?.toUpperCase() === 'IL';
```
Adding TX, FL, MA, NJ brings this to 8 booleans. Each state then needs conditional JSX blocks for: (a) the download button, (b) the submission tracking badge row, (c) any state-specific modal — producing up to 8 separate `{isXX && ...}` blocks in a JSX tree already pushing ~1,400 lines.

**Why it happens:** Each state was added individually with no registry abstraction. The pattern works fine at 4 states; it becomes unmaintainable and error-prone at 8.

**Consequences:** Wrong button shown (TX button visible on FL project), typo in one `isXX` silently gates the wrong feature, reviewer cannot audit state coverage by inspection.

**Prevention:**
- Define a state registry object at the top of the component rather than individual booleans:
  ```typescript
  const STATE_FORMS: Record<string, { label: string; route: string; requiresModal: boolean }> = {
    CA: { label: 'Download CA A-1-131', route: 'a1131', requiresModal: true },
    WA: { label: 'Download WA F700', route: 'f700', requiresModal: true },
    // TX, FL, MA, NJ entries...
  };
  const stateForms = STATE_FORMS[project.state?.toUpperCase() ?? ''] ?? null;
  ```
- The 8 individual booleans can stay for non-download conditional logic (compliance rules, form fields) since those are already established contracts. But the download button rendering should use the registry.

**Detection:** More than 6 `isXX` boolean assignments near the top of `PayrollWeekDetailPage.tsx`.

**Phase:** Address in the first new state form phase (TX or FL, whichever comes first).

---

### CRITICAL — Pitfall 1.2: Inconsistent Case Normalization in State Comparisons

**What goes wrong:** The codebase has mixed case normalization. CA and WA comparisons use exact uppercase without normalization (`project.state === 'CA'`), but NY and IL comparisons use `.toUpperCase()`:
- `project.state === 'CA'` (exact, no normalization — client and server)
- `project.state?.toUpperCase() === 'NY'` (normalized)
- `project.state?.toUpperCase() === 'IL'` (normalized)

A new state added without `.toUpperCase()` will silently fail for any project that stored the state in a different case. Export route gates in `export.ts` all use exact uppercase (`'CA'`, `'WA'`). If a new state form's frontend button uses `.toUpperCase()` but the server gate uses exact `'TX'`, a project stored as `'tx'` passes the frontend check but gets a 400 from the server.

**Why it happens:** CA/WA forms were built first with one normalization style. NY/IL were added later more defensively. The project schema has no enforced case constraint on the `state` column.

**Prevention:** All new state comparisons — both client and server — must normalize with `.toUpperCase()` on both sides. Audit and standardize the existing CA/WA comparisons at the same time. The export route gates (`project.state !== 'CA'`) should become `project.state?.toUpperCase() !== 'CA'`.

**Phase:** Pre-flight task at the start of the state forms phase. One-line fix per comparison; must be done before adding any new states.

---

### CRITICAL — Pitfall 1.3: Server-Side State Gate Missing on New Routes

**What goes wrong:** Export routes for CA and WA each have an explicit server-side gate:
```typescript
if (project.state !== 'CA') {
  res.status(400).json({ error: '...' });
  return;
}
```
If a new state form route is written without this gate (relying only on the frontend button being hidden), the PDF endpoint is accessible to any authenticated user with any project. A user with a TX project can call `/api/export/ma-form/:weekId` on a TX week and receive a PDF populated with TX project data in MA form layout.

**Why it happens:** The route handler is copy-pasted from an existing handler and the state gate line is accidentally omitted or moved to a comment.

**Consequences:** Incorrect forms generated in wrong state format. Legal compliance exposure if a contractor submits the wrong state form.

**Prevention:** Route-level server gate is non-negotiable. Add an explicit test in `tests/routes/export.test.ts` for every new route: `GET /api/export/{route}/:wrongStateWeekId returns 400`. The test makes the gate self-enforcing.

**Phase:** Required acceptance criterion for each new state form phase.

---

### CRITICAL — Pitfall 1.4: PDF Field Coordinates Set Without Measuring the Actual Template

**What goes wrong:** Phase 24 Plan 03 SUMMARY already documented this: the research notes said "Portrait 8.5x11 (612x792 pt)" for the A-1-131, but the actual form is 8.5x14 (612x1008 pt). If coordinates are set based on assumed dimensions, every field will render in the wrong position — often off-page or colliding with form borders.

For the four new state forms, the same trap exists compounded: each state agency uses a different page size, field density, and column layout. TX uses a WH-348-variant layout. FL has its own PBS6 form. MA has a dense portrait layout. NJ uses a very compact single-page format. None of these can be mapped without measuring the actual template PDF.

**Why it happens:** Coordinates are not derivable from research — they must be measured from the actual PDF. Research provides only the field inventory (what fields exist), not positions.

**Prevention:**
- Reproduce the CRITICAL FIRST STEP from Phase 24 Plan 03 for each new state: load the official template via pdf-lib, get page dimensions, measure exact (x, y) positions.
- Document the measured coordinates as named constants at the top of each generator file, with a comment citing the form revision date.
- Never set coordinates from guessing or eyeballing a screenshot. A 5-point error at the top of a dense worker grid compounds to 50+ points of misalignment by the last row.

**Detection:** Generated PDF has text outside form field boxes, or the worker grid rows do not align with the pre-printed row lines.

**Phase:** Each state form phase must include "measure coordinates from official PDF" as a blocking prerequisite task (not parallelizable with coding).

---

### MODERATE — Pitfall 1.5: Missing State-Required Fields That Invalidate the Form

**What goes wrong:** Each state form requires fields beyond the WH-347 baseline. If these are not surfaced to the user before generation, the PDF is technically incomplete and cannot be submitted:

| State | Required Fields Beyond WH-347 | Current Schema |
|-------|-------------------------------|---------------|
| TX | Contractor license (TDLR or exempt), FEIN | No TX-specific columns yet |
| FL | Certificate of Registration (DBPR), FEIN | No FL-specific columns yet |
| MA | Payroll ID from DCAMM, contractor cert number | No MA-specific columns yet |
| NJ | Public Works Registration Certificate, FEIN | No NJ-specific columns yet |

The project schema has state-specific fields only for CA, WA, and NY. Generation can succeed with empty strings in required fields, producing a downloadable but legally incomplete PDF with no warning to the user.

**Prevention:**
- Add state-specific project columns for each new state (additive migration — never drop columns, per the established project constraint).
- Show an advisory in the pre-download modal when required state-specific fields are missing (follow the CA CSLB/WC advisory pattern from Phase 24, `PayrollWeekDetailPage.tsx`).
- Do not block the download — advisories only, consistent with existing behavior.

**Phase:** Each state form phase. The migration must land before the route is deployed.

---

### MODERATE — Pitfall 1.6: Fringe Disaggregation Not Handled for FL/NJ Forms

**What goes wrong:** The CA A-1-131 and eCPR XML both require fringe disaggregation (health/welfare, pension, vacation, training — stored separately in `payrollEntries` as nullable columns). FL and NJ forms similarly have itemized fringe sections. If the new form generators use only `fringeRateSnapshot` (the aggregate rate), fringe sections on those forms are blank or show incorrect totals.

The schema already has `fringeHealthWelfare`, `fringePension`, `fringeVacation`, `fringeTraining` on `payrollEntries` — but they are nullable and populated only for CA projects. For FL/NJ, they will be null for all existing entries.

**Prevention:** Treat null disaggregated fringe fields as `0` in the form generator, not as "do not render." Add a modal advisory if all four sub-fields are null (suggesting the user may want to add fringe detail for accurate state form submission).

**Phase:** FL and NJ state form phases.

---

## Section 2: Subcontractor Tracking

### CRITICAL — Pitfall 2.1: Tracking Per-Sub Instead of Per-Sub-Per-Week

**What goes wrong:** A naive data model tracks one record per subcontractor (name, contact, status). This fails in practice because:

- A sub may be compliant in week 3 but delinquent in week 5.
- The GC's compliance obligation is weekly — they need to know whether each sub submitted a CPR for each week the sub worked.
- A model without a `payrollWeekId` or `weekNumber` axis cannot answer "which subs are missing CPRs for week 7?"

The tracker becomes a static address book rather than a compliance tool, and the GC still manually correlates CPR submissions by date.

**Why it happens:** The natural first instinct is to model a subcontractor as a static entity (like a worker), not as a weekly compliance obligation.

**Prevention:** Model with two tables:
1. `project_subcontractors` — one row per sub per project (name, license, FEIN, contact)
2. `subcontractor_cpr_records` — one row per sub per payroll week (cpr_received boolean, received_at timestamp, notes)

The `subcontractor_cpr_records` table is the compliance surface. The `project_subcontractors` table is the reference entity.

**Phase:** Subcontractor tracking phase. The schema design is the critical decision point — get this right before writing any route.

---

### CRITICAL — Pitfall 2.2: IDOR — Sub Records Not Project-Scoped

**What goes wrong:** `assertProjectAccess()` was introduced in v3.0 Phase 32 to replace 21 scattered inline IDOR checks. If subcontractor routes do not call `assertProjectAccess()` before returning or modifying sub records, a user in Team A can access subcontractors belonging to Team B by guessing or enumerating IDs.

This is not hypothetical: v3.0 found and fixed 21 ownership check gaps. New entity types always need the explicit access check.

**Why it happens:** New route developers assume that JWT auth is sufficient. It prevents unauthenticated access but not cross-tenant access within the authenticated user pool.

**Prevention:**
- Every subcontractor route must load the sub record, get its `projectId`, then call `assertProjectAccess(db, sub.projectId, userId)`.
- Add a required test: create a sub under Project A, authenticate as Project B owner, attempt GET/PUT/DELETE on that sub — verify 403.

**Phase:** Subcontractor tracking phase. The cross-tenant 403 test must be an acceptance criterion.

---

### MODERATE — Pitfall 2.3: GC Workers Conflated with Sub Workers in Reports

**What goes wrong:** When generating compliance summaries or the multi-project compliance PDF that includes sub CPR status, there is a risk of conflating GC workers (in the `workers` table, scoped to the project) with subcontractor workers (not in the `workers` table — only the sub's CPR receipt is tracked, not individual sub employees).

Two specific failure modes:
1. A "total workers" query that JOINs `workers` and `subcontractor_cpr_records` without explicit scoping will double-count or produce incorrect totals.
2. A compliance check that asks "are all workers covered?" must scope to GC workers only; sub workers are covered by the sub's own CPR, not the GC's per-worker entries.

**Prevention:**
- Never JOIN `workers` and subcontractor tables without an explicit comment documenting which records each set represents.
- The multi-project compliance PDF should have distinct labeled sections: "GC Payroll Status" (from `payrollWeeks` / `payrollEntries`) and "Subcontractor CPR Status" (from `subcontractor_cpr_records`). Never blend them into a unified worker count.

**Phase:** Subcontractor tracking phase AND multi-project compliance PDF phase.

---

## Section 3: CSV Export for Audit Logs

### CRITICAL — Pitfall 3.1: CSV Formula Injection via Audit Log Data

**What goes wrong:** CSV injection (formula injection) occurs when a cell value starts with `=`, `+`, `-`, or `@`, causing Excel to interpret it as a formula. In an audit log CSV, the most dangerous fields are `diff` (stores JSON of record changes), worker names, and project names — all user-controlled.

The existing compliance history CSV export in `compliance.ts` uses `stringify(rows, { header: true, columns: CSV_COLUMNS })` from `csv-stringify`. This library handles serialization only — it does not sanitize formula-prefix characters. The BOM prefix `'\uFEFF'` at line 145 protects against encoding issues but not injection.

**Why it happens:** csv-stringify's job is serialization, not security hardening. Sanitization is an application-level responsibility not provided automatically.

**Prevention:**
Define a sanitizer and apply it to every user-controlled string field before passing to csv-stringify:
```typescript
function sanitizeCsvCell(value: string): string {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;  // prefix with single quote — standard Excel defense
  }
  return value;
}
```
Apply to: worker names, project names, action strings, notes, diff content, meta values.

**Detection:** Create a test worker named `=SUM(1+1)` and export the audit log CSV. Open in Excel — if the cell shows `2` instead of the literal string, the injection vector is present.

**Phase:** Audit log CSV export phase. Must be an acceptance criterion.

---

### MODERATE — Pitfall 3.2: Missing UTF-8 BOM Breaks Excel Column Parsing

**What goes wrong:** The existing compliance history CSV at `compliance.ts:145` correctly uses `'\uFEFF' + csvString` — the UTF-8 BOM that signals to Excel that the file is UTF-8 encoded. Without the BOM, Excel on Windows defaults to the system code page (typically CP1252), mangling accented characters in worker names into mojibake.

If the new audit log CSV omits the BOM, worker names with accented characters (common in construction workforce) render incorrectly when auditors open the file — which is exactly the audience for an audit log export.

**Prevention:** Follow the established pattern exactly: `res.send('\uFEFF' + csvString)`. Set `Content-Type: text/csv; charset=utf-8`. Both are required. Copy verbatim from `compliance.ts:145`.

**Phase:** Audit log CSV export phase.

---

### MODERATE — Pitfall 3.3: Unbounded Audit Log Query Causing Timeout or Memory Pressure

**What goes wrong:** The `audit_logs` table grows without bound — every payroll entry create/update/delete fires an audit log insert, every PDF download fires one, every payroll import fires multiple. A project with 52 payroll weeks, 10 workers per week, and several import operations could accumulate 3,000+ rows. Loading all rows into a single in-memory array via `db.select()` then serializing to a CSV string synchronously will:

1. Block the Node.js event loop for the duration.
2. Hold the full result in memory (Drizzle/SQLite returns all rows before iteration in the current pattern).
3. Risk hitting Render.com's request timeout on large datasets.

The `audit_logs` table has the index `idx_audit_project_time` on `(project_id, created_at)` — the SELECT is fast, but serialization is still in-process.

**Prevention:**
- Default to the last 1,000 rows with an optional `?since=ISO_DATE` query param for date filtering.
- Document the limit in the UI: "Showing last 1,000 audit events. Use date filter for earlier records."
- Do not attempt streaming CSV in Node.js — the limit approach is sufficient and avoids streaming complexity.

**Phase:** Audit log CSV export phase.

---

## Section 4: Multi-Project Compliance PDF

### CRITICAL — Pitfall 4.1: In-Process PDF Generation Memory Spike

**What goes wrong:** pdf-lib loads the entire PDF document into a JavaScript object graph in memory. The WH-347, A-1-131, F700, PW-12, and IL transcript generators each produce one PDF per payroll week. A multi-project compliance snapshot that attempts to generate or bundle PDFs for 20 active projects with 10 payroll weeks each would load 200 PDFs' worth of pdf-lib objects simultaneously.

Even if the multi-project PDF is a summary (not a bundle of individual week PDFs), generating it via pdf-lib still loads a template, writes all rows, and holds the full `PDFDocument` object until `pdfDoc.save()` completes. Render.com's free tier has a 512MB memory ceiling.

**Why it happens:** Single-week PDF generation is fast and low-memory. The multi-project case is qualitatively different but looks like the same code pattern.

**Prevention:**
- The multi-project compliance PDF must be a **summary table only** — compliance status per project per recent week, not a bundle of individual payroll PDFs.
- Generate the summary document directly from compliance query results without calling `fillWh347()`, `fillA1131()`, or any per-week PDF generator.
- Add a hard cap on active projects included in the summary (e.g., 50 projects) with an advisory if the user has more.

**Phase:** Multi-project compliance PDF phase.

---

### MODERATE — Pitfall 4.2: Stale Compliance Status in the Snapshot

**What goes wrong:** `computeCompliance(db, weekId)` computes fresh on every call. For a multi-project PDF covering 20 projects with multiple weeks each, this means 100+ individual compliance computations per request. Two tempting shortcuts both create problems:

1. **Caching compliance status** — there is no `complianceStatus` column on `payrollWeeks`. Any caching would require explicit cache invalidation when payroll entries change, which does not exist.
2. **Reading from the dashboard batch endpoint** — the `/api/compliance/batch` endpoint returns per-project status only, not per-week, and is scoped for dashboard display.

**Prevention:**
- The multi-project PDF is a **point-in-time snapshot** — compute compliance fresh at generation time. Do not cache.
- Limit computational cost by scoping to recent weeks only (e.g., last 90 days or last 4 weeks per project).
- Print the snapshot timestamp in the PDF header so the recipient knows when it was generated.
- Document in the UI: "Compliance status is computed at time of download, not real-time."

**Phase:** Multi-project compliance PDF phase.

---

## Section 5: CA A-1-131 (Phase 24 Plan 03 Gap)

### CRITICAL — Pitfall 5.1: Task 3 (Browser Verification) Was Never Completed

**What goes wrong:** Phase 24 Plan 03 SUMMARY confirms Tasks 1 and 2 completed (commits `2345b54` and `051c2c1`) but Task 3 — a blocking `checkpoint:human-verify` gate — was never approved. This means:

- `a1131Generator.ts` exists and 7 service tests pass
- The CA download button and eCPR disclosure modal exist in `PayrollWeekDetailPage.tsx`
- But no human has verified: (a) the generated PDF coordinates are correct against the actual printed form, (b) the CSLB/WC advisory modal behaves correctly, (c) the DT columns appear on CA projects and not others, (d) the WH-347 download still works alongside the CA button

The plan was written against the v2.4 codebase. Since then:
- v3.0: `assertProjectAccess` was centralized (the current `export.ts` already uses it at line 270)
- v4.0: NY and IL state detection was added alongside CA/WA in `PayrollWeekDetailPage.tsx` (lines 461-464)
- v4.0: fringe disaggregation columns were added to `payrollEntries`

The structural risk is moderate (the shipped code was updated, not the plan document). The primary gap is the unconfirmed visual correctness of the generated PDF and the untested browser flow.

**Prevention:**
- The v5.0 CA A-1-131 closure phase should treat Task 3 browser verification as the primary deliverable.
- Before verifying, audit `a1131Generator.ts` against the current `payrollEntries` schema to confirm no v3.0/v4.0 columns are missing from the generator's data mapping.
- Verify that `isCA` in `PayrollWeekDetailPage.tsx` still gates correctly alongside the v4.0 `isNY` / `isIL` additions.
- Check that DT columns in `PayrollEntryPage.tsx` (gated separately on `isCA` at line 72) still render correctly — this is a separate component with its own `isCA` derivation.

**Phase:** CA A-1-131 closure phase.

---

### MODERATE — Pitfall 5.2: Plan 03 Code Sample Uses Superseded Ownership Pattern

**What goes wrong:** The Phase 24 Plan 03 PLAN.md code sample included the old ownership check `if (project.userId !== userId)`. The current shipped `export.ts` correctly uses `assertProjectAccess`. However, the plan document is the reference if someone re-executes or extends the plan. A developer reading the plan without reading the current code may reinstate the old pattern in a new related route (e.g., a CA-specific settings endpoint).

**Prevention:** The closure plan must explicitly note that ownership verification uses `assertProjectAccess(db, week.projectId, userId)` — not inline userId comparison. Do not re-execute Plan 03 tasks verbatim; read the current `export.ts` before making changes.

**Phase:** CA A-1-131 closure phase.

---

### MINOR — Pitfall 5.3: A-1-131 Template May Have Been Revised Since Coordinates Were Calibrated

**What goes wrong:** The `a1131Generator.ts` coordinates were calibrated against the `assets/a1131-official.pdf` version present on 2026-03-24. The CA DIR occasionally revises the A-1-131 form. If the template file has changed since then, coordinates calibrated against the old version may be partially or fully wrong.

**Prevention:** During the browser verification task, visually confirm the generated PDF against the current official A-1-131 template from the CA DIR website. If the form has a newer revision, re-measure coordinates. Add a comment in `a1131Generator.ts` documenting the revision date the coordinates were calibrated against.

**Phase:** CA A-1-131 closure phase.

---

## Phase-Specific Warning Matrix

| Phase Topic | Likely Pitfall | Must-Have Mitigation |
|-------------|---------------|---------------------|
| CA A-1-131 closure | Task 3 browser verification never done | Task 3 is the primary deliverable for the closure phase |
| CA A-1-131 closure | Plan 03 code sample uses old ownership pattern | Read current `export.ts` before any edits; use `assertProjectAccess` |
| TX/FL/MA/NJ state forms | Server-side state gate omitted | Each new route has a 400-test for wrong-state weekId |
| TX/FL/MA/NJ state forms | Coordinates from assumed page size | Measure from actual PDF as blocking prerequisite |
| TX/FL/MA/NJ state forms | Missing state-required fields (TDLR, DBPR, etc.) | Additive migration + advisory in pre-download modal |
| TX/FL/MA/NJ state forms | isXX boolean sprawl at 8 states | State registry object for download button rendering |
| TX/FL/MA/NJ state forms | Inconsistent case normalization | Standardize all state comparisons to `.toUpperCase()` pre-flight |
| FL/NJ state forms | Fringe disaggregation fields null for all existing entries | Treat null sub-fields as 0; advisory when all four are null |
| Subcontractor tracking | Per-sub not per-sub-per-week model | Two-table model: `project_subcontractors` + `subcontractor_cpr_records` |
| Subcontractor tracking | IDOR on sub records | `assertProjectAccess` on every sub route + cross-tenant 403 test |
| Subcontractor tracking | GC workers mixed with sub workers in reports | Distinct labeled sections; no JOIN across GC workers and sub entities |
| Audit log CSV | Formula injection via worker/project names | Sanitize cells starting with `=`, `+`, `-`, `@` before csv-stringify |
| Audit log CSV | Missing UTF-8 BOM | Copy `'\uFEFF' + csvString` pattern from `compliance.ts:145` |
| Audit log CSV | Unbounded result set causing timeout | Default 1,000-row limit + optional `?since=` date filter |
| Multi-project PDF | Memory spike from per-week PDF objects | Summary table only; never bundle individual payroll PDFs |
| Multi-project PDF | Stale compliance status | Compute fresh at generation time; print snapshot timestamp on PDF |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| State detection pitfalls | HIGH | Directly observed — `PayrollWeekDetailPage.tsx` lines 461-464 show the exact pattern |
| Server-side state gate | HIGH | Observed in `export.ts` lines 278, 388, 556, 737 — established pattern, omission is the risk |
| Case normalization inconsistency | HIGH | Grep confirmed mixed `.toUpperCase()` usage across components |
| PDF coordinate measurement | HIGH | Confirmed by Phase 24 SUMMARY — dimensions were wrong, required measurement |
| Subcontractor data model | HIGH | Per-sub-per-week is the standard compliance tracking model; single-record model is the common mistake |
| IDOR on sub records | HIGH | v3.0 Phase 32 found 21 inline IDOR gaps; new entity types always need the explicit check |
| CSV injection | HIGH | Standard vulnerability; existing csv-stringify usage confirmed without sanitization |
| BOM requirement | HIGH | Observed at `compliance.ts:145` — existing pattern must be replicated |
| Audit log size limits | MEDIUM | Render.com constraints inferred; row counts estimated from project size; no production load data |
| Multi-project PDF memory | MEDIUM | pdf-lib memory behavior inferred from library pattern; no production multi-project load test |
| Phase 24 Plan 03 gap | HIGH | SUMMARY and PLAN both read; deferred Task 3 confirmed; v4.0 changes audited against current code |
