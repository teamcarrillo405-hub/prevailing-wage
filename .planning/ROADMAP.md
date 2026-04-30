# Roadmap: HCC Prevailing Wage



## Milestones



- ✅ **v1.0** Foundation + Wage Engine + Payroll + Differentiators — Phases 1-5 (shipped 2026-03-19)

- ✅ **v2.0** Contractor UX Overhaul + Compliance — Phases 6-9 (shipped 2026-03-20)

- ✅ **v2.1** Design Polish + Landing Page — Phases 10-14 (shipped 2026-03-22)

- ✅ **v2.2** UX Completion + Compliance Hardening — Phases 15-16 (shipped 2026-03-23)

- ✅ **v2.3** Contractor Workflow Efficiency + Audit Readiness — Phases 17-22 (shipped 2026-03-24)

- ✅ **v2.4** Ship-Ready + Design Elevation — Phases 23-28 (shipped 2026-03-27)

- ✅ **v2.5** State Portal Integration — Phases 29-30 (shipped 2026-03-27)

- ✅ **v3.0** Team & Integration — Phases 31-36 (shipped 2026-03-31)



## Phases



<details>

<summary>✅ v1.0 Foundation + Wage Engine + Payroll + Differentiators (Phases 1-5) — SHIPPED 2026-03-19</summary>



Auth, project creation, SAM.gov wage determination fetch and cache, workers/classifications, weekly payroll entry, WH-347 PDF generation, CSV export, OT scenario comparison, union allocations, GSA rate builder, job cost variance reporting with PDF.



Plans are not archived here — built before GSD structure. See MILESTONES.md.



</details>



<details>

<summary>✅ v2.0 Contractor UX Overhaul + Compliance (Phases 6-9) — SHIPPED 2026-03-20</summary>



- [x] **Phase 6: WH-347 2025 Compliance Foundation** — programName/J/RA field, multi-page WH-347, certApprentices boolean from real data (4/4 plans — 2026-03-20)

- [x] **Phase 7: Compliance Engine + Payroll Week View** — under-wage/CWHSSA OT detection, PayrollWeekDetailPage, one-click WH-347 (4/4 plans — 2026-03-20)

- [x] **Phase 8: Dashboard + UX Polish** — compliance badges on project cards, nav links, missing-data warnings, WH-347 per row (4/4 plans — 2026-03-20)

- [x] **Phase 9: Reports** — fringe benefit summary and worker pay history reports (4/4 plans — 2026-03-20)



Archive: `.planning/milestones/v2.0-ROADMAP.md`



</details>



<details>

<summary>✅ v2.1 Design Polish + Landing Page (Phases 10-14) — SHIPPED 2026-03-22</summary>



- [x] **Phase 10: CSS Design Token Foundation** — HCC brand tokens in @theme, Google Fonts, inline style migration, focus utility fix (3/3 plans — 2026-03-20)

- [x] **Phase 11: UI Primitives** — Card, Button, Badge, PageHeader, EmptyState reusable components (2/2 plans — 2026-03-20)

- [x] **Phase 12: App Shell + Global Layout** — dark nav on all protected pages, typography hierarchy, consistent card spacing (3/3 plans — 2026-03-20)

- [x] **Phase 13: Landing Page + Routing** — full marketing homepage at public route "/", auth-aware routing (3/3 plans — 2026-03-20)

- [x] **Phase 14: Page-by-Page Polish** — Dashboard, Project Detail, Workers, Payroll Entry, Payroll Week Detail, Reports, Login/Register (3/3 plans — 2026-03-22)



Archive: `.planning/milestones/v2.1-ROADMAP.md`



</details>



<details>

<summary>✅ v2.2 UX Completion + Compliance Hardening (Phases 15-16) — SHIPPED 2026-03-23</summary>



- [x] **Phase 15: Compliance Engine Hardening + Independent Frontend** — Apprentice ratio check in computeCompliance(), workflow progress indicator on Project Detail, print CSS for both reports (3/3 plans — 2026-03-22)

- [x] **Phase 16: WH-347 Submission UX** — Preflight modal with violation summary + confirmation, fetch-driven download with generating state and double-click guard (1/1 plans — 2026-03-22)



Archive: `.planning/milestones/v2.2-ROADMAP.md`



</details>



<details>

<summary>✅ v2.3 Contractor Workflow Efficiency + Audit Readiness (Phases 17-22) — SHIPPED 2026-03-24</summary>



- [x] **Phase 17: DB Migration + Project Archive** — 4-column payrollWeeks migration, project archive/restore, archived badge, compliance pre-check before archive (2/2 plans — 2026-03-23)

- [x] **Phase 18: Dashboard Search + Filter** — name search, funding type filter, URL-persisted filter state, zero-results empty state (1/1 plans — 2026-03-23)

- [x] **Phase 19: WH-347 Submission Tracking** — mark weeks submitted with date/agency, server-side edit lock, un-submit, submitted badges on payroll list (2/2 plans — 2026-03-23)

- [x] **Phase 20: Copy Previous Payroll Week** — copy week to pre-fill new entry, live rate re-fetch per classification, skipped-entries warning (2/2 plans — 2026-03-23)

- [x] **Phase 21: Payroll Amendment Workflow** — amend submitted week as new row, "N (AMENDED M)" WH-347 label, pre-filled entries from original (2/2 plans — 2026-03-23)

- [x] **Phase 22: Per-Worker Compliance History** — cross-project violation history page, compliance history link per worker row (2/2 plans — 2026-03-24)



Archive: `.planning/milestones/v2.3-ROADMAP.md`



</details>



<details>

<summary>✅ v2.4 Ship-Ready + Design Elevation (Phases 23-28) — SHIPPED 2026-03-27</summary>



- [x] **Phase 23: Dashboard Compliance Filter + CSV Export** - Batch compliance summary endpoint, dashboard filter chips, and CSV download from compliance history (DASH-05, AUD-03) (completed 2026-03-24)

- [x] **Phase 24: California DIR A-1-131 Form** - DT schema migration, CA-specific project fields, CA certified payroll PDF generation with daily OT/DT model and eCPR disclosure (CAL-01, CAL-02, CAL-03) (completed 2026-03-25)

- [x] **Phase 25: Washington L&I F700-065-000 Form** - Manual rate entry for WA projects, WA trade code mapping, WA certified payroll PDF generation (WAL-01, WAL-02) (completed 2026-03-26)

- [x] **Phase 26: Contractor Guidance System** - HelpText primitive, contextual help across all major pages, instructional empty states, inline compliance term tooltips (UX-05, UX-06, UX-07, UX-08) (completed 2026-03-26)

- [x] **Phase 27: Design Elevation** - Construction photography, dark gold gradient overlays, elevated card shadows, richer typography matching HCC website standard (DES-01, DES-02, DES-03) (completed 2026-03-27)

- [x] **Phase 28: Production Deployment** - Render.com deployment with persistent SQLite disk, invite-only registration, environment variable hygiene, Vite static file serving (OPS-01, OPS-02, OPS-03, OPS-04) (completed 2026-03-27)



</details>



### v2.5 State Portal Integration (Phases 29-30) — SHIPPED 2026-03-27



- [x] **Phase 29: CA eCPR XML Export** - Fringe disaggregation DB columns + CA payroll UI, CA DIR eCPR XML download, pre-generation modal for missing fields, post-download portal checklist, amendment XML marker
 (completed 2026-03-27)

- [x] **Phase 30: WA PWIA Submission Assist** - WA CPR XML download gated on intentId + trade code validation, WA Intent to Pay + Affidavit submission summary panel (completed 2026-03-27)



<details>

<summary>✅ v3.0 Team & Integration (Phases 31-36) — SHIPPED 2026-03-31</summary>



- [x] **Phase 31: SSN Encryption Foundation** - AES-256-GCM encryption at rest, cryptoService.ts, key versioning envelope, CA eCPR XML updated to write real SSN (SEC-01, SEC-02, SEC-03) (completed 2026-03-28)

- [x] **Phase 32: Multi-User Auth Foundation** - project_members schema + assertProjectAccess refactor across 9 route files, cross-tenant test suite, createdByUserId/updatedByUserId on payroll_entries (MT-03) (completed 2026-03-28)

- [x] **Phase 33: Team Invite Flow + Team UI** - Email invite with tokenized link, team member list, ownership transfer, member removal with data retention (MT-01, MT-02, MT-04, MT-05) (completed 2026-03-30)

- [x] **Phase 34: Agency Submission Status Tracking** - caEcprSubmittedAt + waLniSubmittedAt columns, SubmissionStatusBadge, "Mark as Submitted" UI in CA/WA export modals (AS-01, AS-02) (completed 2026-03-30)

- [x] **Phase 35: Payroll Import — Server Pipeline** - importService.ts with provider auto-detection, qbMapper.ts + adpMapper.ts, preview + commit routes, payroll_imports audit table (PI-01, PI-02) (completed 2026-03-31)

- [x] **Phase 36: Payroll Import — React UI** - PayrollImportModal with file picker, preview table, unmatched worker review & match screen, confirm-commit flow (PI-03) (completed 2026-03-31)



Archive: `.planning/milestones/v3.0-ROADMAP.md`



</details>

## Phase Details



### Phase 17: DB Migration + Project Archive

**Goal**: The database is extended for submission and amendment features, and contractors can mark projects complete and hide them from the active dashboard

**Depends on**: Phase 16 (last shipped phase)

**Requirements**: PRJ-01, PRJ-02, PRJ-03

**Success Criteria** (what must be TRUE):

  1. User can click Archive on a project and it disappears from the main dashboard view

  2. User can toggle "Show Archived" on the dashboard and archived projects reappear with a visual badge

  3. System warns the user (advisory, not a block) if the project has open compliance violations before archiving

  4. User can restore an archived project back to active status

  5. The payrollWeeks table has submitted_at, submitted_to, amendment_number, and original_week_id columns available for subsequent phases

**Plans**: 2 plans

Plans:

- [x] 17-01-PLAN.md — DB migration (4 payrollWeeks columns) + status-filtered GET /api/projects route + tests

- [x] 17-02-PLAN.md — Archive/Restore UI (ProjectDetailPage buttons, compliance advisory modal, ProjectCard badge, DashboardPage toggle)



### Phase 18: Dashboard Search + Filter

**Goal**: Contractors can find specific projects instantly by name or funding type without scrolling through the full list

**Depends on**: Phase 17 (shares DashboardPage.tsx; archive toggle already added)

**Requirements**: DASH-03, DASH-04

**Success Criteria** (what must be TRUE):

  1. User can type in a search box on the dashboard and the project list filters to matching project names in real time

  2. User can select a funding type from a dropdown and the list shows only projects of that type

  3. Search and filter state survive back-navigation (browser back button returns to the same filtered view)

  4. When no projects match the active filters, a clear empty state message is shown (not a blank list)

**Plans**: 1 plan

Plans:

- [x] 18-01-PLAN.md — Search input + funding dropdown + useMemo filtered list + URL-persisted params + empty state (DashboardPage.tsx only)



### Phase 19: WH-347 Submission Tracking

**Goal**: Contractors can formally record when a WH-347 has been submitted and to whom, and the system enforces that submitted weeks are read-only

**Depends on**: Phase 17 (submitted_at, submitted_to columns from migration)

**Requirements**: SUB-01, SUB-02, SUB-03

**Success Criteria** (what must be TRUE):

  1. User can mark a payroll week as submitted by entering a submission date and agency name, and the week shows a submitted badge

  2. Attempting to edit payroll entries on a submitted week is rejected — both in the UI and at the API level

  3. User can un-submit a week to clear its submission status and re-enable editing

  4. PayrollListPage shows submitted/not-submitted status for each week at a glance

**Plans**: 2 plans

Plans:

- [x] 19-01-PLAN.md — Wave 0 tests + PATCH/DELETE submit routes + assertWeekNotSubmitted lock guard in both entry write routes

- [x] 19-02-PLAN.md — PayrollListPage submission badges + PayrollWeekDetailPage submit form + lock UI + WorkflowProgress step 4 fix (superseded — implemented in v7.0 milestone phases 83-106)



### Phase 20: Copy Previous Payroll Week

**Goal**: Contractors can pre-fill a new payroll week from the prior week's worker and hour data, with compliance-safe live rate re-fetch

**Depends on**: Phase 17 (migration complete; copy route must not carry submission flags from source week)

**Requirements**: PAY-01, PAY-02

**Success Criteria** (what must be TRUE):

  1. When creating a new payroll week, user can choose to copy from a previous week and the new week is pre-filled with the prior week's worker hours

  2. Copied entries use freshly fetched wage rates (not cloned snapshots from the source week)

  3. If any workers or classifications cannot be copied (worker inactive, rate lookup failed), the user sees a warning listing the skipped entries before confirming

  4. A successfully copied week can be edited normally before submission

**Plans**: 2 plans

Plans:

- [x] 20-01-PLAN.md — copyPayrollWeek() service + POST /api/payroll/weeks/copy route (preview + commit modes) + integration tests

- [x] 20-02-PLAN.md — Copy modal UI on PayrollListPage (source week selector, preview warning, confirm/cancel) + browser verification



### Phase 21: Payroll Amendment Workflow

**Goal**: Contractors can correct a submitted payroll week by creating a formal amendment that generates an amended WH-347 while preserving the original record

**Depends on**: Phase 17 (amendment_number, original_week_id columns), Phase 19 (Amend button only surfaces when week is submitted), Phase 20 (bulk entry copy pattern reused for amendment pre-fill)

**Requirements**: AMD-01, AMD-02, AMD-03

**Success Criteria** (what must be TRUE):

  1. User can click "Amend This Week" on a submitted payroll week, which creates a new amendment week pre-filled with the original week's hours

  2. The original submitted week remains visible and read-only after an amendment is created

  3. Downloading the WH-347 for an amendment week shows the payroll number in "N (AMENDED M)" format identifying the amendment sequence

  4. Multiple amendments to the same week are numbered sequentially (amendment 1, amendment 2, etc.)

**Plans**: 2 plans

Plans:

- [x] 21-01-PLAN.md — amendPayrollWeek() service + POST /weeks/amend route + "N (AMENDED M)" PDF label + integration tests

- [x] 21-02-PLAN.md — "Amend This Week" button on PayrollWeekDetailPage + amendment badge on PayrollListPage + browser verification



### Phase 22: Per-Worker Compliance History

**Goal**: Contractors can see a single page showing all compliance violations for a specific worker across every project and payroll week — ready for audit response

**Depends on**: Nothing (read-only reporting; fully independent of Phases 17-21)

**Requirements**: AUD-01, AUD-02

**Success Criteria** (what must be TRUE):

  1. User can click "Compliance History" next to any worker on the Workers page and land on a page showing all that worker's violations across all projects

  2. The violation list shows project name, payroll week, violation type, and the amounts involved for each entry

  3. A worker with no violations across any project shows a clear "no violations found" state

  4. Worker identity is correctly matched across projects using name and SSN last 4 (not project-scoped worker ID)

**Plans**: 2 plans

Plans:

- [x] 22-01-PLAN.md — getWorkerComplianceHistory() service + GET /worker/:workerId/history endpoint + multi-project integration tests (TDD) (superseded — implemented in v7.0 milestone phases 83-106)

- [x] 22-02-PLAN.md — WorkerComplianceHistoryPage + "Compliance History" link on WorkersPage + route registration + browser verification



### Phase 23: Dashboard Compliance Filter + CSV Export

**Goal**: Contractors can filter the dashboard by compliance status across all projects using a single batch API call, and can download a worker's compliance history as a CSV for audit submission

**Depends on**: Phase 22 (compliance history route must exist for CSV export to have data to export)

**Requirements**: DASH-05, AUD-03

**Success Criteria** (what must be TRUE):

  1. User can click a filter chip on the dashboard (All / Compliant / Has Violations / No Payroll / Archived) and the project list updates instantly without additional per-card fetches

  2. Selecting "Has Violations" shows only projects with at least one compliance violation across any payroll week

  3. Selecting "Compliant" shows only projects where all payroll weeks pass all compliance checks

  4. User can click "Download CSV" on the compliance history page and receive a UTF-8 BOM CSV file with 17 columns matching WH-347 field convention order

  5. The downloaded CSV opens correctly in Excel with columns aligned and no encoding artifacts

**Plans**: 2 plans

Plans:

- [x] 23-01-PLAN.md — Batch compliance summary endpoint + CSV export route + csv-stringify install + integration tests

- [x] 23-02-PLAN.md — Dashboard filter chips UI + CSV download button + browser verification



### Phase 24: California DIR A-1-131 Form

**Goal**: Contractors on California public works projects can generate a California DIR A-1-131 certified payroll PDF that correctly captures daily overtime and double-time hours per CA Labor Code requirements

**Depends on**: Phase 23 (independent of filter/CSV work, but Phase 23 is sequenced first as a quick win)

**Requirements**: CAL-01, CAL-02, CAL-03

**Success Criteria** (what must be TRUE):

  1. CA project creation form includes CSLB contractor license and WC policy number fields visible only when state is California

  2. Payroll entry for a CA project shows separate ST / OT / DT hour columns per day (Sun-Sat), where DT applies after 12 hours/day

  3. User can click "Download CA A-1-131" on a CA project's payroll week and receive a completed PDF with correct daily hour grid, fringe contributions in the fringe section (not deductions), and SDI deduction field

  4. The CA download preflight modal includes a persistent disclosure that electronic submission requires the DIR eCPR portal at efiling.dir.ca.gov/eCPR

  5. A WA or federal-only project has no CA form download button — the button is state-gated

**Plans**: 3 plans

Plans:

- [x] 24-01-PLAN.md — PDF download + DB migrations (DT columns + CA project fields) + schema.ts + server Zod schemas + test stubs

- [x] 24-02-PLAN.md — CA-conditional project fields in ProjectForm + DT columns in PayrollWeekForm + turn CAL-01/CAL-03 tests GREEN

- [x] 24-03-PLAN.md — A-1-131 PDF generator + export route + state-gated download button + eCPR preflight modal + browser verification (superseded — closed by Phase 53 CA gap-close)



### Phase 25: Washington L&I F700-065-000 Form

**Goal**: Contractors on Washington public works projects can enter WA prevailing wage rates manually and generate a Washington L&I F700-065-000 certified payroll PDF with correct WA trade code mapping

**Depends on**: Phase 24 (WA state form follows CA form pattern; CA establishes the state-specific project field and conditional download button pattern that WA reuses)

**Requirements**: WAL-01, WAL-02

**Success Criteria** (what must be TRUE):

  1. WA project workers have a manual prevailing wage rate entry field (since SAM.gov does not cover WA rates), and the entered rate is used for compliance and PDF generation

  2. User can click "Download WA F700-065-000" on a WA project's payroll week and receive a completed PDF with WA 4-letter trade codes (CARP, ELEC, LABO, etc.), UBI number, L&I certificate, and WC account fields populated

  3. The WA download includes a disclosure that Intent to Pay and Affidavit of Wages filings must be submitted via the PWIA portal at secure.lni.wa.gov

  4. WA trade codes not automatically matched show a dropdown allowing the contractor to select the correct L&I code per worker

  5. A CA or federal-only project has no WA form download button — the button is state-gated

**Plans**: 2 plans



### Phase 26: Contractor Guidance System

**Goal**: First-time contractors understand what to do at every step of the workflow without needing external documentation

**Depends on**: Phase 27 (HelpText primitive uses design tokens that Phase 27 finalizes — sequence after design tokens are locked; however if design tokens are locked early, Phase 26 can run before Phase 27)

**Requirements**: UX-05, UX-06, UX-07, UX-08

**Success Criteria** (what must be TRUE):

  1. The landing page includes a plain-language "how it works" section explaining Davis-Bacon compliance workflow in contractor terms, visible without scrolling below the hero

  2. Each major page (Dashboard, Project Detail, Workers, Payroll Entry, Payroll Week Detail) shows a contextual help callout explaining what to do at that step and why it matters for compliance

  3. Empty states on all pages give specific next-step instructions — a contractor who lands on an empty Workers page knows exactly what to do next, not just that there are no workers

  4. Clicking or tapping a "?" icon next to terms like "Davis-Bacon," "WH-347," "prevailing wage," "CWHSSA," and "WD" shows a plain-English definition — works on both desktop hover and iPad tap

**Plans**: 2 plans

Plans:

- [x] 26-01-PLAN.md — HelpCallout + TermTooltip primitives, landing page 4-step rewrite, HelpCallout on all 5 pages + PayrollListPage migration

- [x] 26-02-PLAN.md — Empty state content updates with action buttons + TermTooltip inline placement across all pages



### Phase 27: Design Elevation

**Goal**: The app visual design matches HCC website quality — construction photography, dark gold gradients, and elevated card depth that distinguishes HCC from generic compliance software

**Depends on**: Phase 23 (independent of form generation work; can begin any time after v2.3 baseline)

**Requirements**: DES-01, DES-02, DES-03

**Success Criteria** (what must be TRUE):

  1. The landing page hero features full-bleed construction photography with a dark overlay, Oswald display headline at clamp(56px, 8vw, 88px), and a high-contrast gold CTA button

  2. Dashboard project cards use an elevated shadow variant (0 8px 24px rgba(0,0,0,0.12)) visually distinct from the flat card used in v2.3

  3. All pages use tighter Oswald letter-spacing and improved vertical rhythm matching HCC website typography — no page uses a raw h1/h2 outside the PageHeader primitive

  4. Photography assets are WebP format, under 200KB each, loaded via CSS background-image (not Vite import), with a print media override preventing dark overlays from printing on white paper

**Plans**: 2 plans

Plans:

- [x] 27-01-PLAN.md — Shadow-card-elevated token + print CSS + PageHeader tracking-tight + ProjectCard className prop + HelpCallout shadow + h1 migration (7 pages)

- [x] 27-02-PLAN.md — Placeholder WebP photos + hero section rewrite (photo overlay, floating nav, clamp headline) + dashboard photo background strip + visual checkpoint



### Phase 28: Production Deployment

**Goal**: The app is live at a public HTTPS URL on Render.com with persistent data storage, invite-only registration, and all secrets properly configured via environment variables

**Depends on**: Phases 23-27 (all features complete; however Render service and disk infrastructure can be configured at any earlier phase)

**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04

**Success Criteria** (what must be TRUE):

  1. App is reachable at a public HTTPS URL and the landing page loads without errors

  2. A project created after the first deploy survives a second redeploy — confirming the SQLite database is on the persistent disk at /var/data and not the ephemeral container filesystem

  3. Attempting to register without a valid invitation code returns a clear error — open registration is disabled

  4. All secrets (SAM.gov API key, JWT secret, database path) are set as Render runtime environment variables and are absent from the deployed JavaScript bundle — no VITE_-prefixed secrets exist

  5. The Vite production build is served as static files by Express, and all React routes resolve correctly on hard refresh (SPA catch-all in place)

**Plans**: 2 plans

Plans:

- [x] 28-01-PLAN.md — Wave 0 invite code tests + tsconfig.server.json + build script + db mkdirSync fix + static file serving + invite code gate + .env.example + render.yaml

- [x] 28-02-PLAN.md — RegisterForm invite code field + brand token fix + Render deploy smoke test checkpoint



### Phase 29: CA eCPR XML Export

**Goal**: Contractors on California projects can generate a CA DIR eCPR-compliant XML file with correctly disaggregated fringe line items, with guided handling of missing fields, a post-download checklist, and correct amendment markers

**Depends on**: Phase 28 (all v2.4 features shipped; xmlbuilder2 install is the first task)

**Requirements**: CAE-01, CAE-02, CAE-03, CAE-04

**Success Criteria** (what must be TRUE):

  1. Payroll entry for a CA project shows four separate fringe contribution fields — health/welfare, pension, vacation, and training — each stored as its own DB column per entry

  2. User can click a CA eCPR XML export button on a CA project's payroll week; if contractor FEIN, DIR project ID, awarding agency, or contract number are absent, a pre-generation modal collects them before the file is generated

  3. After the XML file downloads, the app displays a step-by-step portal upload checklist informing the contractor how to submit to the CA DIR eCPR portal, including the disclosure that SSNs must be entered directly in the portal

  4. When the payroll week is an amendment (created via the v2.3 amendment workflow), the exported XML carries the correct amendment/resubmit marker — a non-amendment week produces no amendment marker

  5. A WA or federal-only project has no CA eCPR XML export button — the export is state-gated to CA projects only

**Plans**: 3 plans

Plans:

- [x] 29-01-PLAN.md — xmlbuilder2 install + DB migration (8 columns) + schema + extended payroll join + CA fringe entry UI

- [x] 29-02-PLAN.md — ecprXmlGenerator.ts (CPR.xsd v1.3 XML) + unit tests + GET /api/export/ecpr-xml/:weekId route

- [x] 29-03-PLAN.md — CA eCPR XML download button + 2-step pre-generation modal + post-download portal checklist



### Phase 30: WA PWIA Submission Assist

**Goal**: Contractors on Washington projects can generate a WA L&I CPR XML file gated on their PWIA intent ID and validated trade codes, and can view a pre-populated submission summary for Intent to Pay and Affidavit of Wages portal entry

**Depends on**: Phase 29 (shared getPayrollEntriesWithWorkerDetails() join and xmlbuilder2 pattern established in Phase 29)

**Requirements**: WAL-03, WAL-04

**Success Criteria** (what must be TRUE):

  1. Before generating a WA CPR XML file, the app requires the contractor to enter their PWIA Intent ID (issued after Statement of Intent approval); generation is blocked until the ID is provided, with a link to the PWIA portal

  2. If any worker on the WA project has a missing or unconfirmed WA trade code, the app surfaces those workers by name and blocks XML generation until the codes are resolved

  3. User can download a WA L&I CPR XML file for a WA project's payroll week; the file is gated to WA projects only

  4. User can view a WA submission assist summary panel — pre-populated with trade codes, hours by day, rates, and gross pay per worker — formatted as a reference for manual entry into the PWIA portal's Intent to Pay and Affidavit of Wages forms

  5. The submission assist panel is clearly labeled as a data-entry guide, not a submission mechanism; no HTTP calls are made to PWIA portal domains from the app backend

**Plans**: 3 plans

Plans:
- [x] 30-01-PLAN.md — DB migration (pwia_intent_id column) + Wave 0 test stubs (RED)
- [x] 30-02-PLAN.md — waCprXmlGenerator.ts pure function + GET /api/export/wa-cpr-xml/:weekId route + tests GREEN
- [x] 30-03-PLAN.md — PayrollWeekDetailPage UI: trade code gate + intentId modal + WA CPR XML download + WAL-04 submission summary panel

**UI hint**: yes


_v3.0 phase details archived to `.planning/milestones/v3.0-ROADMAP.md`_

### Phase 37: Audit Trail Foundation

**Goal**: An append-only audit log table exists in the database and a single `auditService.ts` provides the `insertAuditLog()` function with SSN redaction and hybrid diff/snapshot payload strategy. No existing behavior changes - this phase only creates the infrastructure that Phase 38 wires up.

**Depends on**: Phase 36 (v3.0 complete; service layer patterns established)

**Requirements**: AUDIT-01, AUDIT-02, NFR-01, NFR-04, NFR-05

**Success Criteria** (what must be TRUE):
  1. The `audit_logs` table exists in the DB with all required columns (id as UUIDv4, createdAt UTC, userId, userEmail, ipAddress, projectId, entityType, entityId, action, diff, snapshot, meta) and three indexes on (project_id, created_at DESC), (entity_type, entity_id, created_at DESC), (user_id, created_at DESC)
  2. `auditService.ts` exports only `insertAuditLog()` - no update or delete functions exist on the module
  3. Calling `insertAuditLog()` with a worker payload that includes `ssnEncrypted` writes `"[REDACTED]"` to the diff column, not the encrypted value
  4. The Drizzle schema file reflects the new table and the migration file uses `-->  statement-breakpoint` separators

**Plans**: 2 plans

Plans:
- [x] 37-01-PLAN.md — Schema + migration: audit_logs table, 3 indexes, journal entry (2026-04-01)
- [x] 37-02-PLAN.md — auditService.ts + tests: insertAuditLog(), diffObjects(), SSN redaction

---

### Phase 38: Audit Trail Wiring + Activity UI

**Goal**: All Tier-1 compliance actions (worker CRUD, payroll entry CRUD, submissions, downloads, imports) are wired to `insertAuditLog()` in the service layer, and project members can view a reverse-chronological activity feed with date-range filtering.

**Depends on**: Phase 37 (audit_logs table and auditService must exist before any wiring)

**Requirements**: AUDIT-03, AUDIT-04, AUDIT-05, NFR-03

**Success Criteria** (what must be TRUE):
  1. Creating, editing, or deleting a worker or payroll entry produces an audit log row with correct entityType, entityId, action, actor userId/email, and diff/snapshot payload
  2. Downloading a WH-347, CA eCPR XML, WA CPR XML, or marking any week as submitted produces an audit log row with a meta-only payload
  3. User can navigate to `/projects/:id/activity` and see a reverse-chronological timeline of all project events with actor email, human-readable action description, and timestamp
  4. User can filter the activity feed by date range and the URL updates so the filtered view is bookmarkable
  5. The `GET /api/audit/:projectId` endpoint returns 403 for non-members and paginates at 25 rows per page

**Plans**: 3 plans

Plans:
- [x] 38-01-PLAN.md — Service wiring: workerService.ts + payroll entry audit + export/submission/import audit + trust proxy
- [x] 38-02-PLAN.md — GET /api/audit/:projectId route with assertProjectAccess, pagination, date filter
- [x] 38-03-PLAN.md — ProjectActivityPage React component + route wiring + ProjectDetailPage nav link
**UI hint**: yes

---

### Phase 39: Worker Profile Depth

**Goal**: Worker records support structured addresses (replacing the freetext field), union local and book number, apprenticeship committee details, and per-week trade classification overrides - giving contractors the richer data model required for NY, IL, and audit-readiness.

**Depends on**: Phase 37 (audit trail is live so worker schema changes are logged from the start)

**Requirements**: WORKER-01, WORKER-02, WORKER-03, WORKER-04, NFR-01, NFR-05

**Success Criteria** (what must be TRUE):
  1. The worker form on WorkersPage shows four separate address inputs (street, city, state, zip); existing workers with data in the old `address` text column have that value backfilled into `addressStreet`
  2. WorkersPage shows a "Union Information" section with optional Union Local and Book Number fields for any worker
  3. WorkersPage shows an "Apprenticeship" section with Committee and Registration Number fields that are only visible when the worker's labor type is "apprentice"
  4. On PayrollWeekDetailPage, each worker row has a "Change Classification for This Week" override dropdown; WH-347 uses the week-specific classification when set, falling back to the worker's default
  5. The `payroll_week_classifications` table exists and the WH-347 generator correctly reads week-specific classifications over default classifications

**Plans**: 2 plans
Plans:
- [x] 39-01-schema-server.md -- SQL migration + Drizzle schema + workerService + routes + payrollService override JOIN + new classification override endpoints
- [x] 39-02-react-ui.md -- WorkersPage structured address/union/apprenticeship form + PayrollWeekDetailPage classification override dropdown
**UI hint**: yes

---

### Phase 40: NY Schema + Compliance Rule

**Goal**: New York is a selectable project state, the database has all NY-specific fields, and the compliance engine enforces the NY 8-hours/day overtime rule on NY projects - so the foundation is correct before any PDF or XML is generated.

**Depends on**: Phase 39 (worker schema stabilized; nysRegisteredApprentice is a worker column added here)

**Requirements**: STATE-01, STATE-06, STATE-04, NFR-01, NFR-05

**Success Criteria** (what must be TRUE):
  1. The project creation and edit form includes "NY" as a selectable state alongside CA and WA
  2. NY projects store `nyprcNumber` and `nysContractorRegNumber` fields on the project record; the project form surfaces these fields when state is NY
  3. Workers on any project have a `nysRegisteredApprentice` boolean field visible in their profile
  4. For an NY project payroll week where a worker exceeds 8 hours on any single day, `computeCompliance()` flags a CWHSSA OT violation and PayrollWeekDetailPage shows the violation badge - a worker with exactly 8 hours/day has no OT violation flagged

**Plans**: 3 plans
Plans:
- [x] 40-01-PLAN.md — Migration 0023 + Drizzle schema (NY project + worker columns)
- [x] 40-02-PLAN.md — Server routes + React forms (NY project fields + nysRegisteredApprentice)
- [x] 40-03-PLAN.md — Compliance engine NY daily OT rule + integration tests
**UI hint**: yes

---

### Phase 41: NY State Forms

**Goal**: Contractors on NY projects can generate a PW-12 PDF for offline records and an MPWR-compliant XML file for portal upload, and a 3-step modal guides them through the MPWR submission checklist.

**Depends on**: Phase 40 (NY schema and compliance rule must exist before generators can use nyprcNumber, nysContractorRegNumber, nysRegisteredApprentice, and daily OT data)

**Requirements**: STATE-02, STATE-03, STATE-05, NFR-03

**Success Criteria** (what must be TRUE):
  1. Clicking "Download NY PW-12" on an NY project payroll week generates a PDF with contractor header fields, per-employee rows (name + last4 SSN, classifications with ST/OT, Mon-Sun daily hours, rate, gross pay, deductions, net wages), and the Statement of Compliance certification text including fringe sub-clauses (b) and (c)
  2. Clicking "Download NY MPWR XML" generates an XML file that includes PRC Number, NYS Contractor Registration Number, `nysRegisteredApprentice` boolean per worker, and supplement type rates with separate ST/OT hourly rates
  3. Workers without a full SSN on file produce `000000` + last4 as a placeholder in the XML (same pattern as CA eCPR)
  4. The NY MPWR submission modal is a 3-step flow: Step 1 collects/persists PRC Number + NYS Contractor Registration Number, Step 2 downloads XML + PW-12, Step 3 shows the MPWR portal checklist with the 30-day deadline reminder
  5. "Mark as Submitted to NY MPWR" writes an `agency_submissions` row and the button is only visible on NY projects

**Plans**: 5 plans

Plans:
- [x] 41-01-PLAN.md — Migration + getPayrollEntriesWithWorkerDetails patch
- [x] 41-02-PLAN.md — MPWR XML generator (TDD)
- [x] 41-03-PLAN.md — PW-12 PDF generator (TDD)
- [x] 41-04-PLAN.md — Export routes + route tests
- [x] 41-05-PLAN.md — PayrollWeekDetailPage NY modal
**UI hint**: yes

---

### Phase 42: IL Schema + Project Flag

**Goal**: Illinois is a selectable project state and the database has all IL-specific columns - non-PW hours on payroll entries and demographic fields on workers - so the IL PDF generator and UI can use real data.

**Depends on**: Phase 39 (worker schema stabilized before demographic columns are added)

**Requirements**: STATE-07, STATE-09, STATE-10, NFR-01, NFR-05

**Success Criteria** (what must be TRUE):
  1. The project creation and edit form includes "IL" as a selectable state
  2. For IL projects, the payroll entry form on PayrollWeekDetailPage shows a "Non-PW Hours" decimal input per worker row; the value is stored in `nonPwHours` on the payroll entry
  3. WorkersPage shows a collapsible "IL Compliance Demographics" section for IL projects with nullable fields for race, ethnicity, gender, veteran status, and skill level (journeyman / apprentice); the section is hidden for non-IL projects
  4. The Drizzle schema and migration reflect both new columns with `-->  statement-breakpoint` separators

**Plans**: 3 plans
Plans:
- [x] 42-01-PLAN.md — DB migration + Drizzle schema (6 IL columns)
- [x] 42-02-PLAN.md — Server routes + services (workers demographics + nonPwHours)
- [x] 42-03-PLAN.md — React UI (ProjectForm, WorkersPage, PayrollWeekForm, PayrollWeekDetailPage)
**UI hint**: yes

---

### Phase 43: IL State Forms

**Goal**: Contractors on IL projects can generate a two-page IL DOL Certified Transcript of Payroll PDF and a 2-step modal guides them through the IDOL portal submission checklist.

**Depends on**: Phase 42 (IL schema must exist so the PDF generator can access nonPwHours and demographic fields)

**Requirements**: STATE-08, STATE-11, NFR-03

**Success Criteria** (what must be TRUE):
  1. Clicking "Download IL Certified Transcript" on an IL project payroll week generates a two-page PDF: page 1 has contractor/project header and per-employee rows with PW hours, non-PW hours, base rate, fringe rates (Pension/Health+Welfare/Vacation/Training with "F" fund flags), gross pay, deductions, and net pay; page 2 has the affidavit with subcontractor list and fund details fields
  2. The daily hour columns on the PDF distinguish PW hours from non-PW hours for each employee
  3. The IL IDOL submission modal is a 2-step flow: Step 1 downloads the IL Certified Transcript PDF, Step 2 shows the IDOL portal checklist (due by 15th of following month, portal URL, Excel template note)
  4. "Mark as Submitted to IL IDOL" writes an `agency_submissions` row and the button is only visible on IL projects

**Plans**: 4 plans
Plans:
- [x] 43-01-PLAN.md — Migration + schema (ilIdolSubmittedAt) + setIlIdolSubmitted service
- [x] 43-02-PLAN.md — IL Certified Transcript PDF generator (TDD)
- [x] 43-03-PLAN.md — Export route + submit route + integration tests
- [x] 43-04-PLAN.md — Frontend 2-step IL IDOL modal + human verification
**UI hint**: yes

---

### Phase 44: Import Provider Foundation

**Goal**: The `payroll_provider_mappings` table is in place, Gusto CSV imports work end-to-end using name matching, and the import modal auto-detects the provider from column signatures and shows a provider badge.

**Depends on**: Phase 36 (existing preview-then-commit pipeline and importService.ts must be stable before adding new providers; mappings table must be created before Phase 45 parsers can use it)

**Requirements**: IMPORT-04, IMPORT-01, IMPORT-06, NFR-01, NFR-05

**Success Criteria** (what must be TRUE):
  1. The `payroll_provider_mappings` table exists with columns (id, projectId, provider, providerWorkerId, workerId, createdAt) and a UNIQUE constraint on (projectId, provider, providerWorkerId)
  2. Uploading a Gusto Payroll Journal Report CSV (with `Employee first name`, `Employee last name`, `Payroll end date`, `Regular hours`, `Overtime hours`) processes correctly through the existing matched/unmatched preview flow
  3. If required Gusto columns are missing, the import rejects with a clear error listing the missing columns by name
  4. The Step 2 header of the import modal shows a provider badge (Gusto / Paychex / Sage / QB / ADP) based on column signature detection; if detection is ambiguous, a manual provider dropdown appears

**Plans**: 3 plans
Plans:
- [x] 44-01-PLAN.md — DB migration + schema + types (payrollProviderMappings table, ImportProvider union)
- [x] 44-02-PLAN.md — Gusto CSV parser + importService integration + tests
- [x] 44-03-PLAN.md — Provider badge UI + Gusto weekly-totals banner
**UI hint**: yes

---

### Phase 45: Import ID-Mapped Providers

**Goal**: Paychex Flex and Sage 300 CRE CSV imports work end-to-end, with a Step 2b "Map Employees" screen that lets contractors link numeric provider worker IDs to internal workers; mappings persist for future imports.

**Depends on**: Phase 44 (payroll_provider_mappings table and provider detection badge must exist before Paychex/Sage parsers are added)

**Requirements**: IMPORT-02, IMPORT-03, IMPORT-05, NFR-03

**Success Criteria** (what must be TRUE):
  1. Uploading a Paychex Flex CSV aggregates rows per Worker ID (summing Regular and Overtime `Hours` by `Pay Component`) and produces correct regular/OT hour totals per worker for the week
  2. Uploading a Sage 300 CRE time entry CSV detects unique PayID codes and requires the contractor to classify each as Regular, Overtime, or Double Time before proceeding
  3. For Paychex and Sage 300 imports, the import modal inserts a Step 2b "Map Employees" table between preview parse and the existing preview table; rows with unmapped provider IDs are shown as skipped with a count in the summary
  4. After a contractor confirms a mapping, subsequent imports of the same provider automatically match previously mapped workers without showing the mapping step for already-known IDs
  5. Mappings are project-scoped - a Paychex Worker ID mapped on Project A does not auto-map on Project B

**Plans**: 3 plans
Plans:
- [x] 45-01-PLAN.md — Paychex + Sage parsers, detectProvider + parseImportFile ID-match path
- [x] 45-02-PLAN.md — GET/POST mapping API routes on importRouter
- [x] 45-03-PLAN.md — Step 2b Map Employees UI in import modal
**UI hint**: yes

---

### Phase 46: Notifications

**Goal**: Project owners and members receive email notifications for compliance violations, upcoming payroll due dates, team member activity, and submission confirmations; owners can configure which notifications fire per project via a settings panel.

**Depends on**: Phase 41, Phase 43 (NY MPWR and IL IDOL submission events referenced in NOTIF-04 must exist; NOTIF-05 settings schema is added here)

**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NFR-02, NFR-05

**Success Criteria** (what must be TRUE):
  1. When `computeCompliance()` detects a new violation on a payroll week, all project members receive an email listing the affected workers, violation type (under-wage or CWHSSA OT), and a link to PayrollWeekDetailPage; email failure logs to console and does not 500 the request
  2. When a payroll week end date is within the configured due-soon threshold (default 3 days, stored in `projects.settings`), the project owner receives a reminder email; the threshold is configurable 1-7 days
  3. When a non-owner team member creates or modifies a payroll entry or worker record, the project owner receives one summary email per save action
  4. When any agency submission is marked (CA DIR, WA L&I, NY MPWR, IL IDOL), the acting user receives a confirmation email with submission date, agency name, and project name
  5. ProjectDetailPage has a gear-icon settings panel where the project owner can enable/disable each notification type and set the due-soon threshold; settings persist in `projects.settings` JSON column

**Plans**: 3 plans
Plans:
- [x] 46-01-PLAN.md — emailService.ts violation/reminder/activity/submission triggers + notifService wrapper (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 46-02-PLAN.md — notifSettings schema in projects.settings + due-soon cron scan (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 46-03-PLAN.md — ProjectDetailPage notification prefs panel (superseded — implemented in v7.0 milestone phases 83-106)
**UI hint**: yes

---

### Phase 47: State Foundations + TX Certified Payroll

**Goal**: The codebase is safe for 8-state expansion (STATE_FORMS registry replacing per-state boolean blocks + normalized .toUpperCase() comparisons throughout) and Texas contractors can download a WH-347 with TX-specific header fields overlaid and an LCPtracker submission callout

**Depends on**: Phase 46 (v4.0 complete; NFR-06 mandates this phase is committed before any other new-state phase is planned or executed)

**Requirements**: STATE-12, STATE-13, TX-01, TX-02, NFR-06

**Success Criteria** (what must be TRUE):
  1. PayrollWeekDetailPage replaces the four individual isCA/isWA/isNY/isIL boolean download-button blocks with a STATE_FORMS registry object keyed by state code — adding a new state requires one registry entry, not a new JSX conditional block
  2. All state comparisons across client and server use .toUpperCase() consistently — a project stored as lowercase in the DB still passes the correct state gate
  3. TX appears as a selectable project state; the TX project form surfaces TxDOT contract number, awarding agency name, and project location fields when state is TX
  4. Clicking the WH-347 download on a TX project downloads a correctly populated WH-347 with TX header fields overlaid
  5. PayrollWeekDetailPage on a TX project shows an informational callout noting that Texas requires electronic submission via LCPtracker at lcp123.com, with a link to the TxDOT contractor compliance page

**Plans**: 4 plans
Plans:
- [x] 47-01-PLAN.md — STATE-13 case normalization (7 one-line changes + integration tests)
- [x] 47-02-PLAN.md — STATE_FORMS registry refactor + TX entry (STATE-12, NFR-06)
- [x] 47-03-PLAN.md — TX database migration + schema + project form + WH-347 overlay (TX-01)
- [x] 47-04-PLAN.md — TX LCPtracker callout (TX-02)
**UI hint**: yes

---

### Phase 48: FL Certified Payroll

**Goal**: Florida contractors can download a WH-347 for FL projects and understand why there is no state-specific form — FL is a clean smoke test confirming the Phase 47 state gate pattern is correct before the more complex MA and NJ builds begin

**Depends on**: Phase 47 (STATE_FORMS registry and .toUpperCase() normalization must be committed first per NFR-06)

**Requirements**: FL-01

**Success Criteria** (what must be TRUE):
  1. FL appears as a selectable project state
  2. Clicking the WH-347 download on an FL project downloads a correctly populated WH-347
  3. PayrollWeekDetailPage on an FL project shows an informational callout explaining that Florida has no state-specific certified payroll form and federal Davis-Bacon WH-347 applies
  4. The FL callout is absent on non-FL projects — it is state-gated

**Plans**: 1 plan
Plans:
- [x] 48-01-PLAN.md — FL STATE_FORMS entry + isFL booleans + informational HelpCallout
**UI hint**: yes

---

### Phase 49: MA Schema + UI

**Goal**: Massachusetts is a selectable project state, the database has all MA-specific columns for workers and payroll entries, and the UI surfaces these fields correctly on MA projects — the complete data foundation before the PDF generator is written in Phase 50

**Depends on**: Phase 47 (STATE_FORMS registry must exist; NFR-06 requires Phase 47 committed before any new state phase)

**Requirements**: MA-01, MA-02, MA-03, NFR-01

**Success Criteria** (what must be TRUE):
  1. MA appears as a selectable project state; the MA project form shows MA DLS Project ID and MA SIC/Trade Code fields when state is MA
  2. WorkersPage for MA (and NJ) projects shows isWoman, isMinority, and oshaTraining nullable boolean fields per worker; these fields are absent on non-MA/NJ projects
  3. PayrollWeekDetailPage for MA projects shows checkNumber (text), allOtherHours (decimal), and totalWeekGrossWages (decimal) per worker row; these fields are absent on non-MA projects
  4. MA projects show a state-gated "Download MA DLS Weekly Payroll" button on PayrollWeekDetailPage (wired to the generator in Phase 50)
  5. The Drizzle schema and migrations reflect all new columns with correct statement-breakpoint separators

**Plans**: 3 plans

Plans:
- [x] 49-01-PLAN.md -- DB migration + Drizzle schema + WorkersPage MA/NJ demographics
- [x] 49-02-PLAN.md -- Payroll service + route MA fields + select expansion
- [x] 49-03-PLAN.md -- ProjectForm MA fields + STATE_FORMS registry + export route stub
**UI hint**: yes

---

### Phase 50: MA PDF Generator

**Goal**: Contractors on MA projects can generate a complete MA DLS Weekly Certified Payroll Report PDF that satisfies Massachusetts prevailing wage submission requirements to the awarding authority

**Depends on**: Phase 49 (MA schema and UI must exist so the generator can read isWoman, isMinority, oshaTraining, checkNumber, allOtherHours, totalWeekGrossWages from the database)

**Requirements**: MA-04, NFR-03

**Success Criteria** (what must be TRUE):
  1. Clicking "Download MA DLS Weekly Payroll" on an MA project generates a PDF with contractor header (name, FEIN, address, license) and project header (name, location, contract number, week ending)
  2. Per-worker rows include the OSHA 10 checkbox, isWoman and isMinority columns, supplemental unemployment fringe sub-column, project gross pay, total-week gross pay, and check number
  3. The PDF includes a Statement of Compliance page with MA-specific certification language
  4. The route returns 400 for a non-MA weekId — the download button is state-gated and the server enforces the same gate
  5. maPdfGenerator.ts uses PDFDocument.create() (programmatic draw, not template overlay) following the ilPdfGenerator.ts pattern

**Plans**: 2 plans

Plans:
- [x] 50-01-PLAN.md — maPdfGenerator.ts: test stubs + programmatic PDF generator (PDFDocument.create)
- [x] 50-02-PLAN.md — Export route wiring (replace 501 stub) + integration tests

---

### Phase 51: NJ Schema + Routes

**Goal**: New Jersey is a selectable project state, the database has the NJ contractor registration number field and the workerSex nullable column, and NJ-specific UI fields are surfaced on NJ projects — foundation complete before the PDF generator is written in Phase 52

**Depends on**: Phase 47 (STATE_FORMS registry; NFR-06); Phase 49 (MA worker columns establish the pattern for nullable worker demographic columns)

**Requirements**: NJ-01, NJ-02, NFR-01

**Success Criteria** (what must be TRUE):
  1. NJ appears as a selectable project state; the NJ project form shows NJ Public Works Contractor Registration Number (njPwcNumber) and NJ Contract ID fields when state is NJ
  2. WorkersPage for NJ projects shows a workerSex field (M / F / N / null options) per worker; the field is absent on non-NJ projects
  3. NJ projects show a state-gated "Download NJ MW-562" button on PayrollWeekDetailPage (wired to the generator in Phase 52)
  4. workerSex is a separate nullable text column in the workers table — it does not reuse the existing gender column from v4.0 IL demographics

**Plans**: 2 plans

Plans:
- [x] 51-01-PLAN.md — Migration + schema + server routes + NJ integration tests
- [x] 51-02-PLAN.md — Client UI: ProjectForm NJ block, WorkersPage workerSex, STATE_FORMS NJ entry

**UI hint**: yes

---

### Phase 52: NJ PDF Generator

**Goal**: Contractors on NJ projects can generate a complete NJ MW-562 Payroll Certification for Public Works Projects PDF that satisfies New Jersey prevailing wage submission requirements

**Depends on**: Phase 51 (NJ schema must exist so the generator can read njPwcNumber, workerSex, race, and ethnicity from the database)

**Requirements**: NJ-03, NFR-03

**Success Criteria** (what must be TRUE):
  1. Clicking "Download NJ MW-562" on an NJ project generates a PDF with contractor header including NJ Public Works Contractor Registration Number
  2. Per-worker rows include EEO columns: workerSex (M/F/N), race using NJ 6-code system (W/B/A/N/I/M), and ethnicity (H/N) — drawing from the existing race/ethnicity columns (v4.0 IL) and the new workerSex column
  3. The PDF includes FICA, federal income tax, and state income tax deduction columns per worker
  4. The PDF includes the NJ-specific Statement of Compliance certification language
  5. The route returns 400 for a non-NJ weekId — the download button is state-gated and the server enforces the same gate

**Plans**: 2 plans

Plans:
- [x] 52-01-PLAN.md — DB migration (NJ deduction columns), payrollService extension (EEO fields), PayrollEntryPage NJ deduction UI
- [x] 52-02-PLAN.md — njPdfGenerator.ts (programmatic draw, EEO + deduction columns, NJ compliance text), export route completion

---

### Phase 53: CA A-1-131 Gap Close

**Goal**: The existing CA A-1-131 PDF generator is verified correct by a human reviewing the output in a browser — the Phase 24 Plan 03 Task 3 gap that has been open since v2.4 is formally closed before v5.0 ships

**Depends on**: Phase 52 (placed here to close the long-open gap before final integration; does not block any other v5.0 phase)

**Requirements**: CA-02

**Success Criteria** (what must be TRUE):
  1. A CA project with at least one payroll week with entries is used to download an A-1-131 PDF from the running dev server
  2. All field coordinates are visually confirmed correct: contractor header fields, per-worker rows, fringe section, SDI deduction field, and certification text
  3. Any coordinate corrections discovered are applied to a1131Generator.ts and the corrected PDF is re-verified before closing the phase
  4. The CA UI flow is confirmed working: CSLB/WC advisory modal appears on CA projects, DT hour columns are visible on CA projects only, and the WH-347 download still works alongside the CA button

**Plans**: 2 plans

Plans:
- [x] 53-01-PLAN.md — Fix CA button routing bug (modal bypass) + add ca_pdf.downloaded audit log
- [x] 53-02-PLAN.md — Browser verification of A-1-131 PDF field coordinates; apply any corrections

---

### Phase 54: Subcontractor Schema + Migrations

**Goal**: The subcontractors and subcontractor_cpr_weeks tables exist in the database with correct foreign keys, cascade delete rules, and unique constraints — the data model foundation that all subcontractor routes and UI depend on

**Depends on**: Phase 46 (v4.0 complete; insertAuditLog() available for sub audit events from Phase 37)

**Requirements**: SUB-01, SUB-02, NFR-01

**Success Criteria** (what must be TRUE):
  1. The subcontractors table exists with columns: id (UUID PK), projectId (FK to projects with CASCADE DELETE), name (NOT NULL), licenseNumber, contactName, contactEmail, address, createdAt
  2. The subcontractor_cpr_weeks table exists with columns: id (UUID PK), subcontractorId (FK to subcontractors with CASCADE DELETE), weekEndingDate (NOT NULL), receivedDate, isCompliant, notes, createdAt; a UNIQUE constraint exists on (subcontractorId, weekEndingDate)
  3. The Drizzle schema file reflects both new tables
  4. Migration files are registered in drizzle/meta/_journal.json and use correct statement-breakpoint separators

**Plans**: 1 plan

Plans:
- [x] 54-01-PLAN.md — Migration SQL (0032_subcontractor_schema.sql) + journal registration (idx 28) + Drizzle schema exports for subcontractors and subcontractorCprWeeks

---

### Phase 55: Subcontractor API Routes

**Goal**: The server exposes a complete CRUD and CPR tracking API for subcontractors, with assertProjectAccess guarding every route and audit log entries written for sub lifecycle events

**Depends on**: Phase 54 (tables must exist before routes can query them)

**Requirements**: SUB-03, SUB-04, NFR-03

**Success Criteria** (what must be TRUE):
  1. GET /api/projects/:id/subcontractors returns all subs for the project; POST creates a sub; PATCH updates a sub; DELETE removes a sub — all four routes call assertProjectAccess before any DB access
  2. GET /api/projects/:id/subcontractors/:subId/cpr-weeks returns CPR week records; POST creates a CPR week record; PATCH updates receivedDate, isCompliant, and notes on an existing record
  3. A request from a user without project membership receives a 403 on every sub and CPR route
  4. Creating and removing a sub writes audit log rows with action subcontractor.created and subcontractor.removed with correct meta payload

**Plans**: 1 plan

Plans:
- [x] 55-01-PLAN.md — RED test scaffold + subcontractors.ts route file (7 handlers: SUB-03 CRUD + SUB-04 CPR-week tracking) + mount in index.ts

---

### Phase 56: Subcontractor UI Panel

**Goal**: General contractors can manage subcontractors per project and track CPR receipt and compliance status per payroll week from a dedicated panel on ProjectDetailPage — making the prime contractor liability visible and actionable without leaving the project view

**Depends on**: Phase 55 (API routes must exist before the panel can fetch or mutate data)

**Requirements**: SUB-05

**Success Criteria** (what must be TRUE):
  1. ProjectDetailPage has a Subcontractors panel listing all subs for the project with add, edit, and remove controls
  2. Each sub is expandable to a CPR week table; each row shows a status badge: Received + Compliant, Received + Non-Compliant, Not Received, or Overdue
  3. A payroll week row is marked Overdue when weekEndingDate is more than 7 days ago and CPR has not yet been received
  4. The user can mark a week as Received or Non-Compliant and optionally save a notes field — the status badge updates immediately
  5. Subcontractor entries are never mixed into GC worker counts, totals, or compliance roll-ups shown elsewhere on the page

**Plans**: 1 plan

Plans:
- [x] 56-01-PLAN.md — getCprStatus pure function (cprStatus.ts) + SubcontractorsPanel inline component in ProjectDetailPage with add/edit/remove subs, expandable CPR week table, status badges, and mark received/compliant actions

---

### Phase 57: Audit Log CSV Export

**Goal**: Contractors can download the complete project activity log as a CSV file safe for hand-off to auditors or agencies, with formula injection protection ensuring the file opens cleanly in Excel

**Depends on**: Phase 38 (audit_logs table and paginated GET /api/audit/:projectId route must exist); Phase 55 (sub audit events are live so the exported log is complete for all v5.0 actions)

**Requirements**: RPT-01, NFR-07

**Success Criteria** (what must be TRUE):
  1. GET /api/audit/:projectId/csv returns a UTF-8 BOM CSV file with columns: timestamp, actor email, action, entity type, entity ID, description
  2. The /csv route is registered before the /:projectId wildcard in audit.ts and does not conflict with the existing paginated endpoint
  3. A cell value beginning with =, +, -, or @ has a space character prepended — the file opens in Excel without formula execution prompts
  4. ProjectActivityPage shows a "Download CSV" button in the page header toolbar alongside the existing date filter; the button is absent for non-members

**Plans**: 1 plan

Plans:
- [x] 57-01-PLAN.md — GET /api/audit/:projectId/csv route + UTF-8 BOM + formula injection sanitization + ProjectActivityPage download button (superseded — implemented in v7.0 milestone phases 83-106)
**UI hint**: yes

---

### Phase 58: Enhanced Fringe Report

**Goal**: Contractors can view fringe benefit totals broken down by fund type (health/welfare, pension, vacation, training), union local, and journeyman vs apprentice split — providing the detail needed for union benefit fund reconciliation reports

**Depends on**: Phase 46 (fringe disaggregation columns on payrollEntries and unionLocal on workers exist from prior milestones; all source data is already in the database)

**Requirements**: RPT-02

**Success Criteria** (what must be TRUE):
  1. ReportsPage has a new "Fringe Breakdown" tab alongside the existing fringe summary and pay history tabs
  2. The Fringe Breakdown tab shows fringe totals grouped by fund type, with each group further split by union local and by journeyman vs apprentice
  3. GET /api/projects/:id/reports/fringe-enhanced returns the breakdown data; the existing GET /api/projects/:id/reports/fringe-summary route and its response shape are not modified
  4. getFringeBreakdown() in reportsService.ts is a new exported function added alongside the existing getFringeSummary() — it does not alter or wrap getFringeSummary()

**Plans**: 1 plan

Plans:
- [x] 58-01-PLAN.md — getFringeBreakdown() service + GET /api/projects/:id/reports/fringe-enhanced + ReportsPage Fringe Breakdown tab (superseded — implemented in v7.0 milestone phases 83-106)
**UI hint**: yes

---

### Phase 59: Multi-Project Compliance PDF

**Goal**: Contractors can download a single PDF snapshot covering all their active projects — a portfolio-level compliance view suitable for owner reporting, bonding requirements, or agency audit response

**Depends on**: Phase 54 (subcontractor_cpr_weeks table must exist so the report can include CPR overdue counts per project)

**Requirements**: RPT-03

**Success Criteria** (what must be TRUE):
  1. DashboardPage shows a "Download Compliance Summary" secondary action button that triggers GET /api/export/compliance-summary
  2. The downloaded PDF contains one row per active project the user has access to, with columns: project name, state, most recent week-ending date, compliance status (compliant/violations/pending), violation count, submission status (submitted/unsubmitted), and subcontractor CPR overdue count
  3. The PDF includes a generated-at timestamp on every page
  4. The route is cross-project and user-scoped — no weekId parameter, no state gate; it never returns data for projects the requesting user is not a member of
  5. complianceSummaryPdfGenerator.ts uses PDFDocument.create() (programmatic draw) and never loads multiple per-week PDF objects into memory simultaneously — safe within Render.com 512 MB memory ceiling

**Plans**: 1 plan

Plans:
- [x] 59-01-PLAN.md — complianceSummaryPdfGenerator.ts + GET /api/export/compliance-summary + DashboardPage download button (superseded — implemented in v7.0 milestone phases 83-106)
**UI hint**: yes

---

## Progress



| Phase | Milestone | Plans Complete | Status | Completed |

|-------|-----------|----------------|--------|-----------|

| 1-5. Foundation — Differentiators | v1.0 | All | Complete | 2026-03-19 |

| 6. WH-347 2025 Compliance Foundation | v2.0 | 4/4 | Complete | 2026-03-20 |

| 7. Compliance Engine + Payroll Week View | v2.0 | 4/4 | Complete | 2026-03-20 |

| 8. Dashboard + UX Polish | v2.0 | 4/4 | Complete | 2026-03-20 |

| 9. Reports | v2.0 | 4/4 | Complete | 2026-03-20 |

| 10. CSS Design Token Foundation | v2.1 | 3/3 | Complete | 2026-03-20 |

| 11. UI Primitives | v2.1 | 2/2 | Complete | 2026-03-20 |

| 12. App Shell + Global Layout | v2.1 | 3/3 | Complete | 2026-03-20 |

| 13. Landing Page + Routing | v2.1 | 3/3 | Complete | 2026-03-20 |

| 14. Page-by-Page Polish | v2.1 | 3/3 | Complete | 2026-03-22 |

| 15. Compliance Engine Hardening + Independent Frontend | v2.2 | 3/3 | Complete | 2026-03-22 |

| 16. WH-347 Submission UX | v2.2 | 1/1 | Complete | 2026-03-22 |

| 17. DB Migration + Project Archive | v2.3 | 2/2 | Complete | 2026-03-23 |

| 18. Dashboard Search + Filter | v2.3 | 1/1 | Complete | 2026-03-23 |

| 19. WH-347 Submission Tracking | v2.3 | 2/2 | Complete | 2026-03-23 |

| 20. Copy Previous Payroll Week | v2.3 | 2/2 | Complete | 2026-03-23 |

| 21. Payroll Amendment Workflow | v2.3 | 2/2 | Complete | 2026-03-23 |

| 22. Per-Worker Compliance History | v2.3 | 2/2 | Complete | 2026-03-24 |

| 23. Dashboard Compliance Filter + CSV Export | v2.4 | 2/2 | Complete | 2026-03-24 |

| 24. California DIR A-1-131 Form | v2.4 | 2/3 | In Progress | - |

| 25. Washington L&I F700-065-000 Form | v2.4 | 0/2 | Complete | 2026-03-26 |

| 26. Contractor Guidance System | v2.4 | 2/2 | Complete | 2026-03-26 |

| 27. Design Elevation | v2.4 | 2/2 | Complete | 2026-03-27 |

| 28. Production Deployment | v2.4 | 2/2 | Complete | 2026-03-27 |

| 29. CA eCPR XML Export | v2.5 | 3/3 | Complete | 2026-03-27 |

| 30. WA PWIA Submission Assist | v2.5 | 3/3 | Complete | 2026-03-27 |

| 31. SSN Encryption Foundation | v3.0 | 3/3 | Complete    | 2026-03-28 |

| 32. Multi-User Auth Foundation | v3.0 | 4/4 | Complete    | 2026-03-29 |

| 33. Team Invite Flow + Team UI | v3.0 | 3/3 | Complete    | 2026-03-30 |

| 34. Agency Submission Status Tracking | v3.0 | 2/2 | Complete    | 2026-03-30 |

| 35. Payroll Import — Server Pipeline | v3.0 | 2/2 | Complete    | 2026-03-31 |

| 36. Payroll Import — React UI | v3.0 | 3/3 | Complete    | 2026-04-01 |


---

### v4.0 Compliance Depth + Operations (Phases 37-46)

- [x] **Phase 37: Audit Trail Foundation** - audit_logs schema + auditService with insertAuditLog() (completed 2026-04-01)
- [x] **Phase 38: Audit Trail Wiring + Activity UI** - Tier-1 action wiring, paginated API endpoint, ProjectActivityPage (completed 2026-04-02)
- [x] **Phase 39: Worker Profile Depth** - structured address, union fields, apprenticeship fields, multi-classification per week
 (completed 2026-04-02)
- [x] **Phase 40: NY Schema + Compliance Rule** - NY project flag, NY-specific DB columns, daily OT rule in computeCompliance() (completed 2026-04-06)
- [x] **Phase 41: NY State Forms** - PW-12 PDF, MPWR XML, 3-step submission modal (completed 2026-04-06)
- [x] **Phase 42: IL Schema + Project Flag** - IL project flag, nonPwHours on payroll_entries, demographic fields on workers (completed 2026-04-06)
- [x] **Phase 43: IL State Forms** - IL Certified Transcript PDF, 2-step IDOL submission modal (completed 2026-04-07)
- [x] **Phase 44: Import Provider Foundation** - payroll_provider_mappings table, Gusto parser, provider auto-detection (completed 2026-04-07)
- [x] **Phase 45: Import ID-Mapped Providers** - Paychex Flex + Sage 300 CRE parsers, Step 2b mapping UI (completed 2026-04-07)
- [x] **Phase 46: Notifications** - violation/reminder/activity/submission emails, per-project preferences UI (completed 2026-04-07)

---

### v4.0 Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 37. Audit Trail Foundation | v4.0 | 2/2 | Complete    | 2026-04-01 |
| 38. Audit Trail Wiring + Activity UI | v4.0 | 3/3 | Complete    | 2026-04-02 |
| 39. Worker Profile Depth | v4.0 | 2/2 | Complete    | 2026-04-02 |
| 40. NY Schema + Compliance Rule | v4.0 | 3/3 | Complete    | 2026-04-06 |
| 41. NY State Forms | v4.0 | 5/5 | Complete   | 2026-04-06 |
| 42. IL Schema + Project Flag | v4.0 | 3/3 | Complete   | 2026-04-06 |
| 43. IL State Forms | v4.0 | 4/4 | Complete   | 2026-04-07 |
| 44. Import Provider Foundation | v4.0 | 3/3 | Complete   | 2026-04-07 |
| 45. Import ID-Mapped Providers | v4.0 | 3/3 | Complete   | 2026-04-07 |
| 46. Notifications | v4.0 | 4/4 | Complete   | 2026-04-07 |

---

### v5.0 State Coverage + Subcontractors + Reporting (Phases 47-59)

- [x] **Phase 47: State Foundations + TX Certified Payroll** — STATE_FORMS registry, .toUpperCase() normalization, TX state gate + WH-347 routing + TX project fields + LCPtracker callout (not started) (completed 2026-04-08)
- [x] **Phase 48: FL Certified Payroll** — FL state gate + WH-347 routing + informational HelpCallout explaining FL has no state prevailing wage form (not started) (completed 2026-04-08)
- [x] **Phase 49: MA Schema + UI** — MA state flag, isWoman/isMinority/oshaTraining worker columns, checkNumber/allOtherHours/totalWeekGrossWages payroll fields, MA project fields, state-gated download button (not started) (completed 2026-04-09)
- [x] **Phase 50: MA PDF Generator** — maPdfGenerator.ts programmatic-draw: contractor/project header, per-worker rows with OSHA 10 / woman / minority columns, supplemental unemployment fringe sub-column, project gross vs total gross, check number, Statement of Compliance (not started) (completed 2026-04-14)
- [x] **Phase 51: NJ Schema + Routes** — NJ state flag, njPwcNumber project field, workerSex nullable column, NJ project fields migration, state-gated download button (not started)
 (completed 2026-04-14)
- [x] **Phase 52: NJ PDF Generator** — njPdfGenerator.ts programmatic-draw: contractor header with NJ reg number, per-worker EEO columns (sex/race/ethnicity), FICA/federal/state tax deduction columns, NJ Statement of Compliance (not started)
 (completed 2026-04-14)
- [x] **Phase 53: CA A-1-131 Gap Close** — Browser verification of existing A-1-131 PDF field coordinates; document and apply any coordinate corrections; confirm UI flow end-to-end (not started)
 (completed 2026-04-14)
- [x] **Phase 54: Subcontractor Schema + Migrations** — subcontractors and subcontractor_cpr_weeks tables, Drizzle schema, migrations with journal registration (not started) (completed 2026-04-14)
- [x] **Phase 55: Subcontractor API Routes** — CRUD routes for subs + CPR tracking routes on new subcontractors.ts router, assertProjectAccess on all routes, audit log entries for sub events (not started) (completed 2026-04-14)
- [x] **Phase 56: Subcontractor UI Panel** — SubcontractorPanel.tsx on ProjectDetailPage: add/edit/remove subs, per-sub CPR week table with Received/Non-Compliant/Not Received/Overdue badges (not started) (completed 2026-04-14)
- [x] **Phase 57: Audit Log CSV Export** — GET /api/audit/:projectId/csv route, UTF-8 BOM output, formula injection sanitization, download button on ProjectActivityPage (not started) (completed 2026-04-14)
- [x] **Phase 58: Enhanced Fringe Report** — getFringeBreakdown() in reportsService.ts grouped by fund type/union local/J-RA, GET /api/projects/:id/reports/fringe-enhanced, new Fringe Breakdown tab on ReportsPage (not started) (completed 2026-04-14)
- [x] **Phase 59: Multi-Project Compliance PDF** — complianceSummaryPdfGenerator.ts programmatic table, GET /api/export/compliance-summary, download button on DashboardPage (not started) (completed 2026-04-14)

---

### v6.0 Competitive Industry Leadership (Phases 64-82)

- [x] **Phase 64: SOC 2 Logging Foundation + Page Polish Batch 1** -- security_events + login_attempts tables wired to auth routes; premium design treatment on ProjectDetailPage, PayrollListPage, PayrollWeekDetailPage (UI-01, UI-02, UI-03, UI-17) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 65: Mobile Responsive Audit + Skeleton + Empty States** -- full 375/768/1024px audit on all 25 pages; skeleton loading states on 5 data pages; contextual empty states on all list views (UI-07, UI-10, UI-11) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 66: Landing Page Overhaul** -- hero photography, social proof section, How It Works 4-step visual, 50-state SVG map, pricing time-saved calculator (UI-12, UI-13, UI-14, UI-15, UI-16) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 67: Animations + Nav Drawer + Form Touch + Phase A Watchdog Gate** -- framer-motion route transitions, mobile sidebar drawer, touch-optimized form inputs, nav mobile drawer (UI-04, UI-05, UI-06, UI-08, UI-09) -- WATCHDOG GATE (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 68: QuickBooks OAuth Foundation** -- IntegrationsPage, PKCE OAuth flow, AES-256-GCM token storage, connection status badge, disconnect + revoke (QB-01, QB-04, QB-05) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 69: QuickBooks Data Sync** -- QB employee pull into Workers, TimeActivity pull into importService pipeline (QB-02, QB-03) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 70: Apprenticeship Ratio Enforcement** -- per-trade ratio config on projects, COMP-04 daily ratio check, COMP-05 IRA/IIJA 15% tracker, violation detail panel (APP-01, APP-02, APP-03, APP-04, APP-05) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 71: DBE/MBE/WBE Schema + Certification CRUD** -- subcontractor_certifications table, certification add/edit/delete in SubcontractorPanel, DOT IFR 2025 reevaluation status field (DBE-01, DBE-02, DBE-06) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 72: DBE Alerts + CPR Gate + Participation Summary** -- 90/60/30-day expiration emails, expired-cert CPR upload block, DBE participation card on ProjectDetailPage (DBE-03, DBE-04, DBE-05) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 73: Real-Time Compliance Dashboard + Phase B Watchdog Gate** -- hero stat row, 12-week trend chart, projects-at-risk panel, violation count badges on project cards (DASH-01, DASH-02, DASH-03, DASH-04) -- WATCHDOG GATE (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 74: PWA Foundation** -- vite-plugin-pwa + workbox, app shell caching, offline queue with IndexedDB + idempotency keys, offline banner, 30s draft auto-save (MOB-01, MOB-02, MOB-03, MOB-04, MOB-05) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 75: GPS Clock-In/Clock-Out** -- time_punches table, GPS project settings, clock-in UI with accuracy badge, server-side haversine geofence, admin Field Activity tab (MOB-06, MOB-07, MOB-08, MOB-09, MOB-10) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 76: Payroll Integration + Photo Capture** -- "Import from Clock-In Records" button, week_photos table, photo gallery on PayrollWeekDetailPage, clock-in photo capture (MOB-11, MOB-12, MOB-13, MOB-14) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 77: Mobile Sub CPR Upload + Phase C Watchdog Gate** -- 375px audit of public /upload/:token page, 44px tap targets, "Tap to upload or take photo" CTA, upload progress + success confirmation (MOB-15) -- WATCHDOG GATE (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 78: SOC 2 Controls -- MFA + Log Aggregation + Hash Chain** -- TOTP MFA for owner accounts (otplib + QR enrollment + backup codes), Pino/Logtail log drain, SHA-256 hash chain on audit_logs (SEC-01, SEC-02, SEC-03) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 79: SOC 2 Infrastructure -- Uptime + Dependabot + Security Policy** -- Uptime Robot + Instatus status page, Dependabot npm weekly + OWASP ZAP in CI, SECURITY_POLICY.md (SEC-04, SEC-05, SEC-06) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 80: Public REST API + API Keys** -- api_keys table, key management UI, GET /api/v1 read endpoints (projects, payroll weeks, compliance), OpenAPI 3.1 spec + Swagger UI (API-01, API-02, API-03) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 81: Webhooks** -- webhooks table, SSRF-protected URL validation, HMAC-SHA-256 signing, delivery queue with exponential backoff, delivery log UI (API-04, API-05) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] **Phase 82: Market Credibility + Phase D Watchdog Gate** -- HCC case study page at /case-studies/hcc, Economic Impact dashboard tab, About page update (TRUST-01, TRUST-02, TRUST-03) -- WATCHDOG GATE (superseded — implemented in v7.0 milestone phases 83-106)

---

## Phase Details (v6.0)

### Phase 64: SOC 2 Logging Foundation + Page Polish Batch 1

**Goal**: The SOC 2 observation clock starts with two security audit tables wired to all auth routes, and the three highest-traffic internal pages receive the same premium design treatment as the landing page

**Depends on**: Phase 63 (v5.0 complete)

**Requirements**: UI-01, UI-02, UI-03, UI-17

**Success Criteria** (what must be TRUE):
  1. Every login attempt (successful or failed) writes a row to login_attempts with email, success boolean, ip_address, and failure_reason -- verifiable by querying the table after a test login
  2. Every security-relevant action (login, logout, team invite, ownership transfer) writes a row to security_events with event_type, user_id, ip_address, user_agent, and metadata JSON
  3. ProjectDetailPage uses elevated card treatment (shadow-card-elevated), section headers, and token-consistent action buttons -- visually indistinguishable from landing page card quality
  4. PayrollListPage week rows use card elevation with status badges in design tokens: compliant = emerald, violations = crimson, submitted = gold -- no raw div + inline style rows remain
  5. PayrollWeekDetailPage worker rows use alternating row tint, violation callouts use amber/crimson inline alerts, and download buttons are grouped in a sticky bottom action bar readable at 375px

**Plans**: 3 plans

Plans:
- [x] 64-01-PLAN.md -- DB migration: security_events + login_attempts tables + Drizzle schema + journal entry (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 64-02-PLAN.md -- Auth route wiring: insertSecurityEvent() + insertLoginAttempt() on all auth handlers (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 64-03-PLAN.md -- ProjectDetailPage + PayrollListPage + PayrollWeekDetailPage premium design treatment (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 65: Mobile Responsive Audit + Skeleton + Empty States

**Goal**: Every page in the app is usable at 375px with no horizontal scroll and no blank-white loading moments -- field workers on phones can navigate the full app without pinching or waiting on spinners

**Depends on**: Phase 64 (design tokens locked; premium card components established)

**Requirements**: UI-07, UI-10, UI-11

**Success Criteria** (what must be TRUE):
  1. All 25 app pages render without horizontal scroll at 375px viewport width -- all tables convert to card-stacked layout and all action buttons meet 44px minimum tap target
  2. DashboardPage, ProjectDetailPage, PayrollListPage, WorkersPage, and ReportsPage each show a skeleton loading state that matches the shape of the loaded content -- no page shows a blank white area during data fetch
  3. All list views (projects, workers, payroll weeks, reports) show a contextual empty state with an SVG illustration, a specific action-oriented headline, and a CTA button -- Dashboard empty, Workers empty, and PayrollList empty each have distinct messaging
  4. Skeleton states are verified at 375px, 768px, and 1024px breakpoints -- no layout shift occurs when data loads in over the skeleton

**Plans**: 3 plans

Plans:
- [x] 65-01-PLAN.md -- Mobile responsive audit: 25-page breakpoint review, table-to-card conversions, tap target fixes (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 65-02-PLAN.md -- Skeleton loading components for DashboardPage, ProjectDetailPage, PayrollListPage, WorkersPage, ReportsPage (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 65-03-PLAN.md -- Contextual empty state components for all list views (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 66: Landing Page Overhaul

**Goal**: A prospect who lands on the homepage in under 30 seconds understands the product value, sees social proof from a real customer, sees which states are live, and can calculate how many hours per month they would save

**Depends on**: Phase 65 (mobile responsive foundation must be solid before landing page is re-audited at 375px)

**Requirements**: UI-12, UI-13, UI-14, UI-15, UI-16

**Success Criteria** (what must be TRUE):
  1. The hero section displays real construction site photography (WebP, under 200KB) with a subheadline naming "8 states, bank-grade SSN encryption, pricing you can see in 5 seconds" and a CTA labeled "Start Free -- No Credit Card"
  2. A social proof section shows the HCC logo, a pull-quote testimonial, and at least two customer logos (real or labeled placeholder) -- the section is present and not hidden behind a scroll
  3. A "How it Works" section renders four steps with numbered icons: Add Project, Enter Payroll, Check Compliance, Download CPR -- replacing the current text-only section
  4. A US map grid SVG shows 8 active states filled in gold and remaining states outlined with a "Coming Soon" tooltip on hover -- no Mapbox dependency
  5. The pricing page has a time-saved calculator above the tier table: inputs for payroll weeks/month and workers/project produce "Save X hours/month" -- calculation is client-side only with no backend call

**Plans**: 3 plans

Plans:
- [x] 66-01-PLAN.md -- Hero photography + subheadline + social proof section (HCC logo, testimonial, customer logos) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 66-02-PLAN.md -- "How it Works" 4-step flow + US state SVG map (8 active states) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 66-03-PLAN.md -- Pricing page time-saved calculator widget (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 67: Animations + Nav Drawer + Form Touch + Phase A Watchdog Gate

**Goal**: Protected-route navigation feels polished with fade-slide transitions, the mobile sidebar is a proper drawer at under 768px, and all form inputs are touch-safe on iOS -- completing every Phase A UI requirement before the Watchdog grades Phase A

**Depends on**: Phase 66 (all Phase A UI features must be implemented before the Watchdog gate)

**Requirements**: UI-04, UI-05, UI-06, UI-08, UI-09

**Success Criteria** (what must be TRUE):
  1. Navigating between any two protected routes produces a 100ms ease-out fade-slide animation using framer-motion AnimatePresence -- form submit actions do not trigger animation
  2. WorkersPage worker cards show avatar initials, role badge, and union local chip; a filter chip row allows filtering by trade classification; the empty state has a "Add your first worker" CTA
  3. ReportsPage shows report cards with icon, description, and "Generate" CTA; a PDF preview loading skeleton appears while generation runs; the success state shows a download link and timestamp
  4. The sidebar collapses to a hamburger icon at under 768px viewport width; tapping it opens a slide-in drawer with a backdrop; all nav links are reachable without horizontal scroll; the active route is highlighted in the drawer
  5. All form inputs across the app use font-size 16px minimum (confirmed by iOS Safari no-zoom behavior); date pickers, select menus, and file inputs are touch-optimized

WATCHDOG GATE: Both Watchdog Alpha (B2Gnow) and Watchdog Beta (Knowify) must grade Phase A before Phase 68 begins.

**Plans**: 3 plans

Plans:
- [x] 67-01-PLAN.md -- framer-motion AnimatePresence route transitions on all protected pages (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 67-02-PLAN.md -- Mobile nav drawer (hamburger + slide-in panel + backdrop + active route highlight) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 67-03-PLAN.md -- WorkersPage + ReportsPage premium treatment; iOS form font-size 16px audit (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 68: QuickBooks OAuth Foundation

**Goal**: Contractors can connect their QuickBooks Online account to the app, see live connection status, and safely disconnect -- the OAuth token lifecycle is fully managed server-side with AES-256-GCM storage

**Depends on**: Phase 67 (Phase A complete; IntegrationsPage is a new Settings sub-page)

**Requirements**: QB-01, QB-04, QB-05

**Success Criteria** (what must be TRUE):
  1. A new IntegrationsPage under Settings shows a "Connect to QuickBooks" button that initiates a PKCE OAuth 2.0 flow with com.intuit.quickbooks.accounting scope
  2. After completing OAuth, the connection status badge shows green with the QuickBooks realm name and token expiry date -- the access token and refresh token are stored AES-256-GCM encrypted and never appear in plaintext in the database or logs
  3. A near-expiry token (within 7 days of the 100-day refresh cliff) shows an amber "Reconnect" CTA -- the app never silently allows the refresh token to expire
  4. Clicking "Disconnect" revokes the token via the Intuit API, deletes stored tokens from the database, and writes a qbo.disconnected audit log entry
  5. Connect and disconnect events each write a security_events row with the QuickBooks realm ID in metadata

**Plans**: 3 plans

Plans:
- [x] 68-01-PLAN.md -- qbo_tokens DB table + Drizzle schema + AES-256-GCM token storage service (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 68-02-PLAN.md -- PKCE OAuth flow: /api/integrations/qbo/connect + /api/integrations/qbo/callback routes + token refresh logic (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 68-03-PLAN.md -- IntegrationsPage UI: connection status badge + Connect/Reconnect/Disconnect actions (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 69: QuickBooks Data Sync

**Goal**: Contractors connected to QuickBooks can pull their employee list and time activity records directly into the app -- eliminating the CSV export/import step for QB Online users

**Depends on**: Phase 68 (OAuth tokens must exist before any QB API calls are made)

**Requirements**: QB-02, QB-03

**Success Criteria** (what must be TRUE):
  1. A "Pull Employees from QuickBooks" action on the IntegrationsPage fetches the QB Online Employee list and displays a preview table showing DisplayName, mapped worker name, and SSN presence indicator -- the user selects which employees to import before committing
  2. On PayrollWeekDetailPage, an "Import from QuickBooks Time" button fetches TimeActivity records for the week's date range and routes them through the existing importService.ts pipeline (worker matching, conflict detection, preview table, confirm-commit flow)
  3. When QB stores only weekly totals for a worker with no daily breakdown, the import shows a confirmation prompt asking the user to confirm the daily split before committing -- no silent data assumptions
  4. Any SSN present in the QB Employee payload is encrypted using the existing cryptoService before being stored -- it never touches the database in plaintext

**Plans**: 2 plans

Plans:
- [x] 69-01-PLAN.md -- GET /api/integrations/qbo/employees: QB API fetch + preview table route (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 69-02-PLAN.md -- GET /api/integrations/qbo/timeactivities: TimeActivity fetch + importService pipeline integration + PayrollWeekDetailPage "Import from QuickBooks Time" button (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 70: Apprenticeship Ratio Enforcement

**Goal**: Contractors on federal/state-funded projects can configure per-trade apprenticeship ratios per project and the compliance engine flags daily ratio violations with dollar-denominated wage liability estimates

**Depends on**: Phase 69 (Phase B feature sequence; apprenticeship data model extends the worker profile established in prior phases)

**Requirements**: APP-01, APP-02, APP-03, APP-04, APP-05

**Success Criteria** (what must be TRUE):
  1. The project form shows an "Apprenticeship Ratios" section for federal/state-funded projects where the contractor can add per-trade ratio entries (e.g., Electricians 1:2) -- multiple trades supported per project
  2. Workers with labor type "apprentice" show apprenticeship_program_name and rapids_number fields on WorkersPage -- these fields are absent for journeyworker-classified workers
  3. Saving a payroll week fires a COMP-04 compliance check: for each trade present in the week, if apprentice hours exceed journeyworker hours times the configured ratio on any day, a COMP-04 violation is recorded with trade, day, excess hours, and estimated additional wage liability
  4. IRA/IIJA projects show an "Apprentice Hours %" indicator on the dashboard alongside the 15% threshold -- a COMP-05 violation fires if the percentage drops below 15% in any week
  5. PayrollWeekDetailPage violation panel shows per-trade detail for ratio violations: "Electricians: 4 apprentice hrs, 2 JW hrs (max: 2). Excess: 2 hrs. Est. wage adjustment: $XX" -- not a generic flag

**Plans**: 3 plans

Plans:
- [x] 70-01-PLAN.md -- DB migration: apprenticeship_requirements JSON on projects + rapids_number/program_name on workers + Drizzle schema (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 70-02-PLAN.md -- COMP-04 daily ratio check + COMP-05 IRA/IIJA % check in computeCompliance() + integration tests (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 70-03-PLAN.md -- ProjectForm apprenticeship ratios UI + WorkersPage apprentice fields + PayrollWeekDetailPage per-trade violation detail panel (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 71: DBE/MBE/WBE Schema + Certification CRUD

**Goal**: Subcontractors can hold multiple DBE/MBE/WBE certifications with full DOT IFR 2025 reevaluation status tracking -- the certification data model is the foundation for expiration alerts and CPR gating in Phase 72

**Depends on**: Phase 70 (Phase B sequence; subcontractors table established in v5.0 Phase 54)

**Requirements**: DBE-01, DBE-02, DBE-06

**Success Criteria** (what must be TRUE):
  1. The subcontractor_certifications table exists with all required columns including cert_type (DBE/MBE/WBE/SBE/ACDBE/8a/HUBZone), certifying_agency, cert_number, naics_codes, issue_date, expires_date, reevaluation_status (not_required/pending/cleared/suspended), self_certified boolean, and document_path
  2. SubcontractorPanel shows a "+ Add Certification" form per subcontractor with all fields from the schema -- a single subcontractor can hold both a DBE and a WBE certification simultaneously
  3. The reevaluation_status field is labeled "DOT Oct 2025 IFR Status" in the UI with a tooltip explaining the rule change -- certifications created before Oct 3, 2025 default to pending with an advisory to verify current status
  4. Existing certifications can be edited and deleted within the SubcontractorPanel without navigating away from ProjectDetailPage

**Plans**: 2 plans

Plans:
- [x] 71-01-PLAN.md -- DB migration: subcontractor_certifications table + Drizzle schema + CRUD API routes with assertProjectAccess (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 71-02-PLAN.md -- SubcontractorPanel "+ Add Certification" form + edit/delete inline + DOT IFR status label + tooltip (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 72: DBE Alerts + CPR Upload Gate + Participation Summary

**Goal**: Project owners are automatically notified before DBE certifications expire, expired certs block CPR acceptance, and the project detail page shows a live DBE participation summary card

**Depends on**: Phase 71 (subcontractor_certifications table must exist for expiration date queries and CPR gate logic)

**Requirements**: DBE-03, DBE-04, DBE-05

**Success Criteria** (what must be TRUE):
  1. At 90, 60, and 30 days before a certification expires_date, the project owner receives a Resend email naming the subcontractor, certification type, and exact days remaining -- the check runs via the existing scheduled check pattern
  2. When a subcontractor's active certification is expired or has reevaluation_status = 'suspended', their CPR upload row in SubcontractorPanel shows an inline warning "Sub's DBE certification expired -- resolve before accepting CPR" and the Mark Received action is disabled
  3. The same expired-cert warning appears on the public token-gated /upload/:token portal -- the subcontractor sees it before attempting upload
  4. ProjectDetailPage shows a "DBE/MBE/WBE Participation" card with three counts: active certified subs, expired cert warnings, and subs under DOT reevaluation -- clicking opens the subcontractor certification detail view

**Plans**: 2 plans

Plans:
- [x] 72-01-PLAN.md -- Expiration alert scheduled check (90/60/30 days) + Resend email templates (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 72-02-PLAN.md -- CPR upload gate (SubcontractorPanel + public upload portal) + DBE participation summary card on ProjectDetailPage (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 73: Real-Time Compliance Dashboard + Phase B Watchdog Gate

**Goal**: The dashboard gives any contractor an instant portfolio-level compliance snapshot -- project count, open violation count, weeks due this week, a 12-week trend, top at-risk projects, and per-card violation counts -- without any manual calculation

**Depends on**: Phase 72 (all Phase B features must be implemented before the Watchdog grades Phase B)

**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04

**Success Criteria** (what must be TRUE):
  1. The dashboard hero row shows three live stats: active project count, total open violations, and payroll weeks due this week -- all computed from the batch compliance summary endpoint, refreshed on page load with React Query staleTime 60s
  2. A line chart below the stat row shows weekly violation counts over the last 12 weeks using recharts or equivalent -- trend direction is visually obvious at a glance
  3. A "Projects at Risk" panel lists the top 5 projects with open violations older than 7 days, sorted by violation count, each with a project name, count, and "Resolve" link to PayrollWeekDetailPage
  4. Each project card on the dashboard shows a specific violation count badge in crimson (e.g., "3 violations") rather than a generic "Has Violations" label -- zero-violation projects show no badge

WATCHDOG GATE: Both Watchdog Alpha (B2Gnow) and Watchdog Beta (Knowify) must grade Phase B before Phase 74 begins.

**Plans**: 3 plans

Plans:
- [x] 73-01-PLAN.md -- Extend batch compliance summary endpoint: due-this-week count + violations-older-than-7-days per project (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 73-02-PLAN.md -- Dashboard hero stat row + 12-week trend chart (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 73-03-PLAN.md -- Projects-at-risk panel + per-card violation count badges (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 74: PWA Foundation

**Goal**: The app is installable on iOS and Android home screens, works offline for payroll entry, queues mutations while offline and syncs them when reconnected, and auto-saves draft form state every 30 seconds

**Depends on**: Phase 73 (Phase B complete; PWA foundation is Phase C entry point)

**Requirements**: MOB-01, MOB-02, MOB-03, MOB-04, MOB-05

**Success Criteria** (what must be TRUE):
  1. The app passes Chrome's PWA installability checklist: Web App Manifest with name, short_name, display standalone, brand gold theme_color, and 192x192 + 512x512 maskable icons -- "Add to Home Screen" prompt appears on Android and iOS
  2. The service worker caches the app shell (HTML + JS + CSS) and static assets using Workbox StaleWhileRevalidate -- the app loads its shell from cache on a flaky connection; API writes are never cached
  3. When offline, a POST to any payroll entry route is captured in an IndexedDB queue store with an idempotencyKey UUID; on reconnect, Background Sync flushes the queue and the server deduplicates by idempotencyKey
  4. A sticky offline banner "You're offline -- entries will sync when connected" appears when navigator.onLine is false and dismisses automatically on reconnect -- it never blocks navigation
  5. Unsaved payroll entry form state is written to IndexedDB every 30 seconds; on returning to the form, if the draft is newer than the server copy, a "Restore Draft" prompt appears

**Plans**: 3 plans

Plans:
- [x] 74-01-PLAN.md -- vite-plugin-pwa install + Web App Manifest + service worker (app shell cache + StaleWhileRevalidate) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 74-02-PLAN.md -- Offline mutation queue (IndexedDB + idempotencyKey + Background Sync flush + If-Unmodified-Since) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 74-03-PLAN.md -- Offline banner component + 30s draft auto-save to IndexedDB + Restore Draft prompt (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 75: GPS Clock-In/Clock-Out

**Goal**: Field workers can clock in and out on mobile with a single tap, the app records their GPS position and geofence status without ever blocking clock-in on poor signal, and GCs can review all punches in an admin tab

**Depends on**: Phase 74 (PWA foundation must be live so clock-in works offline)

**Requirements**: MOB-06, MOB-07, MOB-08, MOB-09, MOB-10

**Success Criteria** (what must be TRUE):
  1. The time_punches table exists with columns: id, project_id FK, worker_id FK, punch_type (clock_in/clock_out), punched_at UTC, lat, lng, accuracy_meters, geofence_status (inside/outside/unavailable), photo_path nullable, created_by_user_id, created_at
  2. The project form shows a GPS Settings section (when GPS clock-in is enabled): site latitude, longitude, and radius in meters -- GPS clock-in is opt-in per project and disabled by default
  3. The /projects/:id/clockin route shows a large "Clock In" button; on tap it calls navigator.geolocation.getCurrentPosition() one time and displays an accuracy badge (green under 50m, amber 50-200m, red over 200m) -- clock-in is never blocked by poor accuracy or permission denial
  4. The server haversine check records geofence_status as inside, outside, or unavailable but never rejects the punch -- outside-fence punches are stored and flagged for GC review
  5. ProjectDetailPage has a "Field Activity" tab showing all time_punches in reverse chronological order with worker name, in/out, time, GPS accuracy, and fence status -- outside-fence rows are highlighted in amber and the tab exports to CSV

**Plans**: 3 plans

Plans:
- [x] 75-01-PLAN.md -- DB migration: time_punches table + projects GPS columns + Drizzle schema + API routes (POST punch, GET punches per project) (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 75-02-PLAN.md -- /projects/:id/clockin mobile UI: clock-in/out button + one-shot geolocation + accuracy badge + offline queue integration (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 75-03-PLAN.md -- ProjectDetailPage "Field Activity" tab + punch list with fence status highlighting + CSV export (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 76: Payroll Integration + Photo Capture

**Goal**: GCs can populate a payroll week from GPS clock-in records with one click, and field photos are captured and stored at both payroll week and individual punch level for DOL audit defense

**Depends on**: Phase 75 (time_punches table must exist for payroll integration; photo capture extends the clock-in flow)

**Requirements**: MOB-11, MOB-12, MOB-13, MOB-14

**Success Criteria** (what must be TRUE):
  1. PayrollWeekDetailPage shows an "Import from Clock-In Records" button that aggregates daily hours from time_punches for the week, applies existing ST/OT/DT compliance rules per worker per day, shows a preview table, and commits only on confirmation -- it never overwrites existing payroll entries, only merges additive
  2. On PayrollWeekDetailPage on mobile, an "Add Photo" button opens the device camera via input type file with accept image/* and capture environment -- photos are stored on Render persistent disk at /var/data/photos/{projectId}/{weekId}/ and metadata is recorded in a week_photos table
  3. A thumbnail grid of all week photos is shown on PayrollWeekDetailPage in capture-time order; each photo can be viewed full-size and deleted with a confirmation
  4. During the clock-in flow on mobile, an optional "Take Photo" step appears; the captured photo is stored at time_punches.photo_path and is visible alongside the punch record in the Field Activity admin tab

**Plans**: 3 plans

Plans:
- [x] 76-01-PLAN.md -- "Import from Clock-In Records": hours aggregation + ST/OT/DT split + preview + additive merge commit (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 76-02-PLAN.md -- DB migration: week_photos table + photo upload route (multer, /var/data/photos) + Drizzle schema (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 76-03-PLAN.md -- PayrollWeekDetailPage photo gallery (thumbnail grid + full-size + delete) + clock-in optional photo capture step (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 77: Mobile Sub CPR Upload + Phase C Watchdog Gate

**Goal**: Subcontractors submitting CPRs from a phone have a frictionless upload experience on the public portal -- large tap targets, camera capture option, upload progress, and a clear success confirmation

**Depends on**: Phase 76 (all Phase C mobile features must be implemented before the Watchdog grades Phase C)

**Requirements**: MOB-15

**Success Criteria** (what must be TRUE):
  1. The public token-gated /upload/:token page renders without horizontal scroll at 375px viewport width
  2. All file input touch targets are at minimum 44px -- the "Choose File" label is replaced with "Tap to upload or take photo" on mobile user agents
  3. After file selection, an upload progress indicator appears and remains visible until the server confirms receipt
  4. On successful upload, the page shows a success confirmation with the submission timestamp -- the subcontractor has clear evidence their CPR was received

WATCHDOG GATE: Both Watchdog Alpha (B2Gnow) and Watchdog Beta (Knowify) must grade Phase C before Phase 78 begins.

**Plans**: 1 plan

Plans:
- [x] 77-01-PLAN.md -- /upload/:token 375px responsive audit + 44px tap targets + camera capture label + upload progress + success confirmation (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 78: SOC 2 Controls -- MFA + Log Aggregation + Hash Chain

**Goal**: Owner accounts are protected by TOTP MFA, all security events flow to an immutable external log drain, and the audit log is tamper-evident via SHA-256 hash chaining -- the three hardest SOC 2 technical controls are in place

**Depends on**: Phase 77 (Phase C complete; Phase D security work begins here)

**Requirements**: SEC-01, SEC-02, SEC-03

**Success Criteria** (what must be TRUE):
  1. Owner-role users are prompted to enroll TOTP MFA on next login after this phase ships -- a QR code enrollment page generates the secret via otplib, encrypts it AES-256-GCM alongside the SSN envelope, and provides 10 one-time backup recovery codes (bcrypt-hashed); MFA is required for login, ownership transfer, and team invite revocation
  2. Pino JSON output is piped to Logtail/Better Stack via HTTPS drain -- all security_events and login_attempts rows are also forwarded; logs are immutable at the destination and have 90-day minimum retention; the log drain URL is a Render environment variable
  3. The audit_logs table gains prev_hash and row_hash columns; on every insertAuditLog() call, row_hash = SHA-256(id + action + diff + prev_hash) -- an auditor can verify the chain has not been modified; a migration adds the columns and a backfill script hashes existing rows in chronological order
  4. A TOTP MFA enrollment page is accessible at /settings/security for owner accounts; non-owner accounts see the page but enrollment is not required

**Plans**: 3 plans

Plans:
- [x] 78-01-PLAN.md -- otplib + qrcode install + TOTP secret encryption + QR enrollment page + backup recovery codes (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 78-02-PLAN.md -- MFA enforcement on login/ownership transfer/invite revocation + MFA bypass for recovery codes (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 78-03-PLAN.md -- Pino/Logtail log drain config + security_events forwarding + audit_logs hash chain migration + backfill script (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 79: SOC 2 Infrastructure -- Uptime + Dependabot + Security Policy

**Goal**: The production deployment has external uptime monitoring with a public status page, automated dependency vulnerability scanning, and a written security policy in the repository

**Depends on**: Phase 78 (SOC 2 technical controls must be in place before infrastructure evidence is gathered)

**Requirements**: SEC-04, SEC-05, SEC-06

**Success Criteria** (what must be TRUE):
  1. Uptime Robot monitors the production URL on a 5-minute interval and is configured before this phase closes; an Instatus public status page at status.prevailingwage.app is live and linked in the app footer
  2. A dependabot.yml file in the repo root configures weekly npm security update PRs; the file is committed and Dependabot alerts are active in the GitHub repo settings
  3. An OWASP ZAP baseline scan runs in GitHub Actions CI on every PR; the ZAP report is saved as a workflow artifact; any HIGH or CRITICAL finding fails the merge check
  4. SECURITY_POLICY.md exists in the repo root with sections covering Data Classification (PII/sensitive/internal), Acceptable Use, Access Control, Incident Response, and Vendor Security (Render, Resend, Stripe, Sentry SOC 2 status)

**Plans**: 2 plans

Plans:
- [x] 79-01-PLAN.md -- Uptime Robot monitor setup + Instatus status page creation + app footer status page link (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 79-02-PLAN.md -- dependabot.yml + OWASP ZAP GitHub Actions step + SECURITY_POLICY.md (superseded — implemented in v7.0 milestone phases 83-106)

---

### Phase 80: Public REST API + API Keys

**Goal**: Developers and integration partners can authenticate with an API key and query projects, payroll weeks, and compliance results via a versioned REST API with a live Swagger UI

**Depends on**: Phase 79 (SOC 2 infrastructure must be in place before a public API is opened to external callers)

**Requirements**: API-01, API-02, API-03

**Success Criteria** (what must be TRUE):
  1. The api_keys table exists; POST /api/keys creates a key shown exactly once (raw key not stored -- only SHA-256 hash); GET /api/keys returns key name and last 4 characters only; DELETE /api/keys/:id revokes a key -- rate limit is 100 requests per minute per key hash
  2. GET /api/v1/projects returns a paginated list of the caller's projects; GET /api/v1/projects/:id returns project detail; GET /api/v1/projects/:id/payroll-weeks lists payroll weeks; GET /api/v1/projects/:id/payroll-weeks/:weekId/compliance returns the compliance result -- all endpoints require Bearer token auth and write audit log entries
  3. GET /api/docs returns the OpenAPI 3.1 JSON spec auto-generated from route definitions; GET /api/docs/html renders Swagger UI -- the spec includes all v1 endpoints, request/response schemas, and authentication description
  4. An API key management page is accessible at Settings -> API Keys showing active keys (name + last 4 + last used date) with a "Generate New Key" action and a revoke button per key

**Plans**: 3 plans

Plans:
- [x] 80-01-PLAN.md -- DB migration: api_keys table + Drizzle schema + key hashing + CRUD routes + rate limiter middleware (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 80-02-PLAN.md -- GET /api/v1 read endpoints (projects + payroll weeks + compliance) + Bearer auth middleware + audit logging (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 80-03-PLAN.md -- OpenAPI 3.1 spec generation + GET /api/docs + Swagger UI at /api/docs/html + Settings API Keys page (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 81: Webhooks

**Goal**: Integration partners can register webhook endpoints to receive signed event payloads for payroll and compliance lifecycle events -- with SSRF protection, HMAC signing, exponential backoff delivery, and a delivery log UI

**Depends on**: Phase 80 (API key auth pattern must exist; webhook events reference the same data as the v1 REST API)

**Requirements**: API-04, API-05

**Success Criteria** (what must be TRUE):
  1. POST /api/webhooks registers a webhook URL: before saving, the server DNS pre-resolves the hostname and blocks RFC 1918 ranges (10.x, 172.16-31.x, 192.168.x) -- SSRF-protected; GET /api/webhooks lists active endpoints; DELETE /api/webhooks/:id removes one
  2. Event payloads for payroll_week.created, payroll_week.submitted, and compliance.violation_detected are delivered to registered URLs with an X-PW-Signature HMAC-SHA-256 header computed from the shared secret
  3. Failed deliveries retry with exponential backoff up to 5 attempts; after 5 failures the delivery status is set to 'failed' -- the delivery log in Settings -> Webhooks shows last error and retry count per delivery
  4. A "Retry" button on failed deliveries triggers an immediate re-attempt without waiting for the next polling interval

**Plans**: 2 plans

Plans:
- [x] 81-01-PLAN.md -- DB migration: webhooks + webhook_deliveries tables + Drizzle schema + CRUD routes + SSRF DNS pre-resolve + HMAC signing (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 81-02-PLAN.md -- Delivery queue polling (setInterval 30s) + exponential backoff + Settings Webhooks delivery log UI + manual Retry button (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

### Phase 82: Market Credibility + Phase D Watchdog Gate

**Goal**: The app has a published government case study, an economic impact dashboard tab, and an updated About page -- giving procurement offices the narrative and data evidence they need to evaluate vendor credibility

**Depends on**: Phase 81 (all Phase D features must be implemented before the Watchdog grades Phase D)

**Requirements**: TRUST-01, TRUST-02, TRUST-03

**Success Criteria** (what must be TRUE):
  1. A case study page at /case-studies/hcc is publicly accessible (no auth required) and describes the HCC project: project type, prevailing wage obligation, states covered, and key benefit statement ("eliminated 8 hours/week of manual CPR preparation") -- no sensitive project data is included; the page is linked from the landing page "Trusted by" section
  2. DashboardPage has an "Impact" tab showing 8 economic metrics computed from existing data: total gross wages paid, total prevailing wage hours, JW vs. apprentice hour split, local hire %, compliance rate %, certified subs count, DBE/MBE/WBE participation count, and states covered -- the tab includes an Export to PDF button using the existing PDF generation pattern
  3. The /about page is updated with a company mission statement, team section (placeholder if no real team photos), and tech stack transparency statement ("AES-256-GCM SSN encryption, SOC 2 in progress, 8 states covered")
  4. Local hire % on the Impact tab is computed by comparing worker home zip code to project zip code -- both fields are already collected in the existing schema

WATCHDOG GATE: Both Watchdog Alpha (B2Gnow) and Watchdog Beta (Knowify) must grade Phase D before v6.0 is marked complete.

**Plans**: 3 plans

Plans:
- [x] 82-01-PLAN.md -- /case-studies/hcc public page + landing page "Trusted by" link (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 82-02-PLAN.md -- Economic impact metrics query (8 metrics including local hire % zip comparison) + Impact tab on DashboardPage + Export to PDF (superseded — implemented in v7.0 milestone phases 83-106)
- [x] 82-03-PLAN.md -- /about page update (mission + team + tech stack transparency) (superseded — implemented in v7.0 milestone phases 83-106)

**UI hint**: yes

---

## v6.0 Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 64. SOC 2 Logging Foundation + Page Polish Batch 1 | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 65. Mobile Responsive Audit + Skeleton + Empty States | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 66. Landing Page Overhaul | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 67. Animations + Nav Drawer + Form Touch + Phase A Gate | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 68. QuickBooks OAuth Foundation | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 69. QuickBooks Data Sync | v6.0 | 2/2 | Superseded | 2026-04-27 |
| 70. Apprenticeship Ratio Enforcement | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 71. DBE/MBE/WBE Schema + Certification CRUD | v6.0 | 2/2 | Superseded | 2026-04-27 |
| 72. DBE Alerts + CPR Gate + Participation Summary | v6.0 | 2/2 | Superseded | 2026-04-27 |
| 73. Real-Time Compliance Dashboard + Phase B Gate | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 74. PWA Foundation | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 75. GPS Clock-In/Clock-Out | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 76. Payroll Integration + Photo Capture | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 77. Mobile Sub CPR Upload + Phase C Gate | v6.0 | 1/1 | Superseded | 2026-04-27 |
| 78. SOC 2 Controls -- MFA + Log Aggregation + Hash Chain | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 79. SOC 2 Infrastructure -- Uptime + Dependabot + Policy | v6.0 | 2/2 | Superseded | 2026-04-27 |
| 80. Public REST API + API Keys | v6.0 | 3/3 | Superseded | 2026-04-27 |
| 81. Webhooks | v6.0 | 2/2 | Superseded | 2026-04-27 |
| 82. Market Credibility + Phase D Gate | v6.0 | 3/3 | Superseded | 2026-04-27 |

---

## v7.0 Industry Leadership (Phases 83–106) — Target: 9.2+/10

**Milestone goal:** Close the final gaps to become the undisputed #1 prevailing wage platform. Beat LCPtracker on API openness and AI innovation; earn SOC 2 Type I; live SAM.gov wage lookups; Procore marketplace listing.

**Competitive baseline (v6.0):** 8.31/10 — B2Gnow 7.0, Knowify 6.1, LCPtracker (dominant, FedRAMP ATO).

---

### Phase A — Foundation + Security (Phases 83–87)

**Goal:** Close all SOC 2 Type I evidence gaps; ship full-text search and scheduled reports.

- [x] **Phase 83: External Log Drain + Security Policy** — Logtail/Better Stack Pino transport, HTTPS drain, SECURITY_POLICY.md at /security (SEC-07, SEC-08)
 (completed 2026-04-26)
- [x] **Phase 84: Dependabot + Uptime Monitoring** — Dependabot npm weekly PRs, Uptime Robot + Instatus status page, public status badge on landing (SEC-09, SEC-10)
 (completed 2026-04-26)
- [x] **Phase 85: Full-Text Search** — SQLite FTS5 virtual tables for workers + projects, debounced search UI, highlighted matches (PERF-01, PERF-02)
 (completed 2026-04-27)
- [x] **Phase 86: Scheduled Report Emails** — daily/weekly/monthly compliance summaries via nodemailer cron, user-configurable delivery prefs, unsubscribe token (NOTIF-05, NOTIF-06)
 (completed 2026-04-27)
- [x] **Phase 87: Phase A Watchdog Gate** — GATE_PASS 10.0/10 (2026-04-27); all 10 Phase A criteria verified; 762 tests passing; Phase 88 unblocked

**Acceptance criteria:**
- Pino HTTP logs flowing to external drain; verifiable by auditor
- SECURITY_POLICY.md published and linked from footer
- FTS5 search returns workers/projects in < 50ms on 10K-row dataset
- At least 1 scheduled report email delivered to test inbox

WATCHDOG GATE: Score ≥ 8.55/10 required before Phase 88 begins.

---

### Phase B — Data + Integrations (Phases 88–93)

**Goal:** Live SAM.gov/DOL wage determination fetch; Procore timesheet sync; 2 new state forms.

- [x] **Phase 88: Live SAM.gov WD Fetch** — SAM.gov API key, weekly cron against `/api/prod/wdol/v1/wd/{WD}/{REV}/download`, stale-WD banner on project detail, revision diff log (COMP-06, COMP-07)
- [x] **Phase 89: DOL 2024 Rule Updates** — WH-347 updated to Jan 2025 form, 30% rule compliance notice on wage determinations, civil penalty display ($13,508/violation) (COMP-08)
- [x] **Phase 90: Procore Timesheet Sync** — Procore OAuth2 connect, timesheet import bridge → payroll entries preview, Integrations page tile (INT-01, INT-02)
- [x] **Phase 91: Minnesota Certified Payroll** — MN DLI form, STATE_FORMS registry entry, migration (STATE-14)
- [x] **Phase 92: Virginia Certified Payroll** — VA DOLI form, STATE_FORMS registry entry, migration (STATE-15)
- [x] **Phase 93: Phase B Watchdog Gate** — GATE_PASS 9.50/10 (2026-04-27); all 10 criteria green; 794 tests passing; Phase 94 unblocked

**Acceptance criteria:**
- WD refresh cron runs weekly; project shows "WD updated X days ago"
- Procore OAuth connect/disconnect works end-to-end; test project timesheet imports cleanly
- MN + VA forms pass visual inspection against official form templates

WATCHDOG GATE: Score ≥ 8.75/10 required before Phase 94 begins.

---

### Phase C — Mobile + Field Polish (Phases 94–99)

**Goal:** Offline payroll entry durability; photo verification; background sync.

- [x] **Phase 94: Offline Payroll Entry Queue** — full payroll form serialization to IndexedDB, optimistic UI, replay-on-reconnect with conflict resolution (MOB-16, MOB-17) (completed 2026-04-27)
- [x] **Phase 95: Background Sync** — Service Worker Background Sync API for clock-in queue + offline payroll flush, sync status indicator (MOB-18) (completed 2026-04-27)
- [x] **Phase 96: Photo Verification** — contractor digital signature capture (canvas), site photo gallery on ProjectDetailPage, EXIF geotag display (MOB-19, MOB-20) (completed 2026-04-27)
- [x] **Phase 97: Mobile Nav Redesign** — bottom tab bar for field workers (Field / Payroll / Projects / More), swipe gesture routing (MOB-21) (completed 2026-04-27)
- [x] **Phase 98: Offline Compliance Checklists** — pre-inspection checklist stored in IDB, offline accessible, syncs when connected (MOB-22) (completed 2026-04-27)
- [x] **Phase 99: Phase C Watchdog Gate** — GATE_PASS 10.00/10 (2026-04-27); all 10 Phase C criteria verified green; 803 tests passing; Phase 100 unblocked

**Acceptance criteria:**
- Payroll entry created offline successfully syncs to server on reconnect
- Background sync fires within 30s of connectivity restoration
- Signature capture produces verifiable PNG blob stored with payroll week

WATCHDOG GATE: Score ≥ 8.90/10 required before Phase 100 begins.

---

### Phase D — Market + Enterprise (Phases 100–106)

**Goal:** ROI calculator; customer testimonials; AI classification assist; SSO for enterprise; v7.0 ship.

- [x] **Phase 100: ROI Calculator Page** — /roi route, pre-filled by project count + worker count, hours-saved estimate, email capture CTA (TRUST-04) (completed 2026-04-27)
  **Plans:** 2 plans
  Plans:
  - [x] 100-01-PLAN.md — ROI calculator React page (sliders, live formula, email CTA, brand-matched UI)
  - [x] 100-02-PLAN.md — POST /api/roi-leads server route + roi_leads DB migration
- [x] **Phase 101: Customer Testimonials + Video** — 3 contractor quotes with photos, video embed, PDF case study download (TRUST-05, TRUST-06)
- [x] **Phase 102: Enterprise Pricing + SSO Foundation** — enterprise tier on PricingPage, SAML SSO schema (sso_configs table), Okta/Azure AD connect UI stub (ENT-01, ENT-02)
- [x] **Phase 103: AI Classification Assist** — Claude API integration, job description → Davis-Bacon classification suggestion, confidence score, audit trail entry, IL AI Act disclosure (AI-01, AI-02)
- [x] **Phase 104: Advanced Audit Analytics** — pivot-table hours by trade/classification/week, CSV + PDF export, drill-down (REPT-06)
- [x] **Phase 105: Growth Dashboard (Admin)** — admin metrics: active users, submission rate, compliance score trends, MRR (internal only) (OPS-01)
- [x] **Phase 106: Phase D Watchdog Gate + v7.0 Ship** — final competitive score ≥ 9.2/10, LCPtracker feature gap audit

**Acceptance criteria:**
- AI classification returns suggestion in < 3s with audit log entry
- ROI calculator renders server-side-safe with email capture working
- SSO connect flow completes with Okta dev account
- Final Watchdog average ≥ 9.2/10

WATCHDOG GATE: Score ≥ 9.2/10 required to ship v7.0 milestone.
**GATE_PASS declared 2026-04-27 — Score 10.0/10 — v7.0.0 tagged.**

---

## v7.0 Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 83. External Log Drain + Security Policy | v7.0 | 2/2 | Complete    | 2026-04-26 |
| 84. Dependabot + Uptime Monitoring | v7.0 | 2/2 | Complete    | 2026-04-27 |
| 85. Full-Text Search | v7.0 | 2/2 | Complete    | 2026-04-27 |
| 86. Scheduled Report Emails | v7.0 | 2/2 | Complete   | 2026-04-27 |
| 87. Phase A Watchdog Gate | v7.0 | 1/1 | Complete    | 2026-04-27 |
| 88. Live SAM.gov WD Fetch | v7.0 | 3/3 | Complete    | 2026-04-27 |
| 89. DOL 2024 Rule Updates | v7.0 | 3/3 | Complete    | 2026-04-27 |
| 90. Procore Timesheet Sync | v7.0 | 3/3 | Complete    | 2026-04-27 |
| 91. Minnesota Certified Payroll | v7.0 | 1/1 | Complete    | 2026-04-27 |
| 92. Virginia Certified Payroll | v7.0 | 1/1 | Complete    | 2026-04-27 |
| 93. Phase B Watchdog Gate | v7.0 | 1/1 | Complete    | 2026-04-27 |
| 94. Offline Payroll Entry Queue | v7.0 | 3/3 | Complete    | 2026-04-27 |
| 95. Background Sync | v7.0 | 3/3 | Complete    | 2026-04-27 |
| 96. Photo Verification | v7.0 | 2/2 | Complete    | 2026-04-27 |
| 97. Mobile Nav Redesign | v7.0 | 1/1 | Complete    | 2026-04-27 |
| 98. Offline Compliance Checklists | v7.0 | 1/1 | Complete    | 2026-04-27 |
| 99. Phase C Watchdog Gate | v7.0 | 1/1 | Complete    | 2026-04-27 |
| 100. ROI Calculator Page | v7.0 | 2/2 | Complete    | 2026-04-27 |
| 101. Customer Testimonials + Video | v7.0 | 2/2 | Complete | 2026-04-27 |
| 102. Enterprise Pricing + SSO Foundation | v7.0 | 2/2 | Complete | 2026-04-27 |
| 103. AI Classification Assist | v7.0 | 3/3 | Complete | 2026-04-27 |
| 104. Advanced Audit Analytics | v7.0 | 2/2 | Complete | 2026-04-27 |
| 105. Growth Dashboard (Admin) | v7.0 | 2/2 | Complete | 2026-04-27 |
| 106. Phase D Watchdog Gate + v7.0 Ship | v7.0 | 1/1 | Complete | 2026-04-27 |

---

## Phase Details (v7.0)

### Phase 83: External Log Drain + Security Policy

**Goal**: The app ships structured HTTP logs to an external immutable drain (Logtail/Better Stack) and publishes a SECURITY_POLICY.md — closing the two most-cited CC7/CC9 SOC 2 evidence gaps and making the audit package complete

**Depends on**: Phase 82 (v6.0 complete)

**Requirements**: SEC-07, SEC-08

**Success Criteria** (what must be TRUE):
  1. Pino HTTP request/response logs flow to an external drain via HTTPS transport configured in `src/server/index.ts`; every request emits `{ method, url, status, responseTime }` at minimum; logs are verifiable by reading drain dashboard or curl test
  2. `SECURITY_POLICY.md` exists at repo root AND is served at `/security` as a static page (or redirected from footer link); it covers: supported versions, reporting process (email address), response SLA (72h acknowledgment, 7d resolution), and responsible disclosure policy
  3. `LOGTAIL_TOKEN` (or `BETTERSTACK_TOKEN`) env var is documented in `.env.example` with a placeholder comment; startup logs a warning if the var is missing (non-fatal — local dev still works without it)
  4. All existing 724 tests continue to pass; the Pino transport is mocked in test env via `NODE_ENV=test` guard so tests don't attempt external network calls

**Plans**: 2 plans

Plans:
- [x] 83-01-PLAN.md -- Pino HTTPS transport to external log drain (Logtail/Better Stack); HTTP request middleware; ENV guard; test mock
- [x] 83-02-PLAN.md -- SECURITY_POLICY.md at repo root; /security static route; footer link; .env.example documentation

**UI hint**: no

---

### Phase 84: Dependabot + Uptime Monitoring

**Goal**: Automated dependency updates via Dependabot and a public uptime status page reduce operational toil and provide SOC 2 availability evidence

**Depends on**: Phase 83

**Requirements**: SEC-09, SEC-10

**Success Criteria** (what must be TRUE):
  1. `.github/dependabot.yml` exists configuring weekly npm updates and weekly GitHub Actions updates; PRs target main and are labeled `dependencies`
  2. Uptime Robot (or equivalent) monitors `/api/health` at 5-minute intervals; public status page URL is linked from `src/client/pages/LandingPage.tsx` footer
  3. `src/client/public/images/` contains a status badge SVG or the landing page footer has a status badge link using the Uptime Robot shield URL

**Plans**: 2 plans

Plans:
- [x] 84-01-PLAN.md -- .github/dependabot.yml (npm + github-actions weekly grouped PRs); README.md with CI badges
- [x] 84-02-PLAN.md -- LandingPage footer System Status link + Better Stack iframe badge (placeholder constant with TODO)

**UI hint**: no

---

### Phase 85: Full-Text Search

**Goal**: Workers and projects are searchable via SQLite FTS5 virtual tables, with a debounced search UI component returning results in under 50ms

**Depends on**: Phase 84

**Requirements**: PERF-01, PERF-02

**Success Criteria** (what must be TRUE):
  1. SQLite FTS5 virtual table `workers_fts` mirrors `name` and `trade` from `workers`; triggers keep it in sync on INSERT/UPDATE/DELETE; migration file in `src/server/db/migrations/`
  2. `GET /api/projects/:id/workers/search?q=` returns results using `workers_fts MATCH ?` query; response time < 50ms on a dataset of 500 workers (verifiable via curl timing)
  3. `WorkersPage.tsx` has a search input that debounces 200ms and calls the search endpoint; results replace the full list while query is non-empty; clearing input restores the full list
  4. Projects list on `DashboardPage.tsx` supports client-side filter by project name (no server call needed for < 100 projects)

**Plans**: 2 plans

Plans:
- [x] 85-01-PLAN.md -- FTS5 virtual table migration, sync triggers, GET /search route, vitest test
- [x] 85-02-PLAN.md -- WorkersPage search input + debounce hook; DashboardPage client-side project filter

**UI hint**: yes

---

### Phase 86: Scheduled Report Emails

**Goal**: Users receive automated compliance summary emails on a configurable schedule (daily/weekly/monthly), closing the NOTIF-05/06 gap and demonstrating operational maturity for enterprise prospects

**Depends on**: Phase 85

**Requirements**: NOTIF-05, NOTIF-06

**Success Criteria** (what must be TRUE):
  1. `projectSettings` JSON gains `reportSchedule: 'daily' | 'weekly' | 'monthly' | 'off'` and `reportEmail: string` fields; ProjectDetailPage Settings tab has a report schedule selector and email input
  2. A cron job in `src/server/jobs/scheduledReports.ts` runs at 08:00 UTC on the appropriate cadence; for each project with `reportSchedule !== 'off'`, it sends a compliance summary email via nodemailer listing: compliance rate %, open violations count, payroll weeks due in next 7 days, and a "View Project" link
  3. Email template is plain-text + HTML (same nodemailer dual-format pattern as existing emails); unsubscribe token appended to footer links to `POST /api/notifications/unsubscribe`
  4. Scheduled job is registered in `src/server/index.ts` startup and logs schedule confirmation via Pino

**Plans**: 2 plans

Plans:
- [x] 86-01-PLAN.md -- projectSettings schema extension; scheduledReports cron job; nodemailer template; unsubscribe endpoint
- [x] 86-02-PLAN.md -- ProjectDetailPage Settings tab: report schedule selector + email input + save

**UI hint**: yes

---

### Phase 87: Phase A Watchdog Gate

**Goal**: Run automated evidence checks against phases 83–86, compute a score, and declare GATE_PASS (>= 8.55) or GATE_FAIL — gating Phase 88 from starting until the score is on record

**Depends on**: Phase 86 (all Phase A features must be implemented before gate runs)

**Requirements**: SEC-07, SEC-08, SEC-09, SEC-10, PERF-01, PERF-02, NOTIF-05, NOTIF-06

**Success Criteria** (what must be TRUE):
  1. 87-SCORE.md exists in `.planning/phases/87-phase-a-watchdog-gate/` with a row for each of the 10 gate criteria (C1–C10)
  2. Each criterion row shows PASS or FAIL based on a reproducible bash command
  3. The full Vitest suite is green (762+ tests passing) at the time of scoring
  4. Final score >= 8.55 → GATE_PASS declared; score < 8.55 → GATE_FAIL with remediation bullets

WATCHDOG GATE: Score >= 8.55 required before Phase 88 begins.

**Plans**: 1 plan

Plans:
- [x] 87-01-PLAN.md -- Run all 10 gate criterion checks; compute score; write 87-SCORE.md; declare GATE_PASS or GATE_FAIL (GATE_PASS 10.0/10 — 2026-04-27)

**UI hint**: no


---

## v8.0 Production-Ready + DBE Parity + Enterprise SAML (Phases 107-116) — SHIPPED 2026-04-27

**Milestone goal:** Close the single LCPtracker gap (DBE classification flag on subcontractor records + payroll line items + participation % reporting); deliver a fully working SAML SSO handshake replacing the Phase 102 schema stub; harden production deploy with health check path, all missing env vars documented, and a deploy runbook; replace the landing page abbreviation-box state grid with a geographic SVG compliance map; and wire per-seat billing quotas so enterprise pricing is actually enforced in the server.

**Entering v8.0:** 824 tests passing, 0 new TS errors, v7.0.0 tagged. The REST API (`/v1`), webhooks, Stripe billing routes, and plan-tier member limits are fully built. `sso_configs` table exists as a stub with no SAML library or handshake routes. `subcontractors.dbeClassification` column and `payroll_entries.subcontractorId` FK do not exist. `render.yaml` is missing `healthCheckPath` and 9 required env var keys.

---

### Phase A -- DBE Gap Closure (Phases 107-109)

**Goal:** Move DBE/MBE/WBE tracking from BEHIND to AHEAD of LCPtracker: add the classification flag on subcontractor records, surface it on individual payroll line items, and produce a participation % report per project.

- [x] **Phase 107: DBE Classification Flag on Subcontractors** -- `dbeClassification` text column (`none | dbe | mbe | wbe | sdvosb`) on `subcontractors` table; SubcontractorPanel shows flag selector + color badge per sub (DBE-07)
- [x] **Phase 108: DBE Flag on Payroll Line Items** -- nullable `subcontractorId` FK on `payroll_entries`; payroll entry form shows optional sub selector; DBE badge on worker rows where entry references a certified sub; import pipeline accepts subcontractorId (DBE-08)
- [x] **Phase 109: DBE Participation Report + Phase A Watchdog Gate** -- `GET /api/projects/:id/reports/dbe-participation` computes sub labor hours by classification vs. total project hours; DBE Participation tab on ReportsPage with PDF export; gate score >= 9.3/10 (DBE-09) -- WATCHDOG GATE

**Acceptance criteria:**
- Subcontractor record shows `dbeClassification` selector in SubcontractorPanel; color badge (gold=DBE, emerald=MBE, blue=WBE, purple=SDVOSB, gray=None) renders in sub list
- Payroll entry for sub labor row correctly inherits sub DBE flag; visible in audit log
- DBE Participation report shows total project hours, DBE/MBE/WBE/SDVOSB/uncertified hours each as count and % of total, broken down by payroll week
- 0 new TS errors; all tests green

WATCHDOG GATE: Score >= 9.3/10 required before Phase 110 begins.

---

### Phase B -- Full SAML SSO (Phases 110-112)

**Goal:** Enterprise customers can connect their Okta or Azure AD tenant via SAML 2.0; the SP-initiated handshake is complete server-side; SSO login transparently redirects users whose email domain matches a configured tenant.

- [x] **Phase 110: SAML Library + SP Metadata** -- install `@node-saml/node-saml`; `GET /api/sso/metadata` returns valid SP XML; `POST /api/sso/admin/config` parses IdP metadata XML and upserts `sso_configs` row (ENT-03)
- [x] **Phase 111: SAML Handshake + Session Creation** -- `GET /api/sso/login?domain=` generates AuthnRequest and redirects to IdP; `POST /api/sso/acs` validates SAMLResponse (signature + NotOnOrAfter + Audience), provisions user if new, issues JWT session cookie; replay attack protection via in-memory assertion ID dedup (ENT-04)
- [x] **Phase 112: SSO Domain Gating + Admin UI + Phase B Watchdog Gate** -- `POST /api/auth/login` checks email domain against active `sso_configs` before password validation; `/settings/sso` enterprise admin page (config status, metadata upload, SP metadata download, Test Login button); gate score >= 9.3/10 (ENT-05) -- WATCHDOG GATE

**Acceptance criteria:**
- SP metadata endpoint returns valid SAML XML parseable by Okta/Azure AD metadata import
- ACS endpoint validates SAMLResponse signature; rejects tampered or replayed assertions
- User with matching email domain is redirected to IdP on login; after IdP auth, lands on `/dashboard` with valid JWT session cookie
- Non-SSO users unaffected; email/password login continues working for all non-SSO domains

WATCHDOG GATE: Score >= 9.3/10 required before Phase 113 begins.

---

### Phase C -- Production Hardening (Phase 113)

**Goal:** The Render.com deployment has a documented health check path, all required env vars declared in `render.yaml`, and a `DEPLOY.md` runbook covering env var checklist, disk backup, zero-downtime deploy, rollback, and smoke-test steps.

- [x] **Phase 113: Render Health Check + Env Completeness + Deploy Runbook** -- `render.yaml` gains `healthCheckPath: /api/health` and all 9 missing env var keys (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `APP_URL`, `SSO_SP_CERT`, `SSO_SP_KEY`); `DEPLOY.md` at repo root covers 7 sections: Prerequisites, Env Var Checklist, Disk Backup Procedure, Render Rolling Deploy steps, Rollback Procedure, Post-Deploy Smoke Test (7 steps), Known Limitations (OPS-02, OPS-03)

**Acceptance criteria:**
- `render.yaml` `healthCheckPath` value matches the unauthenticated `/api/health` route that returns `{ status: "ok", db: "ok" }`
- Every env var key the server reads via `process.env` at runtime is declared in `render.yaml` with `sync: false` for secrets
- `DEPLOY.md` documents the 7-step smoke test (auth, project create, payroll entry, WH-347 download, API key create, webhook fire, admin/growth view)
- No new application code added -- config and documentation only; all existing tests continue to pass

---

### Phase D -- Landing Page SVG Compliance Map (Phase 114)

**Goal:** The landing page state coverage section displays an actual geographic United States SVG choropleth map with active states filled gold and inactive states outlined -- replacing the abbreviation-box grid that does not communicate geographic coverage at a glance.

- [x] **Phase 114: 50-State SVG Compliance Map** -- `UsComplianceMap.tsx` component with 50 inline `<path>` elements keyed by state abbreviation; active states filled `var(--color-nav-dark)` with gold stroke, inactive states filled `#f3f4f6`; Alaska/Hawaii as insets; hover/tap tooltip (state name + form status); replaces `StateCoverageSection` in `LandingPage.tsx`; no external map library; SVG under 80 KB; responsive at 375px/768px/1280px (UI-17)

**Acceptance criteria:**
- SVG renders at 375px, 768px, and 1280px without horizontal overflow
- 8 active states are visually distinct from inactive states at a glance with no labels required
- Hover tooltip appears on both active and inactive states; never overflows viewport
- No new entry in `package.json` dependencies for a map library
- Total SVG path data under 80 KB

---

### Phase E -- Per-Seat Billing Quotas + v8.0 Ship (Phases 115-116)

**Goal:** Plan tier limits are enforced in the server for project and worker creation, Stripe checkout passes seat count for Pro subscriptions, BillingPage shows usage vs. limits with upgrade CTA, and the v8.0 milestone closes with a Watchdog gate.

- [x] **Phase 115: Per-Seat Billing Quotas** -- `planLimits.ts` gains `maxProjects` and `maxWorkers` per tier (starter: 3 projects / 25 workers, pro/enterprise: unlimited); `POST /api/projects` and `POST /api/projects/:id/workers` enforce caps with 409 + `{ upgradeRequired: true }`; `GET /api/billing/usage` returns current usage counts; `BillingPage.tsx` shows usage card with progress bars and upgrade CTA at >= 80% utilization; Stripe Checkout for Pro passes `quantity: seatCount` (ENT-06, BILL-01)
- [x] **Phase 116: v8.0 Watchdog Gate + Ship** -- 10-criteria SCORE.md in `.planning/phases/116-watchdog-gate-v8-ship/`; LCPtracker re-audit confirms DBE row moves from BEHIND to AHEAD; full test suite green (>= 850 tests); gate score >= 9.3/10; v8.0.0 tag created (OPS-04) -- WATCHDOG GATE

**Acceptance criteria:**
- Starter account blocked from creating a 4th project with "Upgrade to Pro" modal
- Starter account blocked from adding a 26th worker with same upgrade prompt
- Pro Stripe checkout line item reflects actual seat count
- DBE participation report passes LCPtracker re-audit (AHEAD verdict)
- SAML SSO handshake verified with Okta dev account end-to-end
- All tests green; 0 new TS errors beyond two known pre-existing

WATCHDOG GATE: Score >= 9.3/10 required to ship v8.0 milestone.

---

## v8.0 Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 107. DBE Classification Flag on Subcontractors | v8.0 | 1/1 | Complete | 2026-04-27 |
| 108. DBE Flag on Payroll Line Items | v8.0 | 2/2 | Complete | 2026-04-27 |
| 109. DBE Participation Report + Phase A Gate | v8.0 | 2/2 | Complete | 2026-04-27 |
| 110. SAML Library + SP Metadata | v8.0 | 2/2 | Complete | 2026-04-27 |
| 111. SAML Handshake + Session Creation | v8.0 | 2/2 | Complete | 2026-04-27 |
| 112. SSO Domain Gating + Admin UI + Phase B Gate | v8.0 | 2/2 | Complete | 2026-04-27 |
| 113. Render Health Check + Env Completeness + Deploy Runbook | v8.0 | 1/1 | Complete | 2026-04-27 |
| 114. 50-State SVG Compliance Map | v8.0 | 2/2 | Complete | 2026-04-27 |
| 115. Per-Seat Billing Quotas | v8.0 | 2/2 | Complete | 2026-04-27 |
| 116. v8.0 Watchdog Gate + Ship | v8.0 | 1/1 | Complete | 2026-04-27 |

---

## Phase Details (v8.0)

### Phase 107: DBE Classification Flag on Subcontractors

**Goal**: Every subcontractor record carries an explicit DBE classification flag -- the primary gap identified in the v7.0 LCPtracker audit -- making it possible to query which subs are DBE/MBE/WBE-certified at the record level rather than inferring from the separate certifications table

**Depends on**: Phase 106 (v7.0 complete)

**Requirements**: DBE-07

**Success Criteria** (what must be TRUE):
  1. A migration adds `dbe_classification` text column to the `subcontractors` table with a CHECK constraint enforcing values `none | dbe | mbe | wbe | sdvosb`; the column defaults to `'none'`; the Drizzle schema is updated and the migration registered in `meta/_journal.json`
  2. `SubcontractorPanel.tsx` shows a "DBE Classification" select field (None / DBE / MBE / WBE / SDVOSB) on both the add-sub form and the edit-sub form; value is saved via PATCH `/api/projects/:id/subcontractors/:subId` (which accepts the new field)
  3. The subcontractor list in `SubcontractorPanel.tsx` shows a color-coded badge next to each sub name: DBE=gold, MBE=emerald, WBE=blue, SDVOSB=purple, None=gray (no badge)
  4. `GET /api/projects/:id/subcontractors` response includes `dbeClassification` on each sub object; route tests are extended with a case asserting the field is present and defaults to `none`

**Plans**: 1 plan

Plans:
- [x] 107-01-PLAN.md -- Migration (dbe_classification column + CHECK) + Drizzle schema + PATCH route update + SubcontractorPanel select + classification badges + route tests

**UI hint**: yes

---

### Phase 108: DBE Flag on Payroll Line Items

**Goal**: Payroll entries for subcontractor labor carry the sub reference so compliance reports can compute certified payroll hours broken down by DBE status -- this is the specific payroll-line-item flag LCPtracker surfaces and the project currently lacks

**Depends on**: Phase 107 (dbeClassification must exist on subcontractors before payroll entries can reference it)

**Requirements**: DBE-08

**Success Criteria** (what must be TRUE):
  1. A migration adds `subcontractor_id` nullable FK column to `payroll_entries` referencing `subcontractors.id` with SET NULL on delete; existing entries are unaffected (null = GC direct labor); the Drizzle schema is updated
  2. The payroll entry form on `PayrollWeekDetailPage` shows an optional "Subcontractor" select populated from the project sub list; selecting a sub stamps `subcontractorId` on the entry; the field is absent when no subs exist on the project
  3. `PayrollWeekDetailPage` renders a DBE classification badge next to any worker row where the entry has a `subcontractorId` whose `dbeClassification` is non-null and non-`none` -- the badge value is read from the sub record join, not a denormalized column
  4. The payroll import pipeline (`importService.ts`) accepts an optional `subcontractorId` field on import rows; if present and the sub exists on the project, it is stamped on the created entry; if the subId is absent or unknown it is silently ignored

**Plans**: 2 plans

Plans:
- [x] 108-01-PLAN.md -- Migration (subcontractor_id nullable FK on payroll_entries) + Drizzle schema + payroll service extension (include subcontractorId on select/insert) + import pipeline subcontractorId passthrough
- [x] 108-02-PLAN.md -- PayrollWeekDetailPage subcontractor selector + DBE badge on worker rows + integration tests (entry with sub, entry without sub, badge renders correctly)

**UI hint**: yes

---

### Phase 109: DBE Participation Report + Phase A Watchdog Gate

**Goal**: Project owners can view and export a DBE participation summary showing certified sub labor hours as a percentage of total project hours -- the report format required by most federal agency compliance offices -- and the Phase A Watchdog gate confirms the LCPtracker DBE gap is fully closed

**Depends on**: Phase 108 (subcontractorId on payroll_entries must exist for the participation aggregation to be correct)

**Requirements**: DBE-09

**Success Criteria** (what must be TRUE):
  1. `GET /api/projects/:id/reports/dbe-participation` returns: total project payroll hours, hours by classification (dbe/mbe/wbe/sdvosb/uncertified), each as a count and percentage of total project hours, with a per-week breakdown array
  2. `ReportsPage` has a new "DBE Participation" tab showing the summary table with fund-type rows and week columns; a "Download PDF" button generates a one-page PDF with project header and participation breakdown table using `PDFDocument.create()`
  3. The participation % formula matches DOT DBE program requirements: `(certified sub hours / total project hours) * 100` rounded to 2 decimal places; a project with zero sub hours returns 0% (not NaN or null)
  4. Phase A Watchdog gate SCORE.md exists in `.planning/phases/109-phase-a-watchdog-gate-v8/` with 6 criteria covering DBE-07, DBE-08, DBE-09, test suite green, TS clean, and LCPtracker re-audit showing DBE row moves to AHEAD

WATCHDOG GATE: Score >= 9.3/10 required before Phase 110 begins.

**Plans**: 2 plans

Plans:
- [x] 109-01-PLAN.md -- getDbeParticipation() in reportsService.ts + GET /api/projects/:id/reports/dbe-participation route + unit tests (zero hours, mixed GC+sub, all-sub project)
- [x] 109-02-PLAN.md -- DBE Participation tab on ReportsPage (summary table + per-week breakdown + PDF download) + Phase A Watchdog gate SCORE.md

**UI hint**: yes

---

### Phase 110: SAML Library + SP Metadata

**Goal**: The server has a working SAML 2.0 Service Provider implementation with a valid SP metadata endpoint and an admin route for uploading IdP metadata -- the required foundation before any actual IdP handshake can be tested

**Depends on**: Phase 109 (Phase A complete; Phase B SAML work begins)

**Requirements**: ENT-03

**Success Criteria** (what must be TRUE):
  1. `@node-saml/node-saml` is installed and listed in `package.json` dependencies; no breaking changes to existing auth routes; `SSO_SP_CERT` and `SSO_SP_KEY` are documented in `.env.example`
  2. `GET /api/sso/metadata` returns a valid XML SP metadata document with `entityID` matching `APP_URL + /api/sso/acs`, AssertionConsumerService `Location` pointing to `/api/sso/acs`, `NameIDFormat` set to `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`, and the SP certificate when `SSO_SP_CERT` env var is set
  3. `POST /api/sso/admin/config` (requireAuth + owner role check) accepts `{ provider, idpMetadataXml, domain }` -- parses the XML to extract `idpEntityId`, `idpSsoUrl`, `idpCertificate` -- and upserts the `sso_configs` row for the requesting user; returns the parsed values (minus raw cert) for UI confirmation
  4. `GET /api/sso/admin/config` (requireAuth + owner role) returns the current `sso_configs` row for the tenant omitting the raw `idpCertificate` bytes; returns 404 if no config exists

**Plans**: 2 plans

Plans:
- [ ] 110-01-PLAN.md -- Install @node-saml/node-saml; SSO_SP_CERT/SSO_SP_KEY in .env.example; GET /api/sso/metadata SP metadata endpoint
- [ ] 110-02-PLAN.md -- POST /api/sso/admin/config (IdP metadata XML parse + sso_configs upsert) + GET /api/sso/admin/config (read, cert omitted)

**UI hint**: no

---

### Phase 111: SAML Handshake + Session Creation

**Goal**: The complete SAML 2.0 SP-initiated login flow works end-to-end: AuthnRequest sent to IdP, SAMLResponse received and validated at ACS endpoint, user provisioned or looked up, JWT session cookie issued -- identical session shape to email/password login

**Depends on**: Phase 110 (SP metadata and IdP config endpoints must exist; sso_configs row must be writable before ACS can look up the IdP cert)

**Requirements**: ENT-04

**Success Criteria** (what must be TRUE):
  1. `GET /api/sso/login?domain=[domain]` looks up the active `sso_configs` row for that domain, generates a SAML AuthnRequest using `@node-saml/node-saml`, stores the request ID in session, and redirects the browser to the IdP SSO URL via redirect binding; returns 404 if no active config exists for the domain
  2. `POST /api/sso/acs` receives the SAMLResponse form body, validates it: signature check against stored `idpCertificate`, `NotOnOrAfter` not expired, `Audience` matches SP entity ID; extracts the `NameID` email address; any validation failure returns 400 with a non-leaking error message
  3. After successful assertion validation: if a user with that email exists, issues a JWT and sets the httpOnly `token` session cookie using the same `res.cookie(...)` pattern as `POST /api/auth/login`; if no user exists, creates a new `users` row with `planTier = 'starter'` and a random placeholder password hash
  4. Replay protection: the assertion `InResponseTo` ID is stored in a short-lived in-memory Set with 5-minute TTL; a duplicate ID returns 400 `{ error: "Assertion already consumed" }`

**Plans**: 2 plans

Plans:
- [ ] 111-01-PLAN.md -- GET /api/sso/login AuthnRequest generation + redirect binding + domain lookup; replay protection Set with TTL cleanup
- [ ] 111-02-PLAN.md -- POST /api/sso/acs SAMLResponse validation (sig + NotOnOrAfter + Audience) + user provision/lookup + JWT cookie issuance

**UI hint**: no

---

### Phase 112: SSO Domain Gating + Admin UI + Phase B Watchdog Gate

**Goal**: Users whose email domain matches an active SSO config are transparently redirected to their IdP at login; enterprise admins have a self-service UI to configure and test their SSO connection; the Phase B Watchdog gate confirms the full SAML flow works end-to-end

**Depends on**: Phase 111 (ACS endpoint must work before domain gating can redirect to it)

**Requirements**: ENT-05

**Success Criteria** (what must be TRUE):
  1. `POST /api/auth/login` checks the submitted email domain against `sso_configs` before password validation; if an active config is found, returns `{ ssoRedirect: "/api/sso/login?domain=[domain]" }` with HTTP 200 -- the `LoginPage.tsx` client catches this response shape and performs the redirect; email/password login is unchanged for non-SSO domains
  2. `/settings/sso` page (enterprise `planTier` only, owner role only) shows: current config status badge (Not Configured / Pending / Active), IdP metadata XML upload form, domain field, SP metadata download button, and a "Test Login" button that opens the SSO flow in a new tab
  3. The "Test Login" button generates a test AuthnRequest and opens the IdP login page in a new tab; on successful return, the tab posts a message to the parent window and the parent shows a "SSO connection verified" banner
  4. Phase B Watchdog gate SCORE.md exists in `.planning/phases/112-phase-b-watchdog-gate-v8/` with 6 criteria covering ENT-03 through ENT-05, test suite green, TS clean, and a manual-verify note for live Okta end-to-end

WATCHDOG GATE: Score >= 9.3/10 required before Phase 113 begins.

**Plans**: 2 plans

Plans:
- [ ] 112-01-PLAN.md -- POST /api/auth/login SSO domain check + ssoRedirect response shape + LoginPage.tsx client handling of ssoRedirect
- [ ] 112-02-PLAN.md -- /settings/sso enterprise admin page (status + metadata upload + SP download + Test Login) + Phase B Watchdog gate SCORE.md

**UI hint**: yes

---

### Phase 113: Render Health Check + Env Completeness + Deploy Runbook

**Goal**: The production Render.com deployment is fully self-documented -- every secret the server reads is declared in `render.yaml`, the health check path is wired, and a `DEPLOY.md` runbook gives any team member everything needed to deploy, roll back, and smoke-test the app

**Depends on**: Phase 112 (Phase B complete; new SSO env vars are now known before hardening)

**Requirements**: OPS-02, OPS-03

**Success Criteria** (what must be TRUE):
  1. `render.yaml` has `healthCheckPath: /api/health` set on the web service; every env var key the server reads via `process.env` at runtime is present in the `envVars` list with `sync: false` for secrets -- specifically `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `APP_URL`, `SSO_SP_CERT`, `SSO_SP_KEY` are all added
  2. `DEPLOY.md` at repo root covers seven sections: Prerequisites, Env Var Checklist (one row per key: key name, description, where to obtain), Disk Backup Procedure (SQLite `.backup` + Render disk snapshot interval), Render Rolling Deploy Steps, Rollback Procedure (revert to prior tag + env restore), Post-Deploy Smoke Test (7 steps), Known Limitations (SQLite single-writer, 1 GB disk)
  3. The existing `GET /api/health` route is verified to return `{ status: "ok", db: "ok" }` without requiring a session cookie -- Render health poller calls it unauthenticated; if it currently requires auth, the auth gate is removed from that one route only
  4. No new application code is added beyond the potential health route auth fix; all existing tests continue to pass

**Plans**: 1 plan

Plans:
- [ ] 113-01-PLAN.md -- render.yaml healthCheckPath + full env var declaration (9 new keys) + /api/health auth gate removal if needed + DEPLOY.md (7-section runbook)

**UI hint**: no

---

### Phase 114: 50-State SVG Compliance Map

**Goal**: The landing page state coverage section displays a geographic United States SVG choropleth map -- replacing the abbreviation-box grid that does not communicate geographic coverage at a glance -- so prospects understand spatial reach in under 3 seconds

**Depends on**: Phase 113 (production environment stable before landing page changes ship)

**Requirements**: UI-17

**Success Criteria** (what must be TRUE):
  1. A `UsComplianceMap.tsx` component in `src/client/components/` renders an inline SVG US map with 50 `<path>` elements keyed by state abbreviation; the component accepts an `activeStates: string[]` prop; no external map library is added to `package.json`
  2. Active states (CA, WA, NY, IL, TX, MA, NJ, FL) are filled with the `--color-nav-dark` CSS token and stroked with `--color-brand-gold`; inactive states are filled `#f3f4f6` and stroked `#9ca3af`; Alaska and Hawaii are shown as inset boxes positioned below the lower-48
  3. Hovering any state (desktop) or tapping (mobile) shows a tooltip with the state name and either "State-specific certified payroll form available" or "Federal WH-347 supported -- State form coming soon"; tooltip is positioned to never overflow the viewport edge
  4. The `StateCoverageSection` function in `LandingPage.tsx` is replaced with `<UsComplianceMap activeStates={ACTIVE_STATES} />`; the abbreviation-box grid JSX is deleted; the section heading and supporting copy are preserved
  5. The SVG path data (inlined or imported) totals under 80 KB; the component renders without horizontal overflow at 375px, 768px, and 1280px viewport widths

**Plans**: 2 plans

Plans:
- [ ] 114-01-PLAN.md -- UsComplianceMap.tsx: 50-state SVG paths (simplified from public-domain US TopoJSON), active/inactive fill via CSS token props, Alaska/Hawaii insets
- [ ] 114-02-PLAN.md -- Hover/tap tooltip component (never-overflow positioning) + LandingPage.tsx StateCoverageSection replacement + responsive audit at 375px/768px/1280px

**UI hint**: yes

---

### Phase 115: Per-Seat Billing Quotas

**Goal**: Plan tier limits are enforced server-side for project and worker creation, Stripe checkout reflects actual seat count for Pro subscriptions, and BillingPage shows current usage with an upgrade CTA -- making the pricing page copy accurate and the upgrade path frictionless

**Depends on**: Phase 114 (landing page finalized; PricingPage copy change ships together with quota enforcement)

**Requirements**: ENT-06, BILL-01

**Success Criteria** (what must be TRUE):
  1. `planLimits.ts` gains `maxProjects: number` and `maxWorkers: number` per tier: `starter = { maxProjects: 3, maxWorkers: 25, maxMembers: 2 }`, `pro = { maxProjects: Infinity, maxWorkers: Infinity, maxMembers: 10 }`, `enterprise = { maxProjects: Infinity, maxWorkers: Infinity, maxMembers: 999 }` -- `Infinity` is treated as "no limit" in enforcement routes
  2. `POST /api/projects` enforces the project cap: if the owner account's project count (active + archived) equals `maxProjects`, returns 409 `{ error: "Project limit reached. Upgrade to Pro to create unlimited projects.", upgradeRequired: true }` -- the client shows an upgrade modal on this response shape
  3. `POST /api/projects/:id/workers` enforces the worker cap: count of workers across all the owner account's projects; same 409 + `upgradeRequired: true` shape; the client shows the same upgrade modal
  4. `GET /api/billing/usage` (new, requireAuth) returns `{ projectCount, workerCount, memberCount, limits: { maxProjects, maxWorkers, maxMembers } }` derived from the owner account; `BillingPage.tsx` renders a "Usage" card with a progress bar row per dimension and an "Upgrade to Pro" CTA when any dimension is >= 80% of its limit
  5. `PricingPage.tsx` Pro tier description reads "Unlimited projects, unlimited workers, 10 team members"; Stripe Checkout for Pro passes `quantity: memberCount` from the team data so the checkout line item reflects actual seat count

**Plans**: 2 plans

Plans:
- [ ] 115-01-PLAN.md -- planLimits.ts maxProjects + maxWorkers; GET /api/billing/usage endpoint; POST /api/projects quota enforcement + 409 response; POST /api/workers quota enforcement + 409 response; client upgrade modal on upgradeRequired response
- [ ] 115-02-PLAN.md -- BillingPage usage card (3 progress bars + upgrade CTA at >= 80%) + PricingPage Pro copy update + Stripe Checkout seat quantity passthrough

**UI hint**: yes

---

### Phase 116: v8.0 Watchdog Gate + Ship

**Goal**: Automated evidence checks confirm all v8.0 criteria pass, the LCPtracker DBE re-audit shows AHEAD, SAML is verified end-to-end, and v8.0.0 is tagged

**Depends on**: Phase 115 (all v8.0 features complete)

**Requirements**: OPS-04

**Success Criteria** (what must be TRUE):
  1. `116-SCORE.md` in `.planning/phases/116-watchdog-gate-v8-ship/` contains 10 gate criteria (C1-C10): C1 dbeClassification column on subcontractors, C2 subcontractorId FK on payroll_entries, C3 DBE participation report route, C4 SAML metadata endpoint, C5 SAML ACS route registered, C6 SSO domain check in auth/login, C7 render.yaml healthCheckPath, C8 project quota 409 enforcement, C9 SVG map component exists, C10 full test suite green
  2. Each criterion row shows PASS or FAIL with a reproducible bash command as evidence
  3. Full Vitest suite is green (>= 850 tests passing) at time of scoring; 0 new TS errors beyond the two known pre-existing (workers.ts implicit-any, stripeService.ts Stripe version string)
  4. LCPtracker re-audit table updated in the SCORE.md: DBE/MBE/WBE row changes from BEHIND to AHEAD with evidence citation pointing to the new dbeClassification column and participation report
  5. Final score >= 9.3/10 → GATE_PASS declared; v8.0.0 git tag created; ROADMAP.md phases 107-116 updated to Complete

WATCHDOG GATE: Score >= 9.3/10 required to ship v8.0 milestone.

**Plans**: 1 plan

Plans:
- [ ] 116-01-PLAN.md -- Run all 10 gate criterion checks; LCPtracker re-audit; compute score; write 116-SCORE.md; declare GATE_PASS or GATE_FAIL; create v8.0.0 tag

**UI hint**: no

---

## Phase Details (v8.1)

### Phase 119: Dashboard Intelligence

**Goal**: The DashboardPage becomes a live command center — a hero stat row shows active projects, open violations, and weeks due this week; a 12-week compliance trend sparkline shows trajectory at a glance; a projects-at-risk panel surfaces the top 5 stale-violation projects; and project cards show specific violation counts instead of a generic badge — so a GC can assess their entire portfolio in under 10 seconds without clicking into any project

**Depends on**: Phase 118 (React Native mobile app complete; no blocking dependencies)

**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04

**Success Criteria** (what must be TRUE):
  1. `DashboardPage.tsx` renders a hero stat row with three cards: "X Active Projects" (count of non-archived projects for owner account), "Y Open Violations" (total COMP violations across all active projects with status != resolved), "Z Weeks Due This Week" (payroll weeks whose due date falls within the current calendar week and are not yet submitted); stats fetched from `GET /api/dashboard/stats` (new endpoint); React Query `staleTime: 60000`
  2. `GET /api/dashboard/stats` (requireAuth) returns `{ activeProjects: number, openViolations: number, weeksDueThisWeek: number }` computed from owner account's projects; response time < 200ms (single SQL query with joins); endpoint covered by at least 2 Vitest tests
  3. `DashboardPage.tsx` renders a "Compliance Trend" section below the stat row: a `ComplianceTrendChart` component showing weekly total violation counts for the last 12 weeks as a line chart using recharts (already a dependency — do not add a new charting library); data from `GET /api/dashboard/compliance-trend` returning `{ weeks: Array<{ weekLabel: string, violationCount: number }> }` ordered oldest-first; empty state shows "No violation data yet" placeholder
  4. `DashboardPage.tsx` renders a "Projects at Risk" panel showing the top 5 projects with open violations older than 7 days, sorted descending by violation count; each row shows project name, violation count chip (crimson), and a "View" link to `/projects/:id`; data from `GET /api/dashboard/at-risk` returning `{ projects: Array<{ id, name, openViolationCount, oldestViolationDays }> }`; panel hidden when no at-risk projects exist (not shown as empty — omitted entirely)
  5. Project cards on DashboardPage (existing `ProjectCard` or equivalent) show specific open violation count as a crimson badge (e.g., "3 violations") instead of the current generic "Has Violations" indicator; zero-violation projects show a green "Compliant" badge; badge data sourced from the existing batch-summary endpoint or the new `GET /api/dashboard/stats` response shape (whichever avoids an N+1 query)

**Plans**: 2 plans

Plans:
- [x] 119-01-PLAN.md -- GET /api/dashboard/stats + GET /api/dashboard/compliance-trend + GET /api/dashboard/at-risk endpoints; Vitest tests for all 3; no N+1 queries
- [x] 119-02-PLAN.md -- DashboardPage hero stat row + ComplianceTrendChart (recharts) + ProjectsAtRisk panel + project card violation count badge

**UI hint**: yes

---

### Phase 120: Apprenticeship Enforcement Suite

**Goal**: Apprenticeship ratio enforcement is complete end-to-end — GCs configure per-trade ratios on each project, worker profiles capture RAPIDS numbers, the compliance engine fires COMP-04 (per-trade daily ratio violation) and COMP-05 (IRA/IIJA 15% threshold), and PayrollWeekDetailPage shows the per-trade breakdown with estimated wage liability so a GC can defend any DOL audit

**Depends on**: Phase 119

**Requirements**: APP-01, APP-02, APP-03, APP-04, APP-05

**Success Criteria** (what must be TRUE):
  1. `projects` table has `apprenticeship_requirements` JSON column (migration); `ProjectForm.tsx` shows an "Apprenticeship Ratios" section (visible when funding type is federal/state) with trade dropdown + ratio input (e.g., "1:2"); supports multiple trades per project; saved to DB on form submit
  2. `workers` table has `apprenticeship_program_name` (text) and `rapids_number` (text) columns (migration); `WorkersPage.tsx` shows these fields on the worker form when `isApprenticeship` is true; both fields optional but shown with placeholder guidance
  3. `complianceService.ts` fires `COMP-04` violation: on payroll week save, for each trade with configured ratio, compute daily `jw_hours` and `apprentice_hours`; if `apprentice_hours > jw_hours * ratio`, fire COMP-04 with trade, day, excess hours, and `estWageLiability = excessHours * (jwRate - apprenticeRate)`; at least 3 Vitest tests covering ratio pass, ratio fail, and zero-apprentice-hours cases
  4. When project has `ira_iija_project = true` boolean flag (new column on projects), dashboard shows "Apprentice Hours %: X% of Y total hours" with 15% threshold indicator; compliance engine fires `COMP-05` if apprentice % drops below 15% on any week; IRA banner visible on ApprenticeshipDashboard (Phase 117 component)
  5. `PayrollWeekDetailPage.tsx` violation panel for COMP-04 shows per-trade breakdown: "Electricians: 4 apprentice hrs, 2 JW hrs (max 2). Excess: 2 hrs. Est. wage adjustment: $XX." — not a generic ratio flag; COMP-05 shows "IRA/IIJA threshold: 12.3% (below 15% — X hrs deficit)"

**Plans**: 1 plan

Plans:
- [x] 120-01-PLAN.md -- WA add-worker apprenticeship inputs (APP-02 parity) + structured COMP-04 violation row in PayrollWeekDetailPage main panel and WH-347 preflight modal (APP-05) + 6 new Vitest cases for COMP-04/COMP-05 (APP-03/APP-04 coverage); server logic and schema already shipped in prior phases

**UI hint**: yes

---

### Phase 121: QuickBooks Employee + Time Import

**Goal**: The QuickBooks Online integration is complete — field workers' employee records import directly from QB into Workers, and timesheet hours from QB TimeActivity records flow through the existing import pipeline into payroll entries, eliminating the CSV download step for QB Online users

**Depends on**: Phase 120

**Requirements**: QB-02, QB-03

**Success Criteria** (what must be TRUE):
  1. `GET /api/integrations/qbo/employees` (already scaffolded) returns QB Employee list; `IntegrationsPage.tsx` shows a "Import Employees from QuickBooks" preview table with columns: QB name, mapped worker name, SSN (masked), address; user selects rows and clicks "Import Selected"; server creates workers via existing worker creation logic; duplicate detection by name match shows "already exists" warning instead of creating duplicate
  2. `GET /api/integrations/qbo/timeactivities?startDate=&endDate=&projectId=` fetches QB TimeActivity records for the date range; maps hours to existing `importService.ts` pipeline (worker matching by name, conflict detection, preview-then-commit pattern identical to CSV import); daily M-Su split: if QB stores weekly totals, shows confirmation prompt "QB stores weekly hours — split evenly across days?"; at least 2 Vitest tests for the route (auth 401, shape)
  3. `IntegrationsPage.tsx` has a "Sync Timesheet" section: date range pickers (start/end), project selector, "Preview Import" button; preview table shows worker, day-by-day hours, ST/OT/DT split; "Commit Import" button uses existing import commit endpoint; success toast shows count of entries created

**Plans**: 2 plans

Plans:
- [x] 121-01-PLAN.md -- POST /api/integrations/qbo/import-employees route (server-side SSN re-fetch + name dedup + assertProjectAccess) + EmployeeImportSection in IntegrationsPage + tests/routes/integrations.test.ts
- [x] 121-02-PLAN.md -- SyncTimesheetSection in IntegrationsPage (date pickers, payroll-week selector, preview, classificationId resolution, daily-split gate, commit via /api/payroll/import/commit with provider:quickbooks) + sync-time route tests

**UI hint**: yes

---

### Phase 122: DBE Certification Management

**Goal**: Subcontractors have full certification lifecycle management — GCs record DBE/MBE/WBE/SBE/8(a)/HUBZone certifications with expiry dates, receive email alerts before expiry, and the CPR upload portal blocks subs with expired or suspended certifications — making the app the single source of truth for DBE compliance on federal and state-funded projects

**Depends on**: Phase 121

**Requirements**: DBE-01, DBE-02, DBE-03, DBE-04, DBE-05, DBE-06

**Success Criteria** (what must be TRUE):
  1. `subcontractor_certifications` table exists (migration): id, subcontractor_id FK, cert_type (text — DBE/MBE/WBE/SBE/ACDBE/8a/HUBZone), certifying_agency, cert_number, naics_codes, issue_date, expires_date, owner_race, owner_gender, personal_net_worth_usd, reevaluation_status (text: not_required/pending/cleared/suspended), self_certified boolean, document_path, created_at, updated_at
  2. `SubcontractorPanel.tsx` (or equivalent) has "+ Add Certification" form per sub with all fields from SC-1; edit and delete within panel; multiple certs per sub supported; form validates that expires_date > issue_date
  3. Scheduled job (reuses existing cron/alert pattern) sends Resend email at 90/60/30 days before `expires_date` with sub name, cert type, days remaining; email template matches existing compliance alert style; at least 1 Vitest test for the expiry-check function
  4. Public CPR upload portal (`/upload/:token`) blocks upload with inline warning "Sub's DBE certification expired — resolve before accepting CPR" when sub's active cert is expired OR `reevaluation_status = 'suspended'`; warning shown in SubcontractorPanel too; non-blocking for subs with no certifications
  5. `ProjectDetailPage.tsx` has "DBE/MBE/WBE Participation" card: active certified subs count, expired cert warnings count, subs under DOT reevaluation count; clicking opens sub certification detail view
  6. Certification form labels `reevaluation_status` as "DOT Oct 2025 IFR Status" with tooltip "DOT issued revised DBE rules Oct 3 2025 — existing certifications require reevaluation"; certs imported/created before Oct 3 2025 default to `reevaluation_status = 'pending'`

**Plans**: 3 plans

Plans:
- [x] 122-01-PLAN.md -- subcontractor_certifications migration + CRUD routes (GET/POST/PATCH/DELETE) + SubcontractorPanel cert form UI
- [x] 122-02-PLAN.md -- Resend expiry alert job (90/60/30 days) + CPR upload portal cert gate + DBE-04 SubcontractorPanel warning
- [x] 122-03-PLAN.md -- ProjectDetailPage DBE participation card (DBE-05) + DOT IFR 2025 label + reevaluation_status default logic (DBE-06)

**UI hint**: yes

---

### Phase 123: SOC 2 Foundation + MFA

**Goal**: The SOC 2 observation clock is running — owner accounts have TOTP MFA protecting sensitive operations, all security events flow to an immutable log drain, and the audit log has a SHA-256 hash chain that an auditor can verify was not tampered with — making the app enterprise-ready for government procurement that requires SOC 2 evidence

**Depends on**: Phase 122

**Requirements**: SEC-01, SEC-02, SEC-03

**Success Criteria** (what must be TRUE):
  1. `otplib ^12.x` and `qrcode ^1.5.x` installed; `user_mfa` table (id, user_id FK unique, totp_secret text AES-256-GCM encrypted, recovery_codes text AES-256-GCM encrypted — 10 bcrypt-hashed one-time codes, enrolled_at); owner-role users see MFA enrollment prompt on next login after feature ships; `POST /api/auth/mfa/enroll` returns QR data URL + recovery codes (shown once); `POST /api/auth/mfa/verify` validates TOTP token; MFA required on login (if enrolled), ownership transfer, team invite revocation
  2. Pino JSON output piped to Logtail/Better Stack via HTTPS drain; `LOGTAIL_SOURCE_TOKEN` env var; all `security_events` rows also forwarded; logs immutable at destination; `LOGTAIL_SOURCE_TOKEN` added to `.env.example` and `render.yaml` env var list; at least 1 integration test confirming the transport is configured
  3. `audit_logs` table gains `prev_hash` (text) and `row_hash` (text) columns (migration); `insertAuditLog()` computes `row_hash = SHA256(id + action + diff + prev_hash)`; backfill migration hashes existing rows in chronological order; `GET /api/audit/verify-chain` (admin only) returns `{ valid: boolean, firstInvalidId: string | null }` for auditor use

**Plans**: 2 plans

Plans:
- [x] 123-01-PLAN.md -- user_mfa table migration + TOTP enroll/verify routes + MFA enforcement on login + ownership transfer + team invite revocation
- [x] 123-02-PLAN.md -- Logtail HTTPS drain transport + audit_log hash chain migration + backfill + chain verify route

**UI hint**: no

---

### Phase 124: Public REST API + Webhooks

**Goal**: Enterprise customers and integration partners can access project and compliance data via authenticated API keys, receive webhook events for key actions, and explore the API via Swagger UI — making the app the only prevailing wage platform with a public integration API and enabling the Procore partnership pathway

**Depends on**: Phase 123

**Requirements**: API-01, API-02, API-03, API-04, API-05

**Success Criteria** (what must be TRUE):
  1. `api_keys` table (id, user_id FK, key_hash SHA-256, name, last_used_at, expires_at nullable, created_at); `POST /api/keys` creates key (shown once — raw key never stored), `GET /api/keys` lists name + last4 only, `DELETE /api/keys/:id` revokes; rate limit 100 req/min per key hash; Settings page has "API Keys" tab with create/list/revoke UI
  2. Public REST API v1: `GET /api/v1/projects`, `GET /api/v1/projects/:id`, `GET /api/v1/projects/:id/payroll-weeks`, `GET /api/v1/projects/:id/payroll-weeks/:weekId/compliance`; Bearer token (API key) auth; JSON responses; rate-limited; all requests audit-logged; at least 4 Vitest tests (auth, shape, pagination)
  3. `openapi.json` in repo root auto-generated from route definitions; served at `GET /api/docs` (JSON) and rendered at `GET /api/docs/html` (Swagger UI via `swagger-ui-express`); spec covers all v1 endpoints with request/response schemas and Bearer auth description
  4. `webhooks` table (id, user_id FK, url, events JSON array, secret, active boolean, created_at); `POST /api/webhooks`, `GET /api/webhooks`, `DELETE /api/webhooks/:id`; SSRF protection (DNS pre-resolve, block RFC 1918); payload signed with HMAC-SHA-256 `X-PW-Signature` header; events: `payroll_week.created`, `payroll_week.submitted`, `compliance.violation_detected`
  5. `webhook_deliveries` table; `setInterval` 30s polling attempts delivery with exponential backoff, max 5 attempts, then `status = failed`; Settings → Webhooks shows delivery log with last error + retry count + manual "Retry" button

**Plans**: 3 plans

Plans:
- [x] 124-01-PLAN.md -- api_keys table + rate limiting + Settings API Keys tab + public v1 endpoints (GET only) + Vitest tests
- [x] 124-02-PLAN.md -- OpenAPI 3.1 spec generation + swagger-ui-express at /api/docs/html
- [ ] 124-03-PLAN.md -- webhooks table + SSRF check + HMAC signing + webhook_deliveries queue + Settings Webhooks UI

**UI hint**: yes

---

### Phase 125: Core Page Premium UI

**Goal**: Every page a prospect sees during a demo feels premium — ProjectDetail, PayrollList, PayrollWeekDetail, Workers, and Reports all use design-token-consistent elevated cards; skeleton loading states replace blank-white flashes; contextual empty states guide users to first action; framer-motion route transitions add polish; mobile responsiveness passes a 375px/768px/1024px audit on all 5 pages

**Depends on**: Phase 124

**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11

**Plans**: 3 plans

Plans:
- [ ] 125-01-PLAN.md -- UI-01 ProjectDetailPage + UI-02 PayrollListPage premium treatment (elevated cards, status badges via design tokens, empty states)
- [ ] 125-02-PLAN.md -- UI-03 PayrollWeekDetailPage + UI-04 WorkersPage premium treatment; UI-05 ReportsPage report cards; UI-06 framer-motion AnimatePresence fade-slide on route changes
- [ ] 125-03-PLAN.md -- UI-07 to UI-09 mobile responsive audit (375/768/1024px, 44px tap targets, font-size 16px inputs); UI-10 skeleton loading on 5 pages; UI-11 contextual empty states on all list views

**UI hint**: yes
