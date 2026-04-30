---
phase: 122-dbe-certification-management
plan: 01
subsystem: api
tags: [drizzle, express, react, tanstack-query, lucide-react, zod, typescript]

# Dependency graph
requires:
  - phase: 71-dbe-cert-crud
    provides: subcontractorCertifications table + GET/POST/DELETE cert routes + CertificationsSection UI
  - phase: 82-dbe-gap-close
    provides: SAM.gov fields on certifications + SubcontractorCertification type with uei/cageCode/samRegistrationStatus

provides:
  - PATCH /api/projects/:id/subcontractors/:subId/certifications/:certId — partial update with !== undefined guards
  - DBE-06 auto-pending in POST /certifications when issueDate < 2025-10-03 and reevaluationStatus === 'not_required'
  - Inline edit form on each cert table row (editingCertId toggle pattern)
  - editCertMutation + double-invalidation of certifications + subcontractors query caches

affects: [122-02, 122-03, dbe-participation-card, cert-summary-staleness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PATCH cert route mirrors PATCH sub route pattern with !== undefined guards (never truthiness)
    - DBE-06 conditional: let finalReevalStatus mutated before insert, not post-insert migration
    - Double-invalidation pattern: every cert mutation invalidates both ['certifications', projectId, subId] AND ['subcontractors', projectId]
    - editingCertId: string|null state toggles table row between read-only display and inline edit form

key-files:
  created: []
  modified:
    - src/server/routes/subcontractors.ts
    - src/client/pages/ProjectDetailPage.tsx

key-decisions:
  - "UpdateCertSchema placed directly below CreateCertSchema in subcontractors.ts to keep cert-related schemas grouped"
  - "PATCH cert route placed AFTER DELETE /certifications/:certId (plan originally said between POST and DELETE but final plan says after DELETE — followed final plan)"
  - "api.patch exists in src/client/lib/api.ts — no fallback needed"
  - "EMPTY_CERT_FORM extended with issueDate, naicsCodes, selfCertified — required for edit form pre-population (Rule 2 auto-fix)"
  - "editingCertId conditional: inline edit row spans colSpan=5 matching existing 5-column header (Cert Types, Agency, Expires, DOT IFR Status, Actions)"

patterns-established:
  - "PATCH route: UpdateCertSchema all-optional + !== undefined guards on every field + updatedAt always re-stamped"
  - "DBE-06 conditional fires only at CREATE — no retroactive migration"
  - "Inline cert edit: single editingCertId state, one row at a time, pre-populated from cert object"

requirements-completed: [DBE-02, DBE-06]

# Metrics
duration: 18min
completed: 2026-04-30
---

# Phase 122 Plan 01: DBE Certification Edit + DBE-06 Auto-pending Summary

**PATCH cert route with 11 !== undefined guards + DBE-06 issueDate-before-Oct-2025 auto-pending + inline cert edit UI with double-invalidation on all three cert mutations**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-30T00:39:00Z
- **Completed:** 2026-04-30T00:57:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- PATCH /api/projects/:id/subcontractors/:subId/certifications/:certId with partial-update semantics (null is a valid clearing value; !== undefined guards on all 11 fields)
- DBE-06 compliance: POST /certifications auto-upgrades reevaluationStatus from 'not_required' to 'pending' when issueDate < '2025-10-03'
- Inline cert edit UI: Pencil icon on each cert row toggles to an amber-background edit form; Save calls editCertMutation; Cancel reverts
- All three cert mutations (add, edit, delete) now invalidate BOTH ['certifications', projectId, subId] AND ['subcontractors', projectId] — fixing certSummary stale-counts bug

## Task Commits

1. **Task 1: PATCH cert route + DBE-06 auto-pending** - `2f66893` (feat)
2. **Task 2: Edit cert UI + double-invalidation** - `d0268a5` (feat)

## Files Created/Modified

- `src/server/routes/subcontractors.ts` — Added UpdateCertSchema (lines ~425-437), DBE-06 auto-pending in POST handler (~491-500), PATCH cert route (~556-619). Line count of new code: +85 lines
- `src/client/pages/ProjectDetailPage.tsx` — Added Pencil import, extended EMPTY_CERT_FORM, added editingCertId/editCertForm/editCertError state, editCertMutation, double-invalidation to addCertMutation/deleteCertMutation, replaced cert table row block with edit-conditional rendering. Net diff: +151/-29 lines

## Decisions Made

- `api.patch` already exists in `src/client/lib/api.ts` — no fallback needed
- UpdateCertSchema grouped with CreateCertSchema at line ~425 (cert-related schema locality)
- PATCH cert route placed after DELETE cert route (follows plan instruction: "Add PATCH route AFTER the DELETE /certifications/:certId route")
- EMPTY_CERT_FORM extended with `issueDate`, `naicsCodes`, `selfCertified` fields — auto-fix applied because the edit form pre-populates from `cert.issueDate`, `cert.naicsCodes`, `cert.selfCertified` and these were missing from the form shape
- Inline edit form spans `colSpan={5}` to match existing 5-column cert table layout (Cert Types, Agency, Expires, DOT IFR Status, Actions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended EMPTY_CERT_FORM with issueDate, naicsCodes, selfCertified**
- **Found during:** Task 2 (Edit cert UI)
- **Issue:** Plan's edit form pre-populates `cert.issueDate`, `cert.naicsCodes`, `cert.selfCertified` into `editCertForm` state, but `EMPTY_CERT_FORM` (the type basis for `editCertForm`) was missing these three fields — TypeScript would error or omit them silently
- **Fix:** Added `issueDate: ''`, `naicsCodes: ''`, `selfCertified: false` to `EMPTY_CERT_FORM`
- **Files modified:** src/client/pages/ProjectDetailPage.tsx
- **Verification:** `npm run -s typecheck` 0 errors
- **Committed in:** d0268a5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical fields for type correctness)
**Impact on plan:** Required for TypeScript correctness and edit form pre-population to work. No scope creep.

## Issues Encountered

- `npm run build` fails with a pre-existing error: `vite-plugin-pwa:build` cannot find `sw.js` (pre-dates this plan). The Vite/Rollup compile step itself succeeds ("built in 519ms"). Zero new errors introduced.

## Known Stubs

None — all fields wired to real data.

## Next Phase Readiness

- Plan 122-02 (test coverage) can proceed: PATCH route at exact path `/:id/subcontractors/:subId/certifications/:certId` with UpdateCertSchema validation, and POST route with finalReevalStatus branch are in place for test targeting
- Plan 122-03 (verification) can proceed: smoke test scenario for edit + cert summary refresh is now wirable end-to-end
- Line references for test plans:
  - `subcontractors.ts` PATCH route: starts at `router.patch('/:id/subcontractors/:subId/certifications/:certId'`
  - `subcontractors.ts` DBE-06 conditional: `issueDate < '2025-10-03'`
  - `ProjectDetailPage.tsx` editCertMutation: `const editCertMutation = useMutation`
  - `ProjectDetailPage.tsx` editingCertId conditional: `editingCertId === cert.id`

---
*Phase: 122-dbe-certification-management*
*Completed: 2026-04-30*
