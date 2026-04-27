---
phase: 110-saml-sso-routes
plan: "01"
subsystem: server/sso
tags: [saml, sso, enterprise, auth]
dependency_graph:
  requires: [schema.ts ssoConfigs table]
  provides: [GET /api/sso/metadata, POST /api/sso/admin/config, GET /api/sso/config]
  affects: [src/server/index.ts]
tech_stack:
  added: ["@node-saml/node-saml"]
  patterns: [SAML class API, express Router, drizzle upsert]
key_files:
  created: [src/server/routes/sso.ts]
  modified: [src/server/index.ts, package.json, package-lock.json]
decisions:
  - "Used SAML class directly (not ServiceProvider/IdentityProvider — those don't exist in @node-saml/node-saml v5)"
  - "Combined 110-01 and 110-02 routes into single file creation for API consistency"
  - "Added CSRF skip for /api/sso/acs (external IdP POST binding)"
metrics:
  duration: "12 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  files_changed: 4
---

# Phase 110 Plan 01: SAML SSO Metadata + Admin Config Routes Summary

One-liner: SAML SP metadata XML endpoint + enterprise IdP config upsert using @node-saml/node-saml v5 SAML class.

## What Was Built

- Installed `@node-saml/node-saml` (v5) with `--legacy-peer-deps`
- Created `src/server/routes/sso.ts` with ssoRouter exported
- `GET /api/sso/metadata`: returns SP metadata XML with entityID, ACS location, NameIDFormat emailAddress; includes KeyDescriptor if SSO_SP_CERT env set
- `POST /api/sso/admin/config`: enterprise-only (planTier check) upsert of IdP metadata into sso_configs table
- `GET /api/sso/config`: auth-required endpoint returning current user's SSO status (no certificate fields returned)
- Wired ssoRouter into index.ts before errorHandler; added CSRF skip for /api/sso/acs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @node-saml/node-saml v5 does not export ServiceProvider/IdentityProvider**
- **Found during:** Task 2 TS check
- **Issue:** Plan specified `new ServiceProvider(...)` and `new IdentityProvider(...)` but the library only exports `SAML` class, `SamlStatusError`, `ValidateInResponseTo`, and `generateServiceProviderMetadata`
- **Fix:** Used `SAML` class with `getAuthorizeUrlAsync` and `validatePostResponseAsync`; imported `ValidateInResponseTo` enum for type-correct config
- **Files modified:** src/server/routes/sso.ts
- **Commit:** 6dca198

**2. [Rule 2 - Auto-add] Included 110-02 routes (login + ACS) in 110-01 file**
- **Found during:** Task 2 — routes are tightly coupled; writing them separately would require two partial files
- **Fix:** Wrote all 5 routes in one file creation for API consistency and type correctness

## Self-Check: PASSED

- src/server/routes/sso.ts exists: FOUND
- ssoRouter mounted in index.ts: FOUND
- @node-saml/node-saml in package.json: FOUND
- All 824 tests pass
- 0 TS errors
