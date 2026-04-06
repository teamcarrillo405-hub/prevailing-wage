---
phase: 40-ny-schema-compliance-rule
plan: "02"
subsystem: server-routes, client-forms
tags: [ny, routes, forms, workers, projects]
dependency_graph:
  requires: [40-01]
  provides: [ny-project-fields-api, nys-apprentice-api, ny-project-form-ui, nys-apprentice-ui]
  affects: [projects-route, workers-route, workerService, ProjectForm, WorkersPage]
tech_stack:
  added: []
  patterns: [conditional-state-section, route-zod-schema, drizzle-insert-update]
key_files:
  created: []
  modified:
    - src/server/routes/projects.ts
    - src/server/routes/workers.ts
    - src/server/services/workerService.ts
    - src/client/components/projects/ProjectForm.tsx
    - src/client/pages/WorkersPage.tsx
decisions:
  - "isNY uses stateValue?.toUpperCase() === 'NY' — exact isCA/isWA pattern"
  - "nysRegisteredApprentice checkbox shown universally (all workers, not NY-gated)"
  - "PATCH handler conditionally spreads NY fields using same spread pattern as other optional fields"
  - "ProjectForm NY section uses green-200/green-50 border/bg — distinct from CA amber and WA blue"
metrics:
  duration_seconds: 281
  completed_date: "2026-04-02"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 5
---

# Phase 40 Plan 02: NY Route and Form Wiring Summary

**One-liner:** NY project fields (PRC number, contractor reg) and nysRegisteredApprentice flag wired through Zod routes, workerService, and React forms with isNY conditional panel.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Add NY fields to project route Zod schemas and Drizzle insert/update | e220baf | src/server/routes/projects.ts |
| 2 | Add nysRegisteredApprentice to worker route and workerService | 5719cb2 | src/server/routes/workers.ts, src/server/services/workerService.ts |
| 3 | Add isNY conditional section to ProjectForm and nysRegisteredApprentice checkbox to WorkersPage | 9af4ec5 | src/client/components/projects/ProjectForm.tsx, src/client/pages/WorkersPage.tsx |

## What Was Built

### Task 1 — Project Route NY Fields
- `CreateProjectSchema` and `UpdateProjectSchema` in `projects.ts` now accept `nyprcNumber` (max 100), `nysContractorRegNumber` (max 100), and `projectSettings` as optional strings.
- POST `/api/projects` writes all three via `.values()` with `?? null` fallback.
- PATCH `/api/projects/:id` conditionally updates all three using spread pattern consistent with existing optional fields.

### Task 2 — Worker Route + Service
- `CreateWorkerSchema`: `nysRegisteredApprentice: z.boolean().optional().default(false)`
- `UpdateWorkerSchema`: `nysRegisteredApprentice: z.boolean().optional()`
- Both route handlers pass the field through to `workerService.createWorker()` and `workerService.updateWorker()`.
- `CreateWorkerInput` and `UpdateWorkerInput` interfaces include `nysRegisteredApprentice?: boolean`.
- `createWorker()` writes `nysRegisteredApprentice: input.nysRegisteredApprentice ?? false` to DB.
- `updateWorker()` conditionally sets `nysRegisteredApprentice` using `if (input.nysRegisteredApprentice !== undefined)` guard.

### Task 3 — React UI
- `ProjectForm.tsx`: added `nyprcNumber` and `nysContractorRegNumber` to the client-side Zod schema; `isNY` constant follows exact `isCA`/`isWA` pattern; green-bordered panel (`border-green-200 bg-green-50`) shown when state=NY with two labeled text inputs using `register()` and design tokens.
- `WorkersPage.tsx`: `Worker` interface now includes `nysRegisteredApprentice: boolean | null`; `blankWorkerForm()` defaults it to `false`; `workerToEditForm()` hydrates it with `w.nysRegisteredApprentice ?? false`; inline `editForm` state includes it; checkbox shown universally (not NY-gated) in both Add Worker form and Edit Worker form; both mutations pass the field to the API.

## Verification

`npx tsc --noEmit` passes — only 2 pre-existing errors in `audit.ts` and `projects.ts` (both were present before this plan, documented in CLAUDE.md as non-fatal known issues).

## Deviations from Plan

None — plan executed exactly as written. The PATCH handler approach used the UpdateProjectSchema parsed data spread (which already includes the NY fields) plus explicit conditional spreads for clarity, consistent with the plan spec.

## Known Stubs

None — all fields are wired end-to-end from form to DB.

## Self-Check: PASSED
