---
phase: 84
slug: dependabot-uptime-monitoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 84 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 \| tail -5` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | tail -5`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 84-01-01 | 01 | 1 | SEC-09 | file-exists | `test -f .github/dependabot.yml` | ❌ W0 | ⬜ pending |
| 84-01-02 | 01 | 1 | SEC-09 | file-exists | `test -f README.md` | ❌ W0 | ⬜ pending |
| 84-02-01 | 02 | 2 | SEC-10 | grep | `grep -i "status\|betterstack\|uptime" src/client/pages/LandingPage.tsx` | ✅ | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `.github/dependabot.yml` — created in plan 84-01
- [ ] `README.md` — created in plan 84-01

*No new test stubs needed — Dependabot config and README are file-existence checks; LandingPage edit is verified via grep.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Better Stack monitor fires on `/api/health` downtime | SEC-10 | Requires live Better Stack account + external network test | After account setup, toggle service offline, verify monitor alert fires within 5 min |
| Status page publicly accessible | SEC-10 | External URL, can't automate locally | Open status page URL in browser, confirm public access |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
