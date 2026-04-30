---
phase: 125-core-page-premium-ui
plan: 01
subsystem: frontend-ui
tags: [premium-ui, card-treatment, badges, empty-states, design-tokens]
dependency_graph:
  requires: []
  provides: [premium-section-cards, status-badges, contextual-empty-states]
  affects: [ProjectDetailPage, PayrollListPage]
tech_stack:
  added: []
  patterns: [Card+shadow-card-elevated, Badge variant mapping, getWeekBadge fn, font-headline section headings]
key_files:
  modified:
    - src/client/pages/ProjectDetailPage.tsx
    - src/client/pages/PayrollListPage.tsx
decisions:
  - Removed duplicate Subcontractors heading from SubcontractorsPanel component since outer Card wrapper now provides the h2 heading
  - Moved New Week button from PageHeader action into Card header row to colocate with payroll list
  - Preserved WH-347 download anchor in each week row (stopPropagation prevents Link navigation on click)
  - PayrollEmptyIllustration grep-c returns 2 (1 import + 1 usage) — plan acceptance criterion satisfied
metrics:
  duration: 12m
  completed: 2026-04-29
  tasks_completed: 2
  files_modified: 2
---

# Phase 125 Plan 01: Core Page Premium UI Summary

One-liner: Card-elevated section panels with font-headline headings, Badge status variants, and contextual empty states applied to ProjectDetailPage and PayrollListPage for demo-ready polish.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ProjectDetailPage premium card treatment | e71a70c | src/client/pages/ProjectDetailPage.tsx |
| 2 | PayrollListPage premium card treatment + badges | 86ebe8d | src/client/pages/PayrollListPage.tsx |

## What Was Built

### Task 1: ProjectDetailPage (UI-01)

- Project metadata card: added `font-headline` section heading "Project Details" with `border-border-subtle` divider
- Project status field: upgraded from raw `capitalize` text to `<Badge variant={...}>` with correct mapping (active=compliant, archived=neutral, other=warning)
- Notification preferences panel: upgraded `h3` to `h2` with `font-headline` + `border-border-subtle` divider
- Subcontractors section: wrapped in `<Card className="mt-8 shadow-card-elevated">` with "Subcontractors" heading; removed duplicate `<h2>` from `SubcontractorsPanel` component
- Wage Determinations section: wrapped in `<Card className="mt-8 shadow-card-elevated">` with "Wage Determinations" heading
- ApprenticeshipSection: wrapped in `<Card padding="none" className="mt-8 shadow-card-elevated overflow-hidden">`

### Task 2: PayrollListPage (UI-02)

- Added `React` import (needed for `React.ReactNode` return type)
- Added `ChevronRight` to lucide-react imports
- Added `getWeekBadge()` function with 4 variants: `neutral` (Submitted), `compliant` (Final), `warning` (In Progress), `neutral` (Draft)
- Outer list wrapper: `<Card padding="none" className="shadow-card-elevated overflow-hidden">` with header row containing "Payroll Weeks" h2 + New Week button
- Each week row: `<Card padding="sm" className="shadow-card-elevated hover:shadow-card-hover cursor-pointer transition-shadow duration-150">` wrapping a `<Link>`
- Row layout: `font-headline text-sm text-text-primary` title, `text-xs text-text-secondary` subtitle, badge + WH-347 anchor + ChevronRight
- Empty state: updated to `Start First Payroll Week` CTA using `<Button>` component + navigate()
- Removed New Week button from PageHeader action (moved into card header)

## Acceptance Criteria Results

| Criterion | Result |
|-----------|--------|
| `grep -c "shadow-card-elevated" ProjectDetailPage.tsx` >= 4 | 5 |
| `grep -c "font-headline" ProjectDetailPage.tsx` >= 3 | 9 |
| `grep -c "border-border-subtle" ProjectDetailPage.tsx` >= 2 | 4 |
| `npx tsc --noEmit` exits 0 | PASS |
| `grep -c "shadow-card-elevated" PayrollListPage.tsx` >= 2 | 2 |
| `grep -c "getWeekBadge" PayrollListPage.tsx` = 2 | 2 |
| `grep -c "Badge variant" PayrollListPage.tsx` = 4 | 4 |
| `grep -c "PayrollEmptyIllustration" PayrollListPage.tsx` >= 1 | 2 (import + usage) |
| `grep -c "Start First Payroll Week" PayrollListPage.tsx` = 1 | 1 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate "Subcontractors" heading**
- **Found during:** Task 1
- **Issue:** SubcontractorsPanel had its own `<h2>Subcontractors</h2>` inside its return. After wrapping the panel in a Card with an outer heading, the inner heading would render twice.
- **Fix:** Removed the `<h2>` from SubcontractorsPanel and simplified the `<div ref={subsHeaderRef}>` wrapper to only contain the Add Subcontractor button.
- **Files modified:** src/client/pages/ProjectDetailPage.tsx

**2. [Rule 2 - Missing] Moved New Week button into card header**
- **Found during:** Task 2
- **Issue:** Plan called for New Week button inside the card header. The existing button was in the PageHeader action slot — keeping both would create duplication.
- **Fix:** Removed the New Week button from PageHeader and placed it exclusively in the Card header row. PageHeader now renders title only.
- **Files modified:** src/client/pages/PayrollListPage.tsx

## Known Stubs

None — all sections render live data from existing API queries.

## Self-Check: PASSED

- `src/client/pages/ProjectDetailPage.tsx` — confirmed modified
- `src/client/pages/PayrollListPage.tsx` — confirmed modified
- Commit e71a70c exists in git log
- Commit 86ebe8d exists in git log
- `npx tsc --noEmit` — 0 errors
