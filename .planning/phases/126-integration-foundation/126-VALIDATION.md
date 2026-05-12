---
phase: 126
slug: integration-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 126 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| WAL busy_timeout | 01 | 1 | INTG-03 | unit | `npm test -- integration` | ❌ W0 | ⬜ pending |
| integration_connections migration | 01 | 1 | INTG-02 | unit | `npm test -- migration` | ❌ W0 | ⬜ pending |
| integration_sync_runs migration | 01 | 1 | INTG-02 | unit | `npm test -- migration` | ❌ W0 | ⬜ pending |
| IErpAdapter interface | 01 | 1 | INTG-04 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| integrationVault.ts | 01 | 1 | INTG-05, SEC-02 | unit | `npm test -- vault` | ❌ W0 | ⬜ pending |
| Cron job #6 registration | 01 | 1 | INTG-06 | unit | `npm test -- cron` | ❌ W0 | ⬜ pending |
| SSN exclusion serializer test | 01 | 1 | SEC-01 | unit | `npm test -- ssn` | ❌ W0 | ⬜ pending |
| Math.random nonce fix | 01 | 1 | SEC-03 | unit | `npm test -- nonce` | ❌ W0 | ⬜ pending |
| IntegrationsPage Sage card | 02 | 2 | INTG-01 | manual | — | n/a | ⬜ pending |
| IntegrationsPage Vista card | 02 | 2 | INTG-01 | manual | — | n/a | ⬜ pending |
| Manual sync trigger | 02 | 2 | INTG-07 | manual | — | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/server/integrations/__tests__/integrationVault.test.ts` — unit tests for encryptCredential/decryptCredential
- [ ] `src/server/integrations/__tests__/erpSync.test.ts` — stub tests for WAL mode, cron registration, SSN exclusion
- [ ] `src/server/integrations/__tests__/ssnExclusion.test.ts` — asserts no SSN field in ERP serializer output

*If existing test infrastructure covers it: note and skip the stub.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sage 300 card "File Exchange" badge renders | INTG-01 | UI rendering — no DOM test infra | Open IntegrationsPage, verify amber "File Exchange" badge on Sage 300 card |
| Vista card inline path config | INTG-01 | UI rendering | Open IntegrationsPage, verify import/export fields render inline on Vista card |
| "Import Now" loading state | INTG-07 | Async UI state | Click Import Now, verify button shows "Importing..." during request |
| Persistent notice text | SAGE-04 | Visual copy | Verify "No live connection — place export files in the configured import directory." appears on Sage/Vista cards |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
