# Research Summary — v5.0 State Coverage + Subcontractors + Reporting

**Project:** HCC Prevailing Wage
**Milestone:** v5.0 — TX/FL/MA/NJ State Forms, Subcontractor CPR Tracking, Enhanced Reporting
**Researched:** 2026-04-07
**Confidence:** HIGH overall (stack findings from direct code reads; state form requirements from official government sources; architecture from direct codebase analysis)

---

## Executive Summary

v5.0 adds four states (TX, FL, MA, NJ) to a compliance SaaS that already supports CA, WA, NY, and IL. The headline discovery is that this is really a two-state form build, not four: Texas uses the federal WH-347 (no TX-specific form exists) and Florida has no state prevailing wage law at all (repealed 1979, local ordinances preempted by HB 705 in July 2024). Only Massachusetts and New Jersey require purpose-built state PDF generators. This materially reduces the form-building scope while TX and FL become pattern-validated state gate additions using the existing WH-347 generator.

Zero new npm packages are needed for v5.0. All capabilities — pdf-lib for MA/NJ PDF generation, csv-stringify for audit log CSV export, Drizzle ORM for subcontractor schema additions — are already installed. The recommended build path is to follow the IL `ilPdfGenerator.ts` programmatic-draw pattern (not the template-overlay pattern) for both MA and NJ, because neither state provides a fillable official PDF template suitable for pdf-lib's `loadPdf()` + AcroForm fill approach. All report PDFs (multi-project compliance summary, enhanced fringe report) use the same programmatic draw pattern.

The top risks for this milestone are: (1) inconsistent state case normalization already confirmed in the codebase that will silently break new state gates if not fixed as a pre-flight step; (2) the state detection boolean sprawl in `PayrollWeekDetailPage.tsx` (currently 4 booleans, going to 8) that requires a state registry refactor before adding new states; (3) the subcontractor data model must be per-sub-per-week from the start, or the compliance tracking value is lost; and (4) the CA A-1-131 Phase 24 Task 3 browser verification gap has been open since v2.4 and must be closed before v5.0 ships.

---

## Key Findings

### Stack Additions — What's New vs Already Installed

**Zero new npm packages needed.** All v5.0 capabilities are covered by the installed stack.

| Capability | Package | Status |
|-----------|---------|--------|
| MA and NJ PDF generation | pdf-lib ^1.17.1 | INSTALLED |
| Multi-project compliance PDF | pdf-lib ^1.17.1 | INSTALLED |
| Enhanced fringe report PDF | pdf-lib ^1.17.1 | INSTALLED |
| Audit log CSV export | csv-stringify ^6.7.0 | INSTALLED |
| Subcontractor schema additions | drizzle-orm ^0.45.1 + better-sqlite3 ^12.8.0 | INSTALLED |
| Sub document upload (future only) | multer ^2.1.1 | INSTALLED — no v5.0 usage |

**New service files to create** (all following the `ilPdfGenerator.ts` programmatic-draw pattern):
- `src/server/services/maCprGenerator.ts` — MA Weekly Certified Payroll Report + Statement of Compliance
- `src/server/services/njCprGenerator.ts` — NJ MW-562 Payroll Certification for Public Works Projects
- `src/server/services/complianceSummaryPdfGenerator.ts` — Multi-project compliance snapshot PDF
- `src/server/services/fringeReportGenerator.ts` — Enhanced fringe report by fund type / union / J-RA

TX and FL do NOT need new generator files — they use the existing WH-347 generator with state-gate routing.

**Explicitly do NOT add:** pdfmake, jsPDF, @pdfme/generator (PROJECT.md constraint: pdf-lib only), multer-s3 or any S3/CDN file storage (metadata-only sub tracking for v5.0), portal automation for NJ Wage Hub or TX LCPtracker (no public API; manual upload pattern).

---

### Feature Scope — Table Stakes vs Differentiators by Area

#### Texas (LOW complexity — WH-347 reuse)

| Feature | Category |
|---------|----------|
| TX project flag + state gate + WH-347 routing | Table Stakes |
| TX-specific project fields (txdotProjectId, txContractorLicense) | Table Stakes |
| TxDOT LCPtracker submission guide modal | Differentiator |

TX uses WH-347. TxDOT projects submit via LCPtracker portal (no API — manual upload). Three TX-specific project header fields are needed but no per-worker differences from WH-347.

#### Florida (VERY LOW complexity — informational only)

| Feature | Category |
|---------|----------|
| FL project flag + WH-347 routing | Table Stakes |
| "Florida uses federal WH-347 only" HelpCallout | Differentiator |

FL is a 1-2 plan addition. No new form. No new generator. Add "FL" to the state enum and show an informational callout explaining FL has no state prevailing wage law.

#### Massachusetts (HIGH complexity — most different from WH-347)

| Feature | Category |
|---------|----------|
| MA project flag + state gate | Table Stakes |
| MA Weekly Certified Payroll PDF generator (maCprGenerator.ts) | Table Stakes |
| Workforce participation fields per worker (isWoman, isMinority booleans) | Table Stakes |
| OSHA 10 certified field per worker | Table Stakes |
| "All other hours" column on payroll entries (non-project hours) | Table Stakes |
| Supplemental unemployment as explicit fringe sub-column (Column E) | Table Stakes |
| Project gross wages vs total gross wages (Column G vs Column H) | Table Stakes |
| MA Statement of Compliance companion PDF | Table Stakes |
| MA project fields (maDlsProjectId, maSicCode) | Table Stakes |
| MA submission guide modal (awarding authority + 3-year retention) | Differentiator |

MA has the most new DB columns: `workers` gets `isOsha10Certified`, `isMinority`, `isWoman`; `payroll_entries` gets `allOtherHours`, `checkNumber`. MA uses Mon-Sat columns (not Mon-Sun like WH-347). MA requires OSHA 10 documentation on first payroll listing and tracks workforce participation (15.3% minority / 6.9% women goals) per worker. No statewide portal — submit to awarding authority by mail/email.

#### New Jersey (HIGH complexity — EEO demographic fields)

| Feature | Category |
|---------|----------|
| NJ project flag + state gate | Table Stakes |
| NJ MW-562 PDF generator (njCprGenerator.ts) | Table Stakes |
| NJ Contractor Registration Number on projects (njPwcNumber) | Table Stakes |
| Sex field per worker (M/F/N including non-binary option) | Table Stakes |
| Race field per worker (6-code NJ set: W/B/A/N/I/M) | Table Stakes |
| Ethnicity field per worker (H/N) | Table Stakes |
| NJ project fields (njPwcNumber, njContractId) | Table Stakes |
| NJ Wage Hub submission guide modal (10-day deadline) | Differentiator |

NJ MW-562 (February 2025 revision) is required — WH-347 does not satisfy NJ requirements. Key differentiator: NJ requires EEO demographic data (sex/race/ethnicity) per worker, including a non-binary sex option. IL demographic columns (`race`, `ethnicity`, `gender`) shipped in v4.0 can be reused — NJ uses the same columns with slightly different code values. NJ Wage Hub (njwages.nj.gov) is a mandatory portal as of August 2024 but has no public API — generate PDF, user uploads manually.

#### Subcontractor CPR Tracking (MEDIUM complexity — new entity type)

| Feature | Category |
|---------|----------|
| Add subcontractors to a project (name, license, trade, FEIN) | Table Stakes |
| Per-week CPR receipt tracking (pending/received/rejected) | Table Stakes |
| Overdue flag per sub per week (computed from week_ending vs received_at) | Table Stakes |
| Sub CPR summary view on ProjectDetailPage | Table Stakes |
| "Mark CPR Received/Rejected" action | Table Stakes |
| Notes/deficiency field per week | Table Stakes |
| Automated overdue email alerts | Differentiator |
| Sub CPR history export CSV | Differentiator |
| Sub CPR document upload/storage | Anti-Feature (v5.0) — defer; multer already installed |

Federal regulatory basis (29 CFR 5.5(a)(6)): prime contractors are strictly liable for subcontractor violations. Model as "GC compliance tracker" not "sub payroll entry" — GC records receipt/compliance status only, does not re-enter sub payroll data.

#### Enhanced Reporting (LOW-MEDIUM complexity — reuses existing infrastructure)

| Feature | Category |
|---------|----------|
| Multi-project compliance PDF (account-scoped, from DashboardPage) | Table Stakes |
| Audit log CSV export (project-scoped, from ProjectActivityPage) | Table Stakes |
| Enhanced fringe report (fund type / union local / J-RA split) | Table Stakes |
| Email delivery of compliance summary | Differentiator |
| Historical compliance report archive | Anti-Feature — generate on demand only |

---

### Architecture — Key Decisions

**State gate pattern (8-step, must not be altered):** Every new state PDF route follows the established pattern from `export.ts`: (1) load week, (2) `assertProjectAccess`, (3) state gate → 400 if wrong state, (4) load entries, (5) map to input type, (6) generate PDF, (7) stream response, (8) best-effort audit log. The state gate is always step 3 — never before `assertProjectAccess` (that would leak project existence to unauthorized users).

**Critical pre-flight refactor before any new state is added:** The existing codebase has confirmed mixed case normalization — CA/WA use exact uppercase (`project.state === 'CA'`) while NY/IL use `.toUpperCase()`. The `projects` table has no enforced case constraint. All state comparisons — both client and server — must be standardized to `.toUpperCase()` on both sides before Phase 47 begins. One-line fix per comparison; must be done first.

**State registry for PayrollWeekDetailPage:** Currently 4 individual booleans (`isCA`, `isWA`, `isNY`, `isIL`) at lines 461-464. Adding TX, FL, MA, NJ brings this to 8. The download button rendering block must be replaced with a `STATE_FORMS` registry object keyed by state code. The 4 individual booleans can remain for other conditional logic (compliance rules, form fields) where they are established contracts — only the download section uses the registry.

**Subcontractor two-table model:**
- `subcontractors`: id, projectId (FK CASCADE DELETE), companyName, contactName, contactEmail, licenseNumber, fein, createdByUserId, createdAt, updatedAt
- `subcontractor_cprs`: id, subcontractorId (FK CASCADE DELETE), payrollWeekId (FK CASCADE DELETE), status ('pending'/'received'/'rejected'), receivedAt, notes, createdByUserId, createdAt, updatedAt — with UNIQUE INDEX on (subcontractorId, payrollWeekId)

Per-project scoping is intentional (not global): subs have different contacts/licenses per project, and `assertProjectAccess` scopes all data to project membership without a separate access layer.

**New routes:**
- `GET /api/export/tx-cpr/:weekId`, `fl-cpr/:weekId`, `ma-cpr/:weekId`, `nj-cpr/:weekId` — on export router, each state-gated
- `GET /api/export/compliance-summary` — cross-project, user-scoped (no weekId, no state gate)
- `GET /api/audit/:projectId/csv` — on audit router, registered BEFORE the `/:projectId` wildcard (route ordering constraint)
- `GET /api/projects/:projectId/reports/fringe-enhanced` — parallel to existing fringe-summary route
- Full CRUD + CPR routes on new `src/server/routes/subcontractors.ts`

**Schema additions per state** (all nullable — missing field produces blank on PDF, not a generation error):

| State | New columns on `projects` | New column on `payroll_weeks` |
|-------|--------------------------|-------------------------------|
| TX | txdotProjectId, txContractorLicense | txCprSubmittedAt |
| FL | flDbeNumber, flContractId | flCprSubmittedAt |
| MA | maDlsProjectId, maSicCode | maCprSubmittedAt |
| NJ | njPwcNumber, njContractId | njCprSubmittedAt |

Workers table additions (MA): `isOsha10Certified`, `isMinority`, `isWoman` (nullable booleans).
Payroll entries additions (MA): `allOtherHours`, `checkNumber` (nullable).
Workers table additions (NJ): `sex` as a new nullable column — do not reuse `gender`; the values are semantically different (legal sex on a compliance form vs gender identity).

---

### Top 5 Pitfalls to Avoid

**1. CRITICAL — Inconsistent case normalization silently breaks new state gates**
Mixed `.toUpperCase()` usage confirmed by grep across `PayrollWeekDetailPage.tsx` and `export.ts`. A project stored as `'tx'` passes the frontend button check but gets a 400 from the server gate if the route uses exact `'TX'`. Fix: standardize ALL state comparisons (client and server) to `.toUpperCase()` as a pre-flight task at the start of Phase 47 before any new state is added.

**2. CRITICAL — isXX boolean sprawl at 8 states makes PayrollWeekDetailPage unmaintainable**
Eight individual booleans with 8 separate conditional JSX blocks for download buttons introduces silent state leakage bugs (TX button visible on FL project) and makes compliance coverage unauditable by inspection. Fix: introduce a `STATE_FORMS` registry object for download button rendering at the start of Phase 47. Confirmed observation: booleans exist at lines 461-464 of `PayrollWeekDetailPage.tsx`.

**3. CRITICAL — PDF coordinate measurement is a blocking prerequisite, not optional**
Phase 24 Plan 03 SUMMARY documented this trap exactly: the A-1-131 was assumed to be 8.5x11 but is actually 8.5x14 (612x1008 pt), making all assumed coordinates wrong. For MA (dense portrait layout) and NJ (compact single-page format), the same trap applies compounded. Fix: for each state form phase, load the official PDF via pdf-lib, read actual page dimensions, and measure exact (x, y) field positions as a blocking prerequisite — no coordinates from screenshots or guessing.

**4. CRITICAL — Subcontractor data model must be per-sub-per-week from day one**
A naive model with one record per subcontractor becomes a static address book, not a compliance tool. A GC cannot answer "which subs are missing CPRs for week 7?" without the week axis. Fix: the two-table model (`subcontractors` + `subcontractor_cprs` with payrollWeekId FK and UNIQUE INDEX on subcontractorId+payrollWeekId) must be designed correctly in Phase 52 before any route is written. The schema is the critical decision.

**5. CRITICAL — CSV formula injection via audit log data**
csv-stringify does not sanitize formula-prefix characters. Worker names, project names, notes, and meta JSON are all user-controlled. A cell starting with `=`, `+`, `-`, or `@` executes as an Excel formula when opened by an auditor. Fix: define and apply a `sanitizeCsvCell()` prefixer function to all user-controlled string fields before passing to csv-stringify. This must be an explicit acceptance criterion for Phase 55.

**Also watch for:**
- Server-side state gate missing on new routes (never rely on frontend button visibility alone — the server gate is non-negotiable; test with wrong-state weekId must return 400)
- IDOR on subcontractor routes (every sub route calls `assertProjectAccess` before any data access — same established pattern as workers routes; cross-tenant 403 test is a required acceptance criterion)
- Missing UTF-8 BOM on audit log CSV (copy `'\uFEFF' + csvString` pattern verbatim from `compliance.ts:145`)
- Multi-project compliance PDF memory spike (summary table only — never bundle individual per-week PDF objects in memory simultaneously)
- CA A-1-131 Task 3 browser verification still outstanding (Phase 24 Plan 03 Tasks 1 and 2 shipped; Task 3 was deferred and never completed)

---

## Implications for Roadmap

Research suggests 12 phases (47–58), continuing from v4.0's Phase 46. State forms are independent of each other and of subcontractor tracking. Reporting phases benefit from sub tracking data being live but have no hard blocking dependency.

### Phase 47: TX Certified Payroll PDF
**Rationale:** TX is the largest prevailing wage construction market; WH-347 reuse makes it the lowest-risk first phase. This phase also carries the pre-flight work that all subsequent phases depend on.
**Delivers:** Pre-flight case normalization fix across all existing state comparisons; `STATE_FORMS` registry in PayrollWeekDetailPage; TX state gate + WH-347 routing; TX project fields migration (txdotProjectId, txContractorLicense, txCprSubmittedAt); TxDOT LCPtracker submission guide modal.
**Key pitfalls:** isXX boolean sprawl (use registry); case normalization fix first; server-side state gate test.
**Research flag:** Standard patterns — no deeper research needed. TX uses WH-347 exactly.

### Phase 48: FL Certified Payroll PDF
**Rationale:** FL is a 1-2 plan addition with zero PDF generator work. Confirms the state gate pattern is clean after Phase 47 fixes before heavier form builds.
**Delivers:** FL state gate + WH-347 routing; FL informational HelpCallout; FL project fields migration (flDbeNumber, flContractId, flCprSubmittedAt).
**Key pitfalls:** Server-side state gate test required even though no new form.
**Research flag:** Standard patterns — no deeper research needed.

### Phase 49: MA Certified Payroll PDF
**Rationale:** MA is the most complex state form (most new DB columns, most MA-specific per-worker fields). Build after TX/FL confirm the state gate pattern is clean. DB columns must land before the PDF generator can be written.
**Delivers:** MA worker and payroll entry schema migration (isOsha10Certified, isMinority, isWoman, allOtherHours, checkNumber); MA project fields migration; maCprGenerator.ts (two-page: payroll table + Statement of Compliance); MA state gate route; MA pre-download modal with missing-field advisory.
**Key MA-specific requirements:** OSHA 10 per worker; workforce participation (isMinority, isWoman); allOtherHours on payroll entries; supplemental unemployment as explicit fringe column (Column E); project gross vs total gross (Column G vs H); Mon-Sat hour columns; check number field.
**Key pitfalls:** Measure MA form dimensions from official mass.gov download BEFORE writing coordinates; Column B/E/G/H naming requires validation against current form download (MEDIUM-HIGH confidence).
**Research flag:** MEDIUM-HIGH — MA column naming must be validated against the current official download before coding.

### Phase 50: NJ Certified Payroll PDF
**Rationale:** NJ form leverages IL demographic columns (race, ethnicity, gender) shipped in v4.0, reducing new schema work compared to MA. Build after MA confirms the generator pattern.
**Delivers:** NJ project schema migration (njPwcNumber, njContractId, njCprSubmittedAt, workers.sex); njCprGenerator.ts (MW-562 with EEO columns, FICA/tax deduction columns); NJ state gate route; NJ Wage Hub submission guide modal.
**Key NJ-specific requirements:** EEO demographic columns per worker (sex M/F/N, race 6-code W/B/A/N/I/M, ethnicity H/N); NJ Contractor Registration Number (njPwcNumber) on projects; FICA/Federal/State tax deduction columns; Mon-Sat daily hours; 10-day Wage Hub submission deadline.
**Key pitfalls:** Measure NJ MW-562 dimensions from official NJ DOL download; fringe disaggregation null handling (treat null sub-fields as 0; show advisory when all four are null); separate `sex` column, not reusing `gender`.
**Research flag:** MEDIUM — EEO codes confirmed; column widths/positions require test rendering. Confirm MW-562 is still on February 2025 revision at build time.

### Phase 51: CA A-1-131 Gap Close
**Rationale:** Phase 24 Plan 03 Task 3 (browser verification) was deferred and never completed. Closes this gap before v5.0 ships.
**Delivers:** Browser-verified CA A-1-131 PDF coordinate correctness; verified UI flow (CSLB/WC advisory modal, DT columns on CA projects only, WH-347 still works alongside CA button); audit of a1131Generator.ts against v3.0/v4.0 schema additions.
**Key pitfalls:** Do not re-execute Plan 03 code samples verbatim — they use the old `project.userId !== userId` ownership pattern; read current `export.ts` first. Check for A-1-131 template revision since calibration date.
**Research flag:** Standard patterns — no new research needed. This is verification work, not a new build.

### Phase 52: Subcontractor Schema + API
**Rationale:** Subcontractor tracking is independent of state forms. Schema must land before UI can be built or tested. Two-table model is the critical design decision.
**Delivers:** `subcontractors` and `subcontractor_cprs` tables with migrations; `src/server/routes/subcontractors.ts` (POST/GET/DELETE for subs, POST/GET for CPR records); audit log entries for sub events; UNIQUE INDEX on (subcontractorId, payrollWeekId).
**Key pitfalls:** Per-sub-per-week model (not per-sub static record); `assertProjectAccess` on every route before any data access; cross-tenant 403 test is a required acceptance criterion.
**Research flag:** Standard patterns — two-table model confirmed by regulatory analysis (29 CFR 5) and industry compliance tools.

### Phase 53: Subcontractor UI
**Rationale:** Builds the GC-facing compliance tracker panel on top of Phase 52's API.
**Delivers:** `SubcontractorPanel.tsx` embedded in `ProjectDetailPage.tsx`; "Subcontractors" tab; add/remove sub form; per-week CPR receipt table with overdue flags; Mark Received/Rejected action with notes field.
**Key pitfalls:** Panel is project-scoped (not a new top-level page — no new routing needed); GC workers and sub workers must never be conflated in any totals or counts displayed.
**Research flag:** Standard patterns.

### Phase 54: Subcontractor Integration with State Forms
**Rationale:** Connects live sub data to existing state form generators. The IL Certified Transcript `IlPdfInput` already has a `subcontractors: Array<{name, address}>` field currently passed as an empty array — Phase 54 populates it.
**Delivers:** Auto-populate subcontractor fields in IL transcript affidavit and applicable new state form certification pages; sub CPR overdue count shown on project compliance status.
**Research flag:** Standard patterns.

### Phase 55: Audit Log CSV Export
**Rationale:** Purely additive to existing `audit_logs` table (v4.0). csv-stringify already installed. Lowest-risk reporting phase.
**Delivers:** `GET /api/audit/:projectId/csv` route (registered before `/:projectId` wildcard in audit.ts); CSV download button on ProjectActivityPage; 1,000-row default limit with optional `?since=` date filter; UTF-8 BOM output.
**Key pitfalls:** CSV formula injection sanitization (required acceptance criterion); UTF-8 BOM (copy from compliance.ts:145); route registration order (specific before wildcard).
**Research flag:** Standard patterns.

### Phase 56: Enhanced Fringe Report
**Rationale:** Independent of subcontractor tracking. All required data columns (`fringeHealthWelfare`, `fringePension`, `fringeVacation`, `fringeTraining`, `workers.unionLocal`) already exist from prior milestones.
**Delivers:** `getEnhancedFringeSummary()` in reportsService.ts (non-destructive — does not modify existing `getFringeSummary()`); `GET /api/projects/:projectId/reports/fringe-enhanced` route; third tab on ReportsPage.tsx.
**Research flag:** Standard patterns. All data columns already exist; no new schema work.

### Phase 57: Multi-Project Compliance PDF
**Rationale:** Benefits from sub tracking (Phases 52–54) being live so it can include sub CPR overdue counts per project in the report. Place last in reporting group.
**Delivers:** `complianceSummaryPdfGenerator.ts` (summary table, pdf-lib programmatic draw); `GET /api/export/compliance-summary` route (cross-project, user-scoped, no weekId, no state gate); download button on DashboardPage.
**Key pitfalls:** Summary table only — never bundle per-week PDF objects (memory spike on Render.com 512MB ceiling); compute compliance fresh at generation time (no caching); print snapshot timestamp on every PDF; 50-project hard cap with advisory.
**Research flag:** MEDIUM — multi-project PDF format has no official standard; section structure (cover/project rows/violation detail/sub gap) needs planning validation.

### Phase 58: v5.0 Integration + Polish
**Rationale:** Buffer phase for cross-cutting cleanup easier to finalize after all features exist.
**Delivers:** ACTION_LABELS additions for sub events in ProjectActivityPage.tsx; filename consistency audit across all new download endpoints; PROJECT.md update for v5.0; final test pass (560+ tests target); cross-state compliance validation.
**Research flag:** No research needed.

### Phase Ordering Rationale

- TX first (47): validates the mandatory pre-flight refactors (case normalization, state registry) under the lowest-risk scope possible
- FL second (48): so trivial it doubles as a smoke test confirming the Phase 47 refactors are clean
- MA before NJ (49, 50): MA has more new DB columns; build first so NJ can follow the established migration pattern; NJ reuses IL demographic columns reducing its new-column count
- CA gap (51) after new states: does not block any v5.0 feature; placed to close the long-open Task 3 before final integration
- Sub schema before sub UI (52, 53): API must exist before the panel can be built or tested
- Sub integration (54) after UI: confirms real data flows correctly through the form generators
- Reporting (55-57) at end: benefits from all prior data being live; ordering within reporting is lowest-risk first (55 audit CSV) then independent feature (56 fringe) then most-dependent (57 compliance PDF needs sub data from Phase 52)
- Integration phase (58) as buffer: cross-cutting work is faster when all features exist

### Research Flags

Phases needing attention during plan creation:

- **Phase 49 (MA):** MA form column naming convention (Columns B/E/G/H) requires downloading and reading the current official form from mass.gov before writing coordinate constants. URL: `mass.gov/doc/weekly-certified-payroll-report/download`. Do not use third-party mirror as sole source for column naming.
- **Phase 50 (NJ):** Confirm NJ MW-562 is still on the February 2025 revision at time of build. URL: `nj.gov/labor/wageandhour/tools-resources/forms-publications/`. EEO race codes (W/B/A/N/I/M) confirmed; column widths require test rendering.
- **Phase 57 (multi-project PDF):** Section layout needs planning validation — no official standard exists for this report format. Propose layout during planning; validate with a single-project smoke test before multi-project expansion.

Phases with standard established patterns (skip additional research):
- **Phase 47 (TX):** WH-347 reuse fully confirmed. State gate pattern established by 4 existing implementations.
- **Phase 48 (FL):** Informational flag only. No form to design.
- **Phase 51 (CA gap):** Verification work, not a new build. Read existing files before touching anything.
- **Phases 52–54 (sub tracking):** Two-table model confirmed by 29 CFR 5 regulatory analysis. API pattern mirrors existing workers routes.
- **Phase 55 (audit CSV):** csv-stringify pattern established in compliance.ts. Column set derivable from audit_logs schema.
- **Phase 56 (fringe report):** All data columns exist. New function alongside existing getFringeSummary(); non-destructive.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (no new packages) | HIGH | Confirmed from direct package.json read. Zero new packages is definitive. |
| TX form requirements | HIGH | Multiple official sources (TxDOT, TWC, Texas Gov Code §2258). No ambiguity — WH-347 only. |
| FL no state law | HIGH | Florida statutes + HB 705 (July 2024). Confirmed by multiple consistent independent sources. |
| MA form structure | MEDIUM-HIGH | Official mass.gov form confirmed. Column naming (B/E/G/H) verified via official mirror but must be re-confirmed against current download at build time. |
| NJ MW-562 structure | MEDIUM-HIGH | Official NJ DOL form (Feb 2025 revision) confirmed. EEO codes confirmed. Column widths require test rendering. |
| NJ Wage Hub | MEDIUM | Portal existence and August 2024 launch confirmed; no public API confirmed; assumes manual upload pattern consistent with CA DIR / WA L&I v3.0 finding. |
| Subcontractor regulatory basis | HIGH | 29 CFR 5.5(a)(6) + DOL Fact Sheet #66C confirm prime strict liability. Two-table model derived from industry standards (LCPtracker, b2gnow, Caltrans CA model). |
| Architecture patterns | HIGH | All findings from direct code reads of export.ts, schema.ts, ilPdfGenerator.ts, audit.ts, reportsService.ts. No inference needed. |
| Pitfalls | HIGH | Directly observed in codebase (mixed case normalization confirmed by grep; PayrollWeekDetailPage lines 461-464 observed; Phase 24 Task 3 gap confirmed in SUMMARY). |
| Multi-project PDF format | MEDIUM | No official standard. Structure based on eMars/LCPtracker industry patterns. Needs planning validation. |

**Overall confidence: HIGH**

---

## Open Questions to Resolve Before or During Planning

1. **Should TX and FL share one phase?** Both are minimal builds (WH-347 reuse). Combining saves a phase number but Phase 47 carries the pre-flight refactor load (case normalization, state registry) that FL benefits from without contribution. Recommendation: keep separate. Phase 47 does the pre-flight work; Phase 48 is a clean confirmation.

2. **Should Phase 54 (sub form integration) merge into Phase 53?** The IL transcript sub array field is already defined and passing an empty array. Wiring it up is low complexity. Recommendation: keep separate for deliverable boundary clarity — Phase 53 ships working UI; Phase 54 ships form integration. Can be merged during planning if the phase count is a concern.

3. **Multi-project PDF violation detail scope:** Should Phase 57 include per-violation detail rows (list of specific violations per project) or counts + status badges only? Violation detail requires joining compliance checks or re-running `computeCompliance()` per week per project. Recommendation: v5.0 ships counts + status badges only; violation detail listing is a future enhancement.

4. **workers.sex vs workers.gender for NJ:** Decide before Phase 50 migration. Recommendation: add `sex` as a new separate nullable column on workers, NJ-gated in UI. Reusing `gender` conflates legally-required sex on a compliance form with gender identity — semantically different, different code sets.

5. **FL project fields scope:** ARCHITECTURE.md suggests `flDbeNumber` and `flContractId` as FL project columns, but FL has no state form requiring them. These would be informational only. Decide during Phase 48 planning whether these add user value or over-engineer a flag addition.

6. **Fringe disaggregation advisory design for FL/NJ:** Both forms have fringe sections; existing entries for non-CA projects have null sub-fields. Settle the advisory pattern ("fringe detail not entered — form will show $0 for individual fringe lines") during Phase 48 or Phase 50 planning so it is applied consistently.

---

## Sources

### Primary (HIGH confidence — official government sources and direct code reads)

- `C:/Users/glcar/prevailing-wage/package.json` — confirmed installed packages (pdf-lib ^1.17.1, csv-stringify ^6.7.0, multer ^2.1.1, drizzle-orm ^0.45.1)
- `src/server/services/ilPdfGenerator.ts` — programmatic draw pattern; two-page structure; IlPdfInput interface fields
- `src/server/routes/export.ts` — 8-step state gate pattern; all existing state routes confirmed
- `src/server/db/schema.ts` — existing state-specific columns; table structure; audit_logs shape
- `src/server/routes/audit.ts` — paginated audit log; route ordering constraint confirmed
- `src/server/services/reportsService.ts` — getFringeSummary shape; fringe disaggregation columns
- `src/client/pages/PayrollWeekDetailPage.tsx` — isCA/isWA/isNY/isIL booleans at lines 461-464 confirmed
- Texas Government Code Chapter 2258 + TxDOT manuals + TDHCA Davis-Bacon page — TX uses WH-347; LCPtracker is portal-only
- Florida statutes + HB 705 (July 2024) + FL labor law guides — FL no state prevailing wage law; local ordinances preempted
- mass.gov/doc/weekly-certified-payroll-report/download + MA DLS prevailing wage guide — MA form structure; OSHA 10; workforce participation (15.3% minority / 6.9% women) confirmed
- nj.gov/labor/wageandhour (NJ DOL forms page) — MW-562 February 2025 revision is current; NJ Wage Hub mandatory as of August 2024
- njwages.nj.gov MW-564 instructions document — NJ Wage Hub portal-only submission, no machine-to-machine API
- 29 CFR Part 5 + DOL Fact Sheet #66C — prime contractor strict liability for sub violations

### Secondary (MEDIUM-HIGH confidence — official mirrors and cross-referenced sources)

- srtabus.com MA Weekly Certified Payroll PDF mirror — MA column naming (B/E/G/H); OSHA 10 checkbox details. Consistent with official DLS guide but requires re-validation against current mass.gov download.
- construction-business-forms.com + templateroller.com NJ MW-562 — NJ form structure; EEO column code set. Consistent with official NJ DOL form description.
- Caltrans Labor Compliance Manual Chapter 13 — GC sub CPR tracking model (CA as strongest prime retention example)
- eMars, LCPtracker, b2gnow industry patterns — multi-project compliance report format; GC sub CPR tracking data points

---

*Research completed: 2026-04-07*
*Ready for roadmap: yes*
*Next step: roadmap creation for Phases 47–58*
