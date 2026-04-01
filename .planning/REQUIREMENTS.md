# Requirements: HCC Prevailing Wage v3.0

**Milestone:** v3.0 — Team & Integration
**Created:** 2026-03-27
**Status:** Active

---

## v3.0 Requirements

### Multi-User / Team Accounts (MT)

- [x] **MT-01**: Owner can invite one other user by email; invitee receives a registration link and creates their account through it
- [x] **MT-02**: Maximum 2 users total per account (owner + 1 member); invite button disabled when at capacity
- [x] **MT-03**: All members see and can act on all projects (flat model; no per-project permission tiers)
- [x] **MT-04**: Owner can transfer ownership to the existing member; after transfer, original owner becomes a regular member
- [x] **MT-05**: When a member is removed, their payroll entries, submissions, and activity records are retained for 1 year from removal date, then purged

### Payroll Provider Import (PI)

- [x] **PI-01**: User can upload a QuickBooks payroll export file to pre-populate a payroll week's entries — importing worker names, trade classifications, base rates, fringe rates, and hours by day (ST/OT); researcher to confirm the specific QuickBooks report/export format
- [x] **PI-02**: User can upload an ADP payroll export file with the same pre-population behavior as PI-01; researcher to confirm the specific ADP report/export format
- [x] **PI-03**: When an imported worker name does not match an existing project worker, system presents a review & match screen — user can map the CSV name to an existing project worker via dropdown; rows left unmapped are skipped with explicit user visibility (count shown); new worker creation is handled via the Workers page before importing (no inline creation in v3.0)

### Agency Submission Status Tracking (AS)

- [x] **AS-01**: After downloading CA eCPR XML, user can mark the submission as submitted to CA DIR; `caEcprSubmittedAt` timestamp recorded on the payroll week; Payroll Week Detail shows CA submission status badge
- [x] **AS-02**: After downloading WA L&I CPR XML, user can mark the submission as submitted to WA L&I; `waLniSubmittedAt` timestamp recorded on the payroll week; Payroll Week Detail shows WA submission status badge

*Note: Research confirmed no public machine-to-machine API exists for CA DIR eCPR or WA L&I PWIA as of 2026-03. Direct auto-submit is deferred to v4+ pending portal API availability. This phase replaces conditional AS-01/AS-02 with "Mark as Submitted" tracking.*

### SSN Encryption (SEC)

- [x] **SEC-01**: System collects and stores full SSNs (9 digits) for workers, encrypted at rest with AES-256; existing `ssn_last4` plain-text values are encrypted in the migration
- [x] **SEC-02**: Full SSN used exclusively for CA eCPR XML pre-fill and WA L&I PWIA portal pre-fill; CA eCPR XML generator updated to write real SSN replacing the v2.5 placeholder; never written to WH-347 PDFs or included in CSV exports
- [x] **SEC-03**: SSN is masked in all UI views (e.g., `***-**-1234`); full value only decrypted server-side at export time

---

## Previous Requirements (v2.5 — Complete)

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

- Agency portal auto-submit (CA DIR eCPR + WA L&I PWIA direct API) — no public API as of 2026-03; monitor for availability; v4+
- WA Intent to Pay / Affidavit of Wages as generated PDFs — portal-only submission; no fillable PDF exists
- CA DAS-140 / DAS-142 — apprenticeship committee notification forms; different system entirely
- Dark mode toggle — deferred indefinitely

---

## Out of Scope (v3.0)

- Per-project permission tiers — flat model is intentional
- More than 2 users per account — flat model cap
- Direct eCPR portal API submission for CA if no public API exists
- Direct WA PWIA API submission if no public API exists
- Full SSN on WH-347 — privacy constraint; last-4 is the federal standard on WH-347
- Mobile native app — web-first; browser on tablet is sufficient
- Inline editing in payroll tables — audit trail risk; dedicated edit views are correct

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MT-01 | Phase 33 | Complete |
| MT-02 | Phase 33 | Complete |
| MT-03 | Phase 32 | Complete |
| MT-04 | Phase 33 | Complete |
| MT-05 | Phase 33 | Complete |
| PI-01 | Phase 35 | Complete |
| PI-02 | Phase 35 | Complete |
| PI-03 | Phase 36 | Complete |
| AS-01 | Phase 34 | Complete |
| AS-02 | Phase 34 | Complete |
| SEC-01 | Phase 31 | Complete |
| SEC-02 | Phase 31 | Complete |
| SEC-03 | Phase 31 | Complete |
| CAE-01 | Phase 29 | Complete |
| CAE-02 | Phase 29 | Complete |
| CAE-03 | Phase 29 | Complete |
| CAE-04 | Phase 29 | Complete |
| WAL-03 | Phase 30 | Complete |
| WAL-04 | Phase 30 | Complete |
