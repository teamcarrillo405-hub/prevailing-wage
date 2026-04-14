---
phase: 51
slug: nj-schema-routes
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-14
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/routes/workers.test.ts tests/routes/export.test.ts tests/routes/projects.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

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
| 51-01-01 | 01 | 1 | NFR-01 | manual | N/A | ✅ | ⬜ pending |
| 51-01-02 | 01 | 1 | NJ-01, NJ-02 | integration | `npx vitest run tests/routes/projects.test.ts tests/routes/workers.test.ts` | ✅ | ⬜ pending |
| 51-01-03 | 01 | 1 | NJ-01 | integration | `npx vitest run tests/routes/export.test.ts` | ✅ | ⬜ pending |
| 51-02-01 | 02 | 2 | NJ-01 | integration | `npx vitest run tests/routes/projects.test.ts` | ✅ | ⬜ pending |
| 51-02-02 | 02 | 2 | NJ-02 | integration | `npx vitest run tests/routes/workers.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no new test files needed. Tests extend existing files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration file format | NFR-01 | SQL syntax requires visual inspection | Open `drizzle/0030_nj_schema.sql`, confirm 3 ALTER TABLE statements with 2 `--> statement-breakpoint` separators |
| NJ form fields visibility in UI | NJ-01 | React conditional rendering requires browser | Create NJ project, confirm njPwcNumber + njContractId fields visible; create TX project, confirm absent |
| workerSex select field on WorkersPage | NJ-02 | React conditional rendering requires browser | Open NJ project workers edit form, confirm workerSex select (M/F/N/null); open non-NJ, confirm absent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
