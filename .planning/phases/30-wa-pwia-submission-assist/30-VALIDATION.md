---
phase: 30
slug: wa-pwia-submission-assist
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --reporter=verbose tests/services/waCprXmlGenerator.test.ts tests/routes/export.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/services/waCprXmlGenerator.test.ts tests/routes/export.test.ts`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green (188+ tests passing)
- **Max feedback latency:** ~8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 0 | WAL-03 | unit | `npm test -- tests/services/waCprXmlGenerator.test.ts` | ❌ Wave 0 | ⬜ pending |
| 30-01-02 | 01 | 0 | WAL-03 | route | `npm test -- tests/routes/export.test.ts` | ✅ exists | ⬜ pending |
| 30-02-01 | 02 | 1 | WAL-03 | unit | `npm test -- tests/services/waCprXmlGenerator.test.ts` | ❌ Wave 0 | ⬜ pending |
| 30-02-02 | 02 | 1 | WAL-03 | route | `npm test -- tests/routes/export.test.ts` | ✅ exists | ⬜ pending |
| 30-03-01 | 03 | 2 | WAL-04 | manual | n/a — UI display-only panel | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/waCprXmlGenerator.test.ts` — unit tests for WA CPR XML generator (covers all WAL-03 unit behaviors: root element, intentId, day ordering, amendedFlag)
- [ ] Add WA CPR XML test cases to `tests/routes/export.test.ts` (WAL-03 route behaviors: state gate, intentId gate, trade code gate, successful download, auth gate)

*Existing `tests/routes/export.test.ts` infrastructure is fully reusable — `registerUser`, `createProject`, `createWorkerWithClassification`, `createPayrollWeek`, `createPayrollEntry` helpers apply.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trade code gate screen shows worker names with edit links | WAL-03 | UI rendering, link targets | Open WA project payroll week with a worker missing `wa_trade_code`; click Download WA CPR XML; verify gate screen appears listing worker name with link to edit classification |
| intentId modal pre-fills after first export | WAL-03 | Persistence UX — requires two export flows | Export WA CPR XML once with intentId; close modal; click export again; verify intentId is pre-filled in modal |
| WAL-04 panel renders two sections: Intent to Pay + Affidavit | WAL-04 | UI layout | Open WA project payroll week detail page; verify two labeled sections visible: "Intent to Pay" and "Affidavit of Wages Paid" |
| WAL-04 Affidavit shows daily hours Mon–Sun per worker | WAL-04 | Day ordering correctness | Verify panel shows correct hours on correct days (Mon entry in Day 1 column, not shifted) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
