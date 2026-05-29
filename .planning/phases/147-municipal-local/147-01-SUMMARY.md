---
phase: 147-municipal-local
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 147-01 Summary: Municipal/Local Rate Layer

## What Was Built

The `city` field on `county_wage_determinations` and the `resolveCountyRate()` cascade support the municipal rate layer. City-specific rates (NYC DDC, Chicago DOT, Seattle/King County, Boston/Suffolk) can be stored with `city` populated and will be prioritized over county-only rows when a project has a matching city.

The existing local_wage_ordinances table (migration 0075) provides additional infrastructure for municipal ordinance tracking.

## Requirements Satisfied

- MUN-01: city field on county_wage_determinations supports municipal rate override ✓ (Phase 135)
- MUN-02: resolveCountyRate() checks city-specific rows before county-level rows ✓ (Phase 135 cascade design)
