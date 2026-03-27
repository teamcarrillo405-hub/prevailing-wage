---
phase: 31
slug: ssn-encryption-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (vitest.config.ts, globals: true, environment: node) |
| **Config file** | `vitest.config.ts` at project root |
| **Quick run command** | `npx vitest run tests/services/cryptoService.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/services/cryptoService.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 0 | SEC-01 | unit stub | `npx vitest run tests/services/cryptoService.test.ts` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | SEC-01 | unit | `npx vitest run tests/services/cryptoService.test.ts` | ❌ W0 | ⬜ pending |
| 31-02-01 | 02 | 1 | SEC-01 | route integration | `npx vitest run tests/routes/workers.test.ts` | exists | ⬜ pending |
| 31-02-02 | 02 | 1 | SEC-03 | route integration | `npx vitest run tests/routes/workers.test.ts` | exists | ⬜ pending |
| 31-03-01 | 03 | 2 | SEC-02 | unit | `npx vitest run tests/services/ecprXmlGenerator.test.ts` | ❌ W0 | ⬜ pending |
| 31-03-02 | 03 | 2 | SEC-02 | unit | `npx vitest run tests/services/waCprXmlGenerator.test.ts` | exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/cryptoService.test.ts` — stubs for SEC-01 (encryptSsn/decryptSsn round-trip, random IV, tamper detection, version error)
- [ ] `tests/services/ecprXmlGenerator.test.ts` — SEC-02 CA eCPR: full SSN when 9-digit encrypted available; placeholder fallback when null or 4-digit

*Existing infrastructure covers route and WA XML tests — no new test files needed beyond the two above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Server refuses to start when ENCRYPTION_KEY_V1 missing | SEC-01 | Requires env var manipulation at process start | Remove ENCRYPTION_KEY_V1 from .env, run `npm run dev:server`, confirm startup error message and non-zero exit |
| SQLite inspection shows no plaintext SSN | SEC-01 | Requires sqlite3 CLI | `sqlite3 /var/data/app.db "SELECT ssn_last4, ssn_encrypted FROM workers LIMIT 3"` — confirm ssn_encrypted is a JSON envelope, no digits in plaintext |
| Worker form accepts 9-digit SSN and masks to ***-**-1234 | SEC-03 | Browser interaction | Open worker add/edit form, enter `123456789`, confirm display shows `***-**-6789` |
| Backfill script migrates existing ssnLast4 values | SEC-01 | Requires populated DB | Run `npx ts-node scripts/backfill-ssn-encrypted.ts`, confirm ssn_encrypted populated for all workers with prior ssnLast4 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
