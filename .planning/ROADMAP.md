# Roadmap: HCC Prevailing Wage

## Milestones

- ✅ **v1.0** Foundation + Wage Engine + Payroll + Differentiators — Phases 1-5 (shipped 2026-03-19)
- ✅ **v2.0** Contractor UX Overhaul + Compliance — Phases 6-9 (shipped 2026-03-20)
- ✅ **v2.1** Design Polish + Landing Page — Phases 10-14 (shipped 2026-03-22)
- ✅ **v2.2** UX Completion + Compliance Hardening — Phases 15-16 (shipped 2026-03-23)
- ✅ **v2.3** Contractor Workflow Efficiency + Audit Readiness — Phases 17-22 (shipped 2026-03-24)
- 🔄 **v2.4** Ship-Ready + Design Elevation — Phases 23-28 (active)

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

### v2.4 Ship-Ready + Design Elevation (Phases 23-28) — ACTIVE

- [x] **Phase 23: Dashboard Compliance Filter + CSV Export** - Batch compliance summary endpoint, dashboard filter chips, and CSV download from compliance history (DASH-05, AUD-03) (completed 2026-03-24)
- [x] **Phase 24: California DIR A-1-131 Form** - DT schema migration, CA-specific project fields, CA certified payroll PDF generation with daily OT/DT model and eCPR disclosure (CAL-01, CAL-02, CAL-03) (completed 2026-03-25)
- [x] **Phase 25: Washington L&I F700-065-000 Form** - Manual rate entry for WA projects, WA trade code mapping, WA certified payroll PDF generation (WAL-01, WAL-02) (completed 2026-03-26)
- [x] **Phase 26: Contractor Guidance System** - HelpText primitive, contextual help across all major pages, instructional empty states, inline compliance term tooltips (UX-05, UX-06, UX-07, UX-08) (completed 2026-03-26)
- [ ] **Phase 27: Design Elevation** - Construction photography, dark gold gradient overlays, elevated card shadows, richer typography matching HCC website standard (DES-01, DES-02, DES-03)
- [ ] **Phase 28: Production Deployment** - Render.com deployment with persistent SQLite disk, invite-only registration, environment variable hygiene, Vite static file serving (OPS-01, OPS-02, OPS-03, OPS-04)

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

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5. Foundation → Differentiators | v1.0 | All | Complete | 2026-03-19 |
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
| 23. Dashboard Compliance Filter + CSV Export | v2.4 | 2/2 | Complete    | 2026-03-24 |
| 24. California DIR A-1-131 Form | v2.4 | 2/3 | In Progress|  |
| 25. Washington L&I F700-065-000 Form | v2.4 | 0/2 | Complete    | 2026-03-26 |
| 26. Contractor Guidance System | v2.4 | 2/2 | Complete   | 2026-03-26 |
| 27. Design Elevation | v2.4 | 0/2 | Not started | - |
| 28. Production Deployment | v2.4 | 0/2 | Not started | - |
