---
phase: 26-contractor-guidance-system
plan: "01"
subsystem: client-ui
tags: [ui-primitives, help-callout, term-tooltip, landing-page, contractor-guidance]
dependency_graph:
  requires: []
  provides: [HelpCallout, TermTooltip, landing-4-step-flow]
  affects: [DashboardPage, ProjectDetailPage, WorkersPage, PayrollEntryPage, PayrollWeekDetailPage, PayrollListPage, LandingPage]
tech_stack:
  added: []
  patterns: [lucide-react icon prop pattern, design-token-only styling, focus:outline-hidden]
key_files:
  created:
    - src/client/components/ui/HelpCallout.tsx
    - src/client/components/ui/TermTooltip.tsx
  modified:
    - src/client/pages/LandingPage.tsx
    - src/client/pages/DashboardPage.tsx
    - src/client/pages/ProjectDetailPage.tsx
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollEntryPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/client/pages/PayrollListPage.tsx
    - src/server/routes/workers.ts
decisions:
  - HelpCallout is always-visible static card (no dismiss) per D-06 — reduces cognitive load vs. dismissible patterns
  - TermTooltip uses dual desktop/iPad activation (onMouseEnter + onClick) per D-03 — covers both input modalities
  - PayrollListPage HelpCallout uses "Your Payroll Weeks" copy (not "Review Before You Submit") — contextually appropriate for a list view vs. detail view
  - Workers.ts implicit-any TS errors auto-fixed with inline type aliases — unblocked build which was failing pre-plan
metrics:
  duration_minutes: 13
  completed_date: "2026-03-26"
  tasks_completed: 3
  files_changed: 9
---

# Phase 26 Plan 01: Contractor Guidance Primitives Summary

HelpCallout gold-border info card and TermTooltip hover/tap tooltip created; 4-step landing page flow rewritten; contextual HelpCallout added below PageHeader on all 5 major app pages plus PayrollListPage migration from raw h1.

## What Was Built

### Task 1: HelpCallout and TermTooltip Primitives (commit: 2b1eb9f)

Two new reusable UI components:

**HelpCallout** — Static always-visible info card with gold left border, icon, title, and body. Uses only @theme design tokens (no hardcoded hex). Accepts a LucideIcon component as the `icon` prop.

**TermTooltip** — Inline `?` icon with hover (desktop) + tap (iPad) activation, Escape key close, and click-outside close via `document.addEventListener('mousedown')`. Uses `focus:outline-hidden` (TailwindCSS v4) and `aria-label` for accessibility.

### Task 2: LandingPage HowItWorksSection 4-step Rewrite (commit: 7c756e3)

- Added `Users` to lucide-react import line
- Rewrote steps array to 4 contractor-friendly items per UI-SPEC copy
- Updated subheading to "Four steps from contract award to certified payroll submission"
- Changed grid from `md:grid-cols-3` to `md:grid-cols-2 lg:grid-cols-4`
- Moved HowItWorksSection directly after HeroSection (before ProblemSection) per D-11

### Task 3: HelpCallout on All Pages + PayrollListPage Migration (commit: 38712bd)

Six pages updated with contextual HelpCallout below their PageHeader:

| Page | Icon | Title |
|------|------|-------|
| DashboardPage | LayoutDashboard | Your Active Projects |
| ProjectDetailPage | Workflow | Your Project Workflow |
| WorkersPage | Users | Register Your Workers |
| PayrollEntryPage | ClipboardList | Enter This Week's Hours |
| PayrollWeekDetailPage | FileCheck | Review Before You Submit |
| PayrollListPage | FileCheck | Your Payroll Weeks |

PayrollListPage also migrated from raw `<h1 className="text-2xl font-headline text-gray-900">` to the `PageHeader` primitive. The "+ New Week" button moved into the PageHeader `action` prop using brand-gold button classes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript implicit-any errors in workers.ts (lines 108/115)**
- **Found during:** Task 1 build verification
- **Issue:** `workers.ts` had `Parameter 'w' implicitly has an 'any' type` and `Parameter 'c' implicitly has an 'any' type` — this caused `npm run build` to fail before this plan began
- **Fix:** Added inline type aliases `type WorkerRow = (typeof workerRows)[number]` and `type ClassificationRow = (typeof classifications)[number]` to the `.map()` callbacks
- **Files modified:** `src/server/routes/workers.ts`
- **Commit:** 2b1eb9f (bundled with Task 1)

## Known Stubs

None. All HelpCallout content is hardcoded copy from the UI-SPEC Copywriting Contract — no dynamic data sources required or stubbed.

## Self-Check

Verified:
- [ ] `src/client/components/ui/HelpCallout.tsx` — exists ✓
- [ ] `src/client/components/ui/TermTooltip.tsx` — exists ✓
- [ ] `src/client/pages/LandingPage.tsx` — contains "Add Your Workers" ✓
- [ ] `src/client/pages/DashboardPage.tsx` — contains HelpCallout import ✓
- [ ] `src/client/pages/PayrollListPage.tsx` — contains PageHeader, no raw h1 ✓
- [ ] Build: `npm run build` exits 0 ✓
- [ ] Commits: 2b1eb9f, 7c756e3, 38712bd ✓
