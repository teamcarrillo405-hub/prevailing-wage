---
phase: 126-integration-foundation
plan: 04
status: complete
completed: 2026-05-28
---

# Phase 126-04 Summary: FileErpCard — IntegrationsPage UI

## What Was Built

Added `FileErpCard` local component to `IntegrationsPage.tsx` (line 128) and instantiated it twice — Sage 300 CRE (line 1280) and Viewpoint Vista (line 1285) — after the existing Procore card and before the security footnote.

**FileErpCard features:**
- Amber `variant="warning"` Badge labeled "File Exchange" (top-right)
- Persistent italic notice: "No live connection — place export files in the configured import directory."
- Inline Import directory + Export directory Input fields
- Save Paths button: disabled when paths match persisted values; shows "Saving..." / "Saved." inline for 2s
- Last sync timestamp (relative: minutes/hours/days) + optional Sync Error Badge with `title` hover
- Import Now button: disabled when importDir empty or sync in-flight; fires `toast.success`/`toast.error` on result

**API wiring:**
- `GET /api/erp-integrations` on mount — filters by `erpType` to seed initial state
- `POST /api/erp-integrations/${erpType}/config` — saves import/export directory paths
- `POST /api/erp-integrations/${erpType}/sync` — triggers manual sync; toast on success/error

**Security footnote extended** to: "QuickBooks, Procore, Sage 300 CRE, and Viewpoint Vista credentials are stored encrypted with AES-256-GCM and never appear in plaintext."

## Test Results

8/8 source-grep tests pass (`tests/client/IntegrationsPage.fileerp.test.tsx`)

## Verification

- `function FileErpCard` defined once inline in IntegrationsPage.tsx — no separate file created
- Human visual checkpoint: auto-approved (user authorized autonomous execution)

## Requirements Satisfied

- INTG-01: IntegrationsPage renders Procore + Sage 300 CRE + Viewpoint Vista cards ✓
