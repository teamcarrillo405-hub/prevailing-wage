---
phase: 40
slug: ny-schema-compliance-rule
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-02
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/services/complianceService.test.ts` |
| **Full suite command** | `npx vitest run --exclude ".claude/**"` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/services/complianceService.test.ts tests/routes/projects.test.ts`
- **After every plan wave:** Run `npx vitest run --exclude ".claude/**"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | NFR-01, NFR-05, STATE-06 | compile + grep | `npx tsc --noEmit && grep "nyprcNumber" src/server/db/schema.ts` | ❌ W0 | ⬜ pending |
| 40-02-01 | 02 | 2 | STATE-01, STATE-06 | integration | `npx vitest run tests/routes/projects.test.ts tests/routes/workers.test.ts` | ❌ W0 | ⬜ pending |
| 40-02-02 | 02 | 2 | STATE-01, STATE-06 | compile | `npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 40-03-01 | 03 | 3 | STATE-04 | unit | `npx vitest run tests/services/complianceService.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/complianceService.test.ts` — add test cases: NY project with 9h/day Monday flags `cwhssa-ot`; NY project with exactly 8h/day has no violation; non-NY project with 9h/day does NOT flag daily OT
- [ ] `tests/routes/projects.test.ts` — add test cases: POST/PUT project with `state: "NY"` accepted; NY project row has `nyprcNumber` + `nysContractorRegNumber` fields
- [ ] `tests/routes/workers.test.ts` — add test case: worker row has `nysRegisteredApprentice` boolean field accepted and returned

*(All three are extensions of existing test files — no new files required)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Project form shows "NY" in state selector and conditionally renders NY fields (PRC Number, Contractor Reg Number) when NY is selected | STATE-01, STATE-06 | React conditional UI requires browser | Create a new project, select state=NY, confirm NY-specific fields appear; change state to CA, confirm NY fields disappear |
| Worker profile form shows `nysRegisteredApprentice` checkbox | STATE-06 | React UI requires browser | Open WorkersPage edit form, confirm "NYS Registered Apprentice" checkbox is visible; check it, save, reload, verify persists |
| PayrollWeekDetailPage shows CWHSSA OT violation badge for NY project with 9h on a single day | STATE-04 | Violation badge requires browser + DB setup | Create NY project, add worker, enter payroll week with 9 ST hours on Monday; check PayrollWeekDetailPage for violation badge |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-06
