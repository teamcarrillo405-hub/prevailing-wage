---
phase: 160-onboarding-ux
plan: "01"
subsystem: client-ui
tags: [onboarding, dashboard, ux, urgency]
dependency_graph:
  requires: []
  provides: [ONBOARD-UX-01, DUE-UX-01]
  affects: [DashboardPage, OnboardingChecklist, DueSoonPanel]
tech_stack:
  added: []
  patterns: [collapsible-details, urgency-tier-coloring]
key_files:
  created: []
  modified:
    - src/client/components/ui/OnboardingChecklist.tsx
    - src/client/components/dashboard/DueSoonPanel.tsx
decisions:
  - Steps 1-5 are required (create project, add workers, wage determination, enter payroll, download WH-347); steps 6-7 are optional
  - Progress bar counts only required steps, matching CPR workflow completion
  - Urgency tiers derived from daysUntil field already present on DueSoonItem — no API changes needed
  - DueSoonPanel already had status/daysUntil — enhanced labels and row background colors for the three urgency tiers
metrics:
  duration: 8m
  completed_date: "2026-05-18"
  tasks_completed: 4
  files_changed: 2
---

# Phase 160 Plan 01: OnboardingChecklist Required-Only + DueSoonPanel Urgency Colors Summary

## One-liner

Required/optional split in OnboardingChecklist with collapsible optional section; DueSoonPanel gets three-tier urgency row backgrounds and human-readable relative time labels.

## What Was Built

### Task 1 (read): Analyzed both components before making changes.

### Task 2 — OnboardingChecklist required/optional split (commit: d8ba445)

Added `required: boolean` field to the `Step` interface. Steps 1–5 (create project, add workers, wage determination, enter first payroll week, download WH-347) are marked `required: true` — these directly map to the CPR workflow. Steps 6–7 (invite team member, connect QuickBooks) are `required: false`.

Progress bar and count now compute from `requiredItems` only:
```typescript
const requiredItems = steps.filter(s => s.required);
const completedRequired = requiredItems.filter(s => s.complete).length;
const progressPct = requiredItems.length > 0 ? Math.round(completedRequired / requiredItems.length * 100) : 0;
```

Optional steps render in a `<details>` collapsible section below the required list, showing `Optional setup (N/M)` in the summary line. The optional badge label on individual steps now reads from `!step.required` rather than the old `step.optional` field (which was only set on the QuickBooks step).

### Task 3 — DueSoonPanel urgency colors (commit: f200bec)

Replaced the simple `daysLabel()` function with two purpose-built helpers:

- `getUrgency(daysUntil)` → `'error' | 'warning' | 'muted'` (<=1d / <=3d / >3d)
- `getRelativeLabel(daysUntil)` → `'Overdue' | 'Due today' | 'Due tomorrow' | 'Due in N days' | 'Nd overdue'`

Row background now uses urgency-tiered classes:
- `error`: `bg-red-500/10 border-red-500/20`
- `warning`: `bg-amber-500/10 border-amber-500/20`
- `muted`: `bg-surface-card border-gray-100`

Label text colors follow the same pattern (`text-red-400` / `text-amber-400` / `text-surface-muted`).

The existing section-level grouping (Overdue / Due This Week headers) is preserved unchanged.

### Task 4 — TypeScript check

`npx tsc --noEmit` showed zero errors in either modified file. Pre-existing errors in `CopilotWidget.tsx` are out of scope.

## Deviations from Plan

None — plan executed exactly as written. The DueSoonPanel already had `daysUntil` on the item interface, so no date derivation from `weekEndingDate` was necessary.

## Known Stubs

None. Both components render live data from existing API/props.

## Self-Check: PASSED

- FOUND: src/client/components/ui/OnboardingChecklist.tsx
- FOUND: src/client/components/dashboard/DueSoonPanel.tsx
- FOUND: .planning/phases/160-onboarding-ux/160-01-SUMMARY.md
- FOUND commit: d8ba445 (OnboardingChecklist required/optional split)
- FOUND commit: f200bec (DueSoonPanel urgency colors)
