---
phase: 45-import-id-mapped-providers
plan: 03
subsystem: ui
tags: [import, id-mapping, paychex, sage-300, modal, step-2b, provider-labels]

requires:
  - phase: 45-01
    provides: idMappingRequired flag and unmappedIds in ImportPreviewResult; detectProvider extended for Paychex/Sage 300
  - phase: 45-02
    provides: GET and POST /api/payroll/import/mappings routes for fetching and saving ID mappings

provides:
  - Step 2b "Map Employees" UI screen in import modal for ID-mapped providers
  - importStep widened to 1 | '2b' | 2 | 3
  - idMappings, idMappingsSaving, idMappingsError state management
  - POST mappings then re-preview flow for server-authoritative re-resolution

affects: [PayrollWeekDetailPage, import-modal, paychex-import, sage-300-import]

tech-stack:
  added: []
  patterns: [step-branching-on-server-flag, re-call-preview-after-save, provider-id-to-worker-dropdown]

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "importStep uses string literal '2b' (not number 2.5) to avoid TypeScript number literal clash with existing 1|2|3 union"
  - "After saving mappings, re-call handleImportPreview(importFile) for server-authoritative re-resolution rather than optimistically advancing — ensures remaining unmapped IDs are surfaced if any exist"
  - "If user skips ALL mappings (empty toSave), advance directly to Step 2 without API call — skipped IDs appear as unmatched rows in Step 2"
  - "catch block uses (err instanceof Error) type-guard instead of (err: any) for strict TypeScript compliance"

patterns-established:
  - "Step 2b pattern: inject conditional JSX block between existing step blocks, driven by server flag"
  - "ID mapping save + re-preview: POST mappings -> re-call preview -> server decides next step"

requirements-completed: [IMPORT-05]

duration: ~15min
completed: 2026-04-06
---

# Phase 45 Plan 03: Step 2b Map Employees UI Summary

**Step 2b "Map Employees" modal screen injected between Step 1 and Step 2 for Paychex/Sage 300 imports, routing provider numeric IDs to project workers via a dropdown table with POST-then-re-preview save flow.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-06
- **Completed:** 2026-04-06
- **Tasks:** 1 (+ human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Injected Step 2b "Map Employees" between Step 1 (file upload) and Step 2 (review entries) in the import modal
- `handleImportPreview` now branches to `setImportStep('2b')` when server returns `idMappingRequired: true`
- Saving mappings POSTs to `/api/payroll/import/mappings` then re-calls `handleImportPreview(importFile)` — server-authoritative re-resolution ensures clean step advancement
- All Step 2b state (`idMappings`, `idMappingsSaving`, `idMappingsError`) reset in `closeImportModal`
- `ImportPreviewResult` client interface extended with `idMappingRequired?`, `unmappedIds?`, `sage_100` provider variant
- Human verification approved — end-to-end flow confirmed working

## Task Commits

1. **Task 1: Add Step 2b state, logic, and JSX to PayrollWeekDetailPage** — `95d5b02` (feat)

## Files Created/Modified

- `src/client/pages/PayrollWeekDetailPage.tsx` — importStep type widened; idMappings/idMappingsSaving/idMappingsError state added; handleImportPreview branching; closeImportModal reset; Step 2b JSX block; ImportPreviewResult interface extended

## Decisions Made

1. **String literal '2b' for importStep** — Using `'2b'` (string) rather than a number avoids TypeScript union clash with the existing `1 | 2 | 3` number literals. The string literal is unambiguous and self-documenting.
2. **Re-call preview after save** — Rather than optimistically advancing to Step 2, the save flow re-calls `handleImportPreview(importFile)`. This lets the server decide: if all IDs are now resolved, `idMappingRequired` is false and the modal advances to Step 2. If some remain, Step 2b is shown again with the remaining IDs.
3. **Skip-all shortcut** — If `toSave` is empty (user skipped all mappings), advance directly to Step 2 without an API call. The unresolved IDs will appear as unmatched rows in Step 2, consistent with name-based provider behavior.

## Deviations from Plan

None — plan executed exactly as written. The `err instanceof Error` type guard in the catch block was used instead of `err: any` to maintain strict TypeScript compliance, which is a minor implementation detail not a deviation.

## Issues Encountered

Pre-existing TypeScript errors in `src/server/routes/audit.ts` (line 56) and `src/server/routes/projects.ts` (line 121) — implicit `any` parameter types — exist independent of this plan. `PayrollWeekDetailPage.tsx` compiles clean. These errors are out of scope per deviation rule boundary.

## Known Stubs

None. Step 2b is fully wired: reads `importPreview.unmappedIds` from live server response, populates dropdowns from `projectWorkers` query, and saves via `/api/payroll/import/mappings` POST.

## Next Phase Readiness

- Phase 45 complete. All three plans delivered: parser extension (45-01), API routes (45-02), UI step (45-03).
- Paychex and Sage 300 full import flow operational end-to-end.
- IMPORT-05 requirement satisfied.

---
*Phase: 45-import-id-mapped-providers*
*Completed: 2026-04-06*
