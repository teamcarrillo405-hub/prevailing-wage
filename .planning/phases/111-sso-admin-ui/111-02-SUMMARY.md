---
phase: 111-sso-admin-ui
plan: "02"
subsystem: client/integrations
tags: [sso, enterprise, integrations, status, badge]
dependency_graph:
  requires: [GET /api/sso/config, SsoConfigPage at /settings/sso]
  provides: [IntegrationsPage SSO status card]
  affects: [src/client/pages/IntegrationsPage.tsx]
tech_stack:
  added: []
  patterns: [useQuery, Badge variant, Link from react-router-dom]
key_files:
  created: []
  modified: [src/client/pages/IntegrationsPage.tsx, src/server/routes/sso.ts]
decisions:
  - "GET /api/sso/config was already present from 110-01 — no server change needed"
  - "Replaced static Okta/Azure card grid with live-data SSO card reading from /api/sso/config"
  - "ssoData query uses .catch(() => ({ data: null })) to handle 404/401 gracefully"
metrics:
  duration: "6 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  files_changed: 1
---

# Phase 111 Plan 02: GET /api/sso/config + IntegrationsPage SSO Status Summary

One-liner: IntegrationsPage Enterprise section shows live SSO config status badge and link to SsoConfigPage.

## What Was Built

- GET /api/sso/config already existed in sso.ts (from 110-01) — returns provider/domain/status sans cert
- Added SsoConfigStatus interface to IntegrationsPage
- Added ssoData useQuery fetching /sso/config with graceful 404 fallback
- Replaced static Okta/Azure grid with dynamic SSO card: Badge (Active/Pending/Not Configured) + Link to /settings/sso
- Added Link import from react-router-dom

## Self-Check: PASSED

- IntegrationsPage imports Link: FOUND
- SsoConfigStatus interface: FOUND
- SSO section with Badge + Link to /settings/sso: FOUND
- 0 TS errors; 824 tests pass
