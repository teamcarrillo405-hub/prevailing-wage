---
phase: 41
slug: ny-state-forms
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-06
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/services/mpwrXmlGenerator.test.ts tests/services/pw12Generator.test.ts` |
| **Full suite command** | `npx vitest run --exclude ".claude/**"` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/services/mpwrXmlGenerator.test.ts tests/services/pw12Generator.test.ts`
- **After every plan wave:** Run `npx vitest run --exclude ".claude/**"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 1 | NFR-01, NFR-05 | compile + grep | `npx tsc --noEmit && grep "nyMpwrSubmittedAt" src/server/db/schema.ts` | ❌ W0 | ⬜ pending |
| 41-01-02 | 01 | 1 | STATE-03 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 41-02-01 | 02 | 2 | STATE-03 | unit | `npx vitest run tests/services/mpwrXmlGenerator.test.ts` | ❌ W0 | ⬜ pending |
| 41-03-01 | 03 | 3 | STATE-02 | unit | `npx vitest run tests/services/pw12Generator.test.ts` | ❌ W0 | ⬜ pending |
| 41-04-01 | 04 | 4 | STATE-05, NFR-03 | integration | `npx vitest run tests/routes/export.test.ts tests/routes/payroll.test.ts` | ✅ extend | ⬜ pending |
| 41-05-01 | 05 | 5 | STATE-05 | compile | `npx tsc --noEmit` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/mpwrXmlGenerator.test.ts` — stubs for STATE-03: `<ProjectRollup>` root, `nysRegisteredApprentice`, supplemental payments, `000000+last4` SSN placeholder (new file, created in Plan 02)
- [ ] `tests/services/pw12Generator.test.ts` — stubs for STATE-02: valid PDF buffer, page count, contractor header, worker rows (new file, created in Plan 03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PW-12 PDF visual layout — header fields correct, per-worker rows legible, Statement of Compliance text present | STATE-02 | PDF rendering requires visual inspection | Generate PW-12 for a test NY project week; open PDF; confirm contractor name/FEIN, week-ending date, daily hour columns Mon–Sun, and compliance certification text |
| MPWR 3-step modal flow — Step 1 persists PRC Number, Step 2 downloads both files, Step 3 shows checklist with 30-day deadline reminder | STATE-05 | Multi-step modal requires browser interaction | Navigate to PayrollWeekDetailPage for an NY project; open NY MPWR modal; complete Step 1 (enter/confirm PRC + reg number); confirm Step 2 downloads trigger; confirm Step 3 shows checklist and "Mark as Submitted to NY MPWR" button |
| "Mark as Submitted" button hidden on non-NY projects | STATE-05 | UI gating requires browser | Navigate to PayrollWeekDetailPage for a CA project; confirm no NY MPWR button or modal trigger is present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-06
