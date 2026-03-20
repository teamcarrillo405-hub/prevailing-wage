---
phase: 13
slug: landing-page-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 13 — Validation Strategy

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

> **Note:** No jsdom, no @testing-library/react. The landing page and routing changes are frontend-only. The vitest suite runs server-side only and serves as regression guard. All routing and landing page verification is manual browser inspection.

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run` (181-test regression guard)
- **After every plan wave:** Run `npm run test -- --run` + open browser to verify routing behavior and landing page sections
- **Before `/gsd:verify-work`:** Full suite green + manual sign-off on all 5 success criteria
- **Max feedback latency:** 10 seconds (automated) + 3 minutes (manual routing + visual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 13-01-01 | 01 | 1 | LANDING-01, LANDING-02 | shell+manual | `npm run test -- --run` | Navigate to "/" logged out → landing page; navigate "/" logged in → /dashboard redirect | ⬜ pending |
| 13-01-02 | 01 | 1 | LANDING-02 | shell+manual | `npm run test -- --run` | Navigate to /register → RegisterPage renders; complete registration → lands on /dashboard | ⬜ pending |
| 13-02-01 | 02 | 2 | LANDING-03, LANDING-04 | shell+manual | `npm run test -- --run` | Open "/" logged out — verify hero section names WH-347, Davis-Bacon, SAM.gov above the fold; verify How It Works and Feature Highlights sections render | ⬜ pending |
| 13-03-01 | 03 | 3 | LANDING-05, LANDING-06, LANDING-07 | shell+manual | `npm run test -- --run` | Open "/" logged out — verify trust signals, CTA close, and footer sections render; click "Create Free Account" → navigates to /register | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 test stubs needed. Phase 13 creates new TSX page components and modifies App.tsx routing — no new TypeScript services or API endpoints. The 181-test server suite is the regression guard.

*Existing infrastructure covers all phase requirements (as regression guard).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visiting "/" logged out shows landing page | LANDING-01 | Client-side routing — no server test | Open browser, ensure logged out, navigate to "/", verify landing page renders (not login redirect) |
| Visiting "/" logged in redirects to /dashboard | LANDING-01 | Client-side auth-aware routing | Log in, navigate to "/", verify browser URL changes to "/dashboard" |
| "Create Free Account" CTA navigates to /register | LANDING-02 | Client-side navigation | Click CTA on landing page, verify URL becomes "/register" |
| /register page renders RegisterForm | LANDING-02 | Visual — requires browser | Navigate to /register, verify registration form renders correctly |
| Hero section names WH-347, Davis-Bacon, SAM.gov above fold | LANDING-03 | Visual content placement — above fold = viewport height | Open "/" at 1280x800, verify these three terms visible without scrolling |
| How It Works section renders 3 steps with icons | LANDING-03 | Visual — requires browser + lucide-react | Scroll to How It Works, verify 3 numbered steps with icons |
| Feature Highlights section renders 4+ features | LANDING-04 | Visual — requires browser | Scroll to features, verify grid of feature cards |
| Trust signals section renders | LANDING-05 | Visual — requires browser | Scroll to trust section, verify compliance-related trust content |
| CTA close section renders with "Create Free Account" | LANDING-06 | Visual — requires browser | Scroll to bottom CTA, verify call to action |
| Footer renders with nav links | LANDING-07 | Visual — requires browser | Verify footer at bottom of page |
| Unknown URL logged out → "/" redirect | LANDING-01 | Client-side routing | Navigate to "/nonexistent" logged out, verify redirect to "/" (or landing page) |
| Unknown URL logged in → /dashboard | LANDING-01 | Client-side routing | Navigate to "/nonexistent" logged in, verify redirect to /dashboard |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify (`npm run test -- --run`)
- [ ] Sampling continuity: regression suite after each plan commit
- [ ] Wave 0: N/A — no new TS services; existing suite is regression guard
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 3min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
