# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** GC can run a full project end-to-end — create → workers → payroll → WH-347 → submit — no missing steps.
**Current focus:** Defining v2.0 requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-19 — Milestone v2.0 started

## Accumulated Context

- Server runs on port 4099 (moved from 3001 due to port conflicts)
- tsx does NOT watch for file changes — server must be manually restarted after code edits
- Workers table has `address` column added via ALTER TABLE (already in schema.ts)
- getCachedWd now has statewide (county IS NULL) fallback for resilience
- Known pre-existing TS errors in workers.ts (108, 115) — implicit any — non-fatal
- WH-347 PDF generation exists (fillWh347 in Phase 4-02) but has no UI entry point
- Dashboard currently shows only project list with no compliance status
- Workers page: edit/delete added in latest session, address field added
