# Requirements: HCC Prevailing Wage v2.5

**Milestone:** v2.5 — State Portal Integration
**Created:** 2026-03-27
**Status:** Active

---

## v1 Requirements

### CA Electronic Certified Payroll (CAE)

- [x] **CAE-01**: System disaggregates CA fringe contributions into 4 separate line items at payroll entry — health/welfare, pension, vacation, and training — stored in new DB columns per payroll entry (CA projects only)
- [x] **CAE-02**: User can generate and download a CA DIR eCPR-compliant XML file from existing A-1-131 payroll data; missing required fields (contractor FEIN, DIR project ID, awarding agency, contract number) are collected via a pre-generation modal at export time
- [x] **CAE-03**: After eCPR XML download, app displays a portal upload checklist with step-by-step instructions for submitting the file to the CA DIR eCPR portal, including the SSN caveat (must be entered directly in portal)
- [x] **CAE-04**: eCPR XML carries the correct amendment/resubmit marker when the payroll week is an amendment (ties into the v2.3 amendment model)

### WA L&I Submission (WAL)

- [x] **WAL-03**: User can generate and download a WA L&I CPR XML file for upload to the My L&I PWIA portal; export is gated on the contractor providing their PWIA `intentId` (issued after Statement of Intent approval); WA trade codes validated before generation
- [x] **WAL-04**: User can view a pre-populated submission summary for WA Intent to Pay and Affidavit of Wages filings — all required field values drawn from project/worker/payroll data — formatted for manual entry into the PWIA portal

---

## Future Requirements

- Multi-user / team accounts (v3.0)
- Payroll provider integrations (QuickBooks, ADP) — v3.0
- Auto-submit to agency portal — v3.0
- Full SSN storage with encryption at rest for CA eCPR direct portal pre-fill — v3.0 (privacy/security review required)
- Dark mode toggle — deferred indefinitely

---

## Out of Scope

- CA DAS-140 / DAS-142 — apprenticeship committee notification forms, not certified payroll forms; different system entirely
- WA Intent to Pay / Affidavit of Wages as generated PDFs — these are portal-only submissions; no fillable PDF exists
- Direct eCPR portal API submission for CA — no public API exists; XML download only
- Direct WA PWIA API submission — no confirmed public API; portal upload only
- Full SSN storage this milestone — pre-flight warning + contractor enters directly in portal
- Mobile native app — web-first; browser on tablet is sufficient
- Inline editing in payroll tables — audit trail risk; dedicated edit views are correct
- Hard block on WH-347 with violations — advisory only; contractor must retain override authority

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAE-01 | Phase 29 | Complete |
| CAE-02 | Phase 29 | Complete |
| CAE-03 | Phase 29 | Complete |
| CAE-04 | Phase 29 | Complete |
| WAL-03 | Phase 30 | Complete |
| WAL-04 | Phase 30 | Complete |
