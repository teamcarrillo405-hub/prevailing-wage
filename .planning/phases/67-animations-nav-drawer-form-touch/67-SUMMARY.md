---
phase: 67
plan: 1
subsystem: client-ui
tags: [animations, mobile, nav-drawer, form-ux, workers-page, reports-page, phase-a-complete]
dependency-graph:
  requires: [66]
  provides: [UI-04, UI-05, UI-06, UI-08, UI-09]
  affects: [Layout, WorkersPage, ReportsPage, ProjectForm, PayrollWeekDetailPage]
tech-stack:
  added: []
  patterns: [css-keyframe-transitions, mobile-drawer, touch-44px-targets, ios-zoom-prevention]
key-files:
  created: []
  modified:
    - src/client/index.css
    - src/client/components/shared/Layout.tsx
    - src/client/components/projects/ProjectForm.tsx
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/client/pages/ReportsPage.tsx
decisions:
  - Used pure CSS page transitions (no framer-motion dependency) for minimal bundle impact
  - brand-navy token added as alias to nav-dark (#1d1d1f) to support avatar and chip colors
  - Worker filter chips drive client-side filtering of allWorkers array; nudge bar uses allWorkers count
  - ReportsPage tabs replaced with card selectors while preserving all data table logic intact
metrics:
  duration: 35m
  completed: 2026-04-25
  tasks: 5
  files-changed: 6
---

# Phase 67: Animations, Nav Drawer, Form Touch, Workers + Reports Premium

**One-liner:** CSS route transitions, mobile hamburger drawer, iOS 16px form audit, worker avatar/badge cards with filter chips, and ReportsPage card selector UI.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| A | CSS page-enter route transition | `071c079` | index.css |
| B | Mobile navigation drawer | `0841b6a` | Layout.tsx |
| C | iOS form font-size audit (text-base) | `6888e62` | ProjectForm, WorkersPage, PayrollWeekDetailPage |
| D | WorkersPage premium card treatment | `6888e62` | WorkersPage.tsx |
| E | ReportsPage premium treatment | `0d9aada` | ReportsPage.tsx |

## Changes by Task

### Task A — Route Transitions (UI-04)

Added `@keyframes pageEnter` to `index.css`:
- `opacity: 0 → 1`, `translateY: 8px → 0`, duration `0.1s ease-out`
- `.page-enter` utility class applied to `<main>` in Layout
- `prefers-reduced-motion` guard disables animation for accessibility
- Added `--color-brand-navy: #1d1d1f` design token (alias for nav-dark)

### Task B — Mobile Navigation Drawer (UI-08)

Updated `Layout.tsx`:
- Hamburger button (Menu icon, `sm:hidden`, min 44px touch target) in top-right on mobile
- Full-height drawer (w-64) slides in from left, z-50
- Semi-transparent black backdrop (z-40) closes drawer on click
- All nav links as NavLink with active state (bg-brand-gold text-nav-dark)
- Close drawer automatically on any link click
- Desktop nav wrapped with `hidden sm:flex` — unchanged on larger screens
- Log out button in drawer footer

### Task C — iOS Form Font-Size Audit (UI-09)

Upgraded all `<input>`, `<select>` elements from `text-sm` (14px) to `text-base` (16px) across three files:
- **ProjectForm.tsx**: 12 inputs + 2 selects upgraded
- **WorkersPage.tsx**: ~20 inputs + selects upgraded (add form + edit form + extra classification form)
- **PayrollWeekDetailPage.tsx**: ~10 inputs + selects upgraded

16px minimum prevents iOS Safari from auto-zooming on form focus. Applies to all form pages users interact with during payroll entry.

### Task D — WorkersPage Premium (UI-05)

- **Avatar circle**: `w-10 h-10 rounded-full bg-brand-navy` with 2-letter initials derived from worker name
- **Labor type badges**: JW (blue), APP (amber), FM (green) — rendered per classification
- **Union local chip**: gray badge showing "Local {N}" when unionLocal is present
- **Filter chips**: "All / Journeyman / Apprentice" — filters worker list client-side by laborType on classifications
- **Empty filter state**: soft message when filter yields no results
- **Nudge bar counter**: uses `allWorkers.length` (unfiltered) to avoid confusing count when filtered

### Task E — ReportsPage Premium (UI-06)

- **Report selector cards**: three `ReportCard` components (FileText, TrendingUp, PieChart icons) replace old tab bar
- Each card: `rounded-xl border p-5 shadow-sm hover:shadow-md transition-all` — active gets gold border + gold/5 bg
- **Panel headers**: icon + title + subtitle line inside each active report panel
- **Print button**: top-right, 44px touch target, spinner during `isPrinting` state (200ms delay before `window.print()`)
- All three data reports (Fringe Summary, Pay History, Fringe Breakdown) preserved exactly — display layer only changed

## Deviations from Plan

**1. [Rule 3 - Dependency] Added --color-brand-navy token**
- Found during: Task D
- Issue: `bg-brand-navy` used in avatar and filter chip but token not in index.css — would render as unstyled
- Fix: Added `--color-brand-navy: #1d1d1f` to @theme block (alias of nav-dark)
- Files: index.css
- Commit: 071c079

**2. [Design Choice] Used CSS transitions instead of framer-motion**
- framer-motion not installed; plan offered CSS fallback as alternative
- Pure CSS approach avoids adding ~100KB dependency for a 0.1s fade
- Identical visual result with zero bundle impact

## Known Stubs

None — all implemented features connect to live data.

## Self-Check

Files verified:
- `src/client/index.css` — FOUND, contains pageEnter keyframe and brand-navy token
- `src/client/components/shared/Layout.tsx` — FOUND, contains drawerOpen state and mobile drawer markup
- `src/client/pages/WorkersPage.tsx` — FOUND, contains workerInitials(), FILTER_CHIPS, avatar markup
- `src/client/pages/ReportsPage.tsx` — FOUND, contains ReportCard component and card selector grid
- `src/client/components/projects/ProjectForm.tsx` — FOUND, text-base on all inputs
- `src/client/pages/PayrollWeekDetailPage.tsx` — FOUND, text-base on form inputs

Commits verified:
- `071c079` — feat(67-A): CSS route transitions
- `0841b6a` — feat(67-B): mobile drawer
- `6888e62` — feat(67-C/D): form font-size + WorkersPage
- `0d9aada` — feat(67-E): ReportsPage

Tests: 711 passed | 42 todo (62 files)
TypeScript: 0 errors

## Self-Check: PASSED
