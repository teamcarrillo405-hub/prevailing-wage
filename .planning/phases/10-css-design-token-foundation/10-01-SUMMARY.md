---
phase: 10-css-design-token-foundation
plan: 01
subsystem: ui

tags: [tailwindcss, css-variables, design-tokens, google-fonts, oswald, inter]

# Dependency graph
requires: []
provides:
  - "@theme with 14 HCC brand tokens in index.css generating Tailwind utility classes"
  - "Google Fonts (Oswald + Inter) loaded via HTML link tags with preconnect hints"
  - "@layer base setting body font-family (Inter) and h1-h4 font-family (Oswald) globally"
affects: [11-ui-primitives, 12-app-shell, 13-landing-page, 14-page-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All brand tokens in @theme block in index.css — never split into imported files (TailwindCSS v4 constraint)"
    - "Fonts loaded via HTML link tag (not CSS @import) — ensures fonts available before JS bundle executes"
    - "NEVER use --color-*: initial in @theme — silently wipes all default Tailwind color utilities"

key-files:
  created: []
  modified:
    - src/client/index.css
    - src/client/index.html

key-decisions:
  - "Google Fonts loaded via <link> in index.html, not @import in index.css — HTML link loads before JS execution preventing FOUT"
  - "Only weights 400/500/600/700 loaded for both Oswald and Inter — full 100-900 range adds 600-900ms TTFB"
  - "@layer base sets body and h1-h4 font-family globally — no per-component font class required"
  - "Warning comment added at top of index.css to prevent accidental --color-*: initial token"

patterns-established:
  - "Pattern 1: All HCC brand tokens live in @theme in index.css — any new tokens added here to auto-generate utility classes"
  - "Pattern 2: Semantic color naming (nav-dark, surface-card, status-compliant) not value naming (#1a1a1a)"

requirements-completed: [DESIGN-01, DESIGN-02]

# Metrics
duration: 10min
completed: 2026-03-20
---

# Phase 10 Plan 01: CSS Design Token Foundation Summary

**14-token HCC brand @theme in index.css with Oswald/Inter Google Fonts loaded via HTML preconnect tags and @layer base global font defaults**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-20T08:55:00Z
- **Completed:** 2026-03-20T08:57:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- All 14 HCC brand tokens defined in @theme: brand-gold, nav-dark, surface-card, surface-page, surface-muted, border-default, text-primary, text-secondary, status-compliant, status-violation, status-warning, radius-card, radius-sm, shadow-card
- Google Fonts (Oswald wt 400-700 and Inter wt 400-700) loaded from CDN via HTML link tag with preconnect hints — no FOUT
- @layer base wires body to Inter and h1-h4 to Oswald globally — no per-component class required
- 181-test regression suite stays fully green

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Google Fonts to index.html** - `24f724d` (feat)
2. **Task 2: Expand @theme and add @layer base in index.css** - `8f87094` (feat)

## Files Created/Modified

- `src/client/index.html` - Added preconnect hints + Google Fonts stylesheet link in `<head>`
- `src/client/index.css` - Expanded @theme from 3 to 14 tokens; added @layer base with body/h1-h4 font defaults

## Decisions Made

- Google Fonts loaded via HTML `<link>` tag, not CSS `@import`, so fonts are available before the JS bundle parses (prevents flash of unstyled text)
- Loaded only weights 400/500/600/700 for both families — full weight range would add 600-900ms TTFB per plan spec
- Warning comment placed at top of index.css documenting the `--color-*: initial` gotcha for future developers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Google Fonts load from CDN automatically in browser.

## Next Phase Readiness

- All 14 brand tokens now available as Tailwind utility classes: bg-brand-gold, bg-nav-dark, text-text-primary, text-status-compliant, shadow-card, rounded-card, etc.
- Headings and body text will render in Oswald/Inter respectively once the browser loads the app
- Phase 11 (UI Primitives) can immediately reference all token utilities without defining them

---
*Phase: 10-css-design-token-foundation*
*Completed: 2026-03-20*
