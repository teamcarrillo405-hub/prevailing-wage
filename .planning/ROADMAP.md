# Roadmap: HCC Prevailing Wage



## Milestones



- â **v1.0** Foundation + Wage Engine + Payroll + Differentiators â Phases 1-5 (shipped 2026-03-19)

- â **v2.0** Contractor UX Overhaul + Compliance â Phases 6-9 (shipped 2026-03-20)

- â **v2.1** Design Polish + Landing Page â Phases 10-14 (shipped 2026-03-22)

- â **v2.2** UX Completion + Compliance Hardening â Phases 15-16 (shipped 2026-03-23)

- â **v2.3** Contractor Workflow Efficiency + Audit Readiness â Phases 17-22 (shipped 2026-03-24)

- â **v2.4** Ship-Ready + Design Elevation â Phases 23-28 (shipped 2026-03-27)

- â **v2.5** State Portal Integration â Phases 29-30 (shipped 2026-03-27)

- â **v3.0** Team & Integration â Phases 31-36 (shipped 2026-03-31)



## Phases



<details>

<summary>â v1.0 Foundation + Wage Engine + Payroll + Differentiators (Phases 1-5) â SHIPPED 2026-03-19</summary>



Auth, project creation, SAM.gov wage determination fetch and cache, workers/classifications, weekly payroll entry, WH-347 PDF generation, CSV export, OT scenario comparison, union allocations, GSA rate builder, job cost variance reporting with PDF.



Plans are not archived here â built before GSD structure. See MILESTONES.md.



</details>



<details>

<summary>â v2.0 Contractor UX Overhaul + Compliance (Phases 6-9) â SHIPPED 2026-03-20</summary>



- [x] **Phase 6: WH-347 2025 Compliance Foundation** â programName/J/RA field, multi-page WH-347, certApprentices boolean from real data (4/4 plans â 2026-03-20)

- [x] **Phase 7: Compliance Engine + Payroll Week View** â under-wage/CWHSSA OT detection, PayrollWeekDetailPage, one-click WH-347 (4/4 plans â 2026-03-20)

- [x] **Phase 8: Dashboard + UX Polish** â compliance badges on project cards, nav links, missing-data warnings, WH-347 per row (4/4 plans â 2026-03-20)

- [x] **Phase 9: Reports** â fringe benefit summary and worker pay history reports (4/4 plans â 2026-03-20)



Archive: `.planning/milestones/v2.0-ROADMAP.md`



</details>



<details>

<summary>â v2.1 Design Polish + Landing Page (Phases 10-14) â SHIPPED 2026-03-22</summary>



- [x] **Phase 10: CSS Design Token Foundation** â HCC brand tokens in @theme, Google Fonts, inline style migration, focus utility fix (3/3 plans â 2026-03-20)

- [x] **Phase 11: UI Primitives** â Card, Button, Badge, PageHeader, EmptyState reusable components (2/2 plans â 2026-03-20)

- [x] **Phase 12: App Shell + Global Layout** â dark nav on all protected pages, typography hierarchy, consistent card spacing (3/3 plans â 2026-03-20)

- [x] **Phase 13: Landing Page + Routing** â full marketing homepage at public route "/", auth-aware routing (3/3 plans â 2026-03-20)

- [x] **Phase 14: Page-by-Page Polish** â Dashboard, Project Detail, Workers, Payroll Entry, Payroll Week Detail, Reports, Login/Register (3/3 plans â 2026-03-22)



Archive: `.planning/milestones/v2.1-ROADMAP.md`



</details>



<details>

<summary>â v2.2 UX Completion + Compliance Hardening (Phases 15-16) â SHIPPED 2026-03-23</summary>



- [x] **Phase 15: Compliance Engine Hardening + Independent Frontend** â Apprentice ratio check in computeCompliance(), workflow progress indicator on Project Detail, print CSS for both reports (3/3 plans â 2026-03-22)

- [x] **Phase 16: WH-347 Submission UX** â Preflight modal with violation summary + confirmation, fetch-driven download with generating state and double-click guard (1/1 plans â 2026-03-22)



Archive: `.planning/milestones/v2.2-ROADMAP.md`



</details>



<details>

<summary>â v2.3 Contractor Workflow Efficiency + Audit Readiness (Phases 17-22) â SHIPPED 2026-03-24</summary>



- [x] **Phase 17: DB Migration + Project Archive** â 4-column payrollWeeks migration, project archive/restore, archived badge, compliance pre-check before archive (2/2 plans â 2026-03-23)

- [x] **Phase 18: Dashboard Search + Filter** â name search, funding type filter, URL-persisted filter state, zero-results empty state (1/1 plans â 2026-03-23)

- [x] **Phase 19: WH-347 Submission Tracking** â mark weeks submitted with date/agency, server-side edit lock, un-submit, submitted badges on payroll list (2/2 plans â 2026-03-23)

- [x] **Phase 20: Copy Previous Payroll Week** â copy week to pre-fill new entry, live rate re-fetch per classification, skipped-entries warning (2/2 plans â 2026-03-23)

- [x] **Phase 21: Payroll Amendment Workflow** â amend submitted week as new row, "N (AMENDED M)" WH-347 label, pre-filled entries from original (2/2 plans â 2026-03-23)

- [x] **Phase 22: Per-Worker Compliance History** â cross-project violation history page, compliance history link per worker row (2/2 plans â 2026-03-24)



Archive: `.planning/milestones/v2.3-ROADMAP.md`



</details>



<details>

<summary>â v2.4 Ship-Ready + Design Elevation (Phases 23-28) â SHIPPED 2026-03-27</summary>



- [x] **Phase 23: Dashboard Compliance Filter + CSV Export** - Batch compliance summary endpoint, dashboard filter chips, and CSV download from compliance history (DASH-05, AUD-03) (completed 2026-03-24)

- [x] **Phase 24: California DIR A-1-131 Form** - DT schema migration, CA-specific project fields, CA certified payroll PDF generation with daily OT/DT model and eCPR disclosure (CAL-01, CAL-02, CAL-03) (completed 2026-03-25)

- [x] **Phase 25: Washington L&I F700-065-000 Form** - Manual rate entry for WA projects, WA trade code mapping, WA certified payroll PDF generation (WAL-01, WAL-02) (completed 2026-03-26)

- [x] **Phase 26: Contractor Guidance System** - HelpText primitive, contextual help across all major pages, instructional empty states, inline compliance term tooltips (UX-05, UX-06, UX-07, UX-08) (completed 2026-03-26)

- [x] **Phase 27: Design Elevation** - Construction photography, dark gold gradient overlays, elevated card shadows, richer typography matching HCC website standard (DES-01, DES-02, DES-03) (completed 2026-03-27)

- [x] **Phase 28: Production Deployment** - Render.com deployment with persistent SQLite disk, invite-only registration, environment variable hygiene, Vite static file serving (OPS-01, OPS-02, OPS-03, OPS-04) (completed 2026-03-27)



</details>



### v2.5 State Portal Integration (Phases 29-30) â SHIPPED 2026-03-27



- [x] **Phase 29: CA eCPR XML Export** - Fringe disaggregation DB columns + CA payroll UI, CA DIR eCPR XML download, pre-generation modal for missing fields, post-download portal checklist, amendment XML marker
 (completed 2026-03-27)

- [x] **Phase 30: WA PWIA Submission Assist** - WA CPR XML download gated on intentId + trade code validation, WA Intent to Pay + Affidavit submission summary panel (completed 2026-03-27)



<details>

<summary>â v3.0 Team & Integration (Phases 31-36) â SHIPPED 2026-03-31</summary>



- [x] **Phase 31: SSN Encryption Foundation** - AES-256-GCM encryption at rest, cryptoService.ts, key versioning envelope, CA eCPR XML updated to write real SSN (SEC-01, SEC-02, SEC-03) (completed 2026-03-28)

- [x] **Phase 32: Multi-User Auth Foundation** - project_members schema + assertProjectAccess refactor across 9 route files, cross-tenant test suite, createdByUserId/updatedByUserId on payroll_entries (MT-03) (completed 2026-03-28)

- [x] **Phase 33: Team Invite Flow + Team UI** - Email invite with tokenized link, team member list, ownership transfer, member removal with data retention (MT-01, MT-02, MT-04, MT-05) (completed 2026-03-30)

- [x] **Phase 34: Agency Submission Status Tracking** - caEcprSubmittedAt + waLniSubmittedAt columns, SubmissionStatusBadge, "Mark as Submitted" UI in CA/WA export modals (AS-01, AS-02) (completed 2026-03-30)

- [x] **Phase 35: Payroll Import â Server Pipeline** - importService.ts with provider auto-detection, qbMapper.ts + adpMapper.ts, preview + commit routes, payroll_imports audit table (PI-01, PI-02) (completed 2026-03-31)

- [x] **Phase 36: Payroll Import â React UI** - PayrollImportModal with file picker, preview table, unmatched worker review & match screen, confirm-commit flow (PI-03) (completed 2026-03-31)



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

- [x] 17-01-PLAN.md â DB migration (4 payrollWeeks columns) + status-filtered GET /api/projects route + tests

- [x] 17-02-PLAN.md â Archive/Restore UI (ProjectDetailPage buttons, compliance advisory modal, ProjectCard badge, DashboardPage toggle)



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

- [x] 18-01-PLAN.md â Search input + funding dropdown + useMemo filtered list + URL-persisted params + empty state (DashboardPage.tsx only)



### Phase 19: WH-347 Submission Tracking

**Goal**: Contractors can formally record when a WH-347 has been submitted and to whom, and the system enforces that submitted weeks are read-only

**Depends on**: Phase 17 (submitted_at, submitted_to columns from migration)

**Requirements**: SUB-01, SUB-02, SUB-03

**Success Criteria** (what must be TRUE):

  1. User can mark a payroll week as submitted by entering a submission date and agency name, and the week shows a submitted badge

  2. Attempting to edit payroll entries on a submitted week is rejected â both in the UI and at the API level

  3. User can un-submit a week to clear its submission status and re-enable editing

  4. PayrollListPage shows submitted/not-submitted status for each week at a glance

**Plans**: 2 plans

Plans:

- [x] 19-01-PLAN.md â Wave 0 tests + PATCH/DELETE submit routes + assertWeekNotSubmitted lock guard in both entry write routes

- [ ] 19-02-PLAN.md â PayrollListPage submission badges + PayrollWeekDetailPage submit form + lock UI + WorkflowProgress step 4 fix



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

- [x] 20-01-PLAN.md â copyPayrollWeek() service + POST /api/payroll/weeks/copy route (preview + commit modes) + integration tests

- [x] 20-02-PLAN.md â Copy modal UI on PayrollListPage (source week selector, preview warning, confirm/cancel) + browser verification



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

- [x] 21-01-PLAN.md â amendPayrollWeek() service + POST /weeks/amend route + "N (AMENDED M)" PDF label + integration tests

- [x] 21-02-PLAN.md â "Amend This Week" button on PayrollWeekDetailPage + amendment badge on PayrollListPage + browser verification



### Phase 22: Per-Worker Compliance History

**Goal**: Contractors can see a single page showing all compliance violations for a specific worker across every project and payroll week â ready for audit response

**Depends on**: Nothing (read-only reporting; fully independent of Phases 17-21)

**Requirements**: AUD-01, AUD-02

**Success Criteria** (what must be TRUE):

  1. User can click "Compliance History" next to any worker on the Workers page and land on a page showing all that worker's violations across all projects

  2. The violation list shows project name, payroll week, violation type, and the amounts involved for each entry

  3. A worker with no violations across any project shows a clear "no violations found" state

  4. Worker identity is correctly matched across projects using name and SSN last 4 (not project-scoped worker ID)

**Plans**: 2 plans

Plans:

- [ ] 22-01-PLAN.md â getWorkerComplianceHistory() service + GET /worker/:workerId/history endpoint + multi-project integration tests (TDD)

- [x] 22-02-PLAN.md â WorkerComplianceHistoryPage + "Compliance History" link on WorkersPage + route registration + browser verification



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

- [x] 23-01-PLAN.md â Batch compliance summary endpoint + CSV export route + csv-stringify install + integration tests

- [x] 23-02-PLAN.md â Dashboard filter chips UI + CSV download button + browser verification



### Phase 24: California DIR A-1-131 Form

**Goal**: Contractors on California public works projects can generate a California DIR A-1-131 certified payroll PDF that correctly captures daily overtime and double-time hours per CA Labor Code requirements

**Depends on**: Phase 23 (independent of filter/CSV work, but Phase 23 is sequenced first as a quick win)

**Requirements**: CAL-01, CAL-02, CAL-03

**Success Criteria** (what must be TRUE):

  1. CA project creation form includes CSLB contractor license and WC policy number fields visible only when state is California

  2. Payroll entry for a CA project shows separate ST / OT / DT hour columns per day (Sun-Sat), where DT applies after 12 hours/day

  3. User can click "Download CA A-1-131" on a CA project's payroll week and receive a completed PDF with correct daily hour grid, fringe contributions in the fringe section (not deductions), and SDI deduction field

  4. The CA download preflight modal includes a persistent disclosure that electronic submission requires the DIR eCPR portal at efiling.dir.ca.gov/eCPR

  5. A WA or federal-only project has no CA form download button â the button is state-gated

**Plans**: 3 plans

Plans:

- [x] 24-01-PLAN.md â PDF download + DB migrations (DT columns + CA project fields) + schema.ts + server Zod schemas + test stubs

- [x] 24-02-PLAN.md â CA-conditional project fields in ProjectForm + DT columns in PayrollWeekForm + turn CAL-01/CAL-03 tests GREEN

- [ ] 24-03-PLAN.md â A-1-131 PDF generator + export route + state-gated download button + eCPR preflight modal + browser verification



### Phase 25: Washington L&I F700-065-000 Form

**Goal**: Contractors on Washington public works projects can enter WA prevailing wage rates manually and generate a Washington L&I F700-065-000 certified payroll PDF with correct WA trade code mapping

**Depends on**: Phase 24 (WA state form follows CA form pattern; CA establishes the state-specific project field and conditional download button pattern that WA reuses)

**Requirements**: WAL-01, WAL-02

**Success Criteria** (what must be TRUE):

  1. WA project workers have a manual prevailing wage rate entry field (since SAM.gov does not cover WA rates), and the entered rate is used for compliance and PDF generation

  2. User can click "Download WA F700-065-000" on a WA project's payroll week and receive a completed PDF with WA 4-letter trade codes (CARP, ELEC, LABO, etc.), UBI number, L&I certificate, and WC account fields populated

  3. The WA download includes a disclosure that Intent to Pay and Affidavit of Wages filings must be submitted via the PWIA portal at secure.lni.wa.gov

  4. WA trade codes not automatically matched show a dropdown allowing the contractor to select the correct L&I code per worker

  5. A CA or federal-only project has no WA form download button â the button is state-gated

**Plans**: 2 plans



### Phase 26: Contractor Guidance System

**Goal**: First-time contractors understand what to do at every step of the workflow without needing external documentation

**Depends on**: Phase 27 (HelpText primitive uses design tokens that Phase 27 finalizes â sequence after design tokens are locked; however if design tokens are locked early, Phase 26 can run before Phase 27)

**Requirements**: UX-05, UX-06, UX-07, UX-08

**Success Criteria** (what must be TRUE):

  1. The landing page includes a plain-language "how it works" section explaining Davis-Bacon compliance workflow in contractor terms, visible without scrolling below the hero

  2. Each major page (Dashboard, Project Detail, Workers, Payroll Entry, Payroll Week Detail) shows a contextual help callout explaining what to do at that step and why it matters for compliance

  3. Empty states on all pages give specific next-step instructions â a contractor who lands on an empty Workers page knows exactly what to do next, not just that there are no workers

  4. Clicking or tapping a "?" icon next to terms like "Davis-Bacon," "WH-347," "prevailing wage," "CWHSSA," and "WD" shows a plain-English definition â works on both desktop hover and iPad tap

**Plans**: 2 plans

Plans:

- [x] 26-01-PLAN.md â HelpCallout + TermTooltip primitives, landing page 4-step rewrite, HelpCallout on all 5 pages + PayrollListPage migration

- [x] 26-02-PLAN.md â Empty state content updates with action buttons + TermTooltip inline placement across all pages



### Phase 27: Design Elevation

**Goal**: The app visual design matches HCC website quality â construction photography, dark gold gradients, and elevated card depth that distinguishes HCC from generic compliance software

**Depends on**: Phase 23 (independent of form generation work; can begin any time after v2.3 baseline)

**Requirements**: DES-01, DES-02, DES-03

**Success Criteria** (what must be TRUE):

  1. The landing page hero features full-bleed construction photography with a dark overlay, Oswald display headline at clamp(56px, 8vw, 88px), and a high-contrast gold CTA button

  2. Dashboard project cards use an elevated shadow variant (0 8px 24px rgba(0,0,0,0.12)) visually distinct from the flat card used in v2.3

  3. All pages use tighter Oswald letter-spacing and improved vertical rhythm matching HCC website typography â no page uses a raw h1/h2 outside the PageHeader primitive

  4. Photography assets are WebP format, under 200KB each, loaded via CSS background-image (not Vite import), with a print media override preventing dark overlays from printing on white paper

**Plans**: 2 plans

Plans:

- [x] 27-01-PLAN.md â Shadow-card-elevated token + print CSS + PageHeader tracking-tight + ProjectCard className prop + HelpCallout shadow + h1 migration (7 pages)

- [x] 27-02-PLAN.md â Placeholder WebP photos + hero section rewrite (photo overlay, floating nav, clamp headline) + dashboard photo background strip + visual checkpoint



### Phase 28: Production Deployment

**Goal**: The app is live at a public HTTPS URL on Render.com with persistent data storage, invite-only registration, and all secrets properly configured via environment variables

**Depends on**: Phases 23-27 (all features complete; however Render service and disk infrastructure can be configured at any earlier phase)

**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04

**Success Criteria** (what must be TRUE):

  1. App is reachable at a public HTTPS URL and the landing page loads without errors

  2. A project created after the first deploy survives a second redeploy â confirming the SQLite database is on the persistent disk at /var/data and not the ephemeral container filesystem

  3. Attempting to register without a valid invitation code returns a clear error â open registration is disabled

  4. All secrets (SAM.gov API key, JWT secret, database path) are set as Render runtime environment variables and are absent from the deployed JavaScript bundle â no VITE_-prefixed secrets exist

  5. The Vite production build is served as static files by Express, and all React routes resolve correctly on hard refresh (SPA catch-all in place)

**Plans**: 2 plans

Plans:

- [x] 28-01-PLAN.md â Wave 0 invite code tests + tsconfig.server.json + build script + db mkdirSync fix + static file serving + invite code gate + .env.example + render.yaml

- [x] 28-02-PLAN.md â RegisterForm invite code field + brand token fix + Render deploy smoke test checkpoint



### Phase 29: CA eCPR XML Export

**Goal**: Contractors on California projects can generate a CA DIR eCPR-compliant XML file with correctly disaggregated fringe line items, with guided handling of missing fields, a post-download checklist, and correct amendment markers

**Depends on**: Phase 28 (all v2.4 features shipped; xmlbuilder2 install is the first task)

**Requirements**: CAE-01, CAE-02, CAE-03, CAE-04

**Success Criteria** (what must be TRUE):

  1. Payroll entry for a CA project shows four separate fringe contribution fields â health/welfare, pension, vacation, and training â each stored as its own DB column per entry

  2. User can click a CA eCPR XML export button on a CA project's payroll week; if contractor FEIN, DIR project ID, awarding agency, or contract number are absent, a pre-generation modal collects them before the file is generated

  3. After the XML file downloads, the app displays a step-by-step portal upload checklist informing the contractor how to submit to the CA DIR eCPR portal, including the disclosure that SSNs must be entered directly in the portal

  4. When the payroll week is an amendment (created via the v2.3 amendment workflow), the exported XML carries the correct amendment/resubmit marker â a non-amendment week produces no amendment marker

  5. A WA or federal-only project has no CA eCPR XML export button â the export is state-gated to CA projects only

**Plans**: 3 plans

Plans:

- [x] 29-01-PLAN.md â xmlbuilder2 install + DB migration (8 columns) + schema + extended payroll join + CA fringe entry UI

- [x] 29-02-PLAN.md â ecprXmlGenerator.ts (CPR.xsd v1.3 XML) + unit tests + GET /api/export/ecpr-xml/:weekId route

- [x] 29-03-PLAN.md â CA eCPR XML download button + 2-step pre-generation modal + post-download portal checklist



### Phase 30: WA PWIA Submission Assist

**Goal**: Contractors on Washington projects can generate a WA L&I CPR XML file gated on their PWIA intent ID and validated trade codes, and can view a pre-populated submission summary for Intent to Pay and Affidavit of Wages portal entry

**Depends on**: Phase 29 (shared getPayrollEntriesWithWorkerDetails() join and xmlbuilder2 pattern established in Phase 29)

**Requirements**: WAL-03, WAL-04

**Success Criteria** (what must be TRUE):

  1. Before generating a WA CPR XML file, the app requires the contractor to enter their PWIA Intent ID (issued after Statement of Intent approval); generation is blocked until the ID is provided, with a link to the PWIA portal

  2. If any worker on the WA project has a missing or unconfirmed WA trade code, the app surfaces those workers by name and blocks XML generation until the codes are resolved

  3. User can download a WA L&I CPR XML file for a WA project's payroll week; the file is gated to WA projects only

  4. User can view a WA submission assist summary panel â pre-populated with trade codes, hours by day, rates, and gross pay per worker â formatted as a reference for manual entry into the PWIA portal's Intent to Pay and Affidavit of Wages forms

  5. The submission assist panel is clearly labeled as a data-entry guide, not a submission mechanism; no HTTP calls are made to PWIA portal domains from the app backend

**Plans**: 3 plans

Plans:
- [x] 30-01-PLAN.md â DB migration (pwia_intent_id column) + Wave 0 test stubs (RED)
- [x] 30-02-PLAN.md â waCprXmlGenerator.ts pure function + GET /api/export/wa-cpr-xml/:weekId route + tests GREEN
- [x] 30-03-PLAN.md â PayrollWeekDetailPage UI: trade code gate + intentId modal + WA CPR XML download + WAL-04 submission summary panel

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
- [x] 37-01-PLAN.md â Schema + migration: audit_logs table, 3 indexes, journal entry (2026-04-01)
- [x] 37-02-PLAN.md â auditService.ts + tests: insertAuditLog(), diffObjects(), SSN redaction

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
- [x] 38-01-PLAN.md â Service wiring: workerService.ts + payroll entry audit + export/submission/import audit + trust proxy
- [x] 38-02-PLAN.md â GET /api/audit/:projectId route with assertProjectAccess, pagination, date filter
- [x] 38-03-PLAN.md â ProjectActivityPage React component + route wiring + ProjectDetailPage nav link
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
- [ ] 42-01-PLAN.md — DB migration + Drizzle schema (6 IL columns)
- [ ] 42-02-PLAN.md — Server routes + services (workers demographics + nonPwHours)
- [ ] 42-03-PLAN.md — React UI (ProjectForm, WorkersPage, PayrollWeekForm, PayrollWeekDetailPage)
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
- [ ] 54-01-PLAN.md — Migration SQL (0032_subcontractor_schema.sql) + journal registration (idx 28) + Drizzle schema exports for subcontractors and subcontractorCprWeeks
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
- [ ] 54-01-PLAN.md — Migration SQL (0032_subcontractor_schema.sql) + journal registration (idx 28) + Drizzle schema exports for subcontractors and subcontractorCprWeeks
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
- [ ] 54-01-PLAN.md — Migration SQL (0032_subcontractor_schema.sql) + journal registration (idx 28) + Drizzle schema exports for subcontractors and subcontractorCprWeeks
**UI hint**: yes

---

## Progress



| Phase | Milestone | Plans Complete | Status | Completed |

|-------|-----------|----------------|--------|-----------|

| 1-5. Foundation â Differentiators | v1.0 | All | Complete | 2026-03-19 |

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

| 35. Payroll Import â Server Pipeline | v3.0 | 2/2 | Complete    | 2026-03-31 |

| 36. Payroll Import â React UI | v3.0 | 3/3 | Complete    | 2026-04-01 |


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
- [x] **Phase 55: Subcontractor API Routes** — CRUD routes for subs + CPR tracking routes on new subcontractors.ts router, assertProjectAccess on all routes, audit log entries for sub events (not started) (completed 2026-04-14)
- [x] **Phase 56: Subcontractor UI Panel** — SubcontractorPanel.tsx on ProjectDetailPage: add/edit/remove subs, per-sub CPR week table with Received/Non-Compliant/Not Received/Overdue badges (not started) (completed 2026-04-14)
- [ ] **Phase 57: Audit Log CSV Export** — GET /api/audit/:projectId/csv route, UTF-8 BOM output, formula injection sanitization, download button on ProjectActivityPage (not started)
- [ ] **Phase 58: Enhanced Fringe Report** — getFringeBreakdown() in reportsService.ts grouped by fund type/union local/J-RA, GET /api/projects/:id/reports/fringe-enhanced, new Fringe Breakdown tab on ReportsPage (not started)
- [ ] **Phase 59: Multi-Project Compliance PDF** — complianceSummaryPdfGenerator.ts programmatic table, GET /api/export/compliance-summary, download button on DashboardPage (not started)

---

