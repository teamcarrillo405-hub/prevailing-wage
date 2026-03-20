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

Progress: [░░░░░░░░░░] 0% (v2.0)

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

### Decisions

- v1.0: Server on port 4099 (moved from 3001 due to port conflicts)
- v1.0: tsx does NOT watch for file changes — server must be manually restarted after edits
- v1.0: Workers table has `address` column added via ALTER TABLE (already in schema.ts)
- v1.0: getCachedWd has statewide (county IS NULL) fallback for resilience
- v1.0: Known pre-existing TS errors in workers.ts (108, 115) — implicit any — non-fatal
- v2.0: Compliance engine must be built before WH-347 UI button is exposed — compliance booleans on Statement of Compliance must be driven by real engine output
- v2.0: Violations computed on-demand from stored snapshots — never compared to live WD rates
- v2.0: Phase 6 BEFORE Phase 7 — J/RA field is a hard dependency for 2025 form AND apprentice ratio check

### Research Flags (address during planning)

- Phase 7: Verify exact column names for daily ST/OT hours in payrollEntries before designing apprentice ratio daily-loop query
- Phase 7: Verify getOrDefaultThreshold() handles missing rows for CWHSSA 40-hour default correctly
- Phase 9: Confirm fringeRateSnapshot exists on payrollEntries — if not, schema addition required in Phase 9

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-19
Stopped at: Roadmap written, ready to plan Phase 6
Resume file: None
