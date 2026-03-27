---
phase: 30-wa-pwia-submission-assist
plan: 03
subsystem: ui
tags: [wa, pwia, react, xml, download, submission-guide]

# Dependency graph
requires:
  - phase: 30-wa-pwia-submission-assist-02
    provides: GET /api/export/wa-cpr-xml/:weekId route with WA state gate, intentId validation, and 422 trade code gate

provides:
  - WA CPR XML download button on PayrollWeekDetailPage (WA projects only)
  - Trade code gate screen blocking export when workers have null waTradeCode
  - PWIA Intent ID modal (collects and persists intentId to project via PATCH)
  - Blob file download for WA CPR XML
  - WAL-04 WA PWIA Submission Guide panel (Intent to Pay + Affidavit of Wages Paid sections)

affects: [Phase 30 complete, WAL-03 frontend, WAL-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WA CPR XML download flow: intentId modal entry -> PATCH persist -> fetch XML -> 422/blob handling"
    - "Trade code gate: 422 response from server shows blocking screen listing workers with edit links"
    - "WAL-04 panel: display-only data-entry reference guide inside isWA conditional on PayrollWeekDetailPage"
    - "Day column ordering in WAL-04 affidavit: Monday-first (Mon-Sun) matching WA XSD Day1=Mon spec"

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/server/routes/export.ts

key-decisions:
  - "intentId modal is entry point before XML fetch — trade code gate handled server-side via 422 response after modal confirm"
  - "WAL-04 panel uses entries data already loaded on the page (no extra fetch) — trade code columns shown as available from classification data"
  - "WA CPR XML flow is separate from existing F700 disclosure modal — separate state variables, separate handlers, no sharing"
  - "PATCH to persist pwiaIntentId fires before fetch XML — intentId is always up to date on project record before generation"

patterns-established:
  - "Blob download pattern: fetch() -> .blob() -> URL.createObjectURL() -> anchor click -> setTimeout revokeObjectURL(100ms)"
  - "useRef guard for download (not useState) — prevents double-click race condition"
  - "Server 422 gate pattern: attempt fetch, handle 422 in catch-all block, show blocking gate screen, return early"

requirements-completed: [WAL-03, WAL-04]

# Metrics
duration: ~30min
completed: 2026-03-27
---

# Phase 30 Plan 03: WA CPR XML Download Flow + WAL-04 Submission Guide Summary

**WA CPR XML gated download flow (trade code gate + PWIA intentId modal + blob download) and WAL-04 PWIA portal data-entry guide panel added to PayrollWeekDetailPage**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-27T10:38:00Z
- **Completed:** 2026-03-27T11:10:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint — approved)
- **Files modified:** 2

## Accomplishments

- `PayrollWeekDetailPage.tsx` gains a "Download WA CPR XML" button (WA projects only) with full gated download flow: intentId modal -> PATCH persist -> XML fetch -> trade code 422 handling -> blob download
- Trade code gate screen renders when server returns 422, listing affected workers with links to the Workers page for classification editing
- WAL-04 "WA PWIA Submission Guide" panel renders below the download buttons for WA projects — showing Intent to Pay (per-classification hours/rates) and Affidavit of Wages Paid (per-worker daily Mon-Sun hours + totals + gross pay) as a data-entry reference for the L&I PWIA portal
- TypeScript TS7006 implicit-any errors in `export.ts` filter/map callbacks fixed via `EntryRow` type alias

## Task Commits

1. **Tasks 1 & 2: WA CPR XML download flow + WAL-04 submission guide panel** - `14f8ba6` (feat)
2. **TypeScript fix: implicit any in filter/map callbacks** - `2ebac15` (fix)

**Plan metadata:** (this commit, docs)

## Files Created/Modified

- `src/client/pages/PayrollWeekDetailPage.tsx` — Added WA CPR XML download button, trade code gate screen, PWIA intentId modal, blob download handlers, and WAL-04 submission summary panel
- `src/server/routes/export.ts` — Fixed TS7006 implicit-any errors in wa-cpr-xml route's filter/map callbacks (Rule 1 auto-fix)

## Decisions Made

- intentId modal is the entry point before the XML fetch; trade code gate fires on the server after modal confirm (422 response), not as a client-side pre-check
- WAL-04 panel data comes from `entries` already loaded on the page — no additional API call needed for hours, rates, and gross pay; trade code info available from classification data on entries
- Existing F700 download flow (`showWaDisclosure`, `handleWaDownloadClick`) kept completely separate with no shared state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed implicit any TypeScript errors in export.ts**
- **Found during:** Post-completion verification (TypeScript check)
- **Issue:** `entries.filter(row => ...)` and `nullTradeEntries.map(row => ...)` in export.ts triggered TS7006 (parameter `row` implicitly has `any` type). Added in Plan 02 work, caught during Plan 03 verification.
- **Fix:** Added `type EntryRow = (typeof entries)[number]` type alias before the filter call and explicitly typed both callback parameters as `row: EntryRow`
- **Files modified:** `src/server/routes/export.ts`
- **Verification:** `./node_modules/.bin/tsc --noEmit` returns 0 errors
- **Committed in:** `2ebac15` (fix)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** TS errors were pre-existing from Plan 02 but caught in Plan 03 TypeScript verification. Fix is minimal and non-behavioral.

## Issues Encountered

- Pre-existing test failures in `.claude/worktrees/` directories (stale agent worktrees with RED stubs for a1131/CAL-02 from Phase 24-03, not yet executed). These are out of scope for Phase 30 and did not regress.
- Main `tests/routes/export.test.ts` passed 15/15 including all 5 WA CPR XML route tests
- Main `tests/services/waCprXmlGenerator.test.ts` passed 9/9

## Known Stubs

None - all plan goals achieved. The XML download is wired to the real route, the intentId persists to the project record, and the WAL-04 panel renders real payroll data from the page's loaded entries.

## Next Phase Readiness

- Phase 30 (wa-pwia-submission-assist) is complete — all 3 plans executed
- WAL-03 and WAL-04 requirements fulfilled end-to-end
- Phase 24-03 (A-1-131 PDF generator + export route) remains as v2.4 deferred work — 6 RED stubs in export.test.ts and a1131.test.ts awaiting implementation

---
*Phase: 30-wa-pwia-submission-assist*
*Completed: 2026-03-27*
