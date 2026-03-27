---
phase: 27-design-elevation
plan: "01"
subsystem: frontend-ui
tags: [design-tokens, shadows, typography, primitives, page-headers]
dependency_graph:
  requires: []
  provides: [shadow-card-elevated token, ProjectCard className prop, PageHeader tracking-tight, print CSS override]
  affects: [DashboardPage, HelpCallout, GsaRateBuilderPage, AdminStateWagePage, OtScenarioPage, PayrollWeekDetailPage, VarianceReportPage, UnionAllocationPage, WageLookupPage]
tech_stack:
  added: []
  patterns: [cn() merge pattern for className injection, PageHeader action slot for in-header controls]
key_files:
  created: []
  modified:
    - src/client/index.css
    - src/client/components/ui/PageHeader.tsx
    - src/client/components/projects/ProjectCard.tsx
    - src/client/components/ui/HelpCallout.tsx
    - src/client/pages/DashboardPage.tsx
    - src/client/pages/GsaRateBuilderPage.tsx
    - src/client/pages/AdminStateWagePage.tsx
    - src/client/pages/OtScenarioPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/client/pages/VarianceReportPage.tsx
    - src/client/pages/UnionAllocationPage.tsx
    - src/client/pages/WageLookupPage.tsx
decisions:
  - "OtScenarioPage PageHeader uses className='mb-0' to suppress default mb-6 since it lives inside an existing flex row with back-button"
  - "PayrollWeekDetailPage uses PageHeader action slot for the amendment Badge, keeping subtitle for week-ending date"
  - "VarianceReportPage/UnionAllocationPage Export PDF links moved to PageHeader action slot; hardcoded text-[#F5C518] migrated to text-brand-gold as bonus CLAUDE.md compliance fix"
  - "hover:shadow-md removed from ProjectCard base classes per research pitfall #5 — elevated shadow baseline makes hover:shadow-md a regression"
metrics:
  duration: 6min
  completed_date: "2026-03-26"
  tasks: 2
  files_changed: 12
---

# Phase 27 Plan 01: Design Elevation Wave 1 Summary

**One-liner:** shadow-card-elevated token with print CSS override, tracking-tight on PageHeader h1, ProjectCard className prop using cn() merge pattern, elevated shadows on dashboard cards and HelpCallout, and all 7 raw h1 page titles migrated to PageHeader primitive.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add shadow-card-elevated token, print CSS, PageHeader tracking-tight, ProjectCard className prop | f8f4cbe | index.css, PageHeader.tsx, ProjectCard.tsx |
| 2 | Apply elevated shadow to dashboard ProjectCards, HelpCallout, and migrate 7 raw h1 pages to PageHeader | c629f9f | DashboardPage.tsx, HelpCallout.tsx, 7 page files |

## What Was Built

### Design Token (index.css)
- Added `--shadow-card-elevated: 0 8px 24px rgba(0,0,0,0.12)` inside the `@theme` block directly below `--shadow-card`
- Added `@media print` block targeting `.hero-bg` and `.dashboard-bg` — removes background images and hides absolute overlays in print

### Primitive Updates
- **PageHeader.tsx:** Added `tracking-tight` to h1 className — all page titles now render with tighter letter-spacing globally
- **ProjectCard.tsx:** Added `className?: string` prop, imported `cn()`, refactored button className from template literal to `cn()` call, removed `hover:shadow-md` (elevated baseline makes hover shadow a visual regression)
- **HelpCallout.tsx:** Changed `shadow-card` to `shadow-card-elevated` — help callouts now match dashboard card elevation depth (D-12)

### Dashboard
- **DashboardPage.tsx:** ProjectCard receives `className="shadow-card-elevated"` — dashboard project cards now display visibly deeper shadow than cards on other pages

### h1 Migration (7 pages)
All 7 remaining raw h1 page titles migrated to the PageHeader primitive:

| Page | Notes |
|------|-------|
| GsaRateBuilderPage.tsx | Straight replacement |
| AdminStateWagePage.tsx | Replaced h1, kept subtitle p tag below PageHeader |
| OtScenarioPage.tsx | Inside flex row with back button — `className="mb-0"` suppresses default margin |
| PayrollWeekDetailPage.tsx | PageHeader with title, subtitle (week-ending date), action (amendment Badge) |
| VarianceReportPage.tsx | Export PDF link moved to PageHeader action slot |
| UnionAllocationPage.tsx | Export PDF link moved to PageHeader action slot |
| WageLookupPage.tsx | Straight replacement, PageHeader provides mb-6 |

**Zero raw h1 page titles remain outside PageHeader** (excluding LoginPage/RegisterPage brand headings and LandingPage marketing headline per plan scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Migrated hardcoded #F5C518 to text-brand-gold in VarianceReportPage and UnionAllocationPage**
- **Found during:** Task 2, while reading VarianceReportPage and UnionAllocationPage for h1 migration
- **Issue:** Export PDF links in both pages used `text-[#F5C518]` — violates CLAUDE.md design token constraint ("All brand values via @theme tokens — never hardcode #F5C518")
- **Fix:** Changed to `text-brand-gold` in both files while performing the PageHeader migration
- **Files modified:** src/client/pages/VarianceReportPage.tsx, src/client/pages/UnionAllocationPage.tsx
- **Commit:** c629f9f (bundled with Task 2)

## Verification Results

1. `npm run build` — passes (TypeScript + Vite, 0 errors)
2. `npm test` — pre-existing failures only (RED stubs in a1131.test.ts, agent worktree isolation tests); no new failures introduced
3. `grep -n "shadow-card-elevated" src/client/index.css` — line 36: token defined in @theme
4. `grep -n "shadow-card-elevated" src/client/components/ui/HelpCallout.tsx` — line 16: updated shadow
5. `grep -n "shadow-card-elevated" src/client/pages/DashboardPage.tsx` — line 252: elevated cards
6. `grep -n "tracking-tight" src/client/components/ui/PageHeader.tsx` — line 15: typography update
7. `grep -rn "<h1" src/client/pages/ | grep -v Login | grep -v Register | grep -v Landing` — no output (all migrated)

## Known Stubs

None — all changes wire real design tokens and component props. No placeholder values introduced.

## Self-Check: PASSED
