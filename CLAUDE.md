# HCC Prevailing Wage — Project Instructions

## Session Summary (2026-03-23)

This session completed the v2.2 milestone and initialized v2.3 through Phase 17 planning.

---

## What Was Built This Session

### v2.2 Milestone Completion

**Phase 15 — Compliance Engine Hardening + Independent Frontend** (completed prior session, verified this session)
- `complianceService.ts`: New `WeekViolation` interface + `weekViolations[]` array in `computeCompliance()` — per-week apprentice ratio enforcement (COMP-03). Fires only when `journeyworkerHours > 0` (pure-apprentice crew is valid).
- `ProjectDetailPage.tsx`: Inline `WorkflowProgress` component — 4-step indicator (Create Project → Add Workers → Enter Payroll → Download WH-347) driven by live TanStack Query data.
- `ReportsPage.tsx`: Comprehensive `@media print` block — `thead { display: table-header-group }`, `overflow: visible !important` on `.overflow-x-auto`, `tfoot { display: table-footer-group }`, `@page { margin: 0.5in }`. Added `<tfoot>` totals row on fringe summary via `reduce()`. `print-hidden` CSS class on tab container, back-link, and worker selector.

**Phase 16 — WH-347 Submission UX** (completed this session)
- `PayrollWeekDetailPage.tsx`: Replaced plain `<a href>` anchor with fetch-driven download. Added `showPreflight`/`generating` useState + `generatingRef` useRef (synchronous double-click guard). Preflight modal lists both `violations[]` and `weekViolations[]` with Badge per type. Cancel/backdrop/Escape dismiss. `handleConfirmedDownload` uses `fetch()` → Blob → `URL.createObjectURL()` → click → `setTimeout(URL.revokeObjectURL, 100)`.

**v2.2 Milestone Archive**
- Archived to `.planning/milestones/v2.2-ROADMAP.md` and `v2.2-REQUIREMENTS.md`
- `REQUIREMENTS.md` deleted (fresh for v2.3)
- `ROADMAP.md` v2.2 section collapsed to `<details>` tag
- `PROJECT.md` updated: Current State → v2.2, 5 Active requirements moved to Validated
- Git tag `v2.2` created

---

### v2.3 Milestone — Contractor Workflow Efficiency + Audit Readiness

**Requirements (15 total across 6 categories):**
- `PAY-01/02` — Copy previous payroll week (live rate re-fetch, skipped-entries warning)
- `SUB-01/02/03` — WH-347 submission tracking (date + agency, server-side edit lock, un-submit)
- `AMD-01/02/03` — Payroll amendment workflow (new row, "N (AMENDED M)" PDF label, pre-filled)
- `PRJ-01/02/03` — Project archive (close/restore, show-archived toggle, compliance advisory)
- `DASH-03/04` — Dashboard search by name + filter by funding type
- `AUD-01/02` — Per-worker compliance history page across all projects

**Roadmap: Phases 17–22**
- Phase 17: DB Migration + Project Archive (PRJ-01/02/03)
- Phase 18: Dashboard Search + Filter (DASH-03/04)
- Phase 19: WH-347 Submission Tracking (SUB-01/02/03)
- Phase 20: Copy Previous Payroll Week (PAY-01/02)
- Phase 21: Payroll Amendment Workflow (AMD-01/02/03)
- Phase 22: Per-Worker Compliance History (AUD-01/02)

**Phase 17 — Planned (not yet executed)**
- Plan 17-01 (Wave 1): `payrollWeeks` migration (4 columns: `submitted_at`, `submitted_to`, `amendment_number`, `original_week_id`) + `GET /api/projects?status=` filter + tests
- Plan 17-02 (Wave 2): Archive/Restore buttons on ProjectDetailPage, compliance advisory modal, Archived badge on ProjectCard, Show Archived toggle on DashboardPage

---

## Critical Implementation Rules

### Compliance / Audit Trail (Federal Requirements)
- **NEVER hard-delete projects or payroll weeks** — 29 CFR Part 3 requires 3-year records retention. Archive is status-only (`status = 'closed'`). No DELETE endpoint for projects.
- **Amendments must create new `payrollWeeks` rows** — never update entries in place. In-place update = federal form falsification under 29 CFR Part 3.
- **Copy week must re-fetch live wage rates** — never clone `baseRateSnapshot`/`fringeRateSnapshot`. Stale snapshots produce invalid certified payroll.
- **Server-side edit lock on submitted weeks is non-negotiable** — UI disable alone is not a security boundary.

### DB Migration Pattern
- Migrations are plain SQL `ALTER TABLE ... ADD COLUMN` files in `src/server/db/migrations/`
- **Always register in `meta/_journal.json`** — Drizzle silently skips files not in the journal. Next idx is 5 (current highest: idx 4, tag `0008_program_name`).
- Verify post-migration: `SELECT sql FROM sqlite_master WHERE name = 'payroll_weeks'`
- Never drop or rename columns — add-only migrations only.

### Design Tokens (TailwindCSS v4 @theme)
- All brand values via `@theme` tokens in `src/client/index.css` — never hardcode `#F5C518` or `#1a1a1a` in JSX
- Key tokens: `bg-nav-dark` (#1a1a1a), `border-brand-gold` / `text-brand-gold` / `bg-brand-gold` (#F5C518), `bg-surface-card`, `bg-surface-page`
- Typography: `font-headline` (Oswald) for h1–h4, `font-body` (Inter) for body

### UI Primitives (all in `src/client/components/ui/`)
- `Card` — `padding="default"|"sm"|"none"` — use `padding="none"` for table wrappers
- `Button` — no `asChild` prop; copy secondary classes directly to `<a>` for download links
- `Badge` — variants: `compliant`, `violation`, `warning`, `neutral`
- `PageHeader` — `title` / `subtitle` / `action` props; `mb-6` spacing
- `EmptyState` — `heading` / `message` / `action` props

### React Patterns
- `useRef` for synchronous guards (double-click prevention) — `useState` is async/batched
- TanStack Query: include all variable state in query key array (e.g., `['projects', showArchived ? 'all' : 'active']`)
- Blob URL downloads: `fetch()` → `.blob()` → `URL.createObjectURL()` → click → `setTimeout(URL.revokeObjectURL, 100)`
- WildcardRedirect and PublicRoute are inline in `App.tsx` — single-use components do not warrant separate files

### Print CSS Pattern
- `overflow: visible !important` on `.overflow-x-auto` is **required** for `thead { display: table-header-group }` to work in print
- Use `print-hidden` CSS class (not Tailwind `print:hidden`) for consistency with inline style approach

### Pre-existing Known Issues
- `src/server/services/workers.ts` lines 108/115: implicit any — non-fatal, do not fix
- Migration files 0005, 0006, 0007 exist but are not in `_journal.json` — known gap, non-fatal for existing functionality

---

## Project State

**Current milestone:** v2.3 — Contractor Workflow Efficiency + Audit Readiness
**Next action:** `/gsd:execute-phase 17` (Phase 17 plans ready)
**Tests:** 188 passing
**Stack:** Node.js + Express + TypeScript / React + Vite + TailwindCSS v4 / SQLite + Drizzle ORM / pdf-lib
**Server port:** 4099

## GSD Workflow
- Plans: `.planning/phases/NN-slug/NN-PP-PLAN.md`
- Research: `.planning/phases/NN-slug/NN-RESEARCH.md`
- Execute: `/gsd:execute-phase NN`
- Verify: `/gsd:verify-work NN`
