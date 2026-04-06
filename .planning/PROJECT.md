# HCC Prevailing Wage

## What This Is

A web application that helps general contractors manage Davis-Bacon prevailing wage compliance. Contractors create projects, add workers with trade classifications, enter weekly certified payroll, generate the federally-required WH-347 form (January 2025 revision), and view compliance status and reports — all from one branded application with no manual rate lookup and a clean, professional interface.

## Core Value

A contractor can run a full project end-to-end — create project → add workers → enter payroll → generate WH-347 → submit — with no missing steps, no manual rate lookup, real-time compliance flags before submission, and a consistent branded UI that looks professional enough to hand to an auditor.

## Current Milestone: v4.0 — Compliance Depth + Operations

**Goal:** Deepen compliance coverage with NY and IL state-specific certified payroll forms, richer worker profiles (structured address, union card, apprenticeship, multi-classification), three additional payroll import providers (Gusto, Paychex, Sage), a DOL-audit-ready activity log, and contractor notifications for violations, due dates, team activity, and submissions.

**Target features:**
- Notifications: compliance violation alerts, payroll due-soon reminders, team member activity alerts, submission confirmations (email via nodemailer)
- Additional state forms: New York DOL and Illinois DOL certified payroll PDFs
- More payroll providers: Gusto, Paychex, Sage/Timberline CSV import
- Audit trail: who + what + when activity log, viewable per project
- Worker profile depth: structured address, union local + book number, apprenticeship committee + registration number, multiple trade classifications per payroll week

## Previous Milestone: v3.0 — Team & Integration ✅ SHIPPED 2026-03-31

**Delivered:** Transformed HCC Prevailing Wage from a single-contractor tool into a team-ready platform with encrypted SSN storage, multi-user team accounts, payroll provider imports (QuickBooks + ADP), and agency submission status tracking. Research confirmed no public CA DIR or WA L&I APIs exist — auto-submit deferred to v4+.

## Current State (v4.0 in progress — Phase 40 complete)

Phase 40 complete: NY foundation shipped — `0023_ny_schema.sql` migration adds `nyprcNumber`, `nysContractorRegNumber`, `projectSettings` to projects and `nysRegisteredApprentice` to workers. ProjectForm renders green `isNY` conditional panel (PRC Number + Contractor Reg). `computeCompliance()` fetches `project.state` and enforces NY 8-hours/day OT rule (each day checked independently, `cwhssa-ot` violation). 420 tests passing.

**Shipped:** 2026-03-31 (v3.0); v4.0 in progress
**Tests:** 387+ passing (main suite, excluding worktrees)
**Stack:** Node.js + Express + TypeScript (server), React + Vite + TailwindCSS v4 (client), SQLite + Drizzle ORM, pdf-lib for PDF generation, xmlbuilder2 for XML export, nodemailer (team invites)
**LOC:** ~15,000+ net new lines (v3.0 added ~2,818 across 32 files)

**What works end-to-end:**
- Full marketing landing page at "/" (HCC brand, WH-347/Davis-Bacon/SAM.gov above fold, CTA to /register)
- Auth-aware routing: authenticated → /dashboard, unauthenticated → /, wildcard handled
- Multi-user team accounts: owner invites 1 member by email, flat model (all members see all projects), ownership transfer, member removal with 1-year data retention
- AES-256-GCM encrypted SSN storage: full 9-digit SSN collected, stored encrypted, masked in UI (***-**-1234), decrypted server-side for CA eCPR and WA PWIA XML export only
- Payroll import: QuickBooks "Time by Employee Detail" + ADP Run CSV → 3-step modal (upload → preview/resolve → confirm commit); unmatched worker remap, conflict detection, payroll_imports audit table
- Agency submission status tracking: per-agency "Mark as Submitted" in CA eCPR + WA CPR modals; independent badge rows for CA and WA on Payroll Week Detail
- All pages use design token classes (no hardcoded hex), Oswald/Inter typography, Card/Badge/Button/PageHeader/EmptyState primitives
- CA A-1-131 form (CA-gated, fringe disaggregation), WA F700-065-000 form (WA-gated, manual rate entry), CA eCPR XML, WA PWIA XML
- WH-347 PDF generation (January 2025 revision), per-entry compliance badges, submission tracking, copy/amend workflows

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

<!-- Shipped in v2.1 (phases 10–14) -->

- ✓ HCC brand colors applied via named CSS tokens — @theme in index.css, no hardcoded hex — v2.1
- ✓ Oswald (headlines) and Inter (body) loaded via Google Fonts — v2.1
- ✓ All 7 hardcoded inline brand values replaced with design token classes — v2.1
- ✓ All 43 focus:outline-none instances migrated to focus:outline-hidden — v2.1
- ✓ Card, Button (primary/secondary/ghost), Badge (compliant/violation/warning/neutral), PageHeader, EmptyState primitives — v2.1
- ✓ Dark nav (#1a1a1a) with gold accent on every protected page — v2.1
- ✓ Typography hierarchy enforced globally (Oswald/Inter) — v2.1
- ✓ Consistent Card-based layout with uniform spacing across all pages — v2.1
- ✓ Full marketing landing page at "/" with WH-347/Davis-Bacon/SAM.gov hero, 6 sections, HCC brand — v2.1
- ✓ Auth-aware routing: PublicRoute, WildcardRedirect, separate RegisterPage — v2.1
- ✓ All 7 app pages use design primitives — no ad-hoc inline styling — v2.1

<!-- Shipped in v2.2 (phases 15-16) -->

- ✓ Apprentice ratio per-week violation check (COMP-03) — extends compliance engine, fires when apprentice hours > 1:3 JW ratio — v2.2
- ✓ 4-step workflow progress indicator on Project Detail (Create → Workers → Payroll → WH-347) — v2.2
- ✓ Print-to-PDF for reports — browser print optimization (repeating headers, totals row, no UI chrome) — v2.2
- ✓ WH-347 preflight: compliance violation summary before generating, Download Anyway / Cancel — v2.2
- ✓ WH-347 download feedback: "Generating..." label during fetch, double-click guard via useRef — v2.2

<!-- Shipped in v2.3 (phases 17-22) -->

- ✓ DB extended with submitted_at, submitted_to, amendment_number, original_week_id columns on payroll_weeks — v2.3
- ✓ Project archive/restore: compliance pre-check advisory, Archived badge, Show Archived toggle — v2.3
- ✓ Dashboard name search + funding type filter with URL-persisted state — v2.3
- ✓ WH-347 submission tracking: mark submitted with date/agency, server-side edit lock, un-submit — v2.3
- ✓ Copy previous payroll week: 3-step modal, live rate re-fetch, skipped-entry warning — v2.3
- ✓ Payroll amendment workflow: amend submitted week, "N (AMENDED M)" WH-347 label, pre-filled from original — v2.3
- ✓ Per-worker compliance history: cross-project violation aggregation by (name, ssnLast4) identity — v2.3

<!-- Shipped in v2.4 (phases 23-28) -->

- ✓ Dashboard compliance status filter + batch summary endpoint (no N+1) — v2.4 Phase 23
- ✓ CSV export from per-worker compliance history page (17 cols, UTF-8 BOM) — v2.4 Phase 23
- ✓ Contractor guidance: HelpCallout on 5 pages, TermTooltip for 5 compliance terms, instructional empty states with action buttons, 4-step landing page how-it-works — v2.4 Phase 26
- ✓ UI/UX overhaul: full-bleed hero photography, floating nav, clamp headline, elevated dashboard card shadow, tracking-tight PageHeader h1, 7-page h1 migration — v2.4 Phase 27 (placeholder WebPs — swap real photos before launch)
- ✓ California A-1-131 certified payroll form (CA-gated, eCPR modal, CSLB/WC fields) — v2.4 Phase 24
- ✓ Washington F700-065-000 certified payroll form (WA-gated, PWIA modal, UBI/L&I cert/WC fields, manual rate entry, WA trade codes) — v2.4 Phase 25
- ✓ Operational: Render.com deployment, SQLite on persistent disk (/var/data), invite-only registration, Express static serving for React SPA — v2.4 Phase 28

<!-- Shipped in v2.5 (phases 29-30) -->

- ✓ CA eCPR XML export: fringe disaggregation (4 sub-columns), pre-generation modal, post-download portal checklist, amendment marker — v2.5 Phase 29
- ✓ WA PWIA submission assist: CPR XML export gated on intentId + trade codes, WAL-04 submission guide panel (Intent to Pay + Affidavit of Wages Paid) — v2.5 Phase 30

<!-- Shipped in v3.0 (phases 31-36) -->

- ✓ SSN encryption: AES-256-GCM at rest, versioned envelope, full 9-digit SSN input, masked display, hasFullSsn badge — v3.0 Phase 31
- ✓ Multi-user foundation: project_members join table, assertProjectAccess utility, all 21 ownership checks centralized, cross-tenant IDOR protection — v3.0 Phase 32
- ✓ Team invite flow + UI: email invite (Resend SDK / console fallback), tokenized /accept-invite page, TeamPage at /team, soft-delete member removal, ownership transfer — v3.0 Phase 33
- ✓ Agency submission status tracking: CA eCPR and WA L&I submission timestamps on payroll_weeks, modal "Mark as Submitted" buttons, independent per-agency badge rows (CA=amber, WA=gray), state-gated display — v3.0 Phase 34
- ✓ Payroll import server pipeline: QuickBooks "Time by Employee Detail" + ADP Run CSV parsing, provider auto-detection, per-entry row aggregation (QB), weekly-total Monday placement (ADP), worker matching (case-insensitive), conflict detection, preview/commit API, payroll_imports audit table — v3.0 Phase 35
- ✓ Payroll Import React UI: 3-step PayrollImportModal on PayrollWeekDetailPage — Step 1 file picker (FormData/raw fetch), Step 2 preview/resolve (QB 14-col / ADP 2-col, remap dropdowns, conflict panel), Step 3 confirm/commit (IIFE payload builder, success banner, error inline) — v3.0 Phase 36

### Active

_(empty — v3.0 shipped; start `/gsd:new-milestone` to define v4.0 requirements)_

### Out of Scope

- Mobile native app — web-first; browser on tablet is sufficient
- Agency portal auto-submit (CA DIR eCPR + WA L&I PWIA) — no public API exists as of 2026-03; monitor for availability; deferred to v4+
- State-specific prevailing wage forms (CA DIR, WA L&I) — federal WH-347 only (CA A-1-131 + WA F700 shipped as bonus)
- Missing-data hard block on WH-347 submission — warning only (UX-03); hard block deferred
- Dark mode toggle — CSS complexity, compliance software is often printed or screen-shared; not needed
- Customizable dashboard widgets — fixed well-designed layout preferred
- Feature tour/onboarding overlay — empty states with action prompts are more effective
- Inline editing in payroll tables — audit trail risk; dedicated edit views are correct

## Context

- **Stack:** Node.js + Express + TypeScript (server), React + Vite + TailwindCSS v4 (client), SQLite + Drizzle ORM, pdf-lib for PDF generation
- **Port:** Server on 4099; Vite dev proxy to 4099
- **Brand:** HCC — dark nav (#1a1a1a via bg-nav-dark), gold accent (#F5C518 via brand-gold), Oswald headlines, Inter body — all via @theme tokens
- **WD Source:** SAM.gov WDOL v1 API (federal only); 50-state seed list hardcoded in wdolSync.ts
- **WH-347:** Coordinate overlay on official 2025 form via pdf-lib; `fillWh347()` with multi-page chunking (8 workers/page)
- **Compliance:** Rate snapshots frozen on `payrollEntries.fringeRateSnapshot` / `baseRateSnapshot` — never re-read from live WD
- **Pre-existing TS errors:** workers.ts lines 108/115 implicit any — known, non-fatal
- **Migration workflow:** SQL-only migrations must be manually registered in `meta/_journal.json`
- **Button/asChild:** Button component has no `asChild` prop — use secondary button classes on `<a>` directly for download links

## Constraints

- **Stack:** No new UI frameworks — stay in React + TailwindCSS v4
- **PDF:** pdf-lib already installed; use it for all PDF generation
- **DB:** SQLite via Drizzle — add-only migrations, never drop columns
- **Auth:** JWT in httpOnly cookie — do not change auth model
- **Compliance rates:** Always use snapshot values from payrollEntries, never re-read live wage determinations
- **Design tokens:** All brand values via @theme tokens — never hardcode #F5C518 or #1a1a1a in JSX

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
| @theme CSS tokens over inline styles | Single-source brand values propagate everywhere; no per-component hex values | ✓ Good — v2.1 |
| Button has no asChild prop | Simpler component; copy secondary classes to `<a>` directly for link-buttons | ✓ Good — v2.1 |
| PublicRoute + WildcardRedirect pattern | Mirrors ProtectedRoute pattern; auth-aware without duplicating logic | ✓ Good — v2.1 |
| LoginPage login-only (no embedded RegisterForm) | Simpler component, cleaner routing, dedicated RegisterPage at /register | ✓ Good — v2.1 |
| Browser print CSS for reports | `overflow: visible !important` on `.overflow-x-auto` required for `thead { display: table-header-group }` to work in print | ✓ Good — v2.2 |
| useRef for double-click guard | `useState` setter is async/batched — second click fires before re-render; `useRef.current` is synchronous | ✓ Good — v2.2 |
| weekViolations[] separate from violations[] | COMP-03 is per-week aggregate; existing per-entry violations consumers would break if shape changed | ✓ Good — v2.2 |
| Single user per account | Simplicity for v1/v2; multi-user is a future milestone | ✓ Superseded — team accounts shipped v3.0 Phase 31-33 |
| copyPayrollWeek() re-fetches live rates | Federal compliance: stale snapshots produce invalid certified payroll | ✓ Good — v2.3 |
| amendPayrollWeek() clones snapshots | 29 CFR Part 3: rates fixed at submission time; amendment must use same rates | ✓ Good — v2.3 |
| Amendment always resolves to root week | rootWeekId = source.originalWeekId ?? source.id — prevents chained amendment numbering | ✓ Good — v2.3 |
| ssnLast4=null scopes to source project only | Null identity cannot safely assert cross-project worker match | ✓ Good — v2.3 |
| Route ordering: specific before wildcard | All new routes must register before /:id wildcards on Express routers | ✓ Good — v2.3 |
| Preview-then-commit on copy | preview:true returns {copied,skipped} without DB write; user confirms before commit | ✓ Good — v2.3 |
| AES-256-GCM with versioned JSON envelope | Key rotation support built in from day one; envelope stores version + iv + tag + ciphertext | ✓ Good — v3.0 |
| ssnEncrypted additive column (keep ssnLast4) | ssnLast4 derivable from full SSN; kept for backward compat; derived last-4 from full SSN going forward | ✓ Good — v3.0 |
| assertProjectAccess centralized utility | 21 scattered inline IDOR checks replaced with single utility; cross-tenant regression suite proves coverage | ✓ Good — v3.0 |
| Owner + 1 member cap, flat model | No per-project permission tiers for v3.0; complexity vs. use case not justified | ✓ Good — v3.0 |
| No inline worker creation in import modal | Escape hatch to Workers page sufficient for v3.0; D-10 in 36-CONTEXT.md — deferred to future milestone | ✓ Good — v3.0 |
| Raw fetch() for FormData upload, api.post for JSON commit | api.post JSON.stringifies body, breaking multipart upload; two strategies for two HTTP shapes in one feature | ✓ Good — v3.0 |
| Agency auto-submit deferred (no public CA DIR / WA L&I API) | Research confirmed no public machine-to-machine API as of 2026-03; replaced with "Mark as Submitted" tracking | ✓ Good — v3.0 |

---
*Last updated: 2026-04-01 — v3.0 milestone complete (Team & Integration — 6 phases, 17 plans shipped)*
