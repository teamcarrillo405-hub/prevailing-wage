---
phase: 123-soc2-foundation-mfa
plan: "01"
subsystem: security-mfa
tags: [soc2, mfa, totp, qrcode, sec-01, owner-operations]
dependency_graph:
  requires: []
  provides: [qrDataUrl-in-setup, totp-gate-transfer-ownership, totp-gate-invite-revoke, mfa-nag-banner, mfa-vitest-suite]
  affects: [src/server/services/mfaService.ts, src/server/routes/mfa.ts, src/server/routes/team.ts, src/client/pages/MfaSetupPage.tsx, src/client/pages/DashboardPage.tsx, src/client/pages/ProjectSettingsPage.tsx]
tech_stack:
  added: [qrcode@1.5.4, "@types/qrcode@1.5.6"]
  patterns: [dynamic-import-for-circular-dep-avoidance, async-generateTotpSecret, mid-enrollment-block-guard]
key_files:
  created:
    - tests/services/mfaService.test.ts
    - tests/routes/mfa.test.ts
  modified:
    - src/server/services/mfaService.ts
    - src/server/routes/mfa.ts
    - src/server/routes/team.ts
    - src/client/pages/MfaSetupPage.tsx
    - src/client/pages/DashboardPage.tsx
    - src/client/pages/ProjectSettingsPage.tsx
    - package.json
    - package-lock.json
decisions:
  - "qrcode installed with --legacy-peer-deps per Phase 83 vite8/vite-plugin-pwa peer conflict pattern"
  - "generateTotpSecret converted from sync to async (awaits QRCode.toDataURL); only caller is mfa.ts POST /setup"
  - "Mid-enrollment re-setup blocked by totpSecret guard (Rule 1 fix) — existing totpEnabled guard only caught full enrollment"
  - "Dynamic import for verifyTotpToken in team.ts per Phase 38 decision (circular dependency avoidance)"
  - "DashboardPage: isOwner sourced from existing GET /api/team (isOwner field); no new endpoint added"
  - "bannerDismissed is in-memory only (no localStorage) — banner reappears on refresh, correct for SOC 2 nag"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-04-30"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 8
  tests_added: 14
  tests_total: 914
---

# Phase 123 Plan 01: SOC 2 MFA Foundation — SEC-01 Gap Closure Summary

**One-liner:** Scannable QR PNG enrollment + TOTP gate on owner operations + MFA nag banner + 14 Vitest tests proving SEC-01 contract intact.

## What Was Built

### Task 1: qrcode package + async generateTotpSecret + mfaService test suite

- `qrcode@1.5.4` installed (with `--legacy-peer-deps` per Phase 83 pattern)
- `GeneratedTotp` interface extended with `qrDataUrl: string` field
- `generateTotpSecret` converted from synchronous to `async function`, awaiting `QRCode.toDataURL(qrUri, { width: 200, margin: 1 })`
- `POST /api/mfa/setup` route: changed to `await generateTotpSecret(email)` and added `qrDataUrl` to response data block
- `tests/services/mfaService.test.ts`: 6 tests covering generateTotpSecret (qrDataUrl shape, secret/qrUri shape), verifyTotpToken (happy path with OTPAuth.TOTP.generate(), sad paths), generateBackupCodes (5-code test), consumeBackupCode (one-time use)

### Task 2: TOTP gates + QR image rendering + login MFA gate regression test

- `team.ts POST /:projectId/transfer-ownership`: `totpToken` added to `TransferOwnershipSchema` (optional); TOTP gate inserted after password verification using dynamic import of `verifyTotpToken`
- `team.ts DELETE /invite`: TOTP gate using `req.body.totpToken` after `isOwner` check; same dynamic import pattern
- `mfa.ts POST /setup`: added mid-enrollment guard — returns 409 when `user.totpSecret` is already set (even with `totpEnabled=false`); prevents re-setup during in-progress enrollment
- `MfaSetupPage.tsx`: `SetupResponse.data` type extended with `qrDataUrl`; otpauth:// clickable link replaced with `<img src={setup.qrDataUrl}>` for scannable QR
- `ProjectSettingsPage.tsx`: `mfa-status` useQuery added to `TransferOwnershipSection`; `totpToken` state + conditional `<input>` field rendered when `mfaEnabled`; `totpToken` passed in POST body
- `tests/routes/mfa.test.ts`: 8 tests:
  - Test 1: unauthenticated 401
  - Test 2: authenticated 200 with qrDataUrl + 409 on second call
  - Test 3: verify-setup with correct TOTP returns 200, DB totpEnabled=true
  - Test 4: verify-setup with 000000 returns 400 error message
  - Test 5: transfer-ownership with MFA owner and no totpToken → 401
  - Test 6: transfer-ownership with valid totpToken → 200
  - Test 7: DELETE /invite with MFA owner and no totpToken → 401
  - Test 8: POST /api/auth/login with enrolled user → requiresMfa:true, userId echoed, no pw_session cookie

### Task 3: DashboardPage owner MFA nag banner

- `ShieldAlert` imported from lucide-react
- `mfa-status` useQuery (staleTime 60s) for enrollment status
- `team` useQuery (staleTime 60s) for `isOwner` flag (reuses existing endpoint, no new route)
- `bannerDismissed` useState (in-memory dismiss, reappears on refresh — correct for SOC 2 nag)
- Amber banner conditionally rendered: `isOwner && mfaStatus?.data?.enabled === false && !bannerDismissed`
- Banner contains: ShieldAlert icon, enrollment prompt text, "Enable MFA" link to `/settings/mfa`, dismiss × button

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mid-enrollment re-setup blocked in POST /api/mfa/setup**
- **Found during:** Task 2 (Test 2 assertion: second /setup call should return 409)
- **Issue:** The existing guard only blocked `totpEnabled=true` users from re-calling `/setup`. Users in mid-enrollment (totpSecret set, totpEnabled=false) could call `/setup` again, silently overwriting their in-progress enrollment secret with a new one. This is both a UX bug and a SOC 2 correctness issue (audit log would show duplicate mfa_setup_started events; old backup codes invalidated without user knowledge).
- **Fix:** Added `if (user.totpSecret) { res.status(409).json({ error: 'MFA enrollment is already in progress...' }); return; }` immediately after the `totpEnabled` check.
- **Files modified:** `src/server/routes/mfa.ts`
- **Commit:** `ddc42d0`

## Known Stubs

None — all plan goals are fully wired. qrDataUrl flows from `generateTotpSecret` → `/api/mfa/setup` response → `MfaSetupPage` `<img>` rendering. TOTP gates are live. Nag banner is conditionally rendered from real API data.

## Verification Results

### Automated

```
npx vitest run
Test Files: 78 passed | 7 skipped (85)
Tests: 914 passed | 42 todo (956)
Duration: 20.19s
```

**New tests:** 14 (6 mfaService unit + 8 mfa routes including Test 8 login MFA gate regression)
**Prior baseline:** 890 tests

```
npx tsc --noEmit
Exit: 0 (clean)
```

### Grep verification

- `grep -n '"qrcode":' package.json` → line 56 (dependencies)
- `grep -n '"@types/qrcode":' package.json` → line 84 (devDependencies)
- `grep -n 'qrDataUrl' src/server/services/mfaService.ts` → interface declaration + return assignment
- `grep -n 'async function generateTotpSecret' src/server/services/mfaService.ts` → confirmed async
- `grep -n 'await generateTotpSecret' src/server/routes/mfa.ts` → confirmed
- `grep -n 'qrDataUrl' src/server/routes/mfa.ts` → confirmed in response block
- `grep -n 'totpToken' src/server/routes/team.ts` → 6+ matches (schema + read + gates)
- `grep -n 'verifyTotpToken' src/server/routes/team.ts` → 2 matches (transfer-ownership + invite-revoke)
- `grep -n 'MFA verification required' src/server/routes/team.ts` → 2 matches
- `grep -n 'qrDataUrl' src/client/pages/MfaSetupPage.tsx` → state type + img src
- `grep -n '<img' src/client/pages/MfaSetupPage.tsx` → QR image tag
- `grep -n 'totpToken' src/client/pages/ProjectSettingsPage.tsx` → state + POST body
- `grep -n 'requiresMfa' tests/routes/mfa.test.ts` → Test 8 assertion
- `grep -n 'Enable MFA' src/client/pages/DashboardPage.tsx` → banner link text
- `grep -n '/settings/mfa' src/client/pages/DashboardPage.tsx` → banner link href

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | b520993 | feat(123-01): install qrcode, add async qrDataUrl to mfaService and setup route |
| Task 2 | ddc42d0 | feat(123-01): TOTP gate on transfer-ownership+invite-revoke; QR img in MfaSetupPage; 8 route tests |
| Task 3 | 044ca43 | feat(123-01): owner MFA enrollment nag banner on DashboardPage |

## Self-Check: PASSED
