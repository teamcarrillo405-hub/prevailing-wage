---
phase: 11
slug: ui-primitives
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 11 — Validation Strategy

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

> **Note:** No jsdom, no @testing-library/react. All five UI primitive components are visual-only. Verification is manual browser inspection. The vitest suite runs server-side only and serves as regression guard.

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run` (181 server-side regression guard)
- **After every plan wave:** Run `npm run test -- --run` + open browser to verify component renders
- **Before `/gsd:verify-work`:** Full suite green + manual visual sign-off on all 5 components
- **Max feedback latency:** 10 seconds (automated) + 2 minutes (manual visual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 11-01-01 | 01 | 1 | UI-01, UI-02, UI-03 | shell+manual | `npm run test -- --run` | Open browser, verify Card/Button/Badge render in a temporary test page or DevTools | ⬜ pending |
| 11-02-01 | 02 | 1 | UI-04, UI-05 | shell+manual | `npm run test -- --run` | Open browser, verify PageHeader and EmptyState render on a page | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 test stubs needed. Phase 11 creates new TSX component files — no new TypeScript services, routes, or API endpoints. The 181-test suite is the regression guard.

*Existing infrastructure covers all phase requirements (as regression guard).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card wraps content with correct padding/radius | UI-01 | Visual CSS — no DOM test env | Open app, navigate to any page that uses Card, verify consistent padding |
| Primary button shows gold fill, secondary outlined, ghost no fill | UI-02 | Visual CSS — button variants require browser | Render all three variants side by side, verify visual distinction |
| Badge colors: green/red/amber/gray per variant | UI-03 | Color rendering requires browser | Render all 4 badge variants, verify semantic color matches |
| PageHeader: title + action slot right-aligned | UI-04 | Layout requires browser | Render PageHeader with and without action slot |
| EmptyState: heading + copy render | UI-05 | Visual — requires browser | Render EmptyState on a page with no data |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify (`npm run test -- --run`)
- [ ] Sampling continuity: regression suite after each plan
- [ ] Wave 0: N/A — no new TS services; visual components only
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 2min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
