---
phase: 161-quickbooks-writeback
plan: 01
status: complete
completed: 2026-05-28
---

# Phase 161-01 Summary: QuickBooks 2-Way Write-Back (Scaffold + Account Mapping UI)

## What Was Built

- `src/server/db/migrations/0009_qbo_mapping.sql` — creates `qbo_account_mapping` table (project_id, account_type labor|fringe|tax, qbo_account_id, qbo_account_name); the `payrollWeeks.qboJournalEntryId` column was added via Drizzle schema rather than a separate ALTER TABLE statement
- `src/server/services/qboWriteBack.ts` — stub service exposing `writePayrollToQbo()`; returns `QB_NOT_CONFIGURED` when `QB_CLIENT_ID` env var is absent, `QB_OAUTH_REQUIRED` otherwise; full OAuth deferred
- `src/server/routes/qbo.ts` — `POST /api/qbo/certify/:projectId/:weekId` endpoint; returns 501 when QB not configured, otherwise marks `qboJournalEntryId = 'PENDING'` and delegates to the write-back service
- `src/client/pages/SettingsPage.tsx` — "QuickBooks Integration" card added with "Not Connected" badge, env-var setup instructions, and disabled Labor/Fringe/Tax account ID inputs (account mapping UI scaffold)

## Requirements Satisfied

- QB-01: `qbo_account_mapping` table and Drizzle schema for GL account mapping ✓
- QB-02: `POST /api/qbo/certify` endpoint with 501 guard and PENDING journal entry marker ✓
- QB-03: Settings page QuickBooks Integration section with connection status and account mapping scaffold ✓
