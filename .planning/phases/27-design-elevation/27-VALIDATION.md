---
phase: 27
slug: design-elevation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 27 — Validation Strategy

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

**Note:** Phase 27 is purely visual/CSS — no backend logic or API changes. Vitest server suite is unaffected. TypeScript compilation (`npm run build`) is the primary automated gate. All visual requirements are manual browser verification.

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
| 27-01-01 | 01 | 1 | DES-01 | build + manual | `npm run build` | ✅ index.css | ⬜ pending |
| 27-01-02 | 01 | 1 | DES-03 | build + grep | `npm run build && grep -n "tracking-tight" src/client/components/ui/PageHeader.tsx` | ✅ PageHeader.tsx | ⬜ pending |
| 27-01-03 | 01 | 1 | DES-03 | build + grep | `npm run build && grep -rn "<h1" src/client/pages/` | ✅ pages/ | ⬜ pending |
| 27-02-01 | 02 | 2 | DES-02 | build + manual | `npm run build` | ✅ LandingPage.tsx | ⬜ pending |
| 27-02-02 | 02 | 2 | DES-02 | build + manual | `npm run build` | ✅ DashboardPage.tsx | ⬜ pending |
| 27-02-03 | 02 | 2 | DES-01 | build + manual | `npm run build` | ✅ ProjectCard.tsx | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test stubs or framework installation needed.

- No new backend routes, services, or DB changes — server test suite is unaffected
- TypeScript compilation gates all component changes automatically
- One grep-verifiable check: `grep -rn "<h1" src/client/pages/` must show 0 raw h1 page titles outside PageHeader after DES-03 migration

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hero photo renders with dark overlay | DES-02 | No frontend test framework | Open localhost:5173 — photo fills hero, text legible on dark overlay |
| Nav floats over hero photo (transparent bg) | DES-02 | Visual | LandingPage: nav must sit on top of the photo, not above it in normal flow |
| Gold CTA button visible on hero | DES-02 | Visual | Verify gold button is visible and readable against the dark overlay |
| Dashboard photo background on header strip | DES-02 | Visual | Open /dashboard — subtle dark photo behind page header area |
| Print: photo backgrounds removed | DES-02 | Browser print preview | Cmd+P on hero page — no dark overlay prints, white background |
| ProjectCard elevated shadow visible | DES-01 | Visual | Dashboard project cards show 0 8px 24px depth vs. flat cards elsewhere |
| HelpCallout elevated shadow matches | DES-01 | Visual | HelpCallout has the same elevated shadow as ProjectCards |
| PageHeader h1 tracking-tight | DES-03 | Visual | Compare PageHeader title letter-spacing vs. default — letters slightly tighter |
| No raw h1 page titles outside PageHeader | DES-03 | grep | `grep -rn "<h1" src/client/pages/` — all remaining h1s should be inside PageHeader |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
