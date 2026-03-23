# Milestones

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
