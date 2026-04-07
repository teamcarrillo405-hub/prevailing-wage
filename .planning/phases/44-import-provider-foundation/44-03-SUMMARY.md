---
phase: 44-import-provider-foundation
plan: "03"
subsystem: ui
tags: [import-modal, provider-badge, gusto, payroll-import, react, typescript]
dependency_graph:
  requires:
    - importTypes.ts (ImportProvider union — Plan 01)
    - gustoMapper.ts + gustoWeeklyTotalsOnly flag on ImportPreviewResult (Plan 02)
  provides:
    - PROVIDER_LABELS map for all 5 providers
    - Gusto weekly-totals amber banner in Step 2
    - Client-side ImportPreviewResult extended with gusto/paychex/sage_300 + gustoWeeklyTotalsOnly
  affects:
    - src/client/pages/PayrollWeekDetailPage.tsx
tech_stack:
  added: []
  patterns:
    - PROVIDER_LABELS module-level Record<string, string> — single source of truth for display names
    - Gusto banner follows ADP banner pattern exactly (same Card/className structure)
    - Client-side type mirrors server ImportProvider union — no cross-bundle imports
key_files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx
key_decisions:
  - "PROVIDER_LABELS placed at module level (not inside component) — stable reference, no re-creation on render"
  - "Fallback ?? importPreview.provider handles future providers not yet in map without crashing"
  - "All three ternary sites replaced (badge, onSuccess banner text, Step 3 confirm label) — not just the badge"
  - "sage_100 added to PROVIDER_LABELS even though not yet in provider union — forward-compatibility"
patterns-established:
  - "Provider display names: always look up from PROVIDER_LABELS, never inline ternary"
  - "Weekly-totals banners: per-provider Card with border-status-warning/30 bg-status-warning/10 pattern"
requirements-completed: [IMPORT-06]
duration: 8min
completed: "2026-04-06"
---

# Phase 44 Plan 03: Provider Badge UI Update Summary

**PROVIDER_LABELS map replaces all hardcoded QB/ADP ternaries; Gusto weekly-totals amber banner added to Step 2; client ImportPreviewResult extended to mirror server ImportProvider union.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-06T00:00:00Z
- **Completed:** 2026-04-06T00:08:00Z
- **Tasks:** 2 (combined into single commit — single file)
- **Files modified:** 1

## Accomplishments

- Extended client-side `ImportPreviewResult` provider union from `'quickbooks' | 'adp'` to include `'gusto' | 'paychex' | 'sage_300'` and added `gustoWeeklyTotalsOnly?: boolean`
- Replaced all 3 hardcoded QB-vs-ADP ternaries with `PROVIDER_LABELS[provider] ?? provider` lookups (badge in Step 2, success banner text in onSuccess handler, label variable in Step 3)
- Added Gusto weekly-totals amber banner in Step 2 matching ADP banner styling exactly

## Task Commits

1. **Tasks 1 + 2: ImportPreviewResult extension + PROVIDER_LABELS + Gusto banner** - `74470ba` (feat)

**Plan metadata:** (final docs commit follows)

## Files Created/Modified

- `src/client/pages/PayrollWeekDetailPage.tsx` — ImportPreviewResult extended, PROVIDER_LABELS added at module level, 3 ternaries replaced, Gusto banner added

## Decisions Made

- PROVIDER_LABELS placed at module level (after WH347_DEF const, before interfaces) — avoids re-creation on render
- Fallback `?? importPreview.provider` keeps badge functional for any future provider not yet named in the map
- All three hardcoded ternary sites replaced, not just the badge — ensures consistent provider display across modal steps
- `sage_100` included in PROVIDER_LABELS map (forward-compatibility) even though not yet in ImportProvider union

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced two additional hardcoded QB/ADP ternaries**
- **Found during:** Task 2 (badge replacement) — grep revealed 2 more ternary sites beyond the badge
- **Issue:** Line 414 (`onSuccess` handler success banner) and line 2652 (Step 3 confirm label) both used `provider === 'quickbooks' ? 'QuickBooks' : 'ADP'` — Gusto/Paychex/Sage imports would show "ADP" in success banner and Step 3
- **Fix:** Both replaced with `PROVIDER_LABELS[...] ?? provider` lookups
- **Files modified:** src/client/pages/PayrollWeekDetailPage.tsx
- **Verification:** `grep -c "quickbooks.*QuickBooks.*ADP" src/client/pages/PayrollWeekDetailPage.tsx` returns 0
- **Committed in:** 74470ba

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Auto-fix necessary for correctness. Without it, Gusto/Paychex/Sage imports would show "ADP" in the success banner and Step 3 confirm label. No scope creep.

## Issues Encountered

None.

## Known Stubs

None — PROVIDER_LABELS provides real display names for all supported providers. Badge, success banner, and Step 3 label all render correct names. Gusto and ADP banners only appear when their respective `*WeeklyTotalsOnly` flags are true, driven by real mapper output.

## Self-Check

- `src/client/pages/PayrollWeekDetailPage.tsx` modified: FOUND
- Commit 74470ba: VERIFIED
- `npx tsc --noEmit` — zero errors in modified file (2 pre-existing errors in audit.ts, projects.ts — out of scope): VERIFIED
- `grep -c "PROVIDER_LABELS" src/client/pages/PayrollWeekDetailPage.tsx` = 4: VERIFIED
- `grep -c "gustoWeeklyTotalsOnly" src/client/pages/PayrollWeekDetailPage.tsx` = 3: VERIFIED
- `grep -c "quickbooks.*QuickBooks.*ADP"` = 0 (old ternary gone): VERIFIED
- `'gusto'` in ImportPreviewResult provider union: VERIFIED

## Self-Check: PASSED

## Next Phase Readiness

- PayrollWeekDetailPage.tsx now supports all 5 import providers in the UI
- IMPORT-06 complete — provider badge is extensible via PROVIDER_LABELS map
- Paychex and Sage mappers (when built in future plans) will automatically display correct labels without UI changes

---
*Phase: 44-import-provider-foundation*
*Completed: 2026-04-06*
