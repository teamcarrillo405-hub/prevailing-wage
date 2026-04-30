# Phase 123: SOC 2 Foundation + MFA — Validation Architecture

**Created:** 2026-04-29
**Phase:** 123-soc2-foundation-mfa
**Mode:** Nyquist (every requirement has at least one automated verify command)
**Test framework:** Vitest ^4.0.18

---

## Purpose

This document is the auditor-facing index of every automated verification this phase ships. It maps each requirement (SEC-01, SEC-02, SEC-03) to:

1. The observable behavior the auditor cares about.
2. The exact Vitest test (file + test name) that proves the behavior.
3. The exact CLI command to run that test.
4. The exact CI gate that runs the full regression.

If a SOC 2 auditor asks "show me the test that proves X", the answer is in the table below.

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` |
| Working directory | `C:/Users/glcar/prevailing-wage` |
| Quick run | `npx vitest run <test-file>` |
| Full suite | `npx vitest run` |
| Type check | `npx tsc --noEmit` |
| Baseline test count | 890+ (pre-Phase 123) |
| Phase 123 net new tests | 18+ (6 mfaService + 8 mfa routes + 4 logger + 4–6 audit integrity = 22+ counting backfill) |

---

## Requirement → Test Map

### SEC-01 — TOTP MFA for owner accounts

| Behavior | Test ID | File | Automated Command | Created By |
|----------|---------|------|-------------------|-----------|
| `generateTotpSecret` returns valid PNG `qrDataUrl` | mfaService Test 1 | `tests/services/mfaService.test.ts` | `npx vitest run tests/services/mfaService.test.ts` | Plan 01 Task 1 |
| `generateTotpSecret` returns base32 secret + otpauth URI | mfaService Test 2 | `tests/services/mfaService.test.ts` | `npx vitest run tests/services/mfaService.test.ts` | Plan 01 Task 1 |
| `verifyTotpToken` accepts a freshly generated TOTP | mfaService Test 3 | `tests/services/mfaService.test.ts` | `npx vitest run tests/services/mfaService.test.ts` | Plan 01 Task 1 |
| `verifyTotpToken` rejects empty / garbage tokens (no throws) | mfaService Test 4 | `tests/services/mfaService.test.ts` | `npx vitest run tests/services/mfaService.test.ts` | Plan 01 Task 1 |
| `generateBackupCodes` returns N hex codes + encrypted JSON | mfaService Test 5 | `tests/services/mfaService.test.ts` | `npx vitest run tests/services/mfaService.test.ts` | Plan 01 Task 1 |
| `consumeBackupCode` is one-time (timing-safe) | mfaService Test 6 | `tests/services/mfaService.test.ts` | `npx vitest run tests/services/mfaService.test.ts` | Plan 01 Task 1 |
| Unauthenticated `POST /api/mfa/setup` returns 401 | mfa.test Test 1 | `tests/routes/mfa.test.ts` | `npx vitest run tests/routes/mfa.test.ts` | Plan 01 Task 2 |
| Authenticated `POST /api/mfa/setup` returns qrUri + qrDataUrl + secret + 10 backup codes | mfa.test Test 2 | `tests/routes/mfa.test.ts` | `npx vitest run tests/routes/mfa.test.ts` | Plan 01 Task 2 |
| `POST /api/mfa/verify-setup` flips totpEnabled=true on valid TOTP | mfa.test Test 3 | `tests/routes/mfa.test.ts` | `npx vitest run tests/routes/mfa.test.ts` | Plan 01 Task 2 |
| `POST /api/mfa/verify-setup` rejects invalid TOTP (400) | mfa.test Test 4 | `tests/routes/mfa.test.ts` | `npx vitest run tests/routes/mfa.test.ts` | Plan 01 Task 2 |
| **MFA required on transfer-ownership** — caller MFA on, totpToken missing → 401 | mfa.test Test 5 | `tests/routes/mfa.test.ts` | `npx vitest run tests/routes/mfa.test.ts` | Plan 01 Task 2 |
| **MFA required on transfer-ownership** — caller MFA on, valid totpToken → 200 | mfa.test Test 6 | `tests/routes/mfa.test.ts` | `npx vitest run tests/routes/mfa.test.ts` | Plan 01 Task 2 |
| **MFA required on invite revocation** — caller MFA on, totpToken missing → 401 | mfa.test Test 7 | `tests/routes/mfa.test.ts` | `npx vitest run tests/routes/mfa.test.ts` | Plan 01 Task 2 |
| **MFA required on login** — POST /api/auth/login with totpEnabled=true returns `{requiresMfa:true, userId}`, NO JWT cookie issued | mfa.test Test 8 | `tests/routes/mfa.test.ts` | `npx vitest run tests/routes/mfa.test.ts` | Plan 01 Task 2 (BLOCKER fix) |
| Owner MFA enrollment nag banner renders for owner + totpEnabled=false | grep + tsc smoke | `src/client/pages/DashboardPage.tsx` | `npx tsc --noEmit && grep -n "Enable MFA\|/settings/mfa\|mfa-status" src/client/pages/DashboardPage.tsx` | Plan 01 Task 3 |

**Total SEC-01 automated checks:** 14 Vitest tests + 1 grep/tsc smoke = 15.

---

### SEC-02 — Centralized log aggregation (Logtail / Better Stack)

| Behavior | Test ID | File | Automated Command | Created By |
|----------|---------|------|-------------------|-----------|
| `buildTransport()` returns undefined when NODE_ENV=test | loggerTransport Test 1 | `tests/services/loggerTransport.test.ts` | `npx vitest run tests/services/loggerTransport.test.ts` | Plan 02 Task 1 |
| `buildTransport()` returns `@logtail/pino` target when prod + LOGTAIL_TOKEN set | loggerTransport Test 2 | `tests/services/loggerTransport.test.ts` | `npx vitest run tests/services/loggerTransport.test.ts` | Plan 02 Task 1 |
| `buildTransport()` returns `pino-pretty` when dev + no token | loggerTransport Test 3 | `tests/services/loggerTransport.test.ts` | `npx vitest run tests/services/loggerTransport.test.ts` | Plan 02 Task 1 |
| `buildTransport()` returns undefined when prod + no token (raw stdout) | loggerTransport Test 4 | `tests/services/loggerTransport.test.ts` | `npx vitest run tests/services/loggerTransport.test.ts` | Plan 02 Task 1 |
| `LOGTAIL_TOKEN` documented in `.env.example` with comment | grep | `.env.example` | `grep -n "LOGTAIL_TOKEN" .env.example` | Plan 02 Task 3 |
| `LOGTAIL_TOKEN` listed in `render.yaml` env vars | grep | `render.yaml` | `grep -n "LOGTAIL_TOKEN" render.yaml` | Plan 02 Task 3 |
| No stale `LOGTAIL_SOURCE_TOKEN` references in src/, tests/, render.yaml, .env.example | grep | repo-wide (excl. .planning/) | `! grep -rn "LOGTAIL_SOURCE_TOKEN" src/ tests/ render.yaml .env.example` | Plan 02 Task 3 |

**Total SEC-02 automated checks:** 4 Vitest tests + 3 grep checks = 7.

**Note:** Live drain to Better Stack cannot be tested without a real `LOGTAIL_TOKEN`. The transport-target test mocks `pino.transport` to assert config without spawning workers — this is the SOC 2-evidence-grade equivalent (proves the wiring; the drain itself is the vendor's responsibility).

---

### SEC-03 — Hash chain tamper-evidence on audit_logs

| Behavior | Test ID | File | Automated Command | Created By |
|----------|---------|------|-------------------|-----------|
| 3 sequential `insertAuditLog()` rows → integrity-check returns `valid:true, scanned:3` | audit.integrity Test 1 | `tests/routes/audit.integrity.test.ts` | `npx vitest run tests/routes/audit.integrity.test.ts` | Plan 02 Task 2 |
| Tampered middle-row entry_hash → integrity-check returns `valid:false, brokenAt:<id>` | audit.integrity Test 2 | `tests/routes/audit.integrity.test.ts` | `npx vitest run tests/routes/audit.integrity.test.ts` | Plan 02 Task 2 |
| Unauthenticated `GET /api/audit/integrity-check` returns 401/403 | audit.integrity Test 3 | `tests/routes/audit.integrity.test.ts` | `npx vitest run tests/routes/audit.integrity.test.ts` | Plan 02 Task 2 |
| `computeAuditEntryHash` is deterministic and matches `SHA-256(id\|action\|prevHash\|createdAt)` | audit.integrity Test 4 | `tests/routes/audit.integrity.test.ts` | `npx vitest run tests/routes/audit.integrity.test.ts` | Plan 02 Task 2 |
| **Backfill** — `runBackfill()` hashes pre-chain (entry_hash IS NULL) rows; integrity-check then returns `valid:true` AND every entry_hash matches `computeAuditEntryHash` (no formula drift) | audit.integrity Test 5 | `tests/routes/audit.integrity.test.ts` | `npx vitest run tests/routes/audit.integrity.test.ts` | Plan 02 Task 4 (BLOCKER fix) |
| **Backfill idempotency** — re-running `runBackfill()` on a fully-hashed table reports `backfilled:0` | audit.integrity Test 6 | `tests/routes/audit.integrity.test.ts` | `npx vitest run tests/routes/audit.integrity.test.ts` | Plan 02 Task 4 (BLOCKER fix) |
| Backfill CLI runner smoke — `npx tsx scripts/backfill-audit-hash-chain.ts` exits 0 | shell smoke | `scripts/backfill-audit-hash-chain.ts` | `NODE_ENV=test npx tsx scripts/backfill-audit-hash-chain.ts` | Plan 02 Task 4 |

**Total SEC-03 automated checks:** 6 Vitest tests + 1 shell smoke = 7.

---

## Sampling Cadence

| When | Command | Pass Criteria |
|------|---------|---------------|
| Per task commit | `npx vitest run <files in <verify> block>` | All listed tests pass, 0 failing |
| Per plan completion | `npx vitest run <plan's verify suite>` + `npx tsc --noEmit` | All tests pass, tsc exits 0 |
| Per phase gate (`/gsd:verify-work 123`) | `npx vitest run` (full suite) + `npx tsc --noEmit` + all grep checks above | 890+ baseline tests pass, ~22 new tests pass, tsc 0, every grep returns the expected count |
| Production deploy verification | Same as phase gate + `NODE_ENV=test npx tsx scripts/backfill-audit-hash-chain.ts` exits 0 | Backfill CLI runner is invocable |

---

## Coverage Summary

| Requirement | Truths verified | Test files | Total automated checks |
|-------------|-----------------|------------|------------------------|
| SEC-01 (MFA) | QR image, transfer-ownership gate, invite-revoke gate, login MFA gate, owner nag, backup codes, verify-setup | `tests/services/mfaService.test.ts`, `tests/routes/mfa.test.ts`, grep on `DashboardPage.tsx` | 15 |
| SEC-02 (Logtail) | All 4 transport branches, env var documented in 2 places, no stale alias | `tests/services/loggerTransport.test.ts`, grep | 7 |
| SEC-03 (Hash chain) | Happy chain, tamper detection, auth guard, formula determinism, **backfill chain construction**, **backfill idempotency**, CLI smoke | `tests/routes/audit.integrity.test.ts`, shell | 7 |
| **Phase 123 total** | | | **29 automated checks** |

---

## Files Owning Validation Logic

| File | Owns |
|------|------|
| `tests/services/mfaService.test.ts` | SEC-01 unit coverage |
| `tests/routes/mfa.test.ts` | SEC-01 integration coverage (setup, verify-setup, transfer-ownership, invite-revoke, login MFA gate) |
| `tests/services/loggerTransport.test.ts` | SEC-02 transport-config coverage |
| `tests/routes/audit.integrity.test.ts` | SEC-03 chain integrity + backfill coverage |
| `scripts/backfill-audit-hash-chain.ts` | SEC-03 pre-chain row backfill (idempotent) |
| `src/server/logger.ts` | exports `buildTransport` for testability |

---

## Wave 0 Status

| Test file | Status before Phase 123 | Status after Phase 123 |
|-----------|-------------------------|------------------------|
| `tests/services/mfaService.test.ts` | does not exist | created in Plan 01 Task 1 |
| `tests/routes/mfa.test.ts` | does not exist | created in Plan 01 Task 2 |
| `tests/services/loggerTransport.test.ts` | does not exist | created in Plan 02 Task 1 |
| `tests/routes/audit.integrity.test.ts` | does not exist | created in Plan 02 Task 2, extended in Plan 02 Task 4 |
| `scripts/backfill-audit-hash-chain.ts` | does not exist | created in Plan 02 Task 4 |

All five files are produced inside Phase 123 itself — no upstream Wave 0 dependency on prior phases.

---

## Auditor Quick-Run

```bash
cd C:/Users/glcar/prevailing-wage

# 1. Full Phase 123 test surface (fast — ~5–15s):
npx vitest run \
  tests/services/mfaService.test.ts \
  tests/routes/mfa.test.ts \
  tests/services/loggerTransport.test.ts \
  tests/routes/audit.integrity.test.ts

# 2. Type safety:
npx tsc --noEmit

# 3. Env config presence:
grep -n "LOGTAIL_TOKEN" .env.example render.yaml

# 4. No stale alias leaks:
! grep -rn "LOGTAIL_SOURCE_TOKEN" src/ tests/ render.yaml .env.example

# 5. Backfill CLI invocable:
NODE_ENV=test npx tsx scripts/backfill-audit-hash-chain.ts

# 6. Full regression:
npx vitest run
```

Expected outcome: every command exits 0, ~22 new Phase 123 tests pass, 890+ baseline tests still green, no LOGTAIL_SOURCE_TOKEN matches, backfill smoke exits cleanly.

---

## Sources

- `.planning/phases/123-soc2-foundation-mfa/123-RESEARCH.md` (Validation Architecture section + Phase Requirements → Test Map)
- `.planning/phases/123-soc2-foundation-mfa/123-01-PLAN.md` (Plan 01 verify blocks + acceptance criteria)
- `.planning/phases/123-soc2-foundation-mfa/123-02-PLAN.md` (Plan 02 verify blocks + acceptance criteria, including Task 4 backfill)
- `.planning/REQUIREMENTS.md` SEC-01, SEC-02, SEC-03
- `.planning/ROADMAP.md` Phase 123 success criteria
- `.planning/config.json` `nyquist_validation: true`
