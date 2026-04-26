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

- [ ] 19-02-PLAN.md — PayrollListPage submission badges + PayrollWeekDetailPage submit form + lock UI + WorkflowProgress step 4 fix



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

- [ ] 22-01-PLAN.md — getWorkerComplianceHistory() service + GET /worker/:workerId/history endpoint + multi-project integration tests (TDD)

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

- [ ] 24-03-PLAN.md — A-1-131 PDF generator + export route + state-gated download button + eCPR preflight modal + browser verification



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

- [ ] **Phase 64: SOC 2 Logging Foundation + Page Polish Batch 1** -- security_events + login_attempts tables wired to auth routes; premium design treatment on ProjectDetailPage, PayrollListPage, PayrollWeekDetailPage (UI-01, UI-02, UI-03, UI-17)
- [ ] **Phase 65: Mobile Responsive Audit + Skeleton + Empty States** -- full 375/768/1024px audit on all 25 pages; skeleton loading states on 5 data pages; contextual empty states on all list views (UI-07, UI-10, UI-11)
- [ ] **Phase 66: Landing Page Overhaul** -- hero photography, social proof section, How It Works 4-step visual, 50-state SVG map, pricing time-saved calculator (UI-12, UI-13, UI-14, UI-15, UI-16)
- [ ] **Phase 67: Animations + Nav Drawer + Form Touch + Phase A Watchdog Gate** -- framer-motion route transitions, mobile sidebar drawer, touch-optimized form inputs, nav mobile drawer (UI-04, UI-05, UI-06, UI-08, UI-09) -- WATCHDOG GATE
- [ ] **Phase 68: QuickBooks OAuth Foundation** -- IntegrationsPage, PKCE OAuth flow, AES-256-GCM token storage, connection status badge, disconnect + revoke (QB-01, QB-04, QB-05)
- [ ] **Phase 69: QuickBooks Data Sync** -- QB employee pull into Workers, TimeActivity pull into importService pipeline (QB-02, QB-03)
- [ ] **Phase 70: Apprenticeship Ratio Enforcement** -- per-trade ratio config on projects, COMP-04 daily ratio check, COMP-05 IRA/IIJA 15% tracker, violation detail panel (APP-01, APP-02, APP-03, APP-04, APP-05)
- [ ] **Phase 71: DBE/MBE/WBE Schema + Certification CRUD** -- subcontractor_certifications table, certification add/edit/delete in SubcontractorPanel, DOT IFR 2025 reevaluation status field (DBE-01, DBE-02, DBE-06)
- [ ] **Phase 72: DBE Alerts + CPR Gate + Participation Summary** -- 90/60/30-day expiration emails, expired-cert CPR upload block, DBE participation card on ProjectDetailPage (DBE-03, DBE-04, DBE-05)
- [ ] **Phase 73: Real-Time Compliance Dashboard + Phase B Watchdog Gate** -- hero stat row, 12-week trend chart, projects-at-risk panel, violation count badges on project cards (DASH-01, DASH-02, DASH-03, DASH-04) -- WATCHDOG GATE
- [ ] **Phase 74: PWA Foundation** -- vite-plugin-pwa + workbox, app shell caching, offline queue with IndexedDB + idempotency keys, offline banner, 30s draft auto-save (MOB-01, MOB-02, MOB-03, MOB-04, MOB-05)
- [ ] **Phase 75: GPS Clock-In/Clock-Out** -- time_punches table, GPS project settings, clock-in UI with accuracy badge, server-side haversine geofence, admin Field Activity tab (MOB-06, MOB-07, MOB-08, MOB-09, MOB-10)
- [ ] **Phase 76: Payroll Integration + Photo Capture** -- "Import from Clock-In Records" button, week_photos table, photo gallery on PayrollWeekDetailPage, clock-in photo capture (MOB-11, MOB-12, MOB-13, MOB-14)
- [ ] **Phase 77: Mobile Sub CPR Upload + Phase C Watchdog Gate** -- 375px audit of public /upload/:token page, 44px tap targets, "Tap to upload or take photo" CTA, upload progress + success confirmation (MOB-15) -- WATCHDOG GATE
- [ ] **Phase 78: SOC 2 Controls -- MFA + Log Aggregation + Hash Chain** -- TOTP MFA for owner accounts (otplib + QR enrollment + backup codes), Pino/Logtail log drain, SHA-256 hash chain on audit_logs (SEC-01, SEC-02, SEC-03)
- [ ] **Phase 79: SOC 2 Infrastructure -- Uptime + Dependabot + Security Policy** -- Uptime Robot + Instatus status page, Dependabot npm weekly + OWASP ZAP in CI, SECURITY_POLICY.md (SEC-04, SEC-05, SEC-06)
- [ ] **Phase 80: Public REST API + API Keys** -- api_keys table, key management UI, GET /api/v1 read endpoints (projects, payroll weeks, compliance), OpenAPI 3.1 spec + Swagger UI (API-01, API-02, API-03)
- [ ] **Phase 81: Webhooks** -- webhooks table, SSRF-protected URL validation, HMAC-SHA-256 signing, delivery queue with exponential backoff, delivery log UI (API-04, API-05)
- [ ] **Phase 82: Market Credibility + Phase D Watchdog Gate** -- HCC case study page at /case-studies/hcc, Economic Impact dashboard tab, About page update (TRUST-01, TRUST-02, TRUST-03) -- WATCHDOG GATE

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
- [ ] 64-01-PLAN.md -- DB migration: security_events + login_attempts tables + Drizzle schema + journal entry
- [ ] 64-02-PLAN.md -- Auth route wiring: insertSecurityEvent() + insertLoginAttempt() on all auth handlers
- [ ] 64-03-PLAN.md -- ProjectDetailPage + PayrollListPage + PayrollWeekDetailPage premium design treatment

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
- [ ] 65-01-PLAN.md -- Mobile responsive audit: 25-page breakpoint review, table-to-card conversions, tap target fixes
- [ ] 65-02-PLAN.md -- Skeleton loading components for DashboardPage, ProjectDetailPage, PayrollListPage, WorkersPage, ReportsPage
- [ ] 65-03-PLAN.md -- Contextual empty state components for all list views

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
- [ ] 66-01-PLAN.md -- Hero photography + subheadline + social proof section (HCC logo, testimonial, customer logos)
- [ ] 66-02-PLAN.md -- "How it Works" 4-step flow + US state SVG map (8 active states)
- [ ] 66-03-PLAN.md -- Pricing page time-saved calculator widget

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
- [ ] 67-01-PLAN.md -- framer-motion AnimatePresence route transitions on all protected pages
- [ ] 67-02-PLAN.md -- Mobile nav drawer (hamburger + slide-in panel + backdrop + active route highlight)
- [ ] 67-03-PLAN.md -- WorkersPage + ReportsPage premium treatment; iOS form font-size 16px audit

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
- [ ] 68-01-PLAN.md -- qbo_tokens DB table + Drizzle schema + AES-256-GCM token storage service
- [ ] 68-02-PLAN.md -- PKCE OAuth flow: /api/integrations/qbo/connect + /api/integrations/qbo/callback routes + token refresh logic
- [ ] 68-03-PLAN.md -- IntegrationsPage UI: connection status badge + Connect/Reconnect/Disconnect actions

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
- [ ] 69-01-PLAN.md -- GET /api/integrations/qbo/employees: QB API fetch + preview table route
- [ ] 69-02-PLAN.md -- GET /api/integrations/qbo/timeactivities: TimeActivity fetch + importService pipeline integration + PayrollWeekDetailPage "Import from QuickBooks Time" button

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
- [ ] 70-01-PLAN.md -- DB migration: apprenticeship_requirements JSON on projects + rapids_number/program_name on workers + Drizzle schema
- [ ] 70-02-PLAN.md -- COMP-04 daily ratio check + COMP-05 IRA/IIJA % check in computeCompliance() + integration tests
- [ ] 70-03-PLAN.md -- ProjectForm apprenticeship ratios UI + WorkersPage apprentice fields + PayrollWeekDetailPage per-trade violation detail panel

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
- [ ] 71-01-PLAN.md -- DB migration: subcontractor_certifications table + Drizzle schema + CRUD API routes with assertProjectAccess
- [ ] 71-02-PLAN.md -- SubcontractorPanel "+ Add Certification" form + edit/delete inline + DOT IFR status label + tooltip

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
- [ ] 72-01-PLAN.md -- Expiration alert scheduled check (90/60/30 days) + Resend email templates
- [ ] 72-02-PLAN.md -- CPR upload gate (SubcontractorPanel + public upload portal) + DBE participation summary card on ProjectDetailPage

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
- [ ] 73-01-PLAN.md -- Extend batch compliance summary endpoint: due-this-week count + violations-older-than-7-days per project
- [ ] 73-02-PLAN.md -- Dashboard hero stat row + 12-week trend chart
- [ ] 73-03-PLAN.md -- Projects-at-risk panel + per-card violation count badges

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
- [ ] 74-01-PLAN.md -- vite-plugin-pwa install + Web App Manifest + service worker (app shell cache + StaleWhileRevalidate)
- [ ] 74-02-PLAN.md -- Offline mutation queue (IndexedDB + idempotencyKey + Background Sync flush + If-Unmodified-Since)
- [ ] 74-03-PLAN.md -- Offline banner component + 30s draft auto-save to IndexedDB + Restore Draft prompt

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
- [ ] 75-01-PLAN.md -- DB migration: time_punches table + projects GPS columns + Drizzle schema + API routes (POST punch, GET punches per project)
- [ ] 75-02-PLAN.md -- /projects/:id/clockin mobile UI: clock-in/out button + one-shot geolocation + accuracy badge + offline queue integration
- [ ] 75-03-PLAN.md -- ProjectDetailPage "Field Activity" tab + punch list with fence status highlighting + CSV export

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
- [ ] 76-01-PLAN.md -- "Import from Clock-In Records": hours aggregation + ST/OT/DT split + preview + additive merge commit
- [ ] 76-02-PLAN.md -- DB migration: week_photos table + photo upload route (multer, /var/data/photos) + Drizzle schema
- [ ] 76-03-PLAN.md -- PayrollWeekDetailPage photo gallery (thumbnail grid + full-size + delete) + clock-in optional photo capture step

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
- [ ] 77-01-PLAN.md -- /upload/:token 375px responsive audit + 44px tap targets + camera capture label + upload progress + success confirmation

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
- [ ] 78-01-PLAN.md -- otplib + qrcode install + TOTP secret encryption + QR enrollment page + backup recovery codes
- [ ] 78-02-PLAN.md -- MFA enforcement on login/ownership transfer/invite revocation + MFA bypass for recovery codes
- [ ] 78-03-PLAN.md -- Pino/Logtail log drain config + security_events forwarding + audit_logs hash chain migration + backfill script

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
- [ ] 79-01-PLAN.md -- Uptime Robot monitor setup + Instatus status page creation + app footer status page link
- [ ] 79-02-PLAN.md -- dependabot.yml + OWASP ZAP GitHub Actions step + SECURITY_POLICY.md

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
- [ ] 80-01-PLAN.md -- DB migration: api_keys table + Drizzle schema + key hashing + CRUD routes + rate limiter middleware
- [ ] 80-02-PLAN.md -- GET /api/v1 read endpoints (projects + payroll weeks + compliance) + Bearer auth middleware + audit logging
- [ ] 80-03-PLAN.md -- OpenAPI 3.1 spec generation + GET /api/docs + Swagger UI at /api/docs/html + Settings API Keys page

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
- [ ] 81-01-PLAN.md -- DB migration: webhooks + webhook_deliveries tables + Drizzle schema + CRUD routes + SSRF DNS pre-resolve + HMAC signing
- [ ] 81-02-PLAN.md -- Delivery queue polling (setInterval 30s) + exponential backoff + Settings Webhooks delivery log UI + manual Retry button

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
- [ ] 82-01-PLAN.md -- /case-studies/hcc public page + landing page "Trusted by" link
- [ ] 82-02-PLAN.md -- Economic impact metrics query (8 metrics including local hire % zip comparison) + Impact tab on DashboardPage + Export to PDF
- [ ] 82-03-PLAN.md -- /about page update (mission + team + tech stack transparency)

**UI hint**: yes

---

## v6.0 Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 64. SOC 2 Logging Foundation + Page Polish Batch 1 | v6.0 | 0/3 | Not started | - |
| 65. Mobile Responsive Audit + Skeleton + Empty States | v6.0 | 0/3 | Not started | - |
| 66. Landing Page Overhaul | v6.0 | 0/3 | Not started | - |
| 67. Animations + Nav Drawer + Form Touch + Phase A Gate | v6.0 | 0/3 | Not started | - |
| 68. QuickBooks OAuth Foundation | v6.0 | 0/3 | Not started | - |
| 69. QuickBooks Data Sync | v6.0 | 0/2 | Not started | - |
| 70. Apprenticeship Ratio Enforcement | v6.0 | 0/3 | Not started | - |
| 71. DBE/MBE/WBE Schema + Certification CRUD | v6.0 | 0/2 | Not started | - |
| 72. DBE Alerts + CPR Gate + Participation Summary | v6.0 | 0/2 | Not started | - |
| 73. Real-Time Compliance Dashboard + Phase B Gate | v6.0 | 0/3 | Not started | - |
| 74. PWA Foundation | v6.0 | 0/3 | Not started | - |
| 75. GPS Clock-In/Clock-Out | v6.0 | 0/3 | Not started | - |
| 76. Payroll Integration + Photo Capture | v6.0 | 0/3 | Not started | - |
| 77. Mobile Sub CPR Upload + Phase C Gate | v6.0 | 0/1 | Not started | - |
| 78. SOC 2 Controls -- MFA + Log Aggregation + Hash Chain | v6.0 | 0/3 | Not started | - |
| 79. SOC 2 Infrastructure -- Uptime + Dependabot + Policy | v6.0 | 0/2 | Not started | - |
| 80. Public REST API + API Keys | v6.0 | 0/3 | Not started | - |
| 81. Webhooks | v6.0 | 0/2 | Not started | - |
| 82. Market Credibility + Phase D Gate | v6.0 | 0/3 | Not started | - |

---

## v7.0 Industry Leadership (Phases 83–106) — Target: 9.2+/10

**Milestone goal:** Close the final gaps to become the undisputed #1 prevailing wage platform. Beat LCPtracker on API openness and AI innovation; earn SOC 2 Type I; live SAM.gov wage lookups; Procore marketplace listing.

**Competitive baseline (v6.0):** 8.31/10 — B2Gnow 7.0, Knowify 6.1, LCPtracker (dominant, FedRAMP ATO).

---

### Phase A — Foundation + Security (Phases 83–87)

**Goal:** Close all SOC 2 Type I evidence gaps; ship full-text search and scheduled reports.

- [x] **Phase 83: External Log Drain + Security Policy** — Logtail/Better Stack Pino transport, HTTPS drain, SECURITY_POLICY.md at /security (SEC-07, SEC-08) (completed 2026-04-26)
- [ ] **Phase 84: Dependabot + Uptime Monitoring** — Dependabot npm weekly PRs, Uptime Robot + Instatus status page, public status badge on landing (SEC-09, SEC-10)
- [ ] **Phase 85: Full-Text Search** — SQLite FTS5 virtual tables for workers + projects, debounced search UI, highlighted matches (PERF-01, PERF-02)
- [ ] **Phase 86: Scheduled Report Emails** — daily/weekly/monthly compliance summaries via nodemailer cron, user-configurable delivery prefs, unsubscribe token (NOTIF-05, NOTIF-06)
- [ ] **Phase 87: Phase A Watchdog Gate** — SOC 2 evidence package review (CC6–CC9 coverage), score target 8.55+

**Acceptance criteria:**
- Pino HTTP logs flowing to external drain; verifiable by auditor
- SECURITY_POLICY.md published and linked from footer
- FTS5 search returns workers/projects in < 50ms on 10K-row dataset
- At least 1 scheduled report email delivered to test inbox

WATCHDOG GATE: Score ≥ 8.55/10 required before Phase 88 begins.

---

### Phase B — Data + Integrations (Phases 88–93)

**Goal:** Live SAM.gov/DOL wage determination fetch; Procore timesheet sync; 2 new state forms.

- [ ] **Phase 88: Live SAM.gov WD Fetch** — SAM.gov API key, weekly cron against `/api/prod/wdol/v1/wd/{WD}/{REV}/download`, stale-WD banner on project detail, revision diff log (COMP-06, COMP-07)
- [ ] **Phase 89: DOL 2024 Rule Updates** — WH-347 updated to Jan 2025 form, 30% rule compliance notice on wage determinations, civil penalty display ($13,508/violation) (COMP-08)
- [ ] **Phase 90: Procore Timesheet Sync** — Procore OAuth2 connect, timesheet import bridge → payroll entries preview, Integrations page tile (INT-01, INT-02)
- [ ] **Phase 91: Minnesota Certified Payroll** — MN DLI form, STATE_FORMS registry entry, migration (STATE-14)
- [ ] **Phase 92: Virginia Certified Payroll** — VA DOLI form, STATE_FORMS registry entry, migration (STATE-15)
- [ ] **Phase 93: Phase B Watchdog Gate** — live WD fetch verified against known WD number, score target 8.75+

**Acceptance criteria:**
- WD refresh cron runs weekly; project shows "WD updated X days ago"
- Procore OAuth connect/disconnect works end-to-end; test project timesheet imports cleanly
- MN + VA forms pass visual inspection against official form templates

WATCHDOG GATE: Score ≥ 8.75/10 required before Phase 94 begins.

---

### Phase C — Mobile + Field Polish (Phases 94–99)

**Goal:** Offline payroll entry durability; photo verification; background sync.

- [ ] **Phase 94: Offline Payroll Entry Queue** — full payroll form serialization to IndexedDB, optimistic UI, replay-on-reconnect with conflict resolution (MOB-16, MOB-17)
- [ ] **Phase 95: Background Sync** — Service Worker Background Sync API for clock-in queue + offline payroll flush, sync status indicator (MOB-18)
- [ ] **Phase 96: Photo Verification** — contractor digital signature capture (canvas), site photo gallery on ProjectDetailPage, EXIF geotag display (MOB-19, MOB-20)
- [ ] **Phase 97: Mobile Nav Redesign** — bottom tab bar for field workers (Field / Payroll / Projects / More), swipe gesture routing (MOB-21)
- [ ] **Phase 98: Offline Compliance Checklists** — pre-inspection checklist stored in IDB, offline accessible, syncs when connected (MOB-22)
- [ ] **Phase 99: Phase C Watchdog Gate** — offline payroll submit verified end-to-end with network throttle, score target 8.90+

**Acceptance criteria:**
- Payroll entry created offline successfully syncs to server on reconnect
- Background sync fires within 30s of connectivity restoration
- Signature capture produces verifiable PNG blob stored with payroll week

WATCHDOG GATE: Score ≥ 8.90/10 required before Phase 100 begins.

---

### Phase D — Market + Enterprise (Phases 100–106)

**Goal:** ROI calculator; customer testimonials; AI classification assist; SSO for enterprise; v7.0 ship.

- [ ] **Phase 100: ROI Calculator Page** — /roi route, pre-filled by project count + worker count, hours-saved estimate, email capture CTA (TRUST-04)
- [ ] **Phase 101: Customer Testimonials + Video** — 3 contractor quotes with photos, video embed, PDF case study download (TRUST-05, TRUST-06)
- [ ] **Phase 102: Enterprise Pricing + SSO Foundation** — enterprise tier on PricingPage, SAML SSO schema (sso_configs table), Okta/Azure AD connect UI stub (ENT-01, ENT-02)
- [ ] **Phase 103: AI Classification Assist** — Claude API integration, job description → Davis-Bacon classification suggestion, confidence score, audit trail entry, IL AI Act disclosure (AI-01, AI-02)
- [ ] **Phase 104: Advanced Audit Analytics** — pivot-table hours by trade/classification/week, CSV + PDF export, drill-down (REPT-06)
- [ ] **Phase 105: Growth Dashboard (Admin)** — admin metrics: active users, submission rate, compliance score trends, MRR (internal only) (OPS-01)
- [ ] **Phase 106: Phase D Watchdog Gate + v7.0 Ship** — final competitive score ≥ 9.2/10, LCPtracker feature gap audit

**Acceptance criteria:**
- AI classification returns suggestion in < 3s with audit log entry
- ROI calculator renders server-side-safe with email capture working
- SSO connect flow completes with Okta dev account
- Final Watchdog average ≥ 9.2/10

WATCHDOG GATE: Score ≥ 9.2/10 required to ship v7.0 milestone.

---

## v7.0 Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 83. External Log Drain + Security Policy | v7.0 | 2/2 | Complete   | 2026-04-26 |
| 84. Dependabot + Uptime Monitoring | v7.0 | 0/2 | Not started | - |
| 85. Full-Text Search | v7.0 | 0/2 | Not started | - |
| 86. Scheduled Report Emails | v7.0 | 0/2 | Not started | - |
| 87. Phase A Watchdog Gate | v7.0 | 0/1 | Not started | - |
| 88. Live SAM.gov WD Fetch | v7.0 | 0/3 | Not started | - |
| 89. DOL 2024 Rule Updates | v7.0 | 0/2 | Not started | - |
| 90. Procore Timesheet Sync | v7.0 | 0/3 | Not started | - |
| 91. Minnesota Certified Payroll | v7.0 | 0/2 | Not started | - |
| 92. Virginia Certified Payroll | v7.0 | 0/2 | Not started | - |
| 93. Phase B Watchdog Gate | v7.0 | 0/1 | Not started | - |
| 94. Offline Payroll Entry Queue | v7.0 | 0/2 | Not started | - |
| 95. Background Sync | v7.0 | 0/2 | Not started | - |
| 96. Photo Verification | v7.0 | 0/2 | Not started | - |
| 97. Mobile Nav Redesign | v7.0 | 0/2 | Not started | - |
| 98. Offline Compliance Checklists | v7.0 | 0/2 | Not started | - |
| 99. Phase C Watchdog Gate | v7.0 | 0/1 | Not started | - |
| 100. ROI Calculator Page | v7.0 | 0/2 | Not started | - |
| 101. Customer Testimonials + Video | v7.0 | 0/2 | Not started | - |
| 102. Enterprise Pricing + SSO Foundation | v7.0 | 0/2 | Not started | - |
| 103. AI Classification Assist | v7.0 | 0/3 | Not started | - |
| 104. Advanced Audit Analytics | v7.0 | 0/2 | Not started | - |
| 105. Growth Dashboard (Admin) | v7.0 | 0/2 | Not started | - |
| 106. Phase D Watchdog Gate + v7.0 Ship | v7.0 | 0/1 | Not started | - |

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
- [ ] 84-01-PLAN.md -- .github/dependabot.yml for npm + actions; CI badge in README
- [ ] 84-02-PLAN.md -- Uptime Robot setup instructions + status page link in LandingPage footer

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
- [ ] 85-01-PLAN.md -- FTS5 virtual table migration, sync triggers, GET /search route, vitest test
- [ ] 85-02-PLAN.md -- WorkersPage search input + debounce hook; DashboardPage client-side project filter

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
- [ ] 86-01-PLAN.md -- projectSettings schema extension; scheduledReports cron job; nodemailer template; unsubscribe endpoint
- [ ] 86-02-PLAN.md -- ProjectDetailPage Settings tab: report schedule selector + email input + save

**UI hint**: yes
