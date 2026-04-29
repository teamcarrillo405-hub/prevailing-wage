---
phase: 28
slug: production-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Build gate** | `npm run build` (tsc.server.json + Vite — must produce `dist/server/index.js` + `dist/client/`) |
| **Estimated runtime** | ~30 seconds |

**Note:** Render deploy verification is manual (smoke test against live URL). All code changes are tested locally via `npm test` + `npm run build` before deploy.

---

## Sampling Rate

- **After every task commit:** Run `npm test` — existing suite must remain green
- **After every plan wave:** Run `npm test && npm run build`
- **Before `/gsd:verify-work`:** Full suite green + successful Render deploy + live smoke tests
- **Max feedback latency:** ~30 seconds (local); deploy takes ~3-5 min on Render

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | W0 | OPS-02 | integration | `npm test` | ❌ Wave 0 | ⬜ pending |
| 28-01-02 | 01 | 1 | OPS-01 | build + grep | `npm run build && test -f dist/server/index.js` | ✅ tsconfig.json | ⬜ pending |
| 28-01-03 | 01 | 1 | OPS-04 | build + manual | `npm run build` | ✅ index.ts | ⬜ pending |
| 28-01-04 | 01 | 1 | OPS-01 | grep | `grep -n "dirname(dbPath)" src/server/db/index.ts` | ✅ db/index.ts | ⬜ pending |
| 28-01-05 | 01 | 1 | OPS-03 | grep | `grep -E "INVITE_CODE\|PORT=4099\|CORS_ORIGIN=.*4200" .env.example` | ✅ .env.example | ⬜ pending |
| 28-02-01 | 02 | 2 | OPS-02 | build + manual | `npm run build` | ✅ RegisterPage.tsx | ⬜ pending |
| 28-02-02 | 02 | 2 | OPS-01 | manual (deploy) | Manual Render smoke test | render.yaml | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/auth.test.ts` — add 3 new invite code tests:
  - `INVITE_CODE` set → register without code → expect 403
  - `INVITE_CODE` set → register with correct code → expect 201
  - `INVITE_CODE` not set → register without code → expect 201 (open dev mode)

*(These tests stub out the invite code logic BEFORE it's implemented — Wave 0 stubs run red initially, turn green after Plan 01 implementation)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Render deploy succeeds + landing page loads | OPS-01 | Live deploy required | Push to main → check Render build log → visit https://hcc-prevailing-wage.onrender.com |
| Project survives redeploy (SQLite on disk) | OPS-01 | Live deploy required | Create project post-deploy → trigger second deploy → verify project still exists |
| Register without invite code returns error | OPS-02 | Live production test | Attempt register at live URL without invite code → confirm 403 error message |
| Static files + SPA catch-all work | OPS-04 | Browser test | Hard-refresh /dashboard → must load React app (not 404) |
| No secrets in JS bundle | OPS-03 | Bundle inspection | `grep -r "JWT_SECRET\|INVITE_CODE" dist/client/` → must return empty |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
