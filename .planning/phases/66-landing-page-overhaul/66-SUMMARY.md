---
phase: 66
plan: 1
subsystem: client/landing-page
tags: [ui, landing-page, marketing, pricing, social-proof]
requirements: [UI-12, UI-13, UI-14, UI-15, UI-16]
key-files:
  modified:
    - src/client/pages/LandingPage.tsx
decisions:
  - Used nav-dark token instead of brand-navy (which does not exist in this project's token set)
  - Used CSS gradient for hero background instead of real photography since no image asset is available
  - Added full 3-tier pricing section alongside PricingCalculator since no separate PricingPage.tsx exists
  - Added coming-soon state grid with 16 additional states beyond the 8 active states
metrics:
  duration: ~8 minutes
  completed: 2026-04-25
  tasks: 5
  files: 1
---

# Phase 66: Landing Page Overhaul Summary

Single-file upgrade of `LandingPage.tsx` adding photography hero, social proof section, 4-step visual how-it-works, 50-state coverage grid, and interactive pricing time-saved calculator.

## Sections Added / Upgraded

### UI-12: Hero Section Upgrade
- Replaced the full-screen `min-h-screen` hero with a focused `min-h-[70vh]` hero
- Background is a CSS gradient (`135deg, #1a2744 → #2d4a8a → #1a3a5c`) — professional dark navy construction palette
- Updated headline: "Certified Payroll Compliance / Made Simple"
- Updated sub-copy emphasizing 8 states, SSN encryption, and instant pricing
- Dual CTAs: "Start Free — No Credit Card" (gold) + "See How It Works" (ghost border)
- Floating nav preserved above hero content

### UI-13: Social Proof Section (NEW)
- White section above How It Works
- Four logo placeholder badges (HCC + 3 contractor type labels)
- Full testimonial blockquote from HCC Project Manager
- Stat strip: 8 States / <10 min / 100% compliant

### UI-14: How It Works (UPGRADED)
- Replaced icon-left text-left layout with centered 4-column grid
- Each step has a numbered dark circle (01–04) + Lucide icon + title + description
- Descriptions now reference TermTooltip for Davis-Bacon and WH-347 terms
- Background changed from nav-dark to gray-50 for lighter marketing feel

### UI-15: State Coverage Grid (NEW)
- 8 active states: CA, WA, NY, IL, TX, MA, NJ, FL — dark navy tiles with gold text
- 16 coming-soon states: CO, OH, PA, MN, AZ, GA, NC, VA, OR, NV, MI, WI, IN, TN, MD, CT — gray tiles
- Footer note: "All 50 states supported via federal WH-347"

### UI-16: Pricing Time-Saved Calculator (NEW)
- Stateful component using `useState` (imported from React)
- Two range sliders: payroll weeks/month (1–40) and workers per project (1–100)
- Outputs: hours saved/month and dollar value at $65/hr admin rate
- Range inputs use `accent-brand-gold` for themed slider thumb
- Placed above 3-tier pricing cards in a new PricingSection

### Pricing Section (NEW — companion to UI-16)
- 3 tiers: Starter ($49/mo), Professional ($129/mo, highlighted), Enterprise (custom)
- Professional tier uses nav-dark background with gold ring and gold CTA
- Feature checklists with CheckCircle icons
- Enterprise tier links to `mailto:support@hcc.com`

## Token Adaptations

| Plan Used | Actual Token | Note |
|-----------|-------------|------|
| `brand-navy` | `nav-dark` | brand-navy not defined in index.css |
| `font-display` | `font-headline` | project uses Oswald as `font-headline` |
| `React.useState` | `useState` (named import) | project uses named imports pattern |

## Deviations from Plan

### Auto-adjusted: Token naming
- **Found during:** Task A
- **Issue:** Plan used `brand-navy` and `font-display` which are not defined CSS tokens in this project
- **Fix:** Replaced all `brand-navy` with `nav-dark`, `font-display` with `font-headline` throughout all sections
- **Files modified:** src/client/pages/LandingPage.tsx

### Auto-adjusted: Pricing section added
- **Found during:** Task E
- **Issue:** No separate PricingPage.tsx exists — pricing needed to live on the landing page
- **Fix:** Created `PricingSection` component wrapping `PricingCalculator` + 3 tier cards, inserted before CTACloseSection

## Verification

- TypeScript: `npx tsc --noEmit` — 0 errors
- Tests: `pnpm test` — 711 passed, 42 todo, 7 skipped (62 test files)

## Self-Check: PASSED

- src/client/pages/LandingPage.tsx — FOUND (434 lines added, 96 removed)
- Commit 4e8ed01 — FOUND
- 711 tests — PASSED
- 0 TypeScript errors — CONFIRMED
