# Requirements: HCC Prevailing Wage

**Defined:** 2026-03-19
**Core Value:** GC can run a full project end-to-end — create project -> add workers -> enter payroll -> generate WH-347 -> submit — with no missing steps.

## v2 Requirements

Requirements for milestone v2.0 — Contractor UX Overhaul + Compliance. Phases start at 6.

### WH-347 Correctness

- [x] **WH347-01**: User can download a January 2025-compliant WH-347 PDF (correct form version, correct field positions)
- [x] **WH347-02**: Worker profile includes J/RA (journeyworker/registered apprentice) field — mandatory on 2025 WH-347 form
- [x] **WH347-03**: User can download WH-347 directly from the payroll week view with one click
- [x] **WH347-04**: WH-347 generates multiple pages when a payroll week has more than 8 workers

### Compliance

- [x] **COMP-01**: System flags payroll entries where the rate paid is below the current prevailing wage for that trade
- [x] **COMP-02**: System flags payroll weeks where gross wages don't match the CWHSSA formula (catches OT calculation errors)

### Reports

- [ ] **RPT-01**: User can view a fringe benefit summary showing fringe credits per worker for a project
- [ ] **RPT-02**: User can view worker pay history — all payroll weeks, hours, gross wages, and deductions — for a worker on a project

### Dashboard

- [x] **DASH-01**: Each project card shows a compliance status badge (green = clean, yellow = warnings, red = active violations)
- [x] **DASH-02**: Each project card shows total payroll weeks submitted and the last week number

### UX

- [ ] **UX-01**: Project detail page shows clear navigation to Workers, Payroll Weeks, Reports, and Variance
- [ ] **UX-02**: Payroll weeks list shows all weeks with week number, status, and WH-347 download button per row
- [ ] **UX-03**: Worker cards show missing-data warnings (address, SSN) that block WH-347 submission

## Future Requirements

Deferred to v2.1+.

### Compliance (Deferred)

- **COMP-03**: System checks apprentice-to-journeyworker ratio (1:3 per trade per day) — daily check is complex; deferred to keep v2.0 scope tight
- **COMP-04**: System flags workers missing address or SSN before WH-347 submission — partially covered by UX-03

### Reports (Deferred)

- **RPT-03**: Printable compliance summary report (all flags for a project by week)

## Out of Scope

| Feature | Reason |
|---------|--------|
| State-specific prevailing wage forms (CA DIR, WA L&I) | Federal WH-347 only for v2 |
| Multi-user / team accounts | Single contractor user per account for v2 |
| Payroll provider integrations (QuickBooks, ADP) | Manual entry preserves compliance audit trail |
| Mobile native app | Web-first; tablet browser is sufficient |
| Real-time collaboration | Single user per account |
| Statement of Compliance as separate form | 2025 WH-347 embeds it on the form itself — no separate form needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WH347-01 | Phase 6 | Complete |
| WH347-02 | Phase 6 | Complete |
| WH347-03 | Phase 7 | Complete |
| WH347-04 | Phase 7 | Complete |
| COMP-01 | Phase 7 | Complete |
| COMP-02 | Phase 7 | Complete |
| DASH-01 | Phase 8 | Complete |
| DASH-02 | Phase 8 | Complete |
| UX-01 | Phase 8 | Pending |
| UX-02 | Phase 8 | Pending |
| UX-03 | Phase 8 | Pending |
| RPT-01 | Phase 9 | Pending |
| RPT-02 | Phase 9 | Pending |

**Coverage:**
- v2 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 — traceability confirmed at roadmap creation*
