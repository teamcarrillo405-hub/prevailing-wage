---
phase: 24
slug: california-dir-a-1-131-form
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + Supertest ^7.2.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/routes/projects.test.ts tests/routes/payroll.test.ts tests/services/wh347.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~20 seconds (quick) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/routes/projects.test.ts tests/routes/payroll.test.ts tests/services/wh347.test.ts` (regression guard — verifies WH-347 flow unbroken alongside new CA work)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| Wave 0 — download A-1-131 PDF | TBD | 0 | CAL-02 | infrastructure | `test -f assets/a1131-official.pdf` | ❌ W0 | ⬜ pending |
| Wave 0 — project CA field stubs | TBD | 0 | CAL-01 | integration | `npx vitest run tests/routes/projects.test.ts` | ✅ (file exists; stubs added) | ⬜ pending |
| Wave 0 — payroll DT field stubs | TBD | 0 | CAL-03 | integration | `npx vitest run tests/routes/payroll.test.ts` | ✅ (file exists; stubs added) | ⬜ pending |
| Wave 0 — a1131 service stubs | TBD | 0 | CAL-02 | unit | `npx vitest run tests/services/a1131.test.ts` | ❌ W0 (new file) | ⬜ pending |
| Wave 0 — export route stubs | TBD | 0 | CAL-02 | integration | `npx vitest run tests/routes/export.test.ts` | ❌ W0 (new file) | ⬜ pending |
| Schema migrations (idx 6 + 7) | TBD | 1 | CAL-01, CAL-03 | integration | `npx vitest run tests/routes/projects.test.ts tests/routes/payroll.test.ts` | ✅ | ⬜ pending |
| CA project fields (server + client) | TBD | 1 | CAL-01 | integration | `npx vitest run tests/routes/projects.test.ts` | ✅ | ⬜ pending |
| DT columns in payroll entry | TBD | 1 | CAL-03 | integration | `npx vitest run tests/routes/payroll.test.ts` | ✅ | ⬜ pending |
| fillA1131() generator | TBD | 2 | CAL-02 | unit | `npx vitest run tests/services/a1131.test.ts` | ✅ after W0 | ⬜ pending |
| Export route + state gate | TBD | 2 | CAL-02 | integration | `npx vitest run tests/routes/export.test.ts` | ✅ after W0 | ⬜ pending |
| PayrollWeekDetailPage CA button | TBD | 2 | CAL-02 | manual | See manual verifications | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `assets/a1131-official.pdf` — download blank form from `https://www.dir.ca.gov/dlse/Forms/PW/DLSEFormA-1-131.pdf`; measure and document field coordinates for each data point (required before generator can be written — the field coordinates are the spec)
- [ ] `tests/routes/projects.test.ts` — add `describe('CA project fields — CAL-01')` block with stubs: CA project creation persists cslbLicense + wcPolicyNumber; non-CA project creation does NOT include CA fields in response
- [ ] `tests/routes/payroll.test.ts` — add `describe('DT hours — CAL-03')` block with stubs: POST /api/payroll/entries accepts monDt-sunDt fields for CA project; non-CA project rejects DT fields (or ignores them)
- [ ] `tests/services/a1131.test.ts` — new file; stubs: `fillA1131()` returns non-empty Buffer; PDF output length > 1000 bytes; PDF starts with `%PDF`
- [ ] `tests/routes/export.test.ts` — new file (or additions to payroll test); stubs: GET /api/export/a1131/:weekId returns 200 for CA project; GET /api/export/a1131/:weekId returns 400 for non-CA project; returns 403 for unauthenticated request

*All stubs use real `expect()` assertions (not `.todo`) — fail RED immediately.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSLB license + WC policy fields appear on CA project form only | CAL-01 | Conditional rendering — UI state gating | Create project with state=CA; verify fields appear. Create with state=WA; verify fields absent. |
| DT hour columns appear in payroll entry only for CA projects | CAL-03 | Conditional column rendering | Open payroll entry on CA project; verify monDt-sunDt columns render. Open WH-347 project; verify columns absent. |
| "Download CA A-1-131" button state-gated to CA projects only | CAL-02 | UI state gating | On CA project's payroll week detail: button visible. On WA/federal project: button absent. |
| Downloaded A-1-131 PDF renders correctly in PDF viewer | CAL-02 | Visual inspection — pdf-lib output | Click Download CA A-1-131; open PDF; verify worker rows, hour grid (Sun-Sat), DT column, SDI deduction field, CSLB license in header |
| eCPR portal disclosure visible in preflight modal | CAL-02 | UI content verification | Click download button; verify preflight modal shows persistent eCPR disclosure text + link to efiling.dir.ca.gov/eCPR |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (PDF download, new test files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
