# Requirements: HCC Prevailing Wage v2.4

**Milestone:** v2.4 — Ship-Ready + Design Elevation
**Created:** 2026-03-24
**Status:** Active

---

## v1 Requirements

### Dashboard (DASH)

- [x] **DASH-05**: User can filter the project dashboard by compliance status (Compliant / Has Violations / No Payroll / Archived) using a batch summary endpoint — no N+1 per-card fetches

### Compliance History Export (AUD)

- [x] **AUD-03**: User can download their per-worker compliance history as a CSV file (17 columns including project, week, worker, violation type, amounts — UTF-8 with BOM for Excel)

### California DIR Forms (CAL)

- [x] **CAL-01**: System captures CA-specific project fields (CSLB contractor license, WC policy number) on CA projects only
- [x] **CAL-02**: System generates a California A-1-131 certified payroll PDF (local record / eCPR draft) with CA-specific fields: Sun-Sat hours grid, double-time column, SDI deduction, CSLB license; UI discloses that official submission requires the eCPR portal
- [x] **CAL-03**: System captures and displays double-time (DT) hours alongside ST/OT for CA projects (schema migration required)

### Washington L&I Forms (WAL)

- [x] **WAL-01**: User can enter prevailing wage rates manually for WA projects (SAM.gov does not cover WA state wages)
- [x] **WAL-02**: System generates a Washington F700-065-000 certified payroll PDF (local record) with WA trade code mapping and WA-specific project fields (UBI number, L&I cert, WC account)

### Contractor Guidance (UX)

- [x] **UX-05**: Homepage includes a plain-language explainer section: what the system is, who it's for, and a step-by-step "how it works" flow for contractors unfamiliar with Davis-Bacon compliance
- [x] **UX-06**: Each major page (Dashboard, Project Detail, Workers, Payroll Entry, Payroll Week Detail) has contextual help text explaining what to do at that step and why it matters
- [x] **UX-07**: Empty states on all pages include specific next-step instructions, not generic "no data" messages
- [x] **UX-08**: Compliance terms (Davis-Bacon, WH-347, prevailing wage, CWHSSA, WD) have inline `?` icon tooltips with plain-English definitions — accessible on desktop and iPad (tap, not hover-only)

### Design Elevation (DES)

- [x] **DES-01**: App visual design elevated to match HCC website standard — construction photography in hero/dashboard areas, dark gold gradient overlays, card depth with shadows matching `0 2px 12px rgba(0,0,0,0.08)` / `0 8px 24px rgba(0,0,0,0.12)`
- [x] **DES-02**: Landing page hero features full-bleed construction photography with dark overlay, Oswald display headline (`clamp(56px, 8vw, 88px)`), and high-contrast CTA
- [x] **DES-03**: All pages use richer typography hierarchy — tighter letter-spacing on Oswald headlines, improved spacing rhythm matching HCC website

### Operational (OPS)

- [ ] **OPS-01**: App deployed to a live HTTPS URL on Render.com with SQLite on a persistent disk volume (`/var/data/prevailing-wage.db`); Drizzle migrations run at app startup
- [x] **OPS-02**: Registration requires a valid invitation code — open registration disabled in production
- [ ] **OPS-03**: SAM.gov API key and all secrets configured via environment variables; `.env.example` documents every required variable
- [x] **OPS-04**: Vite production build served as static files by Express in production mode

---

## Future Requirements

- CA eCPR XML export for direct portal upload (v2.5 — requires CA DIR API access)
- WA Intent to Pay / Affidavit of Wages portal integration (v2.5 — WA PWIA API not confirmed)
- Multi-user / team accounts (v3.0)
- Payroll provider integrations (QuickBooks, ADP) — v3.0
- Auto-submit to agency portal — v3.0
- Dark mode toggle — deferred indefinitely

---

## Out of Scope

- CA DAS-140 / DAS-142 — apprenticeship committee notification forms, not certified payroll forms; different system entirely
- WA Intent to Pay / Affidavit of Wages as generated PDFs — these are portal-only submissions; no fillable PDF exists
- Direct eCPR portal API submission for CA — XML upload path only; API integration is a separate project
- Mobile native app — web-first; browser on tablet is sufficient
- Inline editing in payroll tables — audit trail risk; dedicated edit views are correct
- Hard block on WH-347 with violations — advisory only; contractor must retain override authority

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DASH-05 | Phase 23 | Complete |
| AUD-03 | Phase 23 | Complete |
| CAL-01 | Phase 24 | Complete |
| CAL-02 | Phase 24 | Complete |
| CAL-03 | Phase 24 | Complete |
| WAL-01 | Phase 25 | Complete |
| WAL-02 | Phase 25 | Complete |
| UX-05 | Phase 26 | Complete |
| UX-06 | Phase 26 | Complete |
| UX-07 | Phase 26 | Complete |
| UX-08 | Phase 26 | Complete |
| DES-01 | Phase 27 | Complete |
| DES-02 | Phase 27 | Complete |
| DES-03 | Phase 27 | Complete |
| OPS-01 | Phase 28 | Pending |
| OPS-02 | Phase 28 | Complete |
| OPS-03 | Phase 28 | Pending |
| OPS-04 | Phase 28 | Complete |
