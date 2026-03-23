# Requirements: HCC Prevailing Wage v2.3

**Milestone:** v2.3 — Contractor Workflow Efficiency + Audit Readiness
**Created:** 2026-03-23
**Status:** Active

---

## v1 Requirements

### Payroll Efficiency (PAY)

- [ ] **PAY-01**: User can copy a previous payroll week to pre-fill a new week with worker/hour data and live rate re-fetch per classification
- [ ] **PAY-02**: System shows which entries were skipped during copy (worker no longer active, rate lookup failed) before confirming

### Submission Tracking (SUB)

- [ ] **SUB-01**: User can mark a payroll week as submitted with a date and agency name
- [ ] **SUB-02**: System prevents editing payroll entries on a submitted week (server-side lock)
- [ ] **SUB-03**: User can un-submit a week to clear its submission status

### Amendment Workflow (AMD)

- [ ] **AMD-01**: User can amend a submitted payroll week — creates a new week row with amendment number; original week preserved and read-only
- [ ] **AMD-02**: Amended WH-347 PDF shows payroll number in "N (AMENDED M)" format identifying the amendment sequence
- [ ] **AMD-03**: Amendment week entries are pre-filled from the original week's worker hours for editing

### Project Lifecycle (PRJ)

- [ ] **PRJ-01**: User can archive a project, removing it from the active dashboard view
- [ ] **PRJ-02**: User can toggle display of archived projects on the dashboard
- [ ] **PRJ-03**: System warns if a project has open compliance violations before archiving (advisory, not a hard block)

### Dashboard UX (DASH)

- [ ] **DASH-03**: User can search projects by name on the dashboard with URL-persisted filter state
- [ ] **DASH-04**: User can filter projects by funding type on the dashboard

### Audit / Compliance History (AUD)

- [ ] **AUD-01**: User can view a per-worker compliance history page showing all violations across all projects and weeks
- [ ] **AUD-02**: WorkersPage shows a "Compliance History" link per worker row

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
| PAY-01 | TBD | Pending |
| PAY-02 | TBD | Pending |
| SUB-01 | TBD | Pending |
| SUB-02 | TBD | Pending |
| SUB-03 | TBD | Pending |
| AMD-01 | TBD | Pending |
| AMD-02 | TBD | Pending |
| AMD-03 | TBD | Pending |
| PRJ-01 | TBD | Pending |
| PRJ-02 | TBD | Pending |
| PRJ-03 | TBD | Pending |
| DASH-03 | TBD | Pending |
| DASH-04 | TBD | Pending |
| AUD-01 | TBD | Pending |
| AUD-02 | TBD | Pending |
