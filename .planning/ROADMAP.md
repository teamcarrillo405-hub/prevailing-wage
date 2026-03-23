# Roadmap: HCC Prevailing Wage

## Milestones

- ✅ **v1.0** Foundation + Wage Engine + Payroll + Differentiators — Phases 1-5 (shipped 2026-03-19)
- ✅ **v2.0** Contractor UX Overhaul + Compliance — Phases 6-9 (shipped 2026-03-20)
- ✅ **v2.1** Design Polish + Landing Page — Phases 10-14 (shipped 2026-03-22)
- ✅ **v2.2** UX Completion + Compliance Hardening — Phases 15-16 (shipped 2026-03-23)
- 🔄 **v2.3** Contractor Workflow Efficiency + Audit Readiness — Phases 17-22 (active)

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

### v2.3 Contractor Workflow Efficiency + Audit Readiness (Phases 17-22)

- [x] **Phase 17: DB Migration + Project Archive** — 4-column payrollWeeks migration, project archive/restore, archived badge, compliance pre-check before archive
- [x] **Phase 18: Dashboard Search + Filter** — name search, funding type filter, URL-persisted filter state, zero-results empty state
- [ ] **Phase 19: WH-347 Submission Tracking** — mark weeks submitted with date/agency, server-side edit lock, un-submit, submitted badges on payroll list
- [ ] **Phase 20: Copy Previous Payroll Week** — copy week to pre-fill new entry, live rate re-fetch per classification, skipped-entries warning
- [ ] **Phase 21: Payroll Amendment Workflow** — amend submitted week as new row, "N (AMENDED M)" WH-347 label, pre-filled entries from original
- [ ] **Phase 22: Per-Worker Compliance History** — cross-project violation history page, compliance history link per worker row

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
- [ ] 20-01-PLAN.md — copyPayrollWeek() service + POST /api/payroll/weeks/copy route (preview + commit modes) + integration tests
- [ ] 20-02-PLAN.md — Copy modal UI on PayrollListPage (source week selector, preview warning, confirm/cancel) + browser verification

### Phase 21: Payroll Amendment Workflow
**Goal**: Contractors can correct a submitted payroll week by creating a formal amendment that generates an amended WH-347 while preserving the original record
**Depends on**: Phase 17 (amendment_number, original_week_id columns), Phase 19 (Amend button only surfaces when week is submitted), Phase 20 (bulk entry copy pattern reused for amendment pre-fill)
**Requirements**: AMD-01, AMD-02, AMD-03
**Success Criteria** (what must be TRUE):
  1. User can click "Amend This Week" on a submitted payroll week, which creates a new amendment week pre-filled with the original week's hours
  2. The original submitted week remains visible and read-only after an amendment is created
  3. Downloading the WH-347 for an amendment week shows the payroll number in "N (AMENDED M)" format identifying the amendment sequence
  4. Multiple amendments to the same week are numbered sequentially (amendment 1, amendment 2, etc.)
**Plans**: TBD

### Phase 22: Per-Worker Compliance History
**Goal**: Contractors can see a single page showing all compliance violations for a specific worker across every project and payroll week — ready for audit response
**Depends on**: Nothing (read-only reporting; fully independent of Phases 17-21)
**Requirements**: AUD-01, AUD-02
**Success Criteria** (what must be TRUE):
  1. User can click "Compliance History" next to any worker on the Workers page and land on a page showing all that worker's violations across all projects
  2. The violation list shows project name, payroll week, violation type, and the amounts involved for each entry
  3. A worker with no violations across any project shows a clear "no violations found" state
  4. Worker identity is correctly matched across projects using name and SSN last 4 (not project-scoped worker ID)
**Plans**: TBD

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
| 19. WH-347 Submission Tracking | v2.3 | 1/2 | In Progress|  |
| 20. Copy Previous Payroll Week | v2.3 | 0/2 | Not started | - |
| 21. Payroll Amendment Workflow | v2.3 | 0/? | Not started | - |
| 22. Per-Worker Compliance History | v2.3 | 0/? | Not started | - |
