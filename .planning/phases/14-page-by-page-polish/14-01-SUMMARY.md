---
phase: 14-page-by-page-polish
plan: "01"
subsystem: frontend-ui
tags: [ui-primitives, design-tokens, dashboard, login, project-card]
dependency_graph:
  requires: []
  provides: [EmptyState on DashboardPage, token-clean LoginPage, Badge on ProjectCard]
  affects: [src/client/pages/DashboardPage.tsx, src/client/pages/LoginPage.tsx, src/client/components/projects/ProjectCard.tsx]
tech_stack:
  added: []
  patterns: [EmptyState primitive adoption, design-token replacement, Badge for status indicators]
key_files:
  created: []
  modified:
    - src/client/pages/DashboardPage.tsx
    - src/client/pages/LoginPage.tsx
    - src/client/components/projects/ProjectCard.tsx
decisions:
  - LoginPage is now login-only — RegisterForm removed, Link to /register replaces mode toggle
  - Badge variant mapping: violations->violation, clean->compliant, no payroll->neutral
metrics:
  duration: "~5 minutes"
  completed: "2026-03-22T18:52:00Z"
  tasks: 3
  files_modified: 3
---

# Phase 14 Plan 01: Page-by-Page Polish (Wave 1) Summary

**One-liner:** Adopted EmptyState, design tokens, and Badge primitive across DashboardPage, LoginPage, and ProjectCard — eliminating all hardcoded `#F5C518` and raw inline status spans.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DashboardPage — adopt EmptyState for zero-projects state | 8326394 | src/client/pages/DashboardPage.tsx |
| 2 | LoginPage — token cleanup and login-only simplification | c0c9673 | src/client/pages/LoginPage.tsx |
| 3 | ProjectCard — Badge for compliance status and funding type | 2152040 | src/client/components/projects/ProjectCard.tsx |

## What Was Built

**DashboardPage:** The zero-projects branch previously rendered a raw `div className="text-center py-16 text-gray-500"` with inline text. Now uses `<EmptyState heading="No projects yet" message="..." action={<Button>New Project</Button>} />` — consistent with the EmptyState primitive contract.

**LoginPage:** Previously had `useState` for mode switching, a `RegisterForm` import, hardcoded `bg-gray-50`, `border-[#F5C518]`, and a conditional toggle button. The rewrite is 31 lines (down from 46), login-only, uses `bg-surface-page` and `border-brand-gold` design tokens, and links to `/register` via React Router `<Link>`.

**ProjectCard:** The funding type badge was a raw `span` with `bg-[#F5C518]`. The three compliance status spans each had inline Tailwind color classes. All four replaced with `<Badge>` using `variant="neutral"` (funding type), `variant="violation"` (violations), `variant="compliant"` (clean), `variant="neutral"` (no payroll).

## Verification

All plan checks passed:
- `grep border-[#F5C518] LoginPage.tsx` — no output
- `grep bg-gray-50 LoginPage.tsx` — no output
- `grep RegisterForm LoginPage.tsx` — no output
- `grep EmptyState DashboardPage.tsx` — 2 matches (import + usage)
- `grep text-center.py-16 DashboardPage.tsx` — no output
- `grep -c Badge ProjectCard.tsx` — 6 matches
- `grep bg-[#F5C518] ProjectCard.tsx` — no output
- 181/181 tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/client/pages/DashboardPage.tsx — modified
- src/client/pages/LoginPage.tsx — rewritten
- src/client/components/projects/ProjectCard.tsx — modified
- Commits 8326394, c0c9673, 2152040 exist in git log
- 181/181 tests green
