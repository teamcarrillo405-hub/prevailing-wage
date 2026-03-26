---
phase: 26
slug: contractor-guidance-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (server-side only, `environment: node`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Build gate** | `npm run build` (tsc + Vite — primary automated gate for frontend) |
| **Estimated runtime** | ~30 seconds |

**Note:** No frontend component testing framework exists (no Playwright, Cypress, RTL, or Vitest browser mode). Phase 26 is a pure frontend UX phase — all UX requirement validation is manual browser inspection. TypeScript compilation (`npm run build`) is the primary automated gate.

---

## Sampling Rate

- **After every task commit:** Run `npm run build` — must exit 0
- **After every plan wave:** Run `npm test && npm run build`
- **Before `/gsd:verify-work`:** Full suite (`npm test`) must be green + build must pass
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | UX-08 | build + manual | `npm run build` | ✅ tsconfig.json | ⬜ pending |
| 26-01-02 | 01 | 1 | UX-06 | build + manual | `npm run build` | ✅ tsconfig.json | ⬜ pending |
| 26-01-03 | 01 | 2 | UX-06 | build + manual | `npm run build` | ✅ tsconfig.json | ⬜ pending |
| 26-01-04 | 01 | 2 | UX-07 | build + manual | `npm run build` | ✅ tsconfig.json | ⬜ pending |
| 26-02-01 | 02 | 1 | UX-05 | build + manual | `npm run build` | ✅ tsconfig.json | ⬜ pending |
| 26-02-02 | 02 | 1 | UX-08 | build + manual | `npm run build` | ✅ tsconfig.json | ⬜ pending |
| 26-02-03 | 02 | 2 | — | automated | `npm test` | ✅ tests/ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test stubs or framework installation needed.

- No new backend routes, services, or DB changes — server test suite is unaffected
- TypeScript compilation gates all new component work automatically

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HowItWorksSection visible above fold | UX-05 | No frontend test framework | Open localhost:5173 — section appears without scrolling past hero |
| 4-step how-it-works content | UX-05 | Visual | Verify steps: Create Project → Add Workers → Enter Weekly Payroll → Generate & Submit WH-347 |
| HelpCallout on Dashboard | UX-06 | Visual | Open /dashboard — gold-border info card below PageHeader |
| HelpCallout on Project Detail | UX-06 | Visual | Open /project/:id — callout below PageHeader |
| HelpCallout on Workers page | UX-06 | Visual | Open /project/:id/workers — callout below PageHeader |
| HelpCallout on Payroll Entry | UX-06 | Visual | Open payroll entry — callout below PageHeader |
| HelpCallout on Payroll Week Detail | UX-06 | Visual | Open payroll week — callout below PageHeader |
| Workers empty state with action | UX-07 | Visual | New project, navigate to workers — specific message + "Add First Worker" button |
| Payroll Week list empty state | UX-07 | Visual | New project, navigate to project detail — specific message + "Create First Payroll Week" button |
| TermTooltip desktop hover | UX-08 | Interactive | Hover over "Davis-Bacon ?" — panel appears above term with definition |
| TermTooltip iPad tap | UX-08 | Interactive | Chrome DevTools → iPad Air sim → tap "?" — panel opens/closes on tap |
| TermTooltip Escape close | UX-08 | Interactive | Open tooltip, press Escape — panel closes |
| TermTooltip click-outside close | UX-08 | Interactive | Open tooltip, click elsewhere — panel closes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
