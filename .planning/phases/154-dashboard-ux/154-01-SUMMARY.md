---
phase: 154-dashboard-ux
plan: "01"
subsystem: frontend/dashboard
tags: [dashboard, ux, greeting, today-lane, stats-cards, search]
dependency_graph:
  requires: [unified /api/dashboard endpoint]
  provides: [compact greeting bar, Today action lane, 4-metric stats cards, enhanced project search]
  affects: [DashboardPage.tsx]
tech_stack:
  added: []
  patterns: [useMemo for todayItems derivation, useAuthContext for user greeting, time-of-day greeting helper]
key_files:
  modified:
    - src/client/pages/DashboardPage.tsx
decisions:
  - "Replaced large dark hero section with 48px greeting bar using companyName first word or email prefix"
  - "Today lane chips derived from contractorActions array (already in DashboardResponse) rather than a new field"
  - "Activity feed left as TODO comment — /api/dashboard does not return an activity array yet"
  - "navigate('/projects/new') reverted to setShowForm(true) since New Project is a modal not a route"
  - "Pre-existing TypeScript errors in CopilotWidget.tsx are out of scope and left unmodified"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-18"
  tasks_completed: 5
  files_modified: 1
---

# Phase 154 Plan 01: Dashboard Today Lane + Compact Hero + Activity Feed Summary

One-liner: Compact greeting bar with time-of-day salutation, horizontal Today action chip lane from contractorActions, and 4-metric stats row (Active Projects, Compliance Rate, Open Violations, Due This Week) replacing the large dark hero section.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Read and map DashboardPage structure | (analysis only) |
| 2 | Compact greeting bar + Today action lane | 05d4ecf |
| 3 | 4-metric stats cards + enhanced search (Search icon) | 05d4ecf |
| 4 | Activity feed (TODO comment — API not ready) | 05d4ecf |
| 5 | TypeScript + Vite build check — zero errors in DashboardPage | 05d4ecf |

## What Was Built

### Compact Greeting Bar
- Replaced the 200px dark gradient hero with a lean 48px horizontal bar
- `getGreeting()` returns "Good morning / afternoon / evening" based on `Date().getHours()`
- `getDisplayName()` extracts first word of `companyName` or email prefix from `useAuthContext`
- Date subtitle shows full weekday, month, day (e.g. "Monday, May 18")
- "+ New Project" button opens existing modal (calls `setShowForm(true)`)

### Today Action Lane
- Horizontal overflow-scroll row of rounded pill chips
- `todayItems` derived from `contractorActions` — `critical` priority or `violation`/`subcontractor_cpr` types render as red chips, others as amber
- Capped at 8 chips to keep the row from becoming unwieldy
- "All clear" green chip with `CheckCircle` icon when no actions exist
- "Summary PDF" download link floated right in the lane
- All existing today-section card (with 5 mini stat boxes) preserved below

### 4-Metric Stats Cards
- Grid of 4 cards above the sidebar+main layout: Active Projects, Compliance Rate, Open Violations, Due This Week
- Compliance Rate computed client-side: `Math.round((readyProjectCount / projects.length) * 100)%`
- Uses `bg-surface-card`, `border-border-default`, `font-headline` design tokens per CLAUDE.md
- Only renders when `!isLoading && projects.length > 0`

### Enhanced Project Search
- Existing URL-persisted search input now has a `Search` icon (lucide-react) overlaid at left
- Wrapped in `relative` div, icon absolutely positioned at vertical center
- Width widened from `sm:w-56` to `sm:w-64` to accommodate icon

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] navigate('/projects/new') replaced with setShowForm(true)**
- Found during: Task 2
- Issue: Plan referenced `navigate('/projects/new')` but the app has no such route — New Project is a modal opened via `setShowForm(true)`
- Fix: Used existing modal pattern instead of route navigation
- Files modified: DashboardPage.tsx
- Commit: 05d4ecf

**2. [Rule 3 - Scope] Activity feed skipped — no API data**
- Found during: Task 4
- Issue: `/api/dashboard` does not return an `activity` array; no audit event aggregation endpoint exists
- Fix: Added TODO comment at the location where the activity feed will be wired, as specified in the plan
- Files modified: DashboardPage.tsx
- Commit: 05d4ecf

**3. [Rule 3 - Scope] Pre-existing CopilotWidget TypeScript errors not fixed**
- Found during: Task 5
- Issue: 20+ TypeScript errors in `CopilotWidget.tsx` — all pre-existing, none caused by this plan
- Fix: Logged to deviations, skipped per out-of-scope boundary rule

### Out-of-scope Discoveries
- `CopilotWidget.tsx` has type errors around `ChatMessage` discriminated union — pre-existing, deferred

## Known Stubs

None — all UI elements derive from live data in `DashboardResponse`. Stats cards use real `activeProjectCount`, `totalViolations`, `dueSoonCount` from unified `/api/dashboard` endpoint.

## Self-Check: PASSED

- [x] `src/client/pages/DashboardPage.tsx` — modified and committed
- [x] Commit `05d4ecf` exists: `feat(154-01): compact greeting bar + Today action lane + 4-metric stats cards`
- [x] Vite build passes: `✓ built in 27ms`
- [x] TypeScript: zero errors in DashboardPage.tsx
