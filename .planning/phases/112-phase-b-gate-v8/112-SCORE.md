# Phase B Watchdog Gate — v8.0 SAML SSO

**Date:** 2026-04-27
**Required:** >= 9.1/10
**Result:** GATE_PASS

## Criteria

| ID | Requirement | Check | Result | Score |
|----|-------------|-------|--------|-------|
| C1 | ENT-03: sso_configs table in schema.ts | grep ssoConfigs schema.ts → 1 | Y | 1.67 |
| C2 | ENT-03: GET /api/sso/metadata route | grep '/metadata' sso.ts → 1 | Y | 1.67 |
| C3 | ENT-04: POST /api/sso/acs route | grep '/acs' sso.ts → 1 | Y | 1.67 |
| C4 | ENT-04: Replay protection (seenAssertionIds) | grep seenAssertionIds sso.ts → 5 | Y | 1.67 |
| C5 | ENT-05: SsoConfigPage.tsx exists | file check → PASS | Y | 1.67 |
| C6 | Full test suite green | 824 passed, 0 failed | Y | 1.67 |

**Total: 10.02/10**

## Evidence

- C1: `grep -c "ssoConfigs" src/server/db/schema.ts` → 1
- C2: `grep -c "'/metadata'" src/server/routes/sso.ts` → 1
- C3: `grep -c "'/acs'" src/server/routes/sso.ts` → 1
- C4: `grep -c "seenAssertionIds" src/server/routes/sso.ts` → 5 (declaration + reads/writes)
- C5: `test -f src/client/pages/SsoConfigPage.tsx` → PASS
- C6: `npx vitest run` → 67 files passed, 824 tests passed, 0 failed

## Manual Verify Note

Live Okta end-to-end test requires an Okta developer account. The SP metadata URL must be imported
into the Okta admin panel and a test user must successfully log in via SSO. This manual step is
performed by the developer before closing Phase B.

## Declaration

**GATE_PASS** — Phase C (production hardening) may begin.
