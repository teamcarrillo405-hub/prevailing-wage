---
phase: 12
slug: app-shell-global-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (server-side regression only — no DOM/CSS testing) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

> **Note:** No jsdom, no @testing-library/react. All three SHELL requirements are visual-only (CSS class changes and React primitive adoption). The vitest suite runs server-side only and serves as regression guard to confirm no server logic was broken.

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run` (181-test regression guard)
- **After every plan wave:** Run `npm run test -- --run` + open browser to verify visual changes
- **Before `/gsd:verify-work`:** Full suite green + manual visual sign-off on: nav dark background, gold border, page titles using PageHeader, card sections using Card primitive
- **Max feedback latency:** 10 seconds (automated) + 2 minutes (manual visual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 12-01-01 | 01 | 1 | SHELL-01 | shell+manual | `npm run test -- --run` | Open any protected page, verify nav shows `#1a1a1a` dark background and gold bottom border | ⬜ pending |
| 12-02-01 | 02 | 1 | SHELL-02 | shell+manual | `npm run test -- --run` | Open DashboardPage + ProjectDetailPage, verify page title renders in Oswald as h1 via PageHeader | ⬜ pending |
| 12-03-01 | 03 | 2 | SHELL-03 | shell+manual | `npm run test -- --run` | Open PayrollWeekDetailPage + WorkersPage + PayrollListPage + ProjectDetailPage, verify card containers use consistent padding and rounded corners | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 test stubs needed. Phase 12 modifies existing TSX files (Layout.tsx, page components) — no new TypeScript services, routes, or API endpoints. The 181-test suite is the regression guard.

*Existing infrastructure covers all phase requirements (as regression guard).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Nav background renders as `#1a1a1a` (nav-dark token) across all protected pages | SHELL-01 | CSS class rendering is visual — no DOM test env | Open DashboardPage, WorkersPage, ReportsPage. Verify nav bar is dark (`#1a1a1a`), gold bottom border visible |
| Gold logo hover effect on nav | SHELL-01 | CSS hover state requires browser interaction | Hover over "HCC Prevailing Wage" nav link — text should turn gold |
| DashboardPage page title renders via PageHeader primitive (h1, Oswald) | SHELL-02 | Typography requires browser — vitest is node-only | Open DashboardPage, verify "Projects" heading renders in Oswald, title is h1 element |
| ProjectDetailPage page title renders via PageHeader primitive | SHELL-02 | Typography requires browser | Open any project detail page, verify project name heading renders in Oswald as h1 |
| ProjectDetailPage project details section uses Card primitive | SHELL-03 | Visual CSS — card styling is visual-only | Open project detail, verify info section has consistent border radius + shadow |
| PayrollWeekDetailPage table wrappers use Card primitive | SHELL-03 | Visual CSS | Open payroll week detail, verify week summary and entry table sections render with consistent card styling |
| WorkersPage individual worker sections use Card primitive | SHELL-03 | Visual CSS | Open workers page, verify each worker block has Card styling |
| PayrollListPage payroll weeks list uses Card primitive | SHELL-03 | Visual CSS | Open payroll list page, verify the weeks container uses Card |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify (`npm run test -- --run`)
- [ ] Sampling continuity: regression suite after each plan commit
- [ ] Wave 0: N/A — no new TS services; existing suite is regression guard
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 2min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
