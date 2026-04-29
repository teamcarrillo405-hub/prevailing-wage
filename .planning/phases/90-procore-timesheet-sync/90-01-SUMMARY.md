---
phase: 90-procore-timesheet-sync
plan: "01"
subsystem: integrations
tags: [procore, oauth2, db-migration, service-layer]
dependency_graph:
  requires: []
  provides: [procoreTokens-schema, procoreService, procore-oauth-routes]
  affects: [integrations.ts, schema.ts]
tech_stack:
  added: [procoreService.ts]
  patterns: [AES-256-GCM token encryption, upsert pattern, OAuth2 state-param flow]
key_files:
  created:
    - src/server/services/procoreService.ts
    - src/server/db/migrations/0056_procore_connections.sql
    - tests/procoreService.test.ts
  modified:
    - src/server/db/schema.ts
    - src/server/db/migrations/meta/_journal.json
    - src/server/routes/integrations.ts
decisions:
  - "Migration numbered 0056 (not 0055 as plan specified) — last existing migration was 0055_wd_revision_log"
  - "Journal idx=56 matches 0056 filename — idx was 55 before this plan"
  - "getDecryptedProcoreTokens added as 5th export alongside plan's 4 — needed by Plan 02 timesheet fetch"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-27"
  tasks_completed: 3
  files_changed: 6
---

# Phase 90 Plan 01: Procore OAuth2 Service + DB Migration + Routes Summary

One-liner: Procore OAuth2 connect/callback/status/disconnect infrastructure with AES-256-GCM token encryption mirroring qboService.ts pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | procoreTokens schema + 0056 migration | 3adfbbd | schema.ts, 0056_procore_connections.sql, _journal.json |
| 2 | procoreService.ts + tests | 3adfbbd | procoreService.ts, tests/procoreService.test.ts |
| 3 | Four Procore routes on integrationsRouter | 3adfbbd | integrations.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration numbered 0056 instead of 0055**
- **Found during:** Task 1
- **Issue:** Plan specified migration as `0055_procore_connections.sql` and journal idx=55, but the project already had `0055_wd_revision_log.sql` (idx=55). Using 0055 would conflict.
- **Fix:** Used `0056_procore_connections.sql` with journal idx=56 per the critical migration note in the execution prompt.
- **Files modified:** src/server/db/migrations/0056_procore_connections.sql, _journal.json
- **Commit:** 3adfbbd

## Verification Results

- procoreTokens exported from schema.ts with 9 columns, userId FK cascade, idx on userId
- 0056_procore_connections.sql creates table + index with `--> statement-breakpoint`
- _journal.json has idx=56 entry for 0056_procore_connections
- procoreService.ts exports 5 functions (getProcoreConnection, saveProcoreTokens, deleteProcoreTokens, getDecryptedProcoreTokens, getValidProcoreToken)
- Four routes present: GET /procore/status, GET /procore/connect, GET /procore/callback, DELETE /procore
- npx tsc --noEmit: 0 new errors (pre-existing stripeService.ts Stripe API version error only)
- npx vitest run: 775 passed, 0 failed (11 new procoreService tests)

## Self-Check: PASSED
