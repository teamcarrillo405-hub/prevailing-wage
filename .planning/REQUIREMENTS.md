# Requirements: HCC Prevailing Wage v2.3

**Milestone:** v2.3 — Contractor Workflow Efficiency + Audit Readiness
**Created:** 2026-03-23
**Status:** Active

---

## v1 Requirements

### Payroll Efficiency (PAY)

- [x] **PAY-01**: User can copy a previous payroll week to pre-fill a new week with worker/hour data and live rate re-fetch per classification
- [x] **PAY-02**: System shows which entries were skipped during copy (worker no longer active, rate lookup failed) before confirming

### Submission Tracking (SUB)

- [x] **SUB-01**: User can mark a payroll week as submitted with a date and agency name
- [x] **SUB-02**: System prevents editing payroll entries on a submitted week (server-side lock)
- [x] **SUB-03**: User can un-submit a week to clear its submission status

### Amendment Workflow (AMD)

- [x] **AMD-01**: User can amend a submitted payroll week — creates a new week row with amendment number; original week preserved and read-only
- [x] **AMD-02**: Amended WH-347 PDF shows payroll number in "N (AMENDED M)" format identifying the amendment sequence
- [x] **AMD-03**: Amendment week entries are pre-filled from the original week's worker hours for editing

### Project Lifecycle (PRJ)

- [x] **PRJ-01**: User can archive a project, removing it from the active dashboard view
- [x] **PRJ-02**: User can toggle display of archived projects on the dashboard
- [x] **PRJ-03**: System warns if a project has open compliance violations before archiving (advisory, not a hard block)

### Dashboard UX (DASH)

- [x] **DASH-03**: User can search projects by name on the dashboard with URL-persisted filter state
- [x] **DASH-04**: User can filter projects by funding type on the dashboard

### Audit / Compliance History (AUD)

- [x] **AUD-01**: User can view a per-worker compliance history page showing all violations across all projects and weeks
- [x] **AUD-02**: WorkersPage shows a "Compliance History" link per worker row

---

## Future Requirements

- Dashboard compliance status filter — requires `GET /api/compliance/projects/summary` batch endpoint (deferred to v2.4)
- CSV export from per-worker compliance history page
- State-specific prevailing wage forms (CA DIR, WA L&I)
- Auto-submit to agency portal
- Payroll provider integrations (QuickBooks, ADP)

---

## Out of Scope

- Hard-delete of projects or payroll weeks — 29 CFR Part 3 requires 3-year records retention; archive (status-only) is the only permitted removal
- Compliance filter on dashboard in v2.3 — batch compliance summary endpoint adds scope complexity; deferred to v2.4
- Mobile native app — web-first; browser on tablet is sufficient
- Multi-user / team accounts — single contractor user per account

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRJ-01 | Phase 17 | Complete |
| PRJ-02 | Phase 17 | Complete |
| PRJ-03 | Phase 17 | Complete |
| DASH-03 | Phase 18 | Complete |
| DASH-04 | Phase 18 | Complete |
| SUB-01 | Phase 19 | Complete |
| SUB-02 | Phase 19 | Complete |
| SUB-03 | Phase 19 | Complete |
| PAY-01 | Phase 20 | Complete |
| PAY-02 | Phase 20 | Complete |
| AMD-01 | Phase 21 | Complete |
| AMD-02 | Phase 21 | Complete |
| AMD-03 | Phase 21 | Complete |
| AUD-01 | Phase 22 | Complete |
| AUD-02 | Phase 22 | Complete |
