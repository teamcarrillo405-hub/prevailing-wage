---
phase: 8
slug: dashboard-ux-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing in project) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/routes/compliance.test.ts 2>&1 \| tail -20` |
| **Full suite command** | `npx vitest run 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/routes/compliance.test.ts 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run 2>&1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 0 | DASH-01, DASH-02 | stub | `npx vitest run tests/routes/compliance.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 1 | DASH-01, DASH-02 | integration | `npx vitest run tests/routes/compliance.test.ts` | ✅ after W0 | ⬜ pending |
| 8-03-01 | 03 | 1 | UX-01, UX-02, UX-03 | manual | See manual table | N/A | ⬜ pending |
| 8-04-01 | 04 | 1 | DASH-01, DASH-02 | integration | `npx vitest run tests/routes/compliance.test.ts` | ✅ after W0 | ⬜ pending |
| 8-04-02 | 04 | 2 | DASH-01, DASH-02, UX-01 | manual (checkpoint) | See manual table | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Append stubs to `tests/routes/compliance.test.ts` — project-level compliance badge endpoint (DASH-01, DASH-02)

*Existing vitest infrastructure covers test runner. Wave 0 appends to existing compliance test file only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Project card shows green/red compliance badge | DASH-01 | React UI — badge color cannot be automated | Dashboard → project card with no violations → green badge; project with under-wage → red badge |
| Project card shows payroll week count + last week number | DASH-02 | React UI display | Dashboard → project card → verify "X weeks, Week N" displays correctly |
| Project detail page has Workers, Payroll Weeks, Reports, Variance nav links | UX-01 | UI layout | Navigate to project detail → verify 4 nav links visible |
| Payroll weeks list has WH-347 download button per row | UX-02 | UI element presence | Project → Payroll Weeks → each row has "Download WH-347" link/button |
| Worker card shows warning for missing address or SSN | UX-03 | UI element presence | Workers page → worker without address → amber warning visible inline |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
