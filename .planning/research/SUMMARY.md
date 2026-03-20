# Project Research Summary

**Project:** HCC Prevailing Wage — v2.1 Design Polish + Landing Page
**Domain:** B2B SaaS compliance tooling — certified payroll and Davis-Bacon compliance for general contractors
**Researched:** 2026-03-20
**Confidence:** HIGH

## Executive Summary

HCC Prevailing Wage v2.0 is a functionally complete React 19 + TailwindCSS v4 app covering Davis-Bacon compliance, WH-347 PDF generation, and SAM.gov wage determination lookup. The v2.1 milestone is a visual and marketing layer on top of a working product — not a new feature build. The gap between what the app does and how it looks is the entire problem to solve: the functional core is solid, but the current UI uses inconsistent typography, raw hex color values scattered across 33 components, no shared UI primitives, a missing Google Fonts load, and no public-facing landing page. The recommended approach is foundation-first, outside-in: establish the CSS design token system first, then create primitive components, then polish the app shell, then build the landing page.

The technology additions are minimal: `motion` (scroll-triggered entry animations), `react-intersection-observer` (inView triggers), and `lucide-react` (SVG icons). All three are tree-shakeable and React 19-compatible. The architecture is a single React Router SPA — no separate static site, no second deployment. All design tokens live in `index.css` via TailwindCSS v4's `@theme` block, which auto-generates utility classes from every defined variable. The HCC brand palette (dark `#1a1a1a` nav, gold `#F5C518` accent, Oswald headlines, Inter body) is already specified — v2.1 is enforcement and extension, not invention.

The primary risks are technical and content-related. On the technical side: TailwindCSS v4 has a confirmed behavior where `--color-*: initial` in `@theme` silently wipes all default Tailwind colors and breaks all 33 existing components; `@theme` cannot be split into separate imported CSS files without tokens silently failing; and the `focus:outline-none` class was renamed in v4 to `outline-hidden`, with 5+ instances of the old name in existing form inputs. On the content side: landing page copy that does not name "Davis-Bacon," "WH-347," or "SAM.gov" in the hero viewport will not convert the specific GC and project-manager audience this product targets. Both risk categories have clear, low-cost prevention steps.

---

## Key Findings

### Recommended Stack

The v2.1 stack is the existing React 19 + Vite + TailwindCSS v4 foundation, with three new production dependencies. The token system is CSS-first: all design variables belong in the `@theme` block in `src/client/index.css`, which generates Tailwind utility classes automatically — `--color-brand-gold` becomes `bg-brand-gold`, `text-brand-gold`, and `border-brand-gold`. No `tailwind.config.js` is needed or appropriate for v4. All existing v2.0 libraries (Recharts, TanStack Query, react-hook-form, zod, tailwind-merge) are already installed and unchanged.

**Core technologies (new for v2.1):**
- `motion@^12.38.0`: Scroll-triggered entry animations for landing page sections — import from `motion/react`, not `framer-motion`. Fully React 19-compatible. ~30KB gzip when tree-shaken.
- `react-intersection-observer@^10.0.3`: 2KB `useInView` hook for class-based scroll triggers where full `motion` is overkill. Zero dependencies.
- `lucide-react@^0.577.0`: Tree-shakeable SVG icon set (577 icons, TypeScript types). Required because the project prohibits emoji in UI — SVG icons are the mandated alternative.

**CSS-only additions (no new packages):** Extended `@theme` block in `index.css` covering typography scale, spacing tokens, border radii, shadow tokens, and brand surface colors. `@layer base` sets font defaults on `body` and `h1-h4` elements so font families are never applied per-component. `@layer components` defines `.hcc-card` and `.hcc-table` shared style recipes for patterns repeated across 3+ components.

**Explicitly ruled out:** shadcn/ui (confirmed Tailwind v4 transparency rendering bug), `@tailwindcss/typography` (unnecessary for structured JSX pages), `@tanstack/react-table` (overkill for read-only compliance tables), GSAP (imperative API fights React's model), dark mode toggle (adds significant CSS complexity with no value for a compliance-focused audience).

---

### Expected Features

The functional feature set — compliance flags, WH-347 generation, worker management, payroll entry — is complete in v2.0. v2.1 is entirely design and marketing.

**Must have (table stakes design — v2.1):**
- Consistent typography scale enforced across all pages — Oswald for headers, Inter for body, at defined rem sizes
- Card-based layout with uniform padding and border-radius — single reusable `.hcc-card` class applied everywhere
- Compliance status badges with semantic color — green = compliant, red = violation, yellow = warning — consistent across all views
- Data tables with visible structure — header/body distinction, row borders, proper cell padding via `.hcc-table`
- Dark nav + gold accent applied on every page — currently inconsistent across routes
- Primary button hierarchy — one primary CTA per screen; secondary and ghost variants visually subordinate
- Empty states with action-oriented copy — at minimum for: no projects, no workers, no payroll weeks
- Landing page — hero, pain acknowledgment, how-it-works, feature highlights, trust signals, CTA close, footer

**Should have (differentiators):**
- HCC dark/gold brand applied rigorously throughout — every competitor uses enterprise blue; this is low-cost visual differentiation at genuine category scale
- Compliance status above the fold on dashboard — violation counts on project cards, not buried in project detail
- Workflow progress indicator on project detail — steps: project created / workers added / payroll entered / WH-347 ready
- Outcome-focused empty states with specific action prompts instead of "No data found"
- WH-347 download loading/success state feedback — "Generating..." spinner transitioning to "Download ready" button
- Compliance preflight before WH-347 download — brief open-violation count as a final user checkpoint
- Print CSS for on-screen compliance reports

**Defer (v2.2+):**
- PDF fringe benefit summary report and worker pay history report
- Apprentice ratio daily check (COMP-03 rule)
- State-specific forms (CA DIR, WA L&I)
- Dark mode toggle

**Landing page specifics:** Hero must name WH-347, Davis-Bacon, and SAM.gov in the first viewport. Primary CTA is "Create Free Account" linking to `/register`. No logo bar at launch (no client logos available). Trust signals are compliance currency signals ("January 2025 WH-347 form — latest DOL revision"), regulatory alignment statements, and product screenshots — not fabricated social proof metrics. No stock hardhat photography; use product screenshots and HCC brand colors.

---

### Architecture Approach

The architecture is a single-SPA approach with no new routing infrastructure beyond what React Router already provides. `LandingPage.tsx` is a public React route at `/`, declared as a sibling outside the `<ProtectedRoute>` wrapper in `App.tsx`. No separate deployment, no iframe, no second Vite config. The `*` wildcard redirect must become auth-state-aware: authenticated users route to `/dashboard`, unauthenticated users route to `/`. The `/register` route must be explicitly added as a public sibling of `/login` — without this, the landing page CTA dead-ends at the login form for new users.

The design token flow is one-directional: `@theme` in `index.css` → Vite processes → CSS custom properties on `:root` plus generated utility classes → `@layer base` sets element font defaults → React components reference utility class names → browser resolves. A brand color change is a single-line edit in `index.css` with no JSX touch required.

**Major components:**
1. `src/client/index.css` — single source of truth for all design tokens, base styles, and shared component recipes; must not be split into imported sub-files
2. `src/client/components/ui/Badge.tsx` — typed status badge primitive with `gold | gray | green | red` variants; replaces all inline badge spans across 10+ pages
3. `src/client/components/ui/Card.tsx` — card shell primitive with optional padding variant; replaces inline card divs
4. `src/client/components/ui/PageHeader.tsx` — page title + subtitle + action slot; replaces repeated h1+button patterns on every page
5. `src/client/pages/LandingPage.tsx` — full marketing homepage at public route `/`; composed from section components under `components/landing/`

**Build sequence (dependency-ordered):**
1. CSS foundation (tokens, base, components layers) — validates the token pipeline before any React changes
2. Primitive UI components — typed wrappers that all pages will use
3. Layout + shared components polish — affects all protected pages simultaneously
4. Landing page + routing — public route, auth-aware wildcard
5. Page-by-page polish pass — apply tokens and primitives to all 8+ existing pages

---

### Critical Pitfalls

1. **`--color-*: initial` in `@theme` wipes all default Tailwind colors** — Adding this to "clean up" the palette silently removes all `text-gray-*`, `bg-red-*`, `bg-white`, and `border-*` classes from 33 existing components. Prevention: add tokens only; never use `initial` namespace wipe; add an explicit comment in `index.css` before touching the file.

2. **`@theme` in an imported CSS file fails silently** — TailwindCSS v4 only processes `@theme` from the file where `@import "tailwindcss"` lives. A separate `tokens.css` with `@theme` produces no utility classes. Prevention: all `@theme` content stays in `index.css`; only `@layer components` content is safe to split.

3. **`focus:outline-none` renamed to `outline-hidden` in v4** — 5+ confirmed instances of the old class exist on form inputs. In v4, `outline-none` sets a transparent 2px outline that interferes with the gold ring in accessibility and forced-color modes. Prevention: grep and replace as the first task in the typography phase.

4. **Global font application breaks table column widths** — Switching from browser default to Inter changes character metrics, causing `table-auto` column layout to recalculate. The 7-day payroll entry grid and dollar-amount columns are at overflow risk. Prevention: apply the font change as an isolated first step, then manually verify all table-heavy pages before proceeding.

5. **Landing page routing conflict with existing wildcard** — The current `<Navigate to="/dashboard" replace />` wildcard dead-ends new users: if `/register` is not an explicit public route, clicking the landing page CTA routes through `/dashboard` → `/login`. Prevention: write the full routing table spec (public vs. protected, auth states, wildcard behavior) before writing any landing page UI. Verify with 4 manual test cases.

6. **7 hardcoded inline `style={{ }}` brand values in existing components** — `ManualWageEntryForm`, `WageClassificationsTable`, `AdminStateWagePage`, `WageLookupPage`, and `ReportsPage` use `style={{ backgroundColor: '#F5C518' }}` or `style={{ fontFamily: 'Oswald' }}`. These will not update when design tokens are applied. Prevention: audit and clear all inline brand values as a prerequisite to token rollout.

7. **Generic landing page copy will not convert the target audience** — Contractors evaluating Davis-Bacon compliance software need "WH-347," "Davis-Bacon," and "SAM.gov" visible in the first viewport. Abstract SaaS language ("streamline your workflow") does not match how this audience searches or evaluates software. Prevention: write copy before building UI; verify the hero names the form and the regulation before touching JSX.

---

## Implications for Roadmap

The architecture and pitfall dependency ordering strongly suggests a 5-phase build. All phases are sequential — each depends on the prior phase being verified complete.

### Phase 1: CSS Design Token Foundation

**Rationale:** Everything else depends on this. Tokens must exist before primitive components can reference them. The three highest-severity pitfalls (color namespace wipe, `@theme` split failure, inline style drift) are all addressed in this phase. Doing this first validates the entire token pipeline before any React code is touched.

**Delivers:** Fully extended `@theme` block in `index.css` (colors, typography scale, spacing, shadows, radii); `@layer base` defaults for body and heading fonts; `.hcc-card` and `.hcc-table` in `@layer components`; Google Fonts loading via `index.html`; all 7 hardcoded inline brand values migrated to token-based classes.

**Addresses:** Typography consistency, card padding consistency, table styling (from FEATURES.md table stakes design)

**Avoids:** Color namespace wipe (Pitfall 3 in PITFALLS.md), inline style drift (Pitfall 6), font loading FOUT (ARCHITECTURE.md anti-pattern 5)

**Research flag:** Standard patterns — no additional research needed. Exact CSS is specified in ARCHITECTURE.md Pattern 1 and Pattern 2. Execute directly.

---

### Phase 2: Primitive UI Components

**Rationale:** `Badge`, `Card`, and `PageHeader` primitives are the building blocks all 8+ pages will use. Creating them before the page polish pass ensures consistent application — not page-by-page reinvention. Primitive creation requires Phase 1 tokens to be available.

**Delivers:** `components/ui/Badge.tsx` with `gold | gray | green | red | yellow` variants; `components/ui/Card.tsx` with padding variant; `components/ui/PageHeader.tsx` with title + subtitle + action slot.

**Implements:** ARCHITECTURE.md Pattern 4 (typed primitive wrappers)

**Avoids:** Inconsistent badge colors and multiple ad-hoc card implementations that accumulate independently across pages

**Research flag:** Standard patterns — implementation specs are in ARCHITECTURE.md Pattern 4. No additional research needed.

---

### Phase 3: App Shell + Layout Polish

**Rationale:** `Layout.tsx` wraps all protected pages. Polishing it once in a single phase ensures every page inherits the correct dark nav + gold accent without touching 8 individual page files. This phase also addresses the most visible first impression for returning users.

**Delivers:** `Layout.tsx` refactored to token classes with SVG logo; `LoginPage.tsx` polished (first impression for all new users); all protected pages receive `.hcc-table` class on their data tables.

**Addresses:** Dark nav + gold accent on every page, data table structure (FEATURES.md table stakes design)

**Avoids:** Regression risk — `Layout.tsx` changes affect all protected pages simultaneously; verify with existing 181-test suite after this phase before proceeding

**Research flag:** Standard patterns. Mechanical token substitution on shared components. No novel territory.

---

### Phase 4: Landing Page + Routing

**Rationale:** The landing page depends on the token system (Phase 1) and the `motion` package (new install). It requires a routing table redesign that must be planned in full before any UI is written (Pitfall 5 in PITFALLS.md). This phase is a self-contained deliverable — the public face of the product — and must be verified with all 4 routing test cases before declaring it complete.

**Delivers:** `LandingPage.tsx` at public route `/` with hero, pain acknowledgment, how-it-works, feature highlights, trust signals, CTA close, and footer; `App.tsx` routing updated with auth-aware wildcard; `/register` added as explicit public route; `motion`, `react-intersection-observer`, and `lucide-react` installed.

**Uses:** motion, react-intersection-observer, lucide-react (STACK.md new installs)

**Avoids:** Routing conflict dead-ending the registration flow (Pitfall 5), generic copy failing to convert the GC audience (Pitfall 7), CTA linking to `/login` instead of `/register` (PITFALLS.md UX pitfalls section)

**Research flag:** Copy strategy requires attention before building UI. The research confirms what the copy must contain (WH-347, Davis-Bacon, SAM.gov, outcome-focused framing) but the actual headline and section copy must be drafted and reviewed before JSX is written. This is a content problem, not a code problem.

---

### Phase 5: Page-by-Page Polish Pass

**Rationale:** With tokens, primitives, and layout established, each page becomes a safe, independent substitution pass: swap inline hex values for token classes, apply `<Badge>` and `<Card>` primitives, apply `<PageHeader>`, add empty states with action copy. Each page is independently verifiable. Run the 181 existing tests after each page to confirm no regressions.

**Delivers:** All 8+ existing app pages (Dashboard, ProjectDetail, Workers, PayrollEntry, PayrollWeekDetail, Reports, OTScenario, WageLookup) using token classes, primitive components, and consistent empty states; compliance badges with semantic colors across all pages; workflow progress indicator on ProjectDetail; WH-347 loading/success state feedback; compliance preflight summary before WH-347 download.

**Addresses:** All remaining FEATURES.md table stakes design items and differentiator features

**Avoids:** Font-change table column overflow (Pitfall 4) — apply Inter globally as the first action in Phase 5 and verify the payroll grid at 1280px before continuing; `focus:outline-hidden` migration (Pitfall 2) — first task of this phase

**Research flag:** Manual visual verification required on PayrollEntryPage (7-day grid) and WageClassificationsTable after Inter is applied globally. No automated test covers layout regression. Flag these two pages for explicit human review before Phase 5 is declared complete.

---

### Phase Ordering Rationale

- CSS tokens before components before pages: `@theme` must exist before components reference generated utility classes. Components must exist before pages use them. This is a hard dependency chain with no safe way to reorder.
- Layout before individual pages: `Layout.tsx` wraps all protected pages. One change propagates everywhere. Polishing it in Phase 3 means Phase 5 pages inherit the correct nav without per-page nav work.
- Landing page as a discrete phase: The landing page is the only new route, uses the only new packages, and requires the routing table redesign. Isolating it in Phase 4 lets the routing be fully verified before page polish begins.
- Fix pitfalls before extending: Pitfall 2 (outline-none), Pitfall 4 (font + tables), and Pitfall 6 (inline styles) are each addressed in their respective prerequisite phases — not deferred. Deferring these creates compounding visual inconsistency that is harder to untangle later.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All three new packages confirmed at current versions; React 19 + Vite compatibility verified; TailwindCSS v4 patterns from official documentation |
| Features | HIGH | Functional features grounded in 29 CFR regulatory docs and January 2025 WH-347 revision. Design features from live competitor research (LCPtracker, Elation, Hammr) and SaaS pattern library analysis |
| Architecture | HIGH | TailwindCSS v4 `@theme` behavior verified against official docs and confirmed GitHub issues; all patterns validated against direct codebase inspection of 33 TSX files |
| Pitfalls | HIGH | Critical pitfalls confirmed against official v4 docs, GitHub issues, and direct codebase audit; all 7 inline style locations identified by file and line pattern |

**Overall confidence:** HIGH

### Gaps to Address

- **Font weight selection:** Research recommends Oswald at 400/600 and Inter at 400/500/600. Confirm whether bold Inter (700) is needed for any compliance badge label before writing the Google Fonts URL — adding a weight later requires a cache-bust deploy.
- **WageClassificationsTable `<tr>` background:** The table uses `style={{ backgroundColor: '#F5C518' }}` on a `<tr>` element. Migration to `className="bg-brand-gold"` on a `<tr>` should be verified against TailwindCSS v4's specificity behavior on table row elements before applying broadly.
- **Auth-aware wildcard implementation:** Pitfall 5 identifies that the wildcard must distinguish authenticated from unauthenticated users. The existing `ProtectedRoute` auth-check logic may need extraction into a shared `useAuth` hook to avoid duplication in both `ProtectedRoute` and the new wildcard component. Evaluate scope during Phase 4 routing planning.

---

## Sources

### Primary (HIGH confidence)

- [TailwindCSS v4 @theme directive — official docs](https://tailwindcss.com/docs/theme) — token system, utility class generation, namespace wipe behavior
- [TailwindCSS v4 @layer / adding custom styles — official docs](https://tailwindcss.com/docs/adding-custom-styles) — base, components, utilities layer semantics
- [TailwindCSS v4 upgrade guide — official docs](https://tailwindcss.com/docs/upgrade-guide) — shadow scale rename, outline-none rename, ring width changes
- [GitHub issue #18966 — @theme fails in imported CSS files](https://github.com/tailwindlabs/tailwindcss/issues/18966) — confirmed @theme split limitation
- [motion npm / motion.dev docs](https://motion.dev/docs/react) — v12 React import path, whileInView API, React 19 compatibility
- [DOL WH-347 form and instructions (Rev. Jan 2025)](https://www.dol.gov/agencies/whd/forms/wh347) — WH-348 consolidation, J/RA field addition
- Direct codebase audit — 33 TSX files reviewed for inline styles, v4-affected classes, table patterns (2026-03-20)

### Secondary (MEDIUM confidence)

- [LCPtracker](https://lcptracker.com/), [Elation Systems](https://www.elationsys.com/), [Hammr](https://www.hammr.com/prevailing-wage-software-for-construction) — live competitor design research (2026-03-20)
- [SaaSUI Design Library](https://www.saasui.design/) — SaaS UI pattern research; 22+ B2B SaaS pattern categories
- [GitHub discussion #18560 — @theme vs @theme inline](https://github.com/tailwindlabs/tailwindcss/discussions/18560) — when inline keyword is required
- [React Router: Private Routes — Robin Wieruch](https://www.robinwieruch.de/react-router-private-routes/) — public vs. protected route pattern
- [B2B SaaS Landing Page Best Practices — Flow Agency](https://www.flow-agency.com/blog/b2b-saas-landing-page-best-practices/) — CTA placement, hero structure
- [9 B2B Landing Page Lessons From 2025 — Instapage](https://instapage.com/blog/b2b-landing-page-best-practices) — copy mistakes, feature-vs-benefit framing

### Tertiary (LOW confidence)

- [Framer Motion + Tailwind 2025 stack — dev.to](https://dev.to/manukumar07/framer-motion-tailwind-the-2025-animation-stack-1801) — community validation of motion + Tailwind pairing; consistent with official docs but not authoritative
- [Tailwind v4 + shadcn transparency bug — GitHub discussion](https://github.com/tailwindlabs/tailwindcss/discussions/17137) — reinforces not using shadcn; community report, not officially confirmed

---

*Research completed: 2026-03-20*
*Ready for roadmap: yes*
