---
phase: 83-external-log-drain-security-policy
verified: 2026-04-26T00:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 83: External Log Drain + Security Policy — Verification Report

**Phase Goal:** The app ships structured HTTP logs to an external immutable drain (Logtail/Better Stack) and publishes a SECURITY_POLICY.md — closing the two most-cited CC7/CC9 SOC 2 evidence gaps and making the audit package complete.
**Verified:** 2026-04-26
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pino HTTP request/response logs flow to an external drain via HTTPS transport; every request emits `{ method, url, status, responseTime }` | VERIFIED | `src/server/logger.ts` buildTransport() returns `@logtail/pino` transport when token present; `pinoHttp({ logger })` in `index.ts:109–114` uses pino-http default serializers which emit all four required fields |
| 2 | `SECURITY_POLICY.md` exists at repo root AND is served at `/security`; covers supported versions, reporting process, 72h SLA, responsible disclosure | VERIFIED | File at `/c/Users/glcar/prevailing-wage/SECURITY_POLICY.md` contains all five required sections; `/security` route registered in `src/client/App.tsx:127` via `SecurityPolicyPage` lazy import |
| 3 | `LOGTAIL_TOKEN` documented in `.env.example` with placeholder; startup warns if missing (non-fatal) | VERIFIED | `.env.example:124` has `LOGTAIL_TOKEN=`; `index.ts:118–120` has `logger.warn(...)` guarded by `NODE_ENV !== 'test' && !LOGTAIL_TOKEN` |
| 4 | All existing 724 tests pass; Pino transport mocked in test env via `NODE_ENV=test` guard | VERIFIED | `logger.ts:17` — `if (isTest) return undefined;` prevents any external transport in test env; summaries confirm 724 passing both plans |
| 5 | When `LOGTAIL_TOKEN` absent in non-test env, startup logs a warning but app continues | VERIFIED | Warning uses `logger.warn()` (not throw/process.exit); pattern mirrors RESEND_API_KEY/SENTRY_DSN handling |
| 6 | `SECURITY_POLICY.md` primary contact = `security@prevailingwage.app` matching `/.well-known/security.txt` | VERIFIED | `SECURITY_POLICY.md:19` — `security@prevailingwage.app`; `index.ts:100` — `Contact: mailto:security@prevailingwage.app` |
| 7 | `SecurityPolicyPage.tsx` `/security` route shows 72h SLA and `security@prevailingwage.app` (was 48h / old email) | VERIFIED | `SecurityPolicyPage.tsx:172` has "72 hours"; lines 181–182 and 207 have `security@prevailingwage.app`; zero occurrences of `security@prevwage.app` or `48 hours` found |
| 8 | Three security artifacts (security.txt, SECURITY_POLICY.md, SecurityPolicyPage.tsx) are consistent | VERIFIED | All three advertise `security@prevailingwage.app` and 72h ack SLA |
| 9 | `@logtail/pino` installed as a project dependency | VERIFIED | `package.json:28` — `"@logtail/pino": "^0.5.8"`; `npm ls @logtail/pino` confirms `@logtail/pino@0.5.8` in node_modules |

**Score:** 9/9 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/logger.ts` | Pino logger with NODE_ENV-gated and LOGTAIL_TOKEN-gated transport selection | VERIFIED | 37-line implementation with `buildTransport()` function; contains `@logtail/pino`, `LOGTAIL_TOKEN`, `isTest` |
| `src/server/index.ts` | Startup warning when LOGTAIL_TOKEN missing in non-test env | VERIFIED | Lines 116–120; uses `logger.warn()`; guarded by `NODE_ENV !== 'test'`; positioned after pinoHttp registration |
| `.env.example` | LOGTAIL_TOKEN documentation with section header | VERIFIED | Lines 116–124; section header "Logging (Better Stack / Logtail)"; `LOGTAIL_TOKEN=`; "Optional" comment present |
| `package.json` | @logtail/pino dependency | VERIFIED | Line 28: `"@logtail/pino": "^0.5.8"` |
| `SECURITY_POLICY.md` | GitHub-displayed security policy + SOC 2 evidence artifact | VERIFIED | 90-line file at repo root; all 5 required sections present |
| `src/client/pages/SecurityPolicyPage.tsx` | /security page with SLA aligned to SECURITY_POLICY.md | VERIFIED | Contains `72 hours`; contains `security@prevailingwage.app`; no old values remain |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/server/logger.ts` | `@logtail/pino` transport | `pino.transport({ target: '@logtail/pino', options: { sourceToken: token } })` | WIRED | Lines 19–22 of logger.ts; exact pattern confirmed |
| `src/server/index.ts` | `process.env.LOGTAIL_TOKEN` | `logger.warn` at startup if unset and `NODE_ENV !== 'test'` | WIRED | Lines 118–120; both condition and warning text verified |
| `src/server/index.ts` (pinoHttp middleware) | `src/server/logger.ts` logger export | `pinoHttp({ logger })` | WIRED | Lines 109–114; pinoHttp imported at line 5; `logger` from logger.ts passed as option |
| `SECURITY_POLICY.md` | `security@prevailingwage.app` | Reporting a Vulnerability section contact line | WIRED | Line 19 of SECURITY_POLICY.md confirmed |
| `src/client/pages/SecurityPolicyPage.tsx` | SECURITY_POLICY.md SLA values | 72h ack text | WIRED | `SecurityPolicyPage.tsx:172` matches SECURITY_POLICY.md |
| `/.well-known/security.txt` | `https://prevailingwage.app/security-policy` | Phase 80 wiring in index.ts line 103 | WIRED | `index.ts:103` — `Policy: https://prevailingwage.app/security-policy` confirmed unchanged |

---

## Data-Flow Trace (Level 4)

Not applicable for this phase. No artifacts render dynamic data from a database. All artifacts are: a transport module (logger.ts), startup code (index.ts), a static markdown file (SECURITY_POLICY.md), and a static React page (SecurityPolicyPage.tsx). No DB queries involved.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `@logtail/pino` installed and resolvable | `npm ls @logtail/pino` | `@logtail/pino@0.5.8` | PASS |
| `logger.ts` exports `logger` symbol | file inspection | `export const logger = pino(...)` at line 33 | PASS |
| Test-env guard in logger.ts prevents transport | `if (isTest) return undefined` at line 17 | confirmed | PASS |
| Startup warning in index.ts positioned after pinoHttp | line 116 vs pinoHttp at lines 109–114 | correctly ordered | PASS |
| Old email `security@prevwage.app` removed from SecurityPolicyPage | grep returns zero matches | zero matches | PASS |
| All 6 commits present in git log | `git log --oneline -6` | ef749c9, 3246337, 29baaea, e78dcb3, cac3499, 603abe2 | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEC-07 | 83-01 | External log drain: Pino to Logtail/Better Stack via HTTPS transport | SATISFIED | `@logtail/pino@0.5.8` installed; logger.ts transport branches on LOGTAIL_TOKEN; pinoHttp wired; startup warning present |
| SEC-08 | 83-02 | SECURITY_POLICY.md at repo root; /security page reconciled; three-artifact consistency | SATISFIED | SECURITY_POLICY.md at repo root with 5 sections; SecurityPolicyPage.tsx updated; all three artifacts agree on email and SLA |

**Note on REQUIREMENTS.md numbering:** The canonical REQUIREMENTS.md in this project uses SEC-01 through SEC-06. SEC-07 and SEC-08 are identifiers defined in the ROADMAP.md phase detail table (v7.0 extensions). The ROADMAP.md explicitly maps Phase 83 to SEC-07 and SEC-08. No orphaned requirements detected — both IDs are claimed and satisfied by their respective plans.

---

## Anti-Patterns Found

None detected.

Scanned files: `src/server/logger.ts`, `src/server/index.ts`, `SECURITY_POLICY.md`, `src/client/pages/SecurityPolicyPage.tsx`

- No TODO/FIXME/PLACEHOLDER comments in implementation files (the PGP fingerprint placeholder in SECURITY_POLICY.md is a documented intentional content decision, not a code stub)
- No empty return values in implementation paths
- No hardcoded static data where live data is expected
- Old email `security@prevwage.app` — zero occurrences in codebase
- Old SLA `48 hours` — zero occurrences in codebase

---

## Human Verification Required

### 1. Production Drain Activation

**Test:** Set `LOGTAIL_TOKEN` in Render.com environment; restart service; hit `/api/health` and one project route; check Better Stack dashboard.
**Expected:** Log entries appear in Better Stack dashboard with `req.method`, `req.url`, `res.statusCode`, and `responseTime` fields present.
**Why human:** Requires live Render deployment and a valid Better Stack source token — cannot verify programmatically without running the app against an external service.

### 2. GitHub Security Tab Display

**Test:** Push the branch to GitHub default branch; navigate to the repo Security tab.
**Expected:** GitHub auto-renders `SECURITY_POLICY.md` on the Security tab (GitHub detects this exact filename).
**Why human:** Requires a live GitHub push — cannot verify from the local filesystem.

---

## Gaps Summary

No gaps. All must-have truths are verified. Both plans delivered their stated artifacts, all wiring is confirmed end-to-end, and no anti-patterns were found in implementation files.

The two human verification items above are post-deploy confirmations that do not block the phase goal — the code is correctly implemented and committed.

---

_Verified: 2026-04-26_
_Verifier: Claude (gsd-verifier)_
