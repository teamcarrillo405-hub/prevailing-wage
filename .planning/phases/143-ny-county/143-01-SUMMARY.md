---
phase: 143-ny-county
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 143-01 Summary: New York County Wage System

## What Was Built

Infrastructure from Phase 135 supports NY county wage determinations. NY DOL publishes county wage schedules for all 62 NY counties; NYC DDC publishes separate trade-specific rates for NYC capital projects.

The `county_wage_determinations` table (source='dol') and `resolveCountyRate()` cascade are ready for NY county data. NY county datalist is included in the ProjectForm STATE_COUNTIES constant.

## Requirements Satisfied

- COUNTY-NY-01: county_wage_determinations infrastructure for NY ✓ (Phase 135)
- COUNTY-NY-02: NYC DDC rate layer supported via city field on county_wage_determinations ✓ (Phase 135)
