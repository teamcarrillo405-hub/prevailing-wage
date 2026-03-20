---
phase: 11-ui-primitives
plan: "01"
subsystem: client-ui
tags: [ui-primitives, tailwind, components, design-tokens]
dependency_graph:
  requires: [10-css-design-token-foundation]
  provides: [Card, Button, Badge, cn-utility]
  affects: [src/client/components/ui, src/client/lib/utils.ts]
tech_stack:
  added: [clsx@2.1.1, tailwind-merge@3.5.0]
  patterns: [cn-utility, variant-record-pattern, TailwindCSS-v4-opacity-modifiers]
key_files:
  created:
    - src/client/lib/utils.ts
    - src/client/components/ui/Card.tsx
    - src/client/components/ui/Button.tsx
    - src/client/components/ui/Badge.tsx
  modified:
    - package.json
    - package-lock.json
decisions:
  - "neutral Badge uses bg-gray-100/text-gray-600/border-gray-300 — no custom token (--color-status-neutral does not exist in @theme)"
  - "Button uses hover:bg-brand-gold/90 (TailwindCSS v4 opacity modifier) not hover:bg-yellow-400"
  - "cn() in utils.ts (not cn.ts) per planning context"
metrics:
  duration: "~5min"
  completed_date: "2026-03-20"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
---

# Phase 11 Plan 01: UI Primitives (Card, Button, Badge) Summary

**One-liner:** Card/Button/Badge primitives using Phase 10 design tokens with cn() utility backed by clsx + tailwind-merge.

## What Was Built

### Packages Installed
- **clsx@2.1.1** — conditional class merging
- **tailwind-merge@3.5.0** — TailwindCSS class deduplication (last-wins, e.g. `twMerge('p-4 p-6')` → `p-6`)

### cn() Utility
- **Location:** `src/client/lib/utils.ts`
- **Export:** `cn(...inputs: ClassValue[])`
- **Pattern:** `twMerge(clsx(inputs))` — clsx handles conditionals, twMerge deduplicates Tailwind classes

### Card Component
- **Padding variants:** `default` (p-6), `sm` (p-4), `none` (p-0)
- **Base classes:** `bg-surface-card rounded-card shadow-card border border-border-default`
- **Props:** `children`, `padding?`, `className?`

### Button Component
- **Variants:** `primary`, `secondary`, `ghost`
- **Sizes:** `sm` (text-xs, px-3 py-1.5), `md` (text-sm, px-4 py-2)
- **Primary hover:** `hover:bg-brand-gold/90` (TailwindCSS v4 opacity modifier syntax)
- **Secondary hover:** `hover:bg-brand-gold/10`
- **Focus:** `focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold`

### Badge Component
- **Variants:** `compliant`, `violation`, `warning`, `neutral`
- **Status variants** use opacity modifiers: `bg-status-compliant/10 text-status-compliant border border-status-compliant/30`
- **Neutral variant:** `bg-gray-100 text-gray-600 border border-gray-300` — intentionally uses built-in Tailwind classes, NOT `bg-status-neutral` (that token does not exist in @theme)

## Verification Results

- 181-test suite: PASSED (no regressions)
- TypeScript: Clean on new files (pre-existing workers.ts errors unchanged)
- `grep bg-status-neutral src/client/components/ui/` — only in comment, not class usage
- `grep bg-opacity- src/client/components/ui/` — empty (v4 syntax used throughout)
- `grep 'bg-\[#' src/client/components/ui/` — empty (no hardcoded hex values)

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 5d2a146 | feat(11-01): install clsx + tailwind-merge, create cn() utility |
| 2 | 79ead35 | feat(11-01): create Card and Button UI primitives |
| 3 | 44ba042 | feat(11-01): create Badge component with compliant/violation/warning/neutral variants |
