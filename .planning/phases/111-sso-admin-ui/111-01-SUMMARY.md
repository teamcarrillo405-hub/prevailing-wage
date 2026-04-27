---
phase: 111-sso-admin-ui
plan: "01"
subsystem: client/sso
tags: [sso, enterprise, ui, form, react]
dependency_graph:
  requires: [110-02 ssoRouter, /api/sso/admin/config, /api/billing/status]
  provides: [SsoConfigPage at /settings/sso]
  affects: [src/client/App.tsx]
tech_stack:
  added: []
  patterns: [react-hook-form, zod, useQuery for planTier, enterprise gate]
key_files:
  created: [src/client/pages/SsoConfigPage.tsx]
  modified: [src/client/App.tsx]
decisions:
  - "Fetch planTier from /api/billing/status (User type lacks planTier — only id/email)"
  - "Non-enterprise shows upgrade CTA; form renders for enterprise users"
  - "SP metadata section shown after successful save"
metrics:
  duration: "8 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  files_changed: 2
---

# Phase 111 Plan 01: SsoConfigPage with EntityId/SsoUrl/Cert Form Summary

One-liner: Enterprise-gated SAML SSO admin form page with zod validation, 5 fields, and SP metadata display.

## What Was Built

- SsoConfigPage.tsx at src/client/pages/ — enterprise gate + 5-field form + SP metadata display
- Form fields: provider (select: Okta/Azure AD/Google Workspace/Generic SAML), domain, idpEntityId, idpSsoUrl, idpCertificate (textarea with monospace)
- Zod validation: domain dot check, URL validation for entity/SSO URLs, cert BEGIN CERTIFICATE check
- Success banner shows "pending" status; SP metadata URL displayed as copyable code block
- Non-enterprise users see "Enterprise Plan Required" card with /pricing link
- /settings/sso route added to App.tsx protected route block

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] User type lacks planTier field**
- **Found during:** Task 1 TS check
- **Issue:** AuthContext User interface only has `{ id, email }` — no planTier
- **Fix:** Fetch planTier from `/api/billing/status` via useQuery (same pattern as BillingPage)
- **Files modified:** src/client/pages/SsoConfigPage.tsx

## Self-Check: PASSED

- src/client/pages/SsoConfigPage.tsx: FOUND
- /settings/sso route in App.tsx: FOUND
- 0 TS errors; 824 tests pass
