---
phase: 56-subcontractor-ui-panel
plan: "01"
subsystem: client-ui
tags: [subcontractors, cpr-tracking, react, tanstack-query, tdd]
dependency_graph:
  requires: [55-01]
  provides: [SubcontractorsPanel, getCprStatus, STATUS_BADGE, CprWeek, Subcontractor]
  affects: [ProjectDetailPage]
tech_stack:
  added: []
  patterns: [inline-component, tdd-red-green, lazy-query-enabled]
key_files:
  created:
    - src/client/lib/cprStatus.ts
    - tests/lib/cprStatus.test.ts
  modified:
    - src/client/pages/ProjectDetailPage.tsx
    - src/client/components/ui/Badge.tsx
decisions:
  - "BadgeVariant exported from Badge.tsx (was unexported) to allow import type in cprStatus.ts"
  - "STATUS_BADGE label uses em-dash unicode (U+2014) not HTML entity — plain string context"
  - "CprWeekTable defined as nested function inside SubcontractorsPanel body (single-use, not exported)"
  - "deleteSubMutation onSuccess closes expanded row if deleted sub was expanded"
  - "addCprWeekMutation 409 handled in onError with status code check — user-friendly message"
metrics:
  duration: ~6 minutes
  completed_date: "2026-04-14"
  tasks: 3
  files_created: 2
  files_modified: 2
---

# Phase 56 Plan 01: Subcontractors UI Panel Summary

**One-liner:** SubcontractorsPanel inline component with full CRUD, lazy CPR week table, getCprStatus pure function with strict isCompliant === 1 check and T00:00:00 local-time parse, 14 unit tests green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract getCprStatus + unit tests (TDD RED/GREEN) | 0d7c4e7 | src/client/lib/cprStatus.ts, tests/lib/cprStatus.test.ts, src/client/components/ui/Badge.tsx |
| 2 | Implement SubcontractorsPanel inline in ProjectDetailPage | 3a87439 | src/client/pages/ProjectDetailPage.tsx |
| 3 | Visual verification checkpoint | auto-approved | — |

## What Was Built

### src/client/lib/cprStatus.ts
Pure badge logic module exporting:
- `Subcontractor` and `CprWeek` interfaces (matching Phase 55 API shapes)
- `CprStatus` union type: `'overdue' | 'received-compliant' | 'received-non-compliant' | 'not-received'`
- `getCprStatus(week)` — uses `weekEndingDate + 'T00:00:00'` for local time parse, `isCompliant === 1` strict equality, `daysAgo > 7` for overdue boundary
- `STATUS_BADGE` record mapping each status to `{ variant: BadgeVariant, label: string }`

### tests/lib/cprStatus.test.ts
14 unit tests covering:
- All four status return values
- 7-day boundary (7 days ago = not-received, 8 days ago = overdue)
- isCompliant strict equality (0 must not be truthy)
- unassessed (null) = non-compliant for badge purposes
- All four STATUS_BADGE label/variant mappings

### SubcontractorsPanel (inline in ProjectDetailPage.tsx)
- Queries `['subcontractors', projectId]` — `/api/projects/:id/subcontractors`
- Add/Edit/Remove mutations with correct queryKey invalidation
- Inline add form (name required, 4 optional fields)
- Per-row edit mode (inline form replaces row content)
- Per-row delete confirmation ("Confirm remove?" with Confirm/Cancel)
- Expand chevron (ChevronRight with rotate-90 when expanded)

### CprWeekTable (nested inside SubcontractorsPanel)
- Queries `['cpr-weeks', projectId, subId]` — lazy, enabled only when subId present
- Renders table of CPR weeks with Badge via `getCprStatus` / `STATUS_BADGE`
- Mark Received (sets receivedDate = today, isCompliant = null)
- Mark Compliant (sets isCompliant = 1, strict)
- Mark Non-Compliant (sets isCompliant = 0)
- Inline add form with weekEndingDate (required), receivedDate, isCompliant select, notes
- 409 duplicate detection with user-friendly message

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Export] Exported BadgeVariant from Badge.tsx**
- **Found during:** Task 1
- **Issue:** `BadgeVariant` type was defined but not exported in Badge.tsx, preventing `import type { BadgeVariant }` in cprStatus.ts
- **Fix:** Added `export` keyword to `type BadgeVariant` declaration in Badge.tsx
- **Files modified:** src/client/components/ui/Badge.tsx
- **Commit:** 0d7c4e7

## Auto-Approved Checkpoint

Task 3 (checkpoint:human-verify) was auto-approved per user authorization in `<auto_checkpoint>` directive. Visual verification deferred to post-deployment QA or manual browser review. TypeScript compiled with no new errors; 14 unit tests green; pre-existing test failures (EADDRINUSE port conflicts from worktrees, disk I/O errors) are out-of-scope and unrelated to this plan.

## Known Stubs

None. All queries wire to live Phase 55 API routes. No hardcoded data.

## Self-Check: PASSED

- src/client/lib/cprStatus.ts: FOUND
- tests/lib/cprStatus.test.ts: FOUND
- src/client/pages/ProjectDetailPage.tsx: FOUND (SubcontractorsPanel present)
- Commit 0d7c4e7: FOUND
- Commit 3a87439: FOUND
