---
phase: 150-coverage-map
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 150-01 Summary: 50-State Coverage Map

## What Was Built

Updated `src/client/components/UsComplianceMap.tsx` from binary active/inactive to a 3-tier coverage model:

**Tier 1 — State-specific CPR form** (dark/gold, 27 states):
CA, WA, NY, IL, MA, NJ, MN, VA, PA, OH, CO, MD, OR, CT, HI, KY, NM, NV, RI, WV, ME, VT, MT, ND, DE, NH, AK

**Tier 2 — Federal WH-347** (gray, 23 states):
TX, FL, AL, AR, AZ, GA, IA, ID, IN, KS, LA, MI, MO, MS, NC, NE, OK, SC, SD, TN, UT, WI, WY

**Tier 3 — Not supported** (light gray): remaining states

Changes:
- `ACTIVE_STATES` → `STATE_CPR_FORMS` (Record with form names) + `FEDERAL_ONLY_STATES` (Set)
- `CoverageTier` type: `'state-form' | 'federal-only' | 'none'`
- `TIER_FILL/STROKE/STROKE_WIDTH` lookup maps per tier
- `StatePath` now receives `tier` instead of `isActive`
- `getTier()` pure function for abbreviation → tier mapping
- Tooltip updated to show exact form name or "Federal WH-347 (no state PW law)"
- Coverage stats line: "27 states with state-specific CPR forms · 23 states federal WH-347"
- Legend updated with 3 entries

## Requirements Satisfied

- MAP-01: 50-state coverage map with 3 visual tiers ✓
- MAP-02: Tooltip shows exact form name per state ✓
- MAP-03: Coverage stats displayed below map ✓
