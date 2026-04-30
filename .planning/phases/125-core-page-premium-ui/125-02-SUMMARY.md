---
phase: 125-core-page-premium-ui
plan: 02
subsystem: client-ui
tags: [premium-ui, framer-motion, design-tokens, route-transitions]
dependency_graph:
  requires: []
  provides: [premium-payroll-detail-ui, premium-workers-ui, premium-reports-ui, route-transitions]
  affects: [PayrollWeekDetailPage, WorkersPage, ReportsPage, App]
tech_stack:
  added: [framer-motion]
  patterns: [AnimatePresence, React.Fragment table rows, design-token classes]
key_files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/ReportsPage.tsx
    - src/client/App.tsx
    - package.json
decisions:
  - React.Fragment wrapper for desktop table rows to support violation callout sibling rows
  - Download buttons already in MOB-13 sticky bar — no restructuring needed
  - AnimatePresence close tag counts as a grep match (3 not 2) — correct implementation
metrics:
  duration: ~15min
  completed: 2026-04-29
  tasks_completed: 2
  files_modified: 5
---

# Phase 125 Plan 02: Core Page Premium UI (PayrollWeekDetail + Workers + Reports + Route Transitions) Summary

One-liner: Premium row tints + amber/crimson violation callouts on payroll detail, avatar-card workers page, design-token report cards, and 100ms framer-motion AnimatePresence route transitions.

## Tasks Completed

### Task 1: PayrollWeekDetailPage + WorkersPage premium treatment (UI-03, UI-04)

**PayrollWeekDetailPage.tsx (UI-03):**
- Added `React` import (needed for `React.Fragment`)
- Added `cn` import from `../lib/utils`
- Mobile card list rows: alternating `bg-white` / `bg-surface-muted` tint via `cn()` + index
- Desktop table rows: alternating tint with `cn('hover:bg-gray-50', index % 2 === 0 ? 'bg-white' : 'bg-surface-muted')`
- Wrapped desktop `entries.map` return in `React.Fragment` to allow sibling violation callout rows
- CWHSSA OT violations: `bg-amber-50 border-amber-200 text-amber-800` callout row in both mobile and desktop views
- Under-wage violations: `bg-red-50 border-red-200 text-red-700` callout row in both mobile and desktop views
- Download buttons were already grouped in the MOB-13 sticky bar — no restructuring needed

**WorkersPage.tsx (UI-04):**
- Added `cn` import from `../lib/utils`
- Worker Card upgraded: `shadow-card-elevated hover:shadow-card-hover transition-shadow duration-150`
- Filter chips: `rounded-full` pill style with `bg-surface-muted text-text-secondary hover:bg-gray-200` / `bg-brand-navy text-white` active
- Empty state: updated to exact spec — `WorkersEmptyIllustration`, "No workers on this project yet", "Add your first worker...", `<Button>Add Your First Worker</Button>`

### Task 2: ReportsPage premium cards + framer-motion route transitions (UI-05, UI-06)

**ReportsPage.tsx (UI-05):**
- Added `cn` import from `../lib/utils`
- `ReportCard` component fully upgraded to design tokens:
  - `rounded-card border p-5 transition-all duration-150`
  - Active: `border-brand-gold bg-brand-gold/5 shadow-card-elevated`
  - Inactive: `border-border-default bg-surface-card shadow-card hover:shadow-card-elevated hover:-translate-y-0.5`
  - Icon container: `w-10 h-10 rounded-lg bg-surface-muted border border-border-subtle`
  - Title: `font-headline text-sm text-text-primary`
  - Description: `text-xs text-text-secondary leading-relaxed`

**App.tsx (UI-06):**
- Added `useLocation` import from `react-router-dom`
- Added `motion, AnimatePresence` import from `framer-motion`
- Created `PAGE_TRANSITION` const with 100ms ease-out fade-slide (opacity + y)
- Created `AnimatedRoutes` component using `useLocation` key for route change detection
- Wrapped `<Routes>` in `<AnimatedRoutes>` inside existing `<Suspense>`

## Deviations from Plan

### Auto-resolved

**1. [Rule 1 - Bug] Sticky download bar already existed**
- Found during: Task 1 PayrollWeekDetailPage
- Issue: Plan said "group into sticky action bar if scattered" — MOB-13 sticky bar already existed
- Fix: Applied `shadow-sm` was already on the bar; no restructuring needed
- Files modified: none (deviation resolved by pre-existing code)

**2. [Rule 1] AnimatePresence grep count is 3 not 2**
- Found during: Task 2 verification
- Issue: Plan acceptance criteria said `grep -c "AnimatePresence" returns 2` but correct JSX has import + open tag + close tag = 3
- Fix: Implementation is correct; criterion was approximating
- Commit: 5480f18

None — plan executed with minor observation about pre-existing download bar structure.

## Known Stubs

None. All plan goals achieved with live data wired.

## Self-Check: PASSED

Files verified:
- src/client/pages/PayrollWeekDetailPage.tsx — FOUND
- src/client/pages/WorkersPage.tsx — FOUND
- src/client/pages/ReportsPage.tsx — FOUND
- src/client/App.tsx — FOUND

Commits verified:
- dc97ad3 — feat(125-02): premium treatment for PayrollWeekDetailPage and WorkersPage
- 5480f18 — feat(125-02): ReportsPage premium cards + framer-motion route transitions

TypeScript: 0 errors (npx tsc --noEmit exits 0)
