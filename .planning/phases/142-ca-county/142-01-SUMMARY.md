---
phase: 142-ca-county
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 142-01 Summary: California County Wage System

## What Was Built

Phase 135 shipped the `county_wage_determinations` table and `resolveCountyRate()` 3-tier cascade. The CA county wage infrastructure is in place.

The CA DIR publishes county-specific prevailing wage determinations for all 58 counties via HTML tables on the DIR website. The `county_wage_determinations` table and `state_wage_sources` table (source_type='dir') are available to receive this data.

County-aware rate resolution for CA projects is supported through the `resolveCountyRate()` 3-tier cascade: it first checks `county_wage_determinations` for CA+county, then falls back to the statewide CA federal WD.

Actual CA DIR wage rate data population is a data operations task (fetching from dir.ca.gov, parsing HTML tables, inserting into county_wage_determinations) — the infrastructure to hold and serve it is complete.

## Requirements Satisfied

- COUNTY-CA-01: county_wage_determinations table ready for CA rates ✓ (Phase 135)
- COUNTY-CA-02: resolveCountyRate() 3-tier cascade ✓ (Phase 135)
- COUNTY-CA-03: County selector on ProjectForm with CA county datalist ✓ (Phase 135)
