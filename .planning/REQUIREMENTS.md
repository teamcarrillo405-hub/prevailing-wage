# Requirements: v5.0 — State Coverage + Subcontractors + Reporting

**Milestone goal:** Expand certified payroll coverage to TX, FL, MA, and NJ (state-gated, PDF-only), close the CA A-1-131 gap, add GC subcontractor compliance tracking, and deepen reporting with exportable audit logs, enhanced fringe breakdowns, and a multi-project compliance summary PDF.

**Research artifacts:** `.planning/research/STACK.md`, `.planning/research/FEATURES.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md`

---

## Feature Area 1: State Foundations (pre-flight)

Required before any new state is added. Prevents fragile state-detection at 8+ states.

- [ ] **STATE-12** — Replace per-state `isCA`/`isWA`/`isNY`/`isIL` boolean variables across `PayrollWeekDetailPage.tsx` with a `STATE_FORMS` registry object (`const STATE_FORMS = { CA: {...}, WA: {...}, NY: {...}, IL: {...} }`) — enables adding new states without combinatorial JSX growth.
- [x] **STATE-13** — Standardize all state comparisons to `.toUpperCase()` throughout client and server (currently CA/WA use exact match strings, NY/IL use `.toUpperCase()` — must be consistent before adding TX/FL/MA/NJ).

---

## Feature Area 2: TX Certified Payroll

Texas Chapter 2258 requires WH-347 or equivalent. No Texas-specific form exists; TXDOT mandates LCPtracker for electronic submission.

- [ ] **TX-01** — TX is a selectable project state. TX project form shows three TX-specific header fields: TxDOT contract number, awarding agency name, and project location. TX projects route to WH-347 download with these fields overlaid in the WH-347 header.
- [ ] **TX-02** — TX projects show an informational callout on PayrollWeekDetailPage noting that Texas requires electronic submission via LCPtracker (lcp123.com); the callout links to the TXDOT contractor compliance page.

---

## Feature Area 3: FL Certified Payroll

Florida repealed its state prevailing wage law in 1979; HB 705 (July 2024) preempted all local ordinances. FL projects use federal WH-347.

- [ ] **FL-01** — FL is a selectable project state. FL projects route to WH-347 download with an informational callout explaining that Florida has no state-specific certified payroll form and federal Davis-Bacon WH-347 applies. No new PDF generator required.

---

## Feature Area 4: MA Certified Payroll

Massachusetts DLS Weekly Certified Payroll Report — most complex new state form. Adds workforce participation tracking and OSHA 10 certification per worker.

- [ ] **MA-01** — MA is a selectable project state. MA projects show a state-gated "Download MA DLS Weekly Payroll" button on PayrollWeekDetailPage.
- [ ] **MA-02** — New nullable worker columns (shown in WorkersPage for MA and NJ projects): `isWoman` (boolean), `isMinority` (boolean), `oshaTraining` (boolean). All nullable; workers may decline to self-identify.
- [ ] **MA-03** — New nullable payroll entry fields (shown in PayrollWeekDetailPage for MA projects): `checkNumber` (text), `allOtherHours` (decimal — hours worked for other employers that week), `totalWeekGrossWages` (decimal — gross wages from all employers). All optional.
- [ ] **MA-04** — MA DLS Weekly Certified Payroll PDF generator (`maPdfGenerator.ts`): contractor header (name, FEIN, address, license), project header (name, location, contract number, week ending), per-worker rows with OSHA 10 checkbox, woman/minority columns, supplemental unemployment fringe sub-column, project gross pay column, total-week gross pay column, check number, statement of compliance with MA-specific certification language.

---

## Feature Area 5: NJ Certified Payroll

New Jersey MW-562 (February 2025 revision) — requires EEO demographic columns per worker and NJ Public Works Contractor Registration Number.

- [ ] **NJ-01** — NJ is a selectable project state. NJ project form shows NJ Public Works Contractor Registration Number field when state=NJ. NJ projects show a state-gated "Download NJ MW-562" button on PayrollWeekDetailPage.
- [ ] **NJ-02** — New nullable worker EEO field: `workerSex` (text: `'M'` | `'F'` | `'N'` | null). Extends existing `race` and `ethnicity` columns from v4.0 (IL) — no new race/ethnicity columns needed. `workerSex` shown on WorkersPage for NJ projects (and alongside existing demographics for IL projects).
- [ ] **NJ-03** — NJ MW-562 PDF generator (`njPdfGenerator.ts`): contractor header with NJ contractor reg number, per-worker rows with EEO columns (sex/race/ethnicity using standard NJ 6-code race system), FICA/federal income tax/state income tax deduction columns, statement of compliance with NJ-specific certification language.

---

## Feature Area 6: CA A-1-131 Gap Closure

Phase 24 Plan 03 was deferred since v2.4. The generator (`a1131Generator.ts`) and all tests pass. The gap is browser verification of PDF field coordinate accuracy.

- [ ] **CA-02** — Browser verification of the existing CA A-1-131 PDF: run the dev server, download an A-1-131 for a CA project, visually confirm all field coordinates are correct (header fields, per-worker rows, fringe section, SDI deduction, certification text). Document any coordinate corrections needed and apply them.

---

## Feature Area 7: Subcontractor Tracking

Prime contractors bear strict liability under 29 CFR 5 for subcontractor prevailing wage violations. GCs need to track CPR receipt and compliance status per sub per payroll week.

- [ ] **SUB-01** — `subcontractors` table: `(id UUID, projectId FK→projects, name text NOT NULL, licenseNumber text, contactName text, contactEmail text, address text, createdAt text)`. Project-scoped. Migration + Drizzle schema.
- [ ] **SUB-02** — `subcontractor_cpr_weeks` table: `(id UUID, subcontractorId FK→subcontractors, weekEndingDate text NOT NULL, receivedDate text, isCompliant integer, notes text, createdAt text)`. Tracks weekly CPR receipt status per sub. UNIQUE on `(subcontractorId, weekEndingDate)`. Migration + Drizzle schema.
- [ ] **SUB-03** — Sub management routes: `GET /api/projects/:id/subcontractors`, `POST /api/projects/:id/subcontractors`, `PATCH /api/projects/:id/subcontractors/:subId`, `DELETE /api/projects/:id/subcontractors/:subId` — all with `assertProjectAccess`.
- [ ] **SUB-04** — CPR tracking routes: `GET /api/projects/:id/subcontractors/:subId/cpr-weeks`, `POST /api/projects/:id/subcontractors/:subId/cpr-weeks`, `PATCH /api/projects/:id/subcontractors/:subId/cpr-weeks/:weekId` — mark week as received/compliant with optional notes.
- [ ] **SUB-05** — Subcontractors panel on ProjectDetailPage: list all subs for the project; add/edit/remove subs; expandable per-sub CPR week table showing each payroll week with status badge (Received + Compliant / Received + Non-Compliant / Not Received / Overdue). "Overdue" fires when `weekEndingDate` is more than 7 days ago and CPR not yet received.

---

## Feature Area 8: Reporting

- [ ] **RPT-01** — Audit log CSV export: `GET /api/audit/:projectId/csv` — downloads the complete project audit log as a UTF-8 BOM CSV file (matching existing CSV export pattern). Columns: timestamp, actor email, action, entity type, entity ID, description. Formula injection sanitization required (prefix `=`/`+`/`-`/`@` cells with a space). Download button on ProjectActivityPage alongside the existing date filter.
- [ ] **RPT-02** — Enhanced fringe report: extends `reportsService.ts` with a new `getFringeBreakdown()` function that returns fringe totals grouped by fund type (health/pension/vacation/training), union local, and journeyman vs apprentice. New "Fringe Breakdown" tab on ReportsPage alongside the existing fringe summary.
- [ ] **RPT-03** — Multi-project compliance PDF: `GET /api/export/compliance-summary` — generates a single summary PDF covering all active projects the user has access to. Columns: project name, state, week-ending date, compliance status (compliant/violations/pending), violation count, submission status (submitted/unsubmitted), subcontractor CPR overdue count. Download button on DashboardPage. Uses pdf-lib, programmatic table layout (IL generator pattern).

---

## Non-Functional Requirements

- [ ] **NFR-06** — `STATE_FORMS` registry (STATE-12) must be committed before any new state phase (TX/FL/MA/NJ) is planned or executed — enforced by phase dependency ordering in the roadmap.
- [ ] **NFR-07** — All CSV exports sanitize cell values to prevent formula injection: values starting with `=`, `+`, `-`, or `@` are prefixed with a space before writing.
- [ ] **NFR-03** (continued) — All new routes apply `assertProjectAccess` before any data access.
- [ ] **NFR-01** (continued) — All new Drizzle migrations use `--> statement-breakpoint` (one space) separator between SQL statements; single-statement migrations need no separator.

---

## Out of Scope (v5.0)

- NJ Wage Hub portal integration — no public REST API found; manual upload assumed (same pattern as CA DIR / WA L&I)
- TX LCPtracker integration — proprietary API; callout-only approach is correct
- MA OT compliance rule — federal 40-hour/week rule applies; daily OT only for specific CBA trades (not universal like NY 8-hour rule); deferred
- Sub payroll data entry — subs do not get accounts; GC tracks receipt only, does not re-enter sub payroll
- Billing / subscription — deferred to v6.0
- More than 4 new states — TX/FL/MA/NJ covers v5.0; additional states deferred

---

## Traceability

*(Filled by roadmapper)*

| Req ID | Phase |
|--------|-------|
| STATE-12, STATE-13 | Phase 47 |
| TX-01, TX-02 | Phase 47 |
| FL-01 | Phase 48 |
| MA-01–MA-04 | Phases 49–50 |
| NJ-01–NJ-03 | Phases 51–52 |
| CA-02 | Phase 53 |
| SUB-01–SUB-05 | Phases 54–56 |
| RPT-01–RPT-03 | Phases 57–59 |
| NFR-06, NFR-07, NFR-03, NFR-01 | Distributed |
