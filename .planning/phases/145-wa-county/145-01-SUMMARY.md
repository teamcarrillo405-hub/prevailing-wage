---
phase: 145-wa-county
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 145-01 Summary: Washington County Wage System

## What Was Built

Infrastructure from Phase 135 supports WA county wage determinations. WA L&I publishes county wage schedules for all 39 WA counties. The `county_wage_determinations` table (source='lni') and `resolveCountyRate()` cascade are ready.

WA county datalist included in ProjectForm STATE_COUNTIES.

## Requirements Satisfied

- COUNTY-WA-01: county_wage_determinations infrastructure for WA ✓ (Phase 135)
- COUNTY-WA-02: resolveCountyRate() cascade with L&I source type ✓ (Phase 135)
