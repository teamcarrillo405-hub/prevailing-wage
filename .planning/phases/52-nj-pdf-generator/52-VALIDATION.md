---
phase: 52
slug: nj-pdf-generator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/services/njPdfGenerator.test.ts tests/routes/export.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~35 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 52-01-01 | 01 | 1 | NJ-03 | unit | `npx vitest run tests/services/njPdfGenerator.test.ts` | ❌ W0 | ⬜ pending |
| 52-01-02 | 01 | 1 | NJ-03, NFR-01 | unit | `npx vitest run tests/services/njPdfGenerator.test.ts` | ❌ W0 | ⬜ pending |
| 52-02-01 | 02 | 2 | NJ-03, NFR-03 | integration | `npx vitest run tests/routes/export.test.ts` | ✅ | ⬜ pending |
| 52-02-02 | 02 | 2 | NJ-03 | integration | `npx vitest run tests/routes/export.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/njPdfGenerator.test.ts` — failing stubs for NJ-03 (generator unit tests: non-empty Uint8Array, contractor header with njPwcNumber, EEO codes M/W/H, em-dash for null, N.J.S.A. 34:11-56.25 cert text)

*Existing `tests/routes/export.test.ts` already has NJ stub tests from Phase 51 — Wave 0 adds generator unit stubs only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF visual layout (columns, NJ MW-562 structure) | NJ-03 | PDF rendering requires human eye | Open generated PDF, verify contractor header (njPwcNumber, njContractId), per-worker rows with EEO columns (sex/race/ethnicity), FICA/FIT/SIT deduction columns |
| Statement of Compliance NJ-specific text | NJ-03 | String content in binary PDF | Open PDF page 2, confirm "N.J.S.A. 34:11-56.25" reference |
| Monday-first day column order | NJ-03 | Visual column header check | Open PDF, confirm day headers read Mo-Tu-We-Th-Fr-Sa-Su left to right |
| PayrollEntryPage NJ deduction fields | NJ-03 | React UI rendering | Create NJ payroll entry, confirm ficaTax/federalIncomeTax/stateIncomeTax fields visible; non-NJ project absent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
