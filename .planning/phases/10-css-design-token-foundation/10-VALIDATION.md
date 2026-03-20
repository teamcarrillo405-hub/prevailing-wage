---
phase: 10
slug: css-design-token-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (server-side only — no CSS/visual coverage) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

> **Note:** The vitest suite runs in node environment and tests server-side logic only. It cannot verify CSS, font rendering, or visual token propagation. All Phase 10 verification is manual browser inspection + shell grep confirmation.

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run` (regression guard only)
- **After every plan wave:** Run `npm run test -- --run` + manual browser open
- **Before `/gsd:verify-work`:** Full suite green + manual visual sign-off
- **Max feedback latency:** 15 seconds (automated) + 2 minutes (manual visual check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 10-01-01 | 01 | 1 | DESIGN-02 | manual | `npm run test -- --run` (regression) | Open app, open DevTools Network tab, verify Oswald + Inter requests load (status 200) | ⬜ pending |
| 10-02-01 | 02 | 1 | DESIGN-01 | shell+manual | `grep -r "style={{" src/client --include="*.tsx" \| grep -v "//"`  | Open app, change --color-brand-gold in index.css, verify all gold elements update without JSX edits | ⬜ pending |
| 10-03-01 | 03 | 2 | DESIGN-03 | shell | `grep -rn "backgroundColor.*F5C518\|fontFamily.*Oswald\|fontFamily.*Inter" src/client --include="*.tsx"` → expect 0 results | Visual: gold backgrounds/text still renders correctly on WageClassificationsTable, ManualWageEntryForm, ReportsPage | ⬜ pending |
| 10-04-01 | 04 | 2 | DESIGN-04 | shell | `grep -rn "focus:outline-none" src/client --include="*.tsx"` → expect 0 results | Tab through all form inputs: focus ring visible and gold-colored on every input | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 test files needed. Phase 10 is CSS-only with no new TypeScript functions, services, or API endpoints. The 181-test vitest suite serves as the regression guard only.

*Existing infrastructure covers all phase requirements (as regression guard).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Oswald + Inter fonts load from Google CDN | DESIGN-02 | vitest runs in node — no browser, no network requests | Open app in browser, open DevTools → Network → filter by Font, verify Oswald and Inter requests with 200 status |
| Single @theme change propagates to all gold elements | DESIGN-01 | CSS token propagation is visual-only | Change --color-brand-gold to red (#FF0000) in index.css, reload app, verify all gold elements change, revert |
| WageClassificationsTable tr background renders correctly | DESIGN-03 | `<tr>` bg-color specificity is browser-dependent | Verify WageClassificationsTable header row shows gold background after inline style → className migration |
| Focus rings visible on all form inputs | DESIGN-04 | CSS :focus states require browser interaction | Tab through WorkersPage form, PayrollWeekForm, LoginForm — verify gold focus ring on every input |
| No system font fallback after font change | DESIGN-02 | Font rendering is visual, requires browser | Side-by-side compare or screenshot: Oswald headlines distinctly different from system sans-serif |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (regression) or manual verification steps
- [ ] Sampling continuity: regression suite run after each plan completion
- [ ] Wave 0: N/A — no new TS functions; existing suite is regression guard
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 2min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
