# Pitfalls Research

**Domain:** Design polish + landing page on existing React + TailwindCSS v4 app
**Researched:** 2026-03-20
**Confidence:** HIGH (Tailwind v4 official docs, direct codebase audit of 33 TSX files, community discussions)

---

## Critical Pitfalls

### Pitfall 1: TailwindCSS v4 Renamed Shadow Classes Will Break Existing Components If New Code Uses v3 References

**What goes wrong:**

TailwindCSS v4 shifted the shadow scale by one step. `shadow-sm` in v4 produces what `shadow` produced in v3. `shadow-xs` in v4 produces what `shadow-sm` produced in v3. If any new landing page or polished component code is written against v3 documentation or tutorial examples, the shadow weights will be off. A landing page card using `shadow-sm` for a subtle lift will render heavier than intended. Existing components already in the codebase (GsaRateDisplay, LiveCalcDisplay) that use `shadow-sm` were presumably built against v4 semantics and look correct today — the danger is new code added during this milestone that copies v3 patterns.

Full rename table relevant to this project:

| v3 class | v4 equivalent |
|----------|--------------|
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `shadow-md` | `shadow-md` (unchanged) |
| `shadow-lg` | `shadow-lg` (unchanged) |
| `shadow-xl` | `shadow-xl` (unchanged) |

**Why it happens:**

The majority of Tailwind tutorials, component libraries, and StackOverflow answers were written for v3. When building the landing page, developers copy-paste hero sections and card components from v3-era resources without realizing the shadow scale shifted.

**How to avoid:**

Before writing any new component, set a rule: reference the [official v4 shadow docs](https://tailwindcss.com/docs/box-shadow) directly, not any third-party tutorial. When establishing the design token system, define named shadow tokens (`--shadow-card: ...`) in `@theme` so new components reference tokens, not raw Tailwind shadow classes. This insulates all components from the scale confusion.

**Warning signs:**

Landing page cards look noticeably heavier or lighter than app cards using the same class. A "subtle" shadow looks like a modal shadow. Visual inconsistency between pages that should feel unified.

**Phase to address:** Design Token phase — define `--shadow-card`, `--shadow-modal`, `--shadow-elevated` as explicit tokens in `@theme` before writing any new UI.

---

### Pitfall 2: focus:outline-none Behavior Changed in v4 — Existing Form Inputs Have a Broken Focus Pattern

**What goes wrong:**

The existing codebase uses `focus:outline-none focus:ring-2 focus:ring-[#F5C518]` on form inputs throughout LoginForm, RegisterForm, and GsaRateForm. In TailwindCSS v4, `outline-none` was renamed to `outline-hidden`. The old `outline-none` in v4 sets `outline: 2px solid transparent` — which is visually invisible but technically creates a focus outline that can interfere with the `ring` on some browsers and accessibility tools.

The `ring` bare class also changed: in v3 it generated a `3px` ring; in v4 it generates a `1px` ring. The code uses `ring-2` (explicit width), which is safe, but `ring-1` patterns elsewhere in `GsaRateForm` will produce a thinner ring than was designed.

**Why it happens:**

These utilities were stable across v3 and looked correct in development. The v4 behavior change for `outline-none` is subtle — the ring still appears, the change only becomes apparent in browser accessibility mode, forced-colors mode, or when a downstream CSS reset applies its own outline handling.

**How to avoid:**

Global search for `outline-none` in `src/client/` and replace every instance with `outline-hidden`. This is a mechanical find-and-replace with no logic risk. Do it at the start of the Typography/Input Polish phase. There are at least 5 confirmed occurrences (LoginForm: 2, RegisterForm: 2, GsaRateForm: 1).

**Warning signs:**

Input fields show a faint duplicate focus indicator in forced-color accessibility mode. Screen reader tools report "outline: 2px transparent" as the focus style. In some browsers, tabbing to an input shows both a system outline and the gold ring simultaneously.

**Phase to address:** Typography + Input Polish phase — fix all form inputs as the first task of that phase before changing any visual styling.

---

### Pitfall 3: @theme Color Token Addition Can Accidentally Wipe All Default Utility Colors

**What goes wrong:**

TailwindCSS v4 uses `@theme` to define design tokens that also generate utility classes. The current `@theme` in `src/client/index.css` is minimal and correct:

```css
@theme {
  --color-brand-gold: #F5C518;
  --font-headline: 'Oswald', sans-serif;
  --font-body: 'Inter', sans-serif;
}
```

The dangerous pattern emerges when a developer, wanting to "clean up" the color system and restrict available utilities to only brand-approved colors, adds `--color-*: initial` to the theme block. This clears the entire color namespace. Every `text-gray-*`, `bg-red-*`, `bg-white`, `text-black`, and `border-gray-*` class across all 33 components silently stops working. The app renders with no background colors, no text colors beyond currentColor, and no border colors — a catastrophic visual regression that no test will catch.

**Why it happens:**

The Tailwind v4 docs describe `--color-*: initial` as the way to replace the full color palette when building a custom design system. It is the correct tool for a greenfield custom design system. It is the wrong tool for adding tokens to an existing system that depends on Tailwind's default palette.

**How to avoid:**

ADD tokens to `@theme`. Never use `--color-*: initial` or `--*: initial` in this project. The project already has 33 components using `text-gray-*`, `bg-red-*`, `bg-green-*`, and other default Tailwind colors for compliance badges, error states, and status indicators. All of these must remain functional. The design token strategy for this project is additive: define brand-specific tokens (`--color-brand-gold`, `--color-nav-dark`, etc.) without removing any defaults.

**Warning signs:**

After a `@theme` change, the entire app renders with white backgrounds and black text only. Tables have no border colors. Compliance badges (red/green) disappear. The Vite HMR reload triggers immediate full visual collapse.

**Phase to address:** Design Token phase — establish the "ADD only, never wipe" rule explicitly in a comment inside `index.css` before any token additions.

---

### Pitfall 4: Global Font Change Breaks Payroll Table Column Widths

**What goes wrong:**

The payroll entry and week detail pages contain numeric-heavy tables with 7-day-of-week columns and dollar amount columns. These tables use HTML `table` elements with `table-auto` layout, which calculates column widths from content width. The system currently uses the browser default font (likely a system sans-serif). Switching to Inter — a well-hinted web font with specific character metrics — will change the rendered width of every text node. In `table-auto`, this directly changes column widths.

Specific risk scenarios:
- The 7-day payroll entry grid (monST, monOT, tueST... sunOT) may exceed its container on narrow viewports after Inter increases character spacing
- Dollar amount columns with values like `$1,234.56` may gain 2-4px per cell, causing the rightmost columns to push outside the visible area
- `WageClassificationsTable.tsx` (used on multiple pages) has a gold `<tr style={{ backgroundColor: '#F5C518' }}>` header row — confirming it was hand-styled and column widths were not explicitly constrained

The 181 passing tests cover compliance logic, not layout. No test will catch these regressions.

**Why it happens:**

Typography changes feel "safe" because they don't touch business logic. Layout is emergent — it depends on font metrics that developers do not treat as part of their mental model of what typography changes affect.

**How to avoid:**

Apply Inter as the global body font first, as an isolated change, and do a manual visual review of every table-heavy page before making any other design changes:
1. PayrollEntryPage (7-day grid with ST/OT columns)
2. PayrollWeekDetailPage (hours + dollar amounts + compliance flags)
3. WorkersPage (classifications table with base rate, fringe rate, total rate columns)
4. ReportsPage (fringe benefit summary, worker pay history)
5. WageClassificationsTable component (shared, used in multiple pages)

If any column overflows, add explicit `min-w-*` or `w-*` constraints to the affected `<th>` elements before proceeding with further styling. This is an additive fix that does not change any logic.

**Warning signs:**

After applying the font, horizontal scrollbars appear on previously non-scrollable tables. Dollar amounts wrap across two lines mid-value. Day-column headers no longer align with their data cells. The payroll entry grid pushes outside the `max-w-7xl` container.

**Phase to address:** Typography phase — apply global font change as the very first step, do the visual audit immediately, fix any column overflows before moving to card/table polish.

---

### Pitfall 5: Landing Page Route Conflicts With Existing Wildcard Redirect

**What goes wrong:**

The current `App.tsx` has `<Route path="*" element={<Navigate to="/dashboard" replace />} />` as the catch-all. When the landing page is added at `/`, the routing table creates a conflict: an unauthenticated visitor who types any URL other than `/` or `/login` is sent to `/dashboard`, which sends them to `/login` (via ProtectedRoute), which is the correct behavior. But the problem is the landing page CTA.

If the landing page CTA links to `/register` and `/register` is not added as an explicit public route, the visitor is sent to `/dashboard` by the wildcard, then to `/login` by ProtectedRoute. The registration path is dead. New users cannot sign up from the landing page — the entire purpose of the landing page is broken.

A second conflict: the wildcard currently sends authenticated users with a bad URL to `/dashboard`. If the wildcard is changed to send everyone to `/` (the landing page), then authenticated users who mistype a URL see the marketing page, then get redirected to `/dashboard`, creating an unnecessary redirect hop and a flash of the landing page.

**Why it happens:**

The existing routing was designed for a single-entry-point app where `/login` is the homepage. Adding a marketing landing page requires redesigning the entire public/protected route split, including what the wildcard does and what happens when an authenticated user visits a public route.

**How to avoid:**

Plan the full routing table as a written spec before touching `App.tsx`:

| Path | Public | Authenticated user visits | Unauthenticated user visits |
|------|--------|--------------------------|----------------------------|
| `/` | Yes | Redirect to `/dashboard` | Show landing page |
| `/login` | Yes | Redirect to `/dashboard` | Show login form |
| `/register` | Yes | Redirect to `/dashboard` | Show register form |
| `/dashboard` | No | Show dashboard | Redirect to `/login` |
| `*` wildcard | — | Redirect to `/dashboard` | Redirect to `/` |

The wildcard needs auth-state awareness: authenticated users should go to `/dashboard`, unauthenticated users should go to `/`. The current `ProtectedRoute` component can be reused but the wildcard itself needs to become an auth-aware component rather than a static `<Navigate>`.

**Warning signs:**

Landing page CTA click results in the login page appearing instead of the registration form. An authenticated user mistyping a URL sees the marketing page momentarily before redirecting. The back button from `/login` returns to the landing page and immediately redirects again (loop).

**Phase to address:** Landing Page phase — rewrite the routing table as the first task before building any landing page UI. Verify the routing spec with 4 manual test cases (public URLs × 2 auth states).

---

### Pitfall 6: Hardcoded Inline Style Brand Values Will Not Update With Design Tokens

**What goes wrong:**

The codebase audit found 7 instances of `style={{ ... }}` using brand-specific values:

- `ManualWageEntryForm.tsx`: `style={{ backgroundColor: '#F5C518' }}`
- `WageClassificationsTable.tsx`: `<tr style={{ backgroundColor: '#F5C518' }}>` (the gold header row)
- `AdminStateWagePage.tsx`: `style={{ backgroundColor: ... '#F5C518' ... }}` (conditional)
- `WageLookupPage.tsx`: `style={{ backgroundColor: '#F5C518' }}`
- `ReportsPage.tsx`: `style={{ fontFamily: 'Oswald, sans-serif' }}` (3 instances — section headers in the reports)

When design tokens are applied and `--color-brand-gold` is the canonical gold value, these 7 elements will not update. If the brand gold is adjusted (even slightly, e.g., for print contrast), or if Oswald is swapped for a different headline font during a future brand refresh, these locations will silently diverge from the rest of the application.

During the design polish work, if the gold is visually adjusted on most buttons but not on these 4 hardcoded elements, the app will have two visually different "golds" — detectable to a careful eye, unprofessional to a client demo audience.

**Why it happens:**

These were pragmatic shortcuts during earlier development passes. Conditional backgrounds and inline font families are the path of least resistance when Tailwind's arbitrary value syntax feels cumbersome or when a dynamic value is needed.

**How to avoid:**

Migrate all 7 instances as part of the Design Token phase:
- `style={{ backgroundColor: '#F5C518' }}` → `className="bg-brand-gold"` (after the `@theme` token is confirmed)
- Conditional: `style={{ backgroundColor: condition ? '#F5C518' : undefined }}` → `className={condition ? 'bg-brand-gold' : ''}`
- `style={{ fontFamily: 'Oswald, sans-serif' }}` → `className="font-headline"` (the `@theme` token already exists)

**Warning signs:**

After a gold color token update in `@theme`, most buttons update but the WageClassificationsTable header row remains the old gold. The Reports page section headers render Oswald even after a theoretical font swap. Running `grep -rn "style={{" src/client/` after the design polish milestone should return zero brand color or font family values.

**Phase to address:** Design Token phase — audit and clear all inline brand values as a prerequisite before adding new token-based styling.

---

### Pitfall 7: B2B SaaS Landing Page With Generic Copy Does Not Convert Contractors

**What goes wrong:**

A landing page that says "Streamline your payroll workflow" or "Modern compliance management for your business" will not convert a general contractor who is worried about a Davis-Bacon audit. The landing page audience is a specific person: a GC or project manager who has manually looked up prevailing wage rates, printed WH-347 forms, and been told by their attorney that incomplete certified payroll can disqualify them from future bids.

Generic SaaS hero language fails because:
1. It doesn't name the problem the user actually has (the WH-347 form, the SAM.gov rate lookup, the DOL audit risk)
2. It doesn't mention Davis-Bacon, which is the exact search term the target user types
3. It uses abstract benefit language ("streamline", "optimize") instead of concrete action language ("generate the WH-347 form in 3 clicks, with rates auto-filled from SAM.gov")

This is not a code pitfall — it is an execution risk that will result in a beautiful landing page that generates zero registrations.

**Why it happens:**

Developers write copy the way they describe features to each other: "it helps with payroll compliance." Product marketing copy must describe the user's problem from the user's perspective: "You lose federal contracts because your certified payroll has errors."

**How to avoid:**

The hero headline must name the form: "WH-347 Certified Payroll, Done Right." or "Stop Manually Looking Up Davis-Bacon Rates." The subheadline must state the outcome: "Generate the January 2025 WH-347 form with wage rates auto-populated from SAM.gov. No manual rate lookup. No missed compliance flags." The feature list must name specific features: "Auto-fetches federal wage determinations by state/county," "Flags under-wage payments before submission," "Generates multi-page WH-347 for large crews."

Competitors to beat (LCPtracker, Elation, ADP) all have enterprise-feeling but generic copy. HCC wins by being more specific.

**Warning signs:**

Landing page copy could describe any construction software. The WH-347 form is not mentioned by name in the hero. "Davis-Bacon" does not appear in the first viewport. The CTA says "Get Started" instead of something specific ("Try It Free" or "Generate Your First WH-347").

**Phase to address:** Landing Page phase — write copy before building the UI. Verify: does the hero mention WH-347, Davis-Bacon, or SAM.gov? If not, rewrite before building.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Leave `focus:outline-none` unfixed | Saves 20 minutes | Accessibility failures; inconsistent focus rings across forms; fails WCAG 2.1 SC 2.4.7 | Never — fix during Typography phase |
| Keep inline `style={{ backgroundColor: '#F5C518' }}` | No code change needed | Token rollout creates two sources of truth for brand gold; one-off fixes required on every brand update | Never — clear before design token rollout |
| Load all 9 Google Font weights (100-900) for Inter | Font always available | 600-900ms extra TTFB on first load; LCP degrades | Never — load only weights actually used: 400, 500, 600 |
| Use CSS animations from a third-party library on landing page | Visual polish faster | 30-100KB of unused animation CSS hits every app route | Never — write the 2-3 keyframes needed directly |
| Skip routing table planning and just add `/` as a route | Landing page renders immediately | CTA points to wrong destination; auth edge cases break on first test | Never — routing spec must precede UI |
| Apply `--color-*: initial` to "clean up" Tailwind defaults | Clean token namespace | Nukes all default Tailwind colors; all 33 components break | Never in this project |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Fonts loading | Using `@import url(...)` inside the `@theme {}` block in `index.css` | Load Google Fonts via `<link>` in `src/client/index.html` or as a top-level `@import` before `@import "tailwindcss"` in `index.css` — never inside `@theme` |
| Google Fonts loading | Loading Oswald and Inter font families on the landing page but not in the app (or vice versa) | Both fonts are used in `@theme` for the whole app — load them once in `index.html` for all routes; Google Fonts will cache them |
| Vite `root: 'src/client'` | Adding CSS outside `src/client/` and expecting Tailwind to process it | All CSS must live under `src/client/` — the Vite config sets `root: 'src/client'`; files outside this root are not processed by `@tailwindcss/vite` |
| CSS custom properties on landing page | Defining landing-page-specific CSS variables in a separate file that is conditionally loaded | Use the global `@theme` in `index.css` for all tokens; never conditionally load CSS per route in this stack — it creates cascade ordering surprises |
| `@theme inline` vs `@theme` | Using `@theme inline` by default for all tokens | Only use `@theme inline` when a token value references another CSS variable; literal string values (like `'Oswald', sans-serif`) are safe in plain `@theme` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Hero image unoptimized (PNG, no dimensions) | LCP > 2.5s; Google penalizes landing page; first impression is blank | Use WebP, set explicit `width`/`height`, add `fetchpriority="high"` to hero `<img>` | Every visit on mobile or slow connection |
| Loading all Google Font weights (100-900) | Fonts take 400-800ms to load; text renders with system fallback until then (FOUT) | Specify exact weights in the Google Fonts URL: `?family=Oswald:wght@400;600&family=Inter:wght@400;500;600` | First visit to any page before fonts are cached |
| Landing page CSS bleeds into app bundle | App gets heavier with each landing section added | Keep all landing styles as Tailwind utilities (no new CSS layers); if custom styles needed, scope them to a `.landing` parent class | At scale; not a problem at current project size |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `/register` not added as an explicit public route | Unauthenticated visitors following the CTA get redirected to login (dead end); no security risk but registration is unreachable | Add `/register` as a sibling of `/login` outside `ProtectedRoute` in `App.tsx` |
| Landing page served through a component that reads from AuthContext before AuthContext has initialized | Loading spinner flashes; in worst case, a brief redirect to `/login` occurs for all visitors including unauthenticated ones | Landing page component should render immediately without waiting for `isAuthenticated` to resolve — it is a public page |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Landing page CTA says "Get Started" and links to `/login` | New visitors have no account — they see a login form and don't know what to do | CTA says "Start Free" and links to `/register`; secondary link below says "Already have an account? Log in" |
| Landing page hero uses the same `bg-gray-900` dark as the app nav | Visitors feel they are already inside the app; the marketing page loses its distinct identity | Use a slightly different dark for the landing hero (e.g., `bg-gray-950` or pure black `#000`) vs. the nav's `#1a1a1a` |
| Design polish changes the visual position or label of the "Submit Payroll" / "Generate WH-347" buttons | Users who process payroll weekly have muscle memory for the submit flow; a moved button causes errors on deadline day | During polish, change color, shadow, border-radius — never change position or label of compliance-critical action buttons |
| Single CTA in landing page hero only | Users who read the full feature list (scrolled to the bottom) must scroll all the way back up to register | Repeat the CTA button after the features section and at the page bottom |
| Landing page uses animated number counters ("10,000+ contractors") without real data | Skeptical B2B buyers see placeholder-looking numbers and trust the brand less | Use specific, true claims ("Generates the January 2025 WH-347 revision") rather than fabricated social proof |

---

## "Looks Done But Isn't" Checklist

- [ ] **Design token cleanup:** Run `grep -rn "style={{" src/client/` and confirm zero instances of `#F5C518` or `Oswald` in inline styles before considering tokens "done"
- [ ] **focus:outline-hidden migration:** Tab through every form in the app (Login, Register, Payroll Entry, Worker Add, Project Create) — confirm gold ring appears clearly with no double-outline
- [ ] **Table layout after font change:** Open PayrollEntryPage on a 1280px viewport — confirm the 7-day hour grid fits without horizontal scroll after Inter is applied globally
- [ ] **Landing page routing — 4 cases:** (1) Unauthenticated visits `/` → landing page. (2) Authenticated visits `/` → redirected to `/dashboard`. (3) Unauthenticated clicks CTA → `/register` form appears. (4) Unauthenticated visits `/bad-url` → redirected to `/` not `/dashboard`
- [ ] **Registration reachable:** New user can complete the full flow: landing page → CTA click → register form → dashboard — without ever seeing an unexpected redirect
- [ ] **Brand consistency:** Open LoginPage, DashboardPage, WorkersPage, ReportsPage side-by-side — all headings use Oswald at the same scale, all primary buttons are the same gold, all card shadows are the same depth
- [ ] **Google Fonts load:** Check Network tab — only `Oswald:wght@400;600` and `Inter:wght@400;500;600` are requested, not the full 9-weight family
- [ ] **Landing page mobile:** Resize to 375px width — hero headline fits on 3 lines max, CTA button is full-width, feature list is readable, no horizontal scroll

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `@theme` color namespace wipe with `--color-*: initial` | LOW | Revert the `@theme` block to remove `initial`; all default Tailwind colors return on next Vite HMR rebuild; no data or logic affected |
| Table column overflow after font change | LOW | Add `min-w-[X]` to affected `<th>` elements — purely additive, no logic changes, no test risk |
| Landing page CTA links to wrong route | LOW | Update `href` in the CTA component and add `/register` to `App.tsx` as a public route; 30-minute fix |
| Inline style drift discovered post-launch | LOW | `grep -rn "style={{" src/client/` identifies all instances; migrate one-by-one to `className` utilities; no functional risk |
| Generic copy on landing page doesn't convert | MEDIUM | Copy is a content change only — HTML edit, no CSS/logic risk; but requires a re-deploy and potentially re-designing the hero section around the new copy structure |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Shadow class rename confusion | Phase 1: Design Tokens | All new components reference shadow tokens, not raw `shadow-*` classes |
| `focus:outline-none` broken in v4 | Phase 2: Typography + Input Polish | Tab through all forms; gold ring appears without double outline |
| `@theme` color namespace wipe | Phase 1: Design Tokens | `--color-*: initial` never appears in `index.css`; all default Tailwind colors still render on existing pages |
| Font change breaks table columns | Phase 2: Typography (first action in phase) | PayrollEntryPage 7-day grid fits at 1280px after Inter applied |
| Landing page routing conflicts | Phase 3: Landing Page (routing spec first) | 4-case routing test passes before any landing page UI is built |
| Inline brand styles survive token rollout | Phase 1: Design Tokens | `grep style src/client/` returns zero hardcoded `#F5C518` or `Oswald` values |
| Generic landing page copy | Phase 3: Landing Page (copy before UI) | Hero mentions WH-347 by name; "Davis-Bacon" appears in first viewport |

---

## Sources

- [Tailwind CSS v4 Theme Variables — Official Docs](https://tailwindcss.com/docs/theme) — `@theme` vs `:root`, `inline` keyword, namespace wipe behavior
- [Tailwind CSS v4 Upgrade Guide — Official Docs](https://tailwindcss.com/docs/upgrade-guide) — full rename table: shadows, rings, outlines
- [Tailwind CSS v4.0 Release Notes](https://tailwindcss.com/blog/tailwindcss-v4) — default ring/border color changes, browser requirements
- [v4 @theme vs @theme inline — GitHub Discussion #18560](https://github.com/tailwindlabs/tailwindcss/discussions/18560) — when `inline` is needed vs. default behavior
- [Theming best practices in v4 — GitHub Discussion #18471](https://github.com/tailwindlabs/tailwindcss/discussions/18471) — additive token strategy
- [React Router: Private Routes — Robin Wieruch](https://www.robinwieruch.de/react-router-private-routes/) — public vs. protected route pattern, auth-aware wildcard
- [B2B SaaS Landing Page Best Practices 2026 — Genesys Growth](https://genesysgrowth.com/blog/designing-b2b-saas-landing-pages) — copy mistakes, feature-vs-benefit framing
- [9 B2B Landing Page Lessons From 2025 — Instapage](https://instapage.com/blog/b2b-landing-page-best-practices) — CTA placement, hero structure
- Codebase audit — `src/client/` — 33 TSX files reviewed for inline styles, v4-affected utility classes, table patterns (2026-03-20)

---
*Pitfalls research for: Design polish + landing page on existing React + TailwindCSS v4 app (HCC Prevailing Wage v2.1)*
*Researched: 2026-03-20*
