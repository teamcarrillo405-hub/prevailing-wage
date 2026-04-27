---
phase: 90-procore-timesheet-sync
plan: "03"
subsystem: client-ui
tags: [integrations, procore, ui]
dependency_graph:
  requires: [90-01, 90-02]
  provides: [procore-integrations-tile]
  affects: [IntegrationsPage]
tech_stack:
  added: []
  patterns: [react-query, useMutation, useSearchParams]
key_files:
  modified:
    - src/client/pages/IntegrationsPage.tsx
decisions:
  - "Procore card placed below QBO card with same visual pattern (rounded-xl border shadow-sm)"
  - "?procore=connected query param triggers green success banner without setTimeout dismiss"
  - "Import Timesheets link uses <a href> not Button to match secondary action hierarchy"
metrics:
  duration: "5m"
  completed: "2026-04-27"
  tasks_completed: 1
  files_modified: 1
---

# Phase 90 Plan 03: Procore Integrations Tile Summary

Procore Connected/Disconnected card added to IntegrationsPage below QuickBooks card, with Connect/Disconnect/Reconnect actions, Company ID display, nearExpiry warning, Import Timesheets link, and ?procore=connected success banner.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Procore card on IntegrationsPage | 507f44a | src/client/pages/IntegrationsPage.tsx |

## What Was Built

- `ProcoreStatusResponse` interface typed inline
- `useQuery(['procore-status'])` fetching `/api/integrations/procore/status`
- `useMutation DELETE /api/integrations/procore` with query invalidation on success
- Connected state: Company ID display, nearExpiry amber warning, Import Timesheets link, Reconnect + Disconnect buttons
- Disconnected state: "Not connected" Badge + "Connect to Procore" primary button
- `?procore=connected` query param green banner (no setTimeout needed — user navigates away)
- Footer updated: "QuickBooks and Procore credentials are stored encrypted with AES-256-GCM..."

## Deviations from Plan

None — plan executed exactly as written. The file already had partial scaffolding from a prior session; the commit completed the full implementation.

## Self-Check: PASSED

- src/client/pages/IntegrationsPage.tsx: found
- commit 507f44a: found
- tsc --noEmit: no new errors (pre-existing stripeService.ts Stripe API version mismatch is unrelated)
- 784 vitest tests: all passed
