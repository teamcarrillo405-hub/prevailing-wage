---
phase: 10-css-design-token-foundation
plan: "02"
subsystem: ui
tags: [tailwindcss, design-tokens, css, react, tsx]

# Dependency graph
requires:
  - phase: 10-css-design-token-foundation-01
    provides: bg-brand-gold and font-headline utility classes defined in index.css @theme

provides:
  - All 4 backgroundColor inline style instances replaced with bg-brand-gold className
  - All 3 fontFamily inline style instances in ReportsPage replaced with font-headline className
  - 1 focus:outline-none instance in ReportsPage migrated to focus:outline-hidden
  - Zero remaining style={{ backgroundColor: '#F5C518' }} in TSX files
  - Zero remaining style={{ fontFamily: 'Oswald' }} in TSX files
  - WageClassificationsTable tr element verified rendering gold background in browser

affects:
  - 10-css-design-token-foundation-03
  - 11-ui-primitives

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "bg-brand-gold className replaces style={{ backgroundColor: '#F5C518' }} inline props"
    - "font-headline className replaces style={{ fontFamily: 'Oswald, sans-serif' }} inline props"
    - "focus:outline-hidden is the TailwindCSS v4 rename of focus:outline-none"

key-files:
  created: []
  modified:
    - src/client/components/wages/ManualWageEntryForm.tsx
    - src/client/components/wages/WageClassificationsTable.tsx
    - src/client/pages/AdminStateWagePage.tsx
    - src/client/pages/WageLookupPage.tsx
    - src/client/pages/ReportsPage.tsx

key-decisions:
  - "bg-brand-gold works correctly on <tr> elements — browser verify confirmed, no CSS variable fallback needed"
  - "font-headline applied explicitly even on heading elements already covered by @layer base — preserves explicit intent"
  - "focus:outline-hidden migration bundled with ReportsPage edits to avoid concurrent file write conflicts with Plan 03"

patterns-established:
  - "Inline brand style removal: read element, merge className, remove style prop entirely"
  - "Browser checkpoint required when applying utility classes to non-standard elements (tr, thead) due to CSS specificity"

requirements-completed: [DESIGN-03]

# Metrics
duration: ~20min
completed: 2026-03-20
---

# Phase 10 Plan 02: CSS Design Token Foundation — Inline Style Migration Summary

**Removed all 7 hardcoded brand inline styles across 5 TSX files, replacing backgroundColor and fontFamily props with bg-brand-gold and font-headline utility classes, browser-verified on WageClassificationsTable tr element.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-20
- **Completed:** 2026-03-20
- **Tasks:** 3 (2 code migration, 1 browser verify checkpoint)
- **Files modified:** 5

## Accomplishments

- Eliminated all 4 `style={{ backgroundColor: '#F5C518' }}` inline instances across ManualWageEntryForm, WageClassificationsTable, AdminStateWagePage, and WageLookupPage
- Eliminated all 3 `style={{ fontFamily: 'Oswald, sans-serif' }}` inline instances in ReportsPage, replacing with font-headline className
- Migrated 1 focus:outline-none instance in ReportsPage to focus:outline-hidden (TailwindCSS v4 rename)
- Browser verification confirmed bg-brand-gold renders correctly on `<tr>` element — CSS specificity concern (noted in RESEARCH.md Pitfall 2) was not an issue; no fallback needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate 4 backgroundColor inline styles to bg-brand-gold** - `5ed06ae` (feat)
2. **Task 2: Migrate 3 fontFamily inline styles in ReportsPage to font-headline + focus:outline-none** - `205f8b2` (feat)
3. **Task 3: Browser verify checkpoint** - approved (no code commit — verification only)

## Files Created/Modified

- `src/client/components/wages/ManualWageEntryForm.tsx` - bg-brand-gold className replaces backgroundColor inline style (~line 169)
- `src/client/components/wages/WageClassificationsTable.tsx` - bg-brand-gold on tr element replaces backgroundColor inline style (~line 23)
- `src/client/pages/AdminStateWagePage.tsx` - bg-brand-gold className replaces backgroundColor inline style (~line 121)
- `src/client/pages/WageLookupPage.tsx` - bg-brand-gold className replaces backgroundColor inline style (~line 81)
- `src/client/pages/ReportsPage.tsx` - font-headline on 3 elements; focus:outline-hidden replaces focus:outline-none

## Decisions Made

- bg-brand-gold confirmed working on `<tr>` elements via browser verify — the CSS variable fallback documented in the plan was not needed
- font-headline applied explicitly even on h1-h4 heading elements that @layer base already targets — explicit className preserves intent and makes token usage searchable
- ReportsPage focus:outline-none migration bundled here (not Plan 03) to avoid concurrent write conflicts between plans

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 10 Plan 02 complete: zero inline backgroundColor or fontFamily brand values remain in the 5 files in scope
- Plan 03 (focus:outline-none migration across remaining files) was executed in parallel — all inline brand style work is now complete
- Phase 11 (UI Primitives) can proceed: design token foundation is solid, all Tailwind v4 utility renames applied

---
*Phase: 10-css-design-token-foundation*
*Completed: 2026-03-20*
