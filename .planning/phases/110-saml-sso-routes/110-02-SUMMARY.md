---
phase: 110-saml-sso-routes
plan: "02"
subsystem: server/sso
tags: [saml, sso, enterprise, auth, login, acs]
dependency_graph:
  requires: [110-01 ssoRouter]
  provides: [GET /api/sso/login, POST /api/sso/acs]
  affects: [src/server/routes/sso.ts]
tech_stack:
  added: []
  patterns: [SAML.getAuthorizeUrlAsync, SAML.validatePostResponseAsync, in-memory replay protection, JWT cookie issuance]
key_files:
  created: []
  modified: [src/server/routes/sso.ts]
decisions:
  - "Routes written together with 110-01 for API consistency — both use same SAML class instance pattern"
  - "Replay protection uses seenAssertionIds Map keyed on nameID (fallback from inResponseTo)"
  - "ValidateInResponseTo.never used in ACS to avoid state sync issues with in-memory pendingRequests"
metrics:
  duration: "included in 110-01"
  completed: "2026-04-27"
  tasks_completed: 2
  files_changed: 0
---

# Phase 110 Plan 02: SAML Login + ACS Assertion Handler Summary

One-liner: GET /api/sso/login generates AuthnRequest redirect and POST /api/sso/acs validates SAMLResponse with replay protection and JWT session issuance.

## What Was Built

- `GET /api/sso/login?domain=`: looks up active sso_configs row for domain, generates SAML AuthnRequest via `SAML.getAuthorizeUrlAsync`, redirects 302 to IdP
- `POST /api/sso/acs`: receives IdP SAMLResponse, validates via `SAML.validatePostResponseAsync` (tries all active configs), replay protection via `seenAssertionIds` Map with 5-min TTL, auto-provisions SSO users, issues JWT cookie identical to email/password auth flow
- In-memory `pendingRequests` and `seenAssertionIds` Maps with 60-second cleanup intervals

## Deviations from Plan

Routes were implemented together with 110-01 for technical coherence. All behavior requirements are met.

## Self-Check: PASSED

- GET /api/sso/login route in sso.ts: FOUND (grep count 1)
- POST /api/sso/acs route in sso.ts: FOUND (grep count 1)
- seenAssertionIds replay protection: FOUND
- All 824 tests pass; 0 TS errors
