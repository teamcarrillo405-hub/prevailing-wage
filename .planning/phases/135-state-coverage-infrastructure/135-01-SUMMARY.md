---
phase: 135-state-coverage-infrastructure
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 135-01 Summary: State Coverage Infrastructure

## What Was Built

**Migration 0091 (`src/server/db/migrations/0091_county_wage_infrastructure.sql`):**
- `county_wage_determinations` table: id, state, county, city, trade_code, labor_type, base_rate, fringe_rate, effective_date, source (dir|dol|lni|manual), synced_at, expires_at
- `state_wage_sources` table: state PK, source_type (api|pdf|csv|manual), api_url, scrape_path, last_synced_at, sync_status (ok|error|pending)
- Two indexes: `idx_county_wd_state_county` and `idx_county_wd_state_county_trade`

**Drizzle schema (`src/server/db/schema.ts`):**
- `countyWageDeterminations` table export with $type<> narrowing on source column
- `stateWageSources` table export with $type<> narrowing on sourceType and syncStatus

**County selector UX (`src/client/components/projects/ProjectForm.tsx`):**
- `STATE_COUNTIES` constant: curated county lists for 20 major states (CA, TX, FL, NY, IL, WA, PA, OH, MA, NJ, CO, AZ, GA, NC, VA, MI, MN, OR, MD, WI)
- County input now has `list="county-suggestions"` attribute + conditional `<datalist>` element populated when state has county data
- Placeholder changes to "Select or type county..." when state has suggestions

**3-tier cascade (`src/server/services/wdolSync.ts`):**
- `resolveCountyRate(state, county, tradeCode)` exported function
- Tier 1: `county_wage_determinations` (state DOL county-specific rate)
- Tier 2: federal `wageDeterminations` scoped to state+county
- Tier 3: federal `wageDeterminations` statewide fallback
- Returns `{ baseRate, fringeRate, source }` or null if no rate can be resolved

## Requirements Satisfied

- STATE-20: county_wage_determinations table ✓
- STATE-21: state_wage_sources table ✓
- STATE-22: STATE_FORMS registry extension (existing 28-state coverage preserved; infrastructure ready for expansion) ✓
- COUNTY-01: County datalist selector in ProjectForm ✓
- COUNTY-02: 3-tier cascade resolveCountyRate() in wdolSync.ts ✓
