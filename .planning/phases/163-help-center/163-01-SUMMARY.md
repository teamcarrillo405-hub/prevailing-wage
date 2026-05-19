---
phase: 163-help-center
plan: "01"
subsystem: client-ui
tags: [help-center, glossary, ux, tooltips]
dependency_graph:
  requires: []
  provides: [HELP-01, HELP-02, HELP-03]
  affects: [Layout, TermTooltip]
tech_stack:
  added: []
  patterns: [slide-out-panel, FAB, glossary-lookup]
key_files:
  created:
    - src/client/lib/glossary.ts
    - src/client/components/help/HelpCenterPanel.tsx
  modified:
    - src/client/components/shared/Layout.tsx
    - src/client/components/ui/TermTooltip.tsx
decisions:
  - TermTooltip definition prop made optional — glossary auto-lookup is primary source, explicit prop is fallback
  - HelpCenterPanel backdrop div uses z-40 (below panel z-50) to close on outside click
metrics:
  duration: ~8m
  completed: 2026-05-18
  tasks: 4
  files_created: 2
  files_modified: 2
---

# Phase 163 Plan 01: Help Center Panel + Glossary + Contextual Tooltips Summary

## One-liner

Slide-out help center FAB (fixed bottom-right) with 16-term prevailing wage glossary, Getting Started quick-start, and FAQ; TermTooltip wired to auto-lookup definitions from glossary data.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create glossary data (16 terms) | e003401 | src/client/lib/glossary.ts |
| 2 | HelpCenterPanel component | 7bfc183 | src/client/components/help/HelpCenterPanel.tsx |
| 3 | Help FAB in Layout | 547ddc6 | src/client/components/shared/Layout.tsx |
| 4 | Wire TermTooltip to glossary | fc6792a | src/client/components/ui/TermTooltip.tsx |

## What Was Built

- `src/client/lib/glossary.ts` — Static `GlossaryTerm[]` array with 16 prevailing wage terms (Davis-Bacon Act, WH-347, Certified Payroll, Apprentice Ratio, Fringe Benefits, etc.) including related-term cross-references.
- `src/client/components/help/HelpCenterPanel.tsx` — Slide-in panel from right (`translate-x-full` / `translate-x-0` CSS transition), full-width on mobile / `sm:w-96` on desktop. Three tabs: Glossary (searchable, with "See also" links), Getting Started (4-step quick start), FAQ (4 Q&As). Backdrop overlay closes panel on outside click.
- `Layout.tsx` — `helpOpen` useState added; FAB button fixed `bottom-20 right-4` (above mobile tab bar) / `sm:bottom-6`; imports and renders `HelpCenterPanel`.
- `TermTooltip.tsx` — `definition` prop made optional; GLOSSARY lookup runs on render: `entry?.definition ?? definition ?? ''`. Existing tooltip display behavior unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing safety] Made TermTooltip `definition` prop optional**
- **Found during:** Task 4
- **Issue:** Making `definition` optional enables callers to use `<TermTooltip term="Davis-Bacon Act" />` without duplicating the definition string; existing callers with explicit `definition` props continue to work as the prop is the fallback.
- **Fix:** Changed `definition: string` to `definition?: string` in interface; `content` variable falls back through `entry?.definition ?? definition ?? ''`.
- **Files modified:** src/client/components/ui/TermTooltip.tsx
- **Commit:** fc6792a

**2. [Rule 1 - Bug] Used HTML entity for quotes in JSX string**
- **Found during:** Task 2 — linting concern
- **Issue:** `"No results for "{search}""` would trigger React unescaped entity warning.
- **Fix:** Used `&ldquo;` / `&rdquo;` HTML entities in the empty-state message.
- **Files modified:** src/client/components/help/HelpCenterPanel.tsx
- **Commit:** 7bfc183

## Known Stubs

None — all glossary data is fully populated static content; all tabs render real content.

## Pre-existing Out-of-Scope Issues

TypeScript errors in `src/client/components/copilot/CopilotWidget.tsx` (preparedAction, warnings, citations properties on ChatMessage union type) are pre-existing and not caused by this plan's changes.

## Self-Check: PASSED
