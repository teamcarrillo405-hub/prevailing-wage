# Roadmap: HCC Prevailing Wage

## Milestones

- ✅ **v1.0** Foundation + Wage Engine + Payroll + Differentiators — Phases 1-5 (shipped 2026-03-19)
- ✅ **v2.0** Contractor UX Overhaul + Compliance — Phases 6-9 (shipped 2026-03-20)
- ✅ **v2.1** Design Polish + Landing Page — Phases 10-14 (shipped 2026-03-22)
- 🚧 **v2.2** UX Completion + Compliance Hardening — Phases 15-16 (in progress)

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

### 🚧 v2.2 UX Completion + Compliance Hardening (In Progress)

**Milestone Goal:** Close every known UX gap and compliance gap deferred from v2.0/v2.1 — apprentice ratio enforcement, workflow progress visibility, print-ready reports, and WH-347 preflight with generating feedback.

- [x] **Phase 15: Compliance Engine Hardening + Independent Frontend** - Apprentice ratio check in computeCompliance(), workflow progress indicator on Project Detail, and print CSS for both reports (completed 2026-03-22)
- [x] **Phase 16: WH-347 Submission UX** - Preflight modal with violation summary + confirmation, and generating/ready state feedback on download (completed 2026-03-22)

## Phase Details

### Phase 15: Compliance Engine Hardening + Independent Frontend
**Goal**: The compliance engine flags all three Davis-Bacon violation types, the Project Detail page shows workflow completion state, and both reports print cleanly via browser
**Depends on**: Phase 14
**Requirements**: COMP-03, UX-04, RPT-01, RPT-02
**Success Criteria** (what must be TRUE):
  1. Payroll Week Detail shows an apprentice ratio violation badge when apprentice hours for the week exceed 1:3 ratio against journeyworker hours
  2. Project Detail page shows a 4-step progress indicator (Create Project, Add Workers, Enter Payroll, Download WH-347) with each step marked complete based on actual data
  3. Fringe benefit summary report prints cleanly via Ctrl+P — table headers repeat per page, totals row visible, no nav chrome or tab UI printed
  4. Worker pay history report prints cleanly via Ctrl+P — worker selector hidden on print, full history table visible, consistent column alignment across pages
**Plans:** 3/3 plans complete
Plans:
- [x] 15-01-PLAN.md — Apprentice ratio violation in computeCompliance() + PayrollWeekDetailPage badge
- [x] 15-02-PLAN.md — 4-step workflow progress indicator on ProjectDetailPage
- [x] 15-03-PLAN.md — Print CSS for fringe summary and pay history reports + totals row

### Phase 16: WH-347 Submission UX
**Goal**: Contractors see all violation types before generating a WH-347 and get clear feedback while the PDF is being built
**Depends on**: Phase 15
**Requirements**: WH-01, WH-02
**Success Criteria** (what must be TRUE):
  1. Clicking "Download WH-347" when violations exist opens a preflight modal listing each violation (worker name, type, delta amount) before any PDF is generated
  2. Contractor can click "Download Anyway" to proceed or cancel — either action dismisses the modal correctly
  3. WH-347 download anchor shows "Generating..." while the PDF request is in-flight and returns to its normal label after the download begins
  4. Double-clicking the download anchor during generation does not trigger a second PDF request
**Plans:** 1/1 plans complete
Plans:
- [x] 16-01-PLAN.md — Preflight compliance modal + fetch-driven download with generating state and double-click guard

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
| 15. Compliance Engine Hardening + Independent Frontend | v2.2 | 3/3 | Complete    | 2026-03-22 |
| 16. WH-347 Submission UX | v2.2 | 1/1 | Complete    | 2026-03-22 |
