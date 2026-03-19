# HCC Prevailing Wage

## What This Is

A web application that helps general contractors manage Davis-Bacon prevailing wage compliance. Contractors create projects, add workers with trade classifications, enter weekly certified payroll, and generate the federally-required WH-347 form for submission to contracting agencies.

## Core Value

A contractor can run a full project end-to-end — create project → add workers → enter payroll → generate WH-347 → submit — with no missing steps and no manual rate lookup.

## Requirements

### Validated

<!-- Shipped in v1.0 (phases 1–5) -->

- ✓ User can register and log in with email/password — Phase 1
- ✓ User can create a project with state, county, contract type, award date, funding type — Phase 1
- ✓ System fetches federal wage determinations from SAM.gov automatically by project location — Phase 2
- ✓ System caches wage determinations for 30 days with monthly sync — Phase 2
- ✓ User can add workers to a project with name, SSN last 4, union, address — Phase 1 + session
- ✓ User can assign trade classifications with DOL prevailing wage rates auto-populated — Phase 1 + session
- ✓ User can enter weekly payroll hours by day (ST/OT) with live gross wage calculation — Phase 4
- ✓ System generates WH-347 PDF via coordinate overlay on official federal form — Phase 4
- ✓ User can export payroll data as CSV — Phase 4
- ✓ User can compare OT scenarios (CWHSSA vs CBA vs state) — Phase 4
- ✓ User can configure union trade allocations and GSA rate builds — Phase 5
- ✓ User can view job cost variance report with weekly burn rate chart and PDF — Phase 5

### Active

<!-- v2.0 — Contractor UX Overhaul + Compliance -->

- [ ] Dashboard shows all projects with compliance status
- [ ] WH-347 generation accessible with one click from payroll week
- [ ] Statement of Compliance form generated alongside WH-347
- [ ] Fringe benefit summary report per worker per project
- [ ] Worker pay history report across all payroll weeks
- [ ] System flags workers paid below prevailing wage rate
- [ ] System flags OT calculation errors per CWHSSA
- [ ] System checks apprentice-to-journeyworker ratio compliance
- [ ] System flags workers missing address or SSN before WH-347 submission

### Out of Scope

- Mobile native app — web-first; browser on tablet is sufficient
- Multi-user / team accounts — single contractor user per account for v2
- Payroll provider integrations (QuickBooks, ADP) — manual entry is intentional for compliance audit trail
- State-specific prevailing wage forms (CA DIR, WA L&I) — federal WH-347 only for v2

## Context

- **Stack:** Node.js + Express + TypeScript (server), React + Vite + TailwindCSS v4 (client), SQLite + Drizzle ORM, pdf-lib for PDF generation
- **Port:** Server on 4099, Vite proxy to localhost:4099
- **Brand:** HCC — dark nav (#1a1a1a), gold accent (#F5C518), Oswald headlines, Inter body
- **WD Source:** SAM.gov WDOL v1 API (federal only); 50-state seed list hardcoded in wdolSync.ts
- **WH-347:** Coordinate overlay on official form via pdf-lib; fillWh347() in Phase 4-02
- **Pre-existing TS errors:** workers.ts lines 108/115 implicit any — known, non-fatal

## Constraints

- **Stack:** No new UI frameworks — stay in React + TailwindCSS v4
- **PDF:** pdf-lib already installed; use it for all PDF generation
- **DB:** SQLite via Drizzle — no migrations should touch existing tables (add-only)
- **Auth:** JWT in httpOnly cookie — do not change auth model

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SAM.gov seed list vs search API | SAM.gov search/index API returns 404; seed list is the confirmed working pattern | ✓ Good |
| County stored as lowercase string | User-entered at project creation; getCachedWd now has statewide fallback | ✓ Good |
| Rate snapshots on payroll entries | Compliance requires locking in the rate at time of entry, not reading live WD | ✓ Good |
| pdf-lib coordinate overlay for WH-347 | Preserve official form appearance required by DOL | ✓ Good |
| Single user per account | Simplicity for v1; multi-user is a future milestone | — Pending |

## Current Milestone: v2.0 Contractor UX Overhaul

**Goal:** GC can run a complete project end-to-end with no missing workflow steps, full compliance checks, and one-click report generation for federal submission.

**Target features:**
- Dashboard with project compliance status
- Compliance flagging (under-wage, OT errors, apprentice ratio, missing data)
- WH-347 accessible from payroll week view
- Statement of Compliance form
- Fringe benefit summary report
- Worker pay history report
- UX polish: navigation, workflow completeness, no dead ends

---
*Last updated: 2026-03-19 — Milestone v2.0 started*
