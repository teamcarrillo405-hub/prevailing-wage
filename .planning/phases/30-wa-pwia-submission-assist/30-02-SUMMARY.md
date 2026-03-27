---
phase: 30-wa-pwia-submission-assist
plan: 02
subsystem: api
tags: [xml, wa, pwia, export, xmlbuilder2, route]

# Dependency graph
requires:
  - phase: 30-wa-pwia-submission-assist-01
    provides: DB migration adding pwia_intent_id + wa_trade_code columns, Wave 0 RED test stubs

provides:
  - WA L&I PWIA-compliant CPR XML generator pure function (waCprXmlGenerator.ts)
  - GET /api/export/wa-cpr-xml/:weekId route with WA state gate, intentId validation, trade code gate
  - All Wave 0 RED stubs from Plan 01 now GREEN

affects: [30-03, 30-wa-pwia-submission-assist]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WA XSD day ordering: Day1=Mon through Day7=Sun (Monday-first), opposite of CA eCPR (Sun-first)"
    - "Pure XML generator with WaCprData/WaCprEmployee/WaCprTradeEntry typed interfaces"
    - "Route handler 8-step pattern: load week -> ownership -> state gate -> validate -> load entries -> map -> generate -> send"
    - "Multi-classification grouping: entries grouped by workerId for workers with multiple trade entries"

key-files:
  created:
    - src/server/services/waCprXmlGenerator.ts
  modified:
    - src/server/routes/export.ts

key-decisions:
  - "Day mapping is Monday-first (Day1=Mon, Day7=Sun) per WA XSD spec — inverse of CA eCPR (Sun-first)"
  - "Workers with multiple trade classifications produce multiple tradeHoursWage entries under a single employee element, grouped by workerId"
  - "fringeRateAmt emitted as hourlyPensionRateAmt only when defined and > 0 (optional per XSD)"
  - "intentIdStr validated with parseInt + isInteger + > 0 check; stored as TEXT on project, cast to number for XML"
  - "WaPWCPR root element: no namespace prefix, no xmlns declaration — unqualified elements throughout"

patterns-established:
  - "XML generator pattern: create({version,encoding}).ele('WaPWCPR') — root element string, no namespace attrs"
  - "Route state gate: project.state !== 'WA' -> 400 with error containing state name"
  - "Trade code gate: filter(row => !row.waTradeCode) -> 422 with workers array when non-empty"

requirements-completed: [WAL-03]

# Metrics
duration: 15min
completed: 2026-03-27
---

# Phase 30 Plan 02: WA CPR XML Generator + Route Summary

**WA L&I PWIA XML generator (WaPWCPR root, Mon-first day ordering) and export route with state gate, intentId validation, and trade code enforcement — all Wave 0 RED stubs GREEN**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-27T03:33:00Z
- **Completed:** 2026-03-27T03:48:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `waCprXmlGenerator.ts` pure function producing WaPWCPR XML with Monday-first day ordering (Day1=Mon through Day7=Sun per WA XSD spec)
- `GET /api/export/wa-cpr-xml/:weekId` route enforcing WA state gate, intentId positive integer validation, and null waTradeCode 422 gate
- All 9 unit tests and 5 route tests (14 total Wave 0 tests) pass GREEN

## Task Commits

1. **Task 1: waCprXmlGenerator.ts pure function** - `895cfa6` (feat)
2. **Task 2: GET /api/export/wa-cpr-xml/:weekId route** - `99c294d` (feat)

## Files Created/Modified

- `src/server/services/waCprXmlGenerator.ts` — Pure XML generator; exports `generateWaCprXml`, `WaCprData`, `WaCprEmployee`, `WaCprTradeEntry`, `WaCprTradeDay`
- `src/server/routes/export.ts` — Added import for waCprXmlGenerator and wa-cpr-xml route handler (163 lines added)

## Decisions Made

- Day ordering is Monday-first (Day1=Mon, Day7=Sun) per WA XSD — opposite of CA eCPR which uses Sunday-first (id=1=Sun). Confirmed from 30-RESEARCH.md: "Day1=Mon, Day7=Sun".
- Workers with multiple trade entries are grouped by workerId using a Map, producing one `<employee>` element with multiple `<tradeHoursWage>` children per worker.
- `fringeRateAmt` emitted as `<hourlyPensionRateAmt>` only when defined and > 0 (optional WA XSD field).
- intentId stored as TEXT on project (matches dirProjectId pattern per STATE.md decision). Route converts to integer via `parseInt(intentIdStr, 10)` before building WaCprData.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing RED stubs in `tests/routes/export.test.ts` for the A-1-131 route (CAL-02 block, 6 failures) were present before this plan and remain out-of-scope. These are from Phase 24-03 (not yet executed). No regressions introduced.

## Known Stubs

None - all plan goals achieved. The generator produces real XML; the route is fully wired.

## Next Phase Readiness

- Plan 30-03 (WA submission assist UI) ready: backend XML route operational, intentId stored on project
- Pre-existing blocker: Phase 24-03 (A-1-131 PDF generator + export route) remains unexecuted; 6 tests remain RED but are out of scope for Phase 30

---
*Phase: 30-wa-pwia-submission-assist*
*Completed: 2026-03-27*
