---
phase: 127-procore-oauth-worker-sync
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 127-01 Summary: Procore OAuth + Worker Sync

## What Was Built

- `src/server/integrations/procoreAdapter.ts` — `ProcoreAdapter` implements `IErpAdapter`
  - `pullWorkers()`: fetches `/companies/:id/users?filters[is_employee]=true`, upserts by `erp_external_id='procore'` (dedup by ID, not name)
  - `pullTimesheets()`: HTTP 429 rate-limit backoff via `X-Rate-Limit-Reset` header; Phase 128 scaffold
  - `pushComplianceStatus()`: Phase 129 scaffold
- `src/server/db/migrations/0089_erp_worker_columns.sql` — adds `erp_external_id TEXT` and `erp_source TEXT` to workers table + partial unique index
- `src/server/db/schema.ts` — `erpExternalId`, `erpSource` columns added to workers
- `src/server/integrations/syncOrchestrator.ts` — replaced `dispatchNoop` stub with real `dispatch()` routing to ProcoreAdapter/Sage300Adapter/VistaAdapter by erpType

## Requirements Satisfied

- PRO-01: OAuth connect flow (existing procoreService.ts hardened with randomBytes nonce) ✓
- PRO-02: Worker roster sync with idempotent upsert by erp_external_id ✓
- SEC-03: OAuth nonce uses `crypto.randomBytes(16)` (already in integrations.ts line 526) ✓
