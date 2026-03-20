# HCC Prevailing Wage

## What This Is

A web application that helps general contractors manage Davis-Bacon prevailing wage compliance. Contractors create projects, add workers with trade classifications, enter weekly certified payroll, generate the federally-required WH-347 form (January 2025 revision), and view compliance status and reports — all from one application with no manual rate lookup.

## Core Value

A contractor can run a full project end-to-end — create project → add workers → enter payroll → generate WH-347 → submit — with no missing steps, no manual rate lookup, and real-time compliance flags before submission.

## Current Milestone: v2.1 — Design Polish + Landing Page

**Goal:** Transform the app from generic-looking to clean + professional with a full marketing landing page and consistent HCC brand polish across every page.

**Target features:**
- Full marketing landing page (HCC logo, value prop, feature list, CTA to register)
- UI polish across all pages: Dashboard, Project Detail, Workers, Payroll Entry, Payroll Week Detail, Reports, Login/Register
- Typography hierarchy (Oswald headlines at correct sizes, Inter body)
- Table and data display polish (spacing, borders, cell contrast)
- Card and layout consistency (padding, shadow, border-radius)
- Competitor-beating design vs LCPtracker, Elation, QuickBooks, ADP

## Current State (v2.0)

**Shipped:** 2026-03-20
**Tests:** 181 passing
**Stack:** Node.js + Express + TypeScript (server), React + Vite + TailwindCSS v4 (client), SQLite + Drizzle ORM, pdf-lib for PDF generation

**What works end-to-end:**
- Project creation → workers/classifications → weekly payroll entry → WH-347 PDF (January 2025 form)
- Compliance engine flags under-wage and CWHSSA OT violations before WH-347 submission
- Dashboard shows compliance badge + week count per project
- Reports: fringe benefit summary and worker pay history
- Navigation: every page has explicit links to adjacent workflow steps

## Requirements

### Validated

<!-- Shipped in v1.0 (phases 1–5) -->

- ✓ User can register and log in with email/password — v1.0
- ✓ User can create a project with state, county, contract type, award date, funding type — v1.0
- ✓ System fetches federal wage determinations from SAM.gov automatically by project location — v1.0
- ✓ System caches wage determinations for 30 days with monthly sync — v1.0
- ✓ User can add workers to a project with name, SSN last 4, union, address — v1.0
- ✓ User can assign trade classifications with DOL prevailing wage rates auto-populated — v1.0
- ✓ User can enter weekly payroll hours by day (ST/OT) with live gross wage calculation — v1.0
- ✓ System generates WH-347 PDF via coordinate overlay on official federal form — v1.0
- ✓ User can export payroll data as CSV — v1.0
- ✓ User can compare OT scenarios (CWHSSA vs CBA vs state) — v1.0
- ✓ User can configure union trade allocations and GSA rate builds — v1.0
- ✓ User can view job cost variance report with weekly burn rate chart and PDF — v1.0

<!-- Shipped in v2.0 (phases 6–9) -->

- ✓ WH-347 conforms to January 2025 DOL revision (correct form, multi-page support) — v2.0
- ✓ Worker profile includes J/RA (journeyworker/registered apprentice) field — v2.0
- ✓ WH-347 downloadable with one click from payroll week view — v2.0
- ✓ System flags under-wage and CWHSSA OT violations per payroll entry — v2.0
- ✓ Dashboard shows compliance status badge and week count per project card — v2.0
- ✓ Project detail page has explicit navigation to all workflow sections — v2.0
- ✓ Worker cards show missing-data warnings for address/SSN — v2.0
- ✓ Fringe benefit summary report per worker (using frozen rate snapshots) — v2.0
- ✓ Worker pay history report across all payroll weeks in descending date order — v2.0

### Active

<!-- v2.1 — requirements being defined -->

- Landing page: Full marketing homepage with HCC brand (in progress)
- UI polish: Typography hierarchy, table/data polish, card/layout consistency across all pages (in progress)

### Out of Scope

- Mobile native app — web-first; browser on tablet is sufficient
- Multi-user / team accounts — single contractor user per account
- Payroll provider integrations (QuickBooks, ADP) — manual entry is intentional for compliance audit trail
- State-specific prevailing wage forms (CA DIR, WA L&I) — federal WH-347 only
- Apprentice ratio daily check (COMP-03) — complex daily loop; deferred to v2.1
- Missing-data hard block on WH-347 submission (COMP-04) — warning only (UX-03); hard block deferred

## Context

- **Stack:** Node.js + Express + TypeScript (server), React + Vite + TailwindCSS v4 (client), SQLite + Drizzle ORM, pdf-lib for PDF generation
- **Port:** Server on 4099 (moved from 3001 to avoid conflicts); Vite dev proxy to 4099
- **Brand:** HCC — dark nav (#1a1a1a), gold accent (#F5C518), Oswald headlines, Inter body
- **WD Source:** SAM.gov WDOL v1 API (federal only); 50-state seed list hardcoded in wdolSync.ts
- **WH-347:** Coordinate overlay on official 2025 form via pdf-lib; `fillWh347()` with multi-page chunking (8 workers/page)
- **Compliance:** Rate snapshots frozen on `payrollEntries.fringeRateSnapshot` / `baseRateSnapshot` — never re-read from live WD
- **Pre-existing TS errors:** workers.ts lines 108/115 implicit any — known, non-fatal
- **Migration workflow:** SQL-only migrations must be manually registered in `meta/_journal.json`

## Constraints

- **Stack:** No new UI frameworks — stay in React + TailwindCSS v4
- **PDF:** pdf-lib already installed; use it for all PDF generation
- **DB:** SQLite via Drizzle — add-only migrations, never drop columns
- **Auth:** JWT in httpOnly cookie — do not change auth model
- **Compliance rates:** Always use snapshot values from payrollEntries, never re-read live wage determinations

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SAM.gov seed list vs search API | SAM.gov search/index API returns 404; seed list is the confirmed working pattern | ✓ Good |
| County stored as lowercase string | User-entered at project creation; getCachedWd has statewide fallback | ✓ Good |
| Rate snapshots on payroll entries | Compliance requires locking in the rate at time of entry, not reading live WD | ✓ Good |
| pdf-lib coordinate overlay for WH-347 | Preserve official form appearance required by DOL | ✓ Good |
| `pdfDoc.copyPages()` before drawing content | Template pages must be blank when copied — snapshot captures current state | ✓ Good |
| `cwhssa-ot` check fires before `under-wage` | Both can't fire for the same entry; OT entry has different expected formula | ✓ Good |
| CWHSSA fringe not multiplied for OT | DOL formula: `totalHours×fringe` is flat; fringe is per-hour regardless of premium | ✓ Good |
| Compliance query in `ProjectCard` not `DashboardPage` | Each card owns its fetch; staleTime:60_000 prevents N re-fetches on navigate-back | ✓ Good |
| Static route before parameterized route | `/project/:projectId` must precede `/:weekId` to prevent wildcard capture | ✓ Good |
| Reports on-screen only for v2.0 | PDF reports deferred — on-screen covers DOL audit requests | — Pending v2.1 |
| Single user per account | Simplicity for v1/v2; multi-user is a future milestone | — Pending |

---
*Last updated: 2026-03-20 after v2.0 milestone*
