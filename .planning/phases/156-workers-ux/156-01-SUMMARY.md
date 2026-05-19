---
phase: 156-workers-ux
plan: "01"
subsystem: workers
tags: [ux, slide-over, workers, add-worker, edit-worker]
dependency_graph:
  requires: []
  provides: [WorkerSlideOver component, slide-over add/edit UX]
  affects: [WorkersPage, worker CRUD flow]
tech_stack:
  added: []
  patterns: [slide-over panel, TanStack Query mutations, optimistic invalidation, Escape key dismiss]
key_files:
  created:
    - src/client/components/workers/WorkerSlideOver.tsx
  modified:
    - src/client/pages/WorkersPage.tsx
decisions:
  - "Kept existing inline edit form as fallback — slide-over is the primary path but no existing functionality removed"
  - "Classifications shown read-only in edit slide-over; add/remove trades stays on roster card to avoid duplicating mutation logic"
  - "projectState forwarded from WorkersPage to WorkerSlideOver to drive IL/MA/NJ/WA conditional fields"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 156 Plan 01: Worker Slide-Over Edit Panel Summary

## One-liner

Fixed right slide-over panel (320px desktop / full-width mobile, z-50, dark bg-nav-dark) for add and edit worker, with TanStack Query mutations, state-specific compliance fields, and inline delete confirm.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create WorkerSlideOver component | 6a145c3 | src/client/components/workers/WorkerSlideOver.tsx (new) |
| 2 | Wire slide-over into WorkersPage | 3c3b8c3 | src/client/pages/WorkersPage.tsx |

## What Was Built

### WorkerSlideOver component (`src/client/components/workers/WorkerSlideOver.tsx`)

- Fixed right panel, `w-full sm:w-80`, `bg-nav-dark`, `z-50` over `z-40` backdrop
- CSS transform animation: `translate-x-0` (open) / `translate-x-full` (closed) with `duration-200 ease-in-out`
- `open` prop controls visibility; backdrop click and Escape key both call `onClose`
- `worker` prop determines mode: `null/undefined` = add, `Worker` object = edit
- `useEffect` resets form state whenever `open` or `worker` changes
- useMutation for `createWorker`, `updateWorker`, `deleteWorker` — all call `qc.invalidateQueries(['workers', projectId])` on success
- Validation mirrors WorkersPage: name required, SSN digits-only + length-9, apprentice % + program name required for apprentice labor type
- Inline delete confirmation via `showDeleteConfirm` state (no modal, no navigation)
- State-specific conditional sections:
  - WA: trade code, description, manual rate, WA trade code dropdown
  - IL: race, ethnicity, gender, veteran status, skill level
  - MA/NJ: isWoman, isMinority, oshaTraining checkboxes
  - NJ: workerSex select (EEO)
- Classifications shown read-only in edit mode with note to use roster card for add/remove

### WorkersPage wiring (`src/client/pages/WorkersPage.tsx`)

- Added `slideOverOpen: boolean` and `slideOverWorker: Worker | null` state
- "Add Worker" PageHeader button opens slide-over in add mode
- Sidebar "Add or update worker" CTA opens slide-over in add mode
- "Add Your First Worker" EmptyState button opens slide-over in add mode
- Worker card "Edit" button opens slide-over in edit mode, pre-populated with worker data
- Existing inline edit form (editingId state) preserved — Edit button clears editingId before opening slide-over
- `<WorkerSlideOver>` rendered at bottom of Layout, always mounted (controlled by `open` prop)
- `projectState` forwarded from `projectData?.data?.project?.state`

## Deviations from Plan

None — plan executed exactly as written. The plan specified keeping existing functionality, which was honored: the inline edit form remains functional as a fallback path. The slide-over is the primary add/edit path.

## Known Stubs

None. All data flows from real API mutations. Classifications are shown read-only in edit mode with an explanation; this is intentional — the existing roster card UI handles classification add/remove with its own established mutation flow.

## Self-Check: PASSED

- `src/client/components/workers/WorkerSlideOver.tsx` — created and present
- `src/client/pages/WorkersPage.tsx` — modified with slide-over import and wiring
- Commits `6a145c3` and `3c3b8c3` verified in git log
- TypeScript: 0 errors in WorkerSlideOver.tsx, 0 errors in WorkersPage.tsx (pre-existing errors in CopilotWidget.tsx and server/routes/workers.ts are unchanged)
