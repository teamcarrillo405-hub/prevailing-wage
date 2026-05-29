---
phase: 134-integration-dashboard
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 134-01 Summary: Integration Dashboard

## What Was Built

**Server routes added to `src/server/routes/erpIntegrations.ts`:**
- `GET /api/erp-integrations/history` — sync run history from `integration_sync_runs` table, ordered by `startedAt DESC`, paginated (limit param, max 200)
- `GET /api/erp-integrations/failure-alert` — returns connections with `consecutiveFailureCount >= 2` for dashboard banner

**Client changes:**
- `src/client/pages/IntegrationsPage.tsx` — added sync history table showing last 20 runs (ERP type, started time, records synced, error count, trigger, status) with 30s auto-refresh
- `src/client/pages/DashboardPage.tsx` — added ERP failure alert banner: appears when any ERP has 2+ consecutive failures; names the failing ERP(s); links to /integrations; uses red border/bg for severity distinction from amber MFA banner

## Requirements Satisfied

- DASH-01: Sync history table on IntegrationsPage ✓
- DASH-02: Failure alert banner on DashboardPage when consecutiveFailureCount >= 2 ✓
- DASH-03: Links to Integration Dashboard from banner ✓
- DASH-04: Field mapping UI (existing FileErpCard save-paths flow) ✓
