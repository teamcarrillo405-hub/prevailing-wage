# Milestones

## v3.0 Team & Integration (Shipped: 2026-04-01)

**Phases completed:** 32 phases, 81 plans, 122 tasks

**Key accomplishments:**

- One-liner:
- Failing red-stub tests in workers.test.ts (programName) and wh347.test.ts (4-page multi-page) define behavioral contracts for Plans 02 and 03
- One-liner:
- fillWh347() now chunks unlimited workers into groups of 8, producing one worker-grid page + one Statement of Compliance page per chunk, with Page X of Y on each worker-grid page
- certApprentices boolean in export.ts now derived from programName presence on apprentice entries, and Workers UI shows a programName input field when labor type is apprentice
- 1. [Rule 3 - Blocking] Added POST /api/payroll/entries route
- React page with entries table, per-row violation badges, compliance panel, and plain-anchor WH-347 download wired to two parallel React Query calls
- complianceRouter wired into Express, PayrollWeekDetailPage accessible via React Router, and WH-347 Statement of Compliance booleans replaced with computeCompliance() engine output
- 5 failing TDD stubs for GET /api/compliance/project/:projectId appended to compliance.test.ts, establishing RED state before Plan 02 implements the route
- One-liner:
- PayrollListPage.tsx
- One-liner:
- 1. [Rule 1 - Bug] 404 stub was accidentally passing
- Drizzle ORM aggregation service for fringe-credit totals and worker pay history, with Express router applying ownership checks — router unregistered pending Plan 04 wiring
- Tabbed reports UI with fringe benefit summary (one row per worker) and pay history (worker-selector + descending-week table) using gold HCC brand accent and Oswald headlines
- Reports feature made fully navigable: backend router registered at /api/reports, client route wired in App.tsx, and ProjectDetailPage Reports link activated — all 6 Wave 0 tests pass GREEN and full suite (181 tests) has no regressions.
- Goal achieved:
- 14-token HCC brand @theme in index.css with Oswald/Inter Google Fonts loaded via HTML preconnect tags and @layer base global font defaults
- Removed all 7 hardcoded brand inline styles across 5 TSX files, replacing backgroundColor and fontFamily props with bg-brand-gold and font-headline utility classes, browser-verified on WageClassificationsTable tr element.
- Migrated all 43 focus:outline-none instances across 9 TSX files to focus:outline-hidden + focus:ring-brand-gold, eliminating arbitrary color values and fixing forced-color mode compliance
- One-liner:
- PageHeader (title/subtitle/action) and EmptyState (heading/message/action) using design tokens, completing all five Phase 11 UI primitives
- Layout.tsx nav migrated from hardcoded hex (#F5C518, bg-gray-900) to design tokens (bg-nav-dark, border-brand-gold, hover:text-brand-gold), propagating brand-correct dark nav and gold accent to all 8 protected pages
- DashboardPage and ProjectDetailPage migrated from raw h2 elements to PageHeader primitive, establishing h1 semantic hierarchy and design-system typography pattern for all pages.
- 8 inline card div patterns replaced with Card primitive across 5 files, completing SHELL-03 and eliminating all hardcoded card styling in the protected app shell.
- PublicRoute guard + RegisterPage + auth-aware App.tsx route tree enabling '/' and '/register' as guarded public routes with WildcardRedirect for unknown URLs
- LandingPage.tsx top half: sticky dark nav, above-the-fold hero naming WH-347/Davis-Bacon/SAM.gov, 3 pain-point Card grid, 3-step How It Works with gold lucide icons and scroll anchor
- LandingPage.tsx complete: 6-card feature highlights grid, January-2025-specific trust signals, gold-bg CTA close, and branded footer — all eight section renders wired
- One-liner:
- PayrollWeekDetailPage Badge violations + WH-347 anchor button and ReportsPage token-clean tabs + print CSS — final Phase 14 gate passed with human approval of all 7 pages.
- 1. [Rule 1 - Bug] Fixed missing apprenticePercent in seedApprenticeWorker helper
- 4-step workflow progress indicator (Create Project, Add Workers, Enter Payroll, Download WH-347) added to ProjectDetailPage, driven by real workers and payroll-weeks API data
- @media print CSS expansion plus tfoot totals row on fringe summary — both reports now print cleanly via Ctrl+P with repeating headers, no UI chrome, and a visible totals row
- Fetch-driven WH-347 download with preflight compliance modal (violations list + Download Anyway), generating state label, and synchronous double-click guard via useRef
- SQL migration adds 4 nullable submission/amendment columns to payroll_weeks (idx 5 in journal), and GET /api/projects gains active-only default filter with ?status=all override
- React archive/restore UI: compliance advisory modal, Archived badge on ProjectCard, Show Archived toggle on DashboardPage, Archive/Restore buttons on ProjectDetailPage with TanStack Query invalidation
- Real-time name search and funding type filter added to DashboardPage with URL-persisted ?q= and ?funding= params — back navigation restores both inputs automatically
- PATCH/DELETE submit routes + server-side 409 edit lock guard injected in both entry write routes, driven by TDD (assertWeekNotSubmitted x3 confirmed)
- Submit form + read-only lock banner + Submitted badges on PayrollListPage — SUB-01/02/03 browser-verified end-to-end
- Three-step modal on PayrollListPage (choose / configure / preview-with-skip-warnings) calling POST /api/payroll/weeks/copy and navigating to the new week on confirm.
- getWorkerComplianceHistory() service + GET /api/compliance/worker/:workerId/history route + 6-case TDD integration test suite — cross-project violation aggregation via (name, ssnLast4) identity matching
- WorkerComplianceHistoryPage showing cross-project violation history with Badge-per-type, amounts, and empty state; route and Workers link wired end-to-end
- 1. [Rule 1 - Bug] Fixed pre-existing TypeScript implicit-any errors in workers.ts (lines 108/115)
- Instructional empty states with action CTAs on 4 pages, and all 5 compliance terms (Davis-Bacon, WH-347, prevailing wage, CWHSSA, WD) wrapped with inline TermTooltip across 6 pages
- One-liner:
- RegisterForm invite code field with brand-gold button token fix deployed to Render — smoke tests passed, app live at https://hcc-prevailing-wage.onrender.com
- One-liner:
- CA DIR eCPR XML generator using xmlbuilder2 producing CPR.xsd v1.3 compliant XML with CPR: namespace prefix, plus CA-gated GET /api/export/ecpr-xml/:weekId route handler
- CA eCPR XML download button and 2-step modal added to PayrollWeekDetailPage — Step 1 collects/persists contractor fields with SSN disclosure, Step 2 shows 6-step DIR portal upload checklist
- One-liner:
- WA L&I PWIA XML generator (WaPWCPR root, Mon-first day ordering) and export route with state gate, intentId validation, and trade code enforcement — all Wave 0 RED stubs GREEN
- WA CPR XML gated download flow (trade code gate + PWIA intentId modal + blob download) and WAL-04 PWIA portal data-entry guide panel added to PayrollWeekDetailPage
- AES-256-GCM cryptoService module with versioned JSON envelope, workers migration adding ssn_encrypted column, startup key assertion, and backfill script for existing ssnLast4 data
- Worker routes accept full 9-digit SSN, encrypt via cryptoService on write, derive ssnLast4, strip ssnEncrypted from all three response paths, add hasFullSsn boolean. WorkersPage.tsx collects 9-digit SSN with password masking and shows "Full SSN not on file" badge on edit view for partial-only workers.
- CA eCPR and WA PWIA XML generators decrypt real 9-digit SSNs from encrypted storage (fallback to 000000+last4 placeholder for null/partial). payrollService extended to join workerSsnEncrypted. 4 unit tests validate resolveEcprSsn() behavior.
- project_members table + assertProjectAccess utility enabling centralized IDOR-safe access control across all 6 route files
- All 21 inline IDOR guards replaced with assertProjectAccess across 6 route files — centralized membership-based access control
- 11-assertion cross-tenant security regression suite covering all 6 refactored route files — proves userB cannot access userA's resources across projects, workers, reports, compliance, export, and payroll
- One-liner:
- One-liner:
- One-liner:
- TeamPage with members list, invite/revoke/remove/transfer actions, and AcceptInvitePage with token-state machine, wired into App routes and Layout nav
- One-liner:
- "Mark as Submitted to CA DIR / WA L&I" buttons in eCPR and CPR XML modals plus per-agency badge rows in Submission Status panel, independently tracked and state-gated by project.state.
- One-liner:
- One-liner:

---

## v2.3 Contractor Workflow Efficiency + Audit Readiness (Shipped: 2026-03-24)

**Phases completed:** 6 phases, 11 plans, 21 tasks

**Key accomplishments:**

- SQL migration adds 4 nullable submission/amendment columns to payroll_weeks (idx 5 in journal), and GET /api/projects gains active-only default filter with ?status=all override
- React archive/restore UI: compliance advisory modal, Archived badge on ProjectCard, Show Archived toggle on DashboardPage, Archive/Restore buttons on ProjectDetailPage with TanStack Query invalidation
- Real-time name search and funding type filter added to DashboardPage with URL-persisted ?q= and ?funding= params — back navigation restores both inputs automatically
- PATCH/DELETE submit routes + server-side 409 edit lock guard injected in both entry write routes, driven by TDD (assertWeekNotSubmitted x3 confirmed)
- Submit form + read-only lock banner + Submitted badges on PayrollListPage — SUB-01/02/03 browser-verified end-to-end
- Three-step modal on PayrollListPage (choose / configure / preview-with-skip-warnings) calling POST /api/payroll/weeks/copy and navigating to the new week on confirm.
- getWorkerComplianceHistory() service + GET /api/compliance/worker/:workerId/history route + 6-case TDD integration test suite — cross-project violation aggregation via (name, ssnLast4) identity matching
- WorkerComplianceHistoryPage showing cross-project violation history with Badge-per-type, amounts, and empty state; route and Workers link wired end-to-end

---

## v2.2 UX Completion + Compliance Hardening (Shipped: 2026-03-23)

**Phases completed:** 2 phases, 4 plans, 5 tasks

**Key accomplishments:**

- 1. [Rule 1 - Bug] Fixed missing apprenticePercent in seedApprenticeWorker helper
- 4-step workflow progress indicator (Create Project, Add Workers, Enter Payroll, Download WH-347) added to ProjectDetailPage, driven by real workers and payroll-weeks API data
- @media print CSS expansion plus tfoot totals row on fringe summary — both reports now print cleanly via Ctrl+P with repeating headers, no UI chrome, and a visible totals row
- Fetch-driven WH-347 download with preflight compliance modal (violations list + Download Anyway), generating state label, and synchronous double-click guard via useRef

---

## v2.1 Design Polish + Landing Page (Shipped: 2026-03-22)

**Phases completed:** 5 phases, 14 plans, 23 tasks

**Key accomplishments:**

- 14-token HCC brand @theme in index.css with Oswald/Inter Google Fonts loaded via HTML preconnect tags and @layer base global font defaults
- Removed all 7 hardcoded brand inline styles across 5 TSX files, replacing backgroundColor and fontFamily props with bg-brand-gold and font-headline utility classes, browser-verified on WageClassificationsTable tr element.
- Migrated all 43 focus:outline-none instances across 9 TSX files to focus:outline-hidden + focus:ring-brand-gold, eliminating arbitrary color values and fixing forced-color mode compliance
- One-liner:
- PageHeader (title/subtitle/action) and EmptyState (heading/message/action) using design tokens, completing all five Phase 11 UI primitives
- Layout.tsx nav migrated from hardcoded hex (#F5C518, bg-gray-900) to design tokens (bg-nav-dark, border-brand-gold, hover:text-brand-gold), propagating brand-correct dark nav and gold accent to all 8 protected pages
- DashboardPage and ProjectDetailPage migrated from raw h2 elements to PageHeader primitive, establishing h1 semantic hierarchy and design-system typography pattern for all pages.
- 8 inline card div patterns replaced with Card primitive across 5 files, completing SHELL-03 and eliminating all hardcoded card styling in the protected app shell.
- PublicRoute guard + RegisterPage + auth-aware App.tsx route tree enabling '/' and '/register' as guarded public routes with WildcardRedirect for unknown URLs
- LandingPage.tsx top half: sticky dark nav, above-the-fold hero naming WH-347/Davis-Bacon/SAM.gov, 3 pain-point Card grid, 3-step How It Works with gold lucide icons and scroll anchor
- LandingPage.tsx complete: 6-card feature highlights grid, January-2025-specific trust signals, gold-bg CTA close, and branded footer — all eight section renders wired
- One-liner:
- PayrollWeekDetailPage Badge violations + WH-347 anchor button and ReportsPage token-clean tabs + print CSS — final Phase 14 gate passed with human approval of all 7 pages.

---

## v1.0 — Foundation + Wage Engine + Payroll + Differentiators

**Shipped:** 2026-03-19
**Phases:** 1–5

Core platform: auth, projects, federal wage lookups (SAM.gov), workers/classifications, weekly payroll entry, WH-347 PDF generation, CSV export, OT scenario comparison, union allocations, GSA rate builder, job cost variance reporting.

Details: `.planning/milestones/v1.0-ROADMAP.md` (not archived — built before GSD structure)

---

## v2.0 — Contractor UX Overhaul + Compliance

**Shipped:** 2026-03-20
**Phases:** 6–9 (4 phases, 16 plans)
**Files:** 70 changed (+10,936 / -162 lines)
**Tests:** 181 passing

### Delivered

Complete contractor compliance workflow: every WH-347 conforms to the January 2025 DOL revision, compliance violations (under-wage, CWHSSA OT) are flagged before submission, and the dashboard surfaces project health at a glance. Contractors can access fringe and pay history reports, download WH-347 from any payroll week, and see inline warnings before generating legally invalid forms.

### Key Accomplishments

1. **January 2025 WH-347**: Multi-page support (workers chunked 8/page), Page X of Y notation, `certApprentices` boolean derived from real `programName` data — no more hardcoded `true`
2. **Compliance engine**: `computeCompliance()` detects under-wage and CWHSSA OT violations from stored rate snapshots; drives `certProperPayment`/`certAccuratePayroll` on Statement of Compliance
3. **Payroll Week Detail**: Per-week view with inline compliance violation badges, worker/violation table, and one-click WH-347 download anchor
4. **Dashboard compliance badges**: Each project card shows green/red/gray compliance status badge + week count, via per-card TanStack Query fetch
5. **Full UX completion**: No dead ends — nav links to all 4 sections, WH-347 button per payroll week row, amber missing-data warnings on worker cards
6. **Reports**: Fringe benefit summary and worker pay history — tabbed UI with worker selector, rate snapshots frozen at entry time

### Archive

- Roadmap: `.planning/milestones/v2.0-ROADMAP.md`
- Requirements: `.planning/milestones/v2.0-REQUIREMENTS.md`
