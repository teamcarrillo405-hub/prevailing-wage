---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Contractor UX Overhaul + Compliance
status: planning
stopped_at: Completed 07-04-PLAN.md — Phase 7 fully complete
last_updated: "2026-03-20T10:12:40.227Z"
last_activity: 2026-03-19 — v2.0 roadmap created, phases 6-9 defined
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
  percent: 50
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — no missing steps.
**Current focus:** Phase 6 — WH-347 2025 Compliance Foundation

## Current Position

Phase: 6 of 9 (WH-347 2025 Compliance Foundation)
Plan: — of — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-19 — v2.0 roadmap created, phases 6-9 defined

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v2.0)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context
| Phase 06 P01 | 7 | 2 tasks | 2 files |
| Phase 06 P02 | 5m | 3 tasks | 6 files |
| Phase 06 P03 | 3 | 1 tasks | 1 files |
| Phase 06 P04 | 5m | 2 tasks | 3 files |
| Phase 06 P04 | 10min | 3 tasks | 3 files |
| Phase 07 P01 | 2m | 2 tasks | 2 files |
| Phase 07 P02 | 8m | 2 tasks | 3 files |
| Phase 07 P03 | 4 | 1 tasks | 1 files |
| Phase 07 P04 | 3min | 2 tasks | 3 files |
| Phase 07 P04 | 3min | 3 tasks | 3 files |

### Decisions

- v1.0: Server on port 4099 (moved from 3001 due to port conflicts)
- v1.0: tsx does NOT watch for file changes — server must be manually restarted after edits
- v1.0: Workers table has `address` column added via ALTER TABLE (already in schema.ts)
- v1.0: getCachedWd has statewide (county IS NULL) fallback for resilience
- v1.0: Known pre-existing TS errors in workers.ts (108, 115) — implicit any — non-fatal
- v2.0: Compliance engine must be built before WH-347 UI button is exposed — compliance booleans on Statement of Compliance must be driven by real engine output
- v2.0: Violations computed on-demand from stored snapshots — never compared to live WD rates
- v2.0: Phase 6 BEFORE Phase 7 — J/RA field is a hard dependency for 2025 form AND apprentice ratio check
- [Phase 06]: Stubs must use actual assertions (not .todo) so they run and fail on missing fields
- [Phase 06]: certApprentices contract test is green by design — documents API accepts false, not a failing stub
- [Phase 06]: Migration journal must be updated manually when adding SQL-only migrations outside Drizzle generate workflow
- [Phase 06]: programName is optional on all laborTypes in route — server does not restrict it to apprentices
- [Phase 06]: Copy additional template pages before fillng any content in fillWh347() — pdf-lib copyPages() snapshots current state so pages must be blank when copied
- [Phase 06]: addPage() used (not insertPage()) in multi-page WH-347 — appending worker/statement pairs gives correct DOL page ordering automatically
- [Phase 06]: deriveAllApprenticesRegistered() exported from export.ts for testability without route mocking
- [Phase 06]: programName only included in POST payload when non-empty; server accepts null per Plan 02
- [Phase 06]: deriveAllApprenticesRegistered() exported from export.ts for testability without route mocking
- [Phase 06]: programName only included in POST payload when non-empty; server accepts null per Plan 02
- [Phase 07]: Test stubs import from complianceService.ts (not yet created) — import error is the intentional TDD RED state
- [Phase 07]: CWHSSA fringe NOT multiplied for OT: expected = totalHours*base + otHours*0.5*base + totalHours*fringe
- [Phase 07]: cwhssa-ot fires when totalOt > 0 AND |delta| > 0.01 (before under-wage check); under-wage fires only for straight-time underpayment
- [Phase 07]: POST /api/payroll/entries added as convenience endpoint mirroring PUT — required by compliance test seeders
- [Phase 07]: WH-347 download is a plain <a href> anchor — browser handles Content-Disposition attachment natively
- [Phase 07]: computeCompliance() called independently in export.ts route — entries fetched twice is acceptable for Phase 7; performance optimization deferred to v2.1
- [Phase 07]: certProperPayment/certAccuratePayroll use ?? true fallback when computeCompliance returns null — no entries means no violations detected = compliant
- [Phase 07]: Browser verification (Task 3) approved — all 6 end-to-end tests confirmed passing in browser

### Research Flags (address during planning)

- Phase 7: Verify exact column names for daily ST/OT hours in payrollEntries before designing apprentice ratio daily-loop query
- Phase 7: Verify getOrDefaultThreshold() handles missing rows for CWHSSA 40-hour default correctly
- Phase 9: Confirm fringeRateSnapshot exists on payrollEntries — if not, schema addition required in Phase 9

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-20T10:08:02.156Z
Stopped at: Completed 07-04-PLAN.md — Phase 7 fully complete
Resume file: None
