---
phase: 25
slug: washington-l-i-f700-065-000-form
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/routes/export.test.ts tests/routes/projects.test.ts tests/services/wh347.test.ts tests/services/a1131.test.ts` |
| **Full suite command** | `npx vitest run --exclude ".claude/**"` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/routes/export.test.ts tests/routes/projects.test.ts tests/services/wh347.test.ts tests/services/a1131.test.ts`
- **After every plan wave:** Run `npx vitest run --exclude ".claude/**"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 0 | WAL-01/WAL-02 | setup | `npx vitest run tests/services/f700.test.ts` | ❌ W0 | ⬜ pending |
| 25-01-02 | 01 | 0 | WAL-01/WAL-02 | setup | `npx vitest run tests/routes/export.test.ts` | ✅ | ⬜ pending |
| 25-01-03 | 01 | 0 | WAL-01/WAL-02 | setup | locate `assets/f700-official.pdf` | ❌ W0 | ⬜ pending |
| 25-01-04 | 01 | 1 | WAL-01/WAL-02 | integration | `npx vitest run tests/routes/projects.test.ts` | ✅ | ⬜ pending |
| 25-01-05 | 01 | 1 | WAL-01 | integration | `npx vitest run tests/routes/workers.test.ts` | ✅ | ⬜ pending |
| 25-02-01 | 02 | 2 | WAL-02 | unit | `npx vitest run tests/services/f700.test.ts` | ❌ W0 | ⬜ pending |
| 25-02-02 | 02 | 2 | WAL-02 | integration | `npx vitest run tests/routes/export.test.ts` | ✅ | ⬜ pending |
| 25-02-03 | 02 | 2 | WAL-02 | manual | visual PDF review | N/A | ⬜ pending |
| 25-02-04 | 02 | 2 | WAL-02 | manual | UI state-gate check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/f700.test.ts` — new file; stubs for WAL-02 `fillF700()` (mirrors `a1131.test.ts` structure)
- [ ] `tests/routes/export.test.ts` — add `describe('GET /api/export/f700/:weekId - WAL-02', ...)` block (5 tests mirroring the a1131 describe block)
- [ ] `tests/routes/projects.test.ts` — add describe block for WAL-02 WA project fields (ubiNumber, lniCertificate, wcAccount)
- [ ] `tests/routes/workers.test.ts` — add WAL-01 tests for waManualRate on classification create
- [ ] `assets/f700-official.pdf` — download from lni.wa.gov; inspect `/Rotate` and page dimensions before writing any coordinate constants in `f700Generator.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WA download button absent on CA project | WAL-02 | React conditional rendering not covered by route tests | Create a CA project, open any payroll week, verify no "Download WA F700-065-000" button appears |
| CA download button absent on WA project | WAL-02 | Symmetric state-gate check | Create a WA project, verify only the WA button (not CA button) appears |
| PWIA disclosure modal shows on every WA download click | WAL-02 | Modal behavior not in route tests | Click "Download WA F700-065-000" button, confirm modal appears before PDF download |
| Generated F700 PDF text is readable and positioned correctly | WAL-02 | Visual coordinate calibration | Open generated PDF in viewer; check header fields, worker rows, trade codes align with printed form |
| WA manual rate pre-fills base rate at payroll entry | WAL-01 | UI pre-fill behavior not in route tests | Create WA project + classification with waManualRate; go to payroll entry; verify rate is pre-filled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
