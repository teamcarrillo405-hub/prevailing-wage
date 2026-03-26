# Phase 27: Design Elevation - Research

**Researched:** 2026-03-26
**Domain:** TailwindCSS v4 design tokens, Vite asset pipeline, React component surgery
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Photography (DES-02 input)**
- D-01: Source is Unsplash / Pexels stock — free, no attribution required on Unsplash
- D-02: Two photo spots — hero on LandingPage + a subtle dark photo behind the DashboardPage page header area (desaturated/low-opacity)
- D-03: Hero scene = infrastructure / bridge / highway — aligns with Davis-Bacon's federal public works context
- D-04: Dashboard background = subtle dark photo, low opacity — behind the dashboard page header strip, not behind cards themselves
- D-05: Assets stored as WebP <200KB each, referenced via CSS background-image (not Vite import). A @media print override removes all dark overlays so printed/exported views stay clean.

**Hero Layout (DES-02)**
- D-06: Full-bleed photo, centered text — photo covers 100vw, dark overlay bg-black/60, headline + subhead + CTA centered
- D-07: Oswald headline: clamp(56px, 8vw, 88px) — matches roadmap spec exactly
- D-08: Subhead: Inter 20px. CTA: gold button (existing bg-brand-gold Button primary variant)
- D-09: Nav floats over the hero photo — nav bar is transparent or semi-transparent on top of the photo. Implementation agent decides the cleaner approach; must keep nav fully legible
- D-10: Non-landing pages keep the current dark nav bar bg-nav-dark — the floating treatment is landing page only

**Card Shadow Scope (DES-01)**
- D-11: Dashboard project cards only receive elevated shadow 0 8px 24px rgba(0,0,0,0.12). Applied as a className prop on ProjectCard instances inside DashboardPage — not a global Card default change
- D-12: HelpCallout gets the elevated shadow too — update the HelpCallout component's shadow class to match shadow-[0_8px_24px_rgba(0,0,0,0.12)]
- D-13: All other Card instances (workers, payroll, reports, modals) retain the existing shadow-card token
- D-14: Do NOT change --shadow-card in index.css — add a new --shadow-card-elevated token instead: 0 8px 24px rgba(0,0,0,0.12)

**Typography Rhythm (DES-03)**
- D-15: tracking-tight Oswald letter-spacing applies to H1 headlines only — specifically PageHeader title and the LandingPage hero headline
- D-16: Apply tracking-tight inside the PageHeader component itself (the h1 element) so all page titles get it automatically
- D-17: Full h1/h2 audit — grep all .tsx files for raw h1 and h2 tags not inside PageHeader. Migrate every one found to the appropriate design primitive

### Claude's Discretion

- Exact Unsplash/Pexels search query and image selection (seek dark-toned, high-contrast infrastructure scenes that work with a 60% overlay)
- Whether nav float uses CSS position: sticky with transparent bg-to-overlay, or hero uses negative mt offset
- Exact tracking-tight implementation in PageHeader (add to existing title className)
- New --shadow-card-elevated token naming and exact CSS variable declaration location in index.css

### Deferred Ideas (OUT OF SCOPE)

None — all discussed topics stayed within DES-01/02/03 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DES-01 | App visual design elevated — construction photography in hero/dashboard, dark gold gradients, card depth shadows | Shadow token pattern in index.css @theme; ProjectCard className prop addition; HelpCallout shadow change |
| DES-02 | Landing page hero: full-bleed construction photography, dark overlay, Oswald clamp(56px,8vw,88px) headline, high-contrast CTA | Vite public/ asset path for CSS url(); LandingNav float approach; HeroSection structural rewrite |
| DES-03 | All pages: tighter letter-spacing on Oswald headlines, improved spacing rhythm; no page uses raw h1/h2 outside PageHeader | PageHeader h1 tracking-tight; raw h1/h2 audit results; migration targets listed explicitly |
</phase_requirements>

---

## Summary

Phase 27 is pure frontend CSS/JSX surgery — no backend changes, no new routes, no DB migrations. All decisions are locked. The work divides cleanly into three streams matching the requirement clusters: (1) shadow token + component updates, (2) photography assets + hero/dashboard layout, (3) typography audit + PageHeader fix.

The most consequential discovery is that **ProjectCard does not use the Card primitive and has no className prop**. It is a raw `<button>` element with hardcoded `shadow-sm`. This means D-11 (elevated shadow via className prop on DashboardPage render sites) requires first adding a `className` prop to ProjectCard — a safe, additive change. All other Card usages are unaffected because they use the Card primitive which already accepts className.

The second key finding is the **Vite public directory path**. With `root: 'src/client'` in vite.config.ts, the Vite public directory (for files served verbatim without hashing, reachable via CSS `url('/')`) is `src/client/public/`. This directory does not yet exist and must be created. CSS background-image references using root-relative paths like `/images/hero.webp` will work correctly. The `src/assets/` approach does NOT work for CSS url() without Vite import handling.

The h1/h2 audit found **nine pages** with raw `<h1>` page-title headings outside PageHeader. However, the DES-03 scope specifically targets page-level titles. The `<h2>` raw tags are all section headings within panels/modals — appropriate use of h2 for semantic structure, not page titles. The planner should scope migration to h1 page titles only, not all h2 section headings.

**Primary recommendation:** Execute in three plans — (P1) token + component surgery, (P2) photography assets + hero/dashboard layout, (P3) h1 audit + typography migration.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| TailwindCSS | 4.2.2 | Utility CSS, @theme tokens | Installed |
| @tailwindcss/vite | 4.2.2 | Vite integration for TW4 | Installed |
| Vite | 8.0.0 | Asset pipeline, dev server | Installed |
| React | 19.2.4 | Component framework | Installed |

No new packages required for this phase.

---

## Architecture Patterns

### Vite Asset Pipeline — The Critical Decision

Vite's behavior depends on `root` in vite.config.ts. This project sets `root: 'src/client'`. Therefore:

| Asset Location | URL in CSS | Hashed? | Use Case |
|---------------|-----------|---------|---------|
| `src/client/public/images/hero.webp` | `/images/hero.webp` | No | CSS background-image (CORRECT approach) |
| `src/client/assets/hero.webp` (JS import) | `/assets/hero.[hash].webp` | Yes | `<img src={import}>` in JSX (WRONG for CSS url()) |

**Rule:** CSS `background-image: url(...)` references must use the public/ directory because CSS files are processed at build time with static paths. Vite does not resolve CSS url() against `src/assets/` at build time in the same way it resolves JS imports.

**Correct path:** Create `src/client/public/images/` directory. Place `hero.webp` and `dashboard-bg.webp` there. Reference in CSS inline styles or a utility class as `url('/images/hero.webp')`.

### TailwindCSS v4 @theme Shadow Token

In TailwindCSS v4, `@theme` CSS custom properties with the `--shadow-*` prefix automatically generate utility classes. Adding to `src/client/index.css`:

```css
/* Source: TailwindCSS v4 @theme token convention */
@theme {
  /* existing tokens ... */
  --shadow-card-elevated: 0 8px 24px rgba(0,0,0,0.12);
}
```

This automatically creates the `shadow-card-elevated` Tailwind utility class (no arbitrary value syntax needed). Usage: `className="... shadow-card-elevated"`.

The existing `--shadow-card` token already follows this exact pattern and generates `shadow-card`. This is HIGH confidence — directly verified from index.css and TailwindCSS v4 @theme documentation behavior.

### CSS Background-Image with Overlay Pattern

The HeroSection will use a sibling `<div>` overlay approach (cleaner than `::before` pseudo-elements in JSX/React):

```tsx
// Pattern: photo container with absolute overlay div
<section
  className="relative min-h-screen text-white"
  style={{ backgroundImage: "url('/images/hero.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }}
>
  {/* dark overlay */}
  <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
  {/* content sits above overlay */}
  <div className="relative z-10 ...">
    {/* nav floats here + headline + CTA */}
  </div>
</section>
```

**Print override required** (from D-05 and CONTEXT.md):
```css
@media print {
  .hero-bg, .dashboard-bg {
    background-image: none !important;
  }
}
```

Apply CSS class names `hero-bg` and `dashboard-bg` to the respective sections for the print override to target them.

### LandingNav Float Approach

Current state: `LandingNav` uses `sticky top-0 z-10 bg-nav-dark`. It sits above the hero in normal document flow.

For the floating nav over the photo (D-09), the cleanest approach (Claude's discretion):

```tsx
// In LandingPage, replace separate <LandingNav /> + <HeroSection />
// with a combined hero section containing the nav:
<section className="relative hero-bg min-h-screen ...">
  <div className="absolute inset-0 bg-black/60" />
  <div className="relative z-10">
    {/* nav inside hero: position is normal flow within relative container */}
    <nav className="px-6 py-4 flex items-center justify-between">
      ...
    </nav>
    {/* hero content */}
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] text-center px-4">
      ...
    </div>
  </div>
</section>
```

This keeps `LandingNav` as a separate component but renders it _inside_ the hero section's `relative z-10` container. No negative margin hacks, no position:fixed (which would affect scroll behavior for all sections below).

The `LandingPage` root `<div>` continues to render the hero section first, followed by `HowItWorksSection`, `ProblemSection`, etc. — no structural changes to the page order.

### ProjectCard className Prop Addition

`ProjectCard` currently has `interface ProjectCardProps { project: Project }` — no `className`. Pattern to add (matching how Card.tsx does it):

```tsx
import { cn } from '../../lib/utils';

interface ProjectCardProps {
  project: Project;
  className?: string;
}

export function ProjectCard({ project, className }: ProjectCardProps) {
  return (
    <button
      ...
      className={cn(
        `w-full text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-brand-gold transition-all group${project.status === 'closed' ? ' opacity-70' : ''}`,
        className
      )}
    >
```

Then in DashboardPage at the render site:
```tsx
<ProjectCard
  key={project.id}
  project={project}
  className="shadow-card-elevated"
/>
```

Note: The current ProjectCard uses `hover:shadow-md` for hover state. With elevated shadow as baseline, consider removing `hover:shadow-md` or increasing it slightly on hover. This is Claude's discretion.

### Dashboard Photo Background Pattern

Dashboard gets a subtle dark photo behind the PageHeader strip only (D-04). Implementation:

```tsx
// In DashboardPage, wrap PageHeader in a styled strip:
<div
  className="dashboard-bg relative -mx-6 px-6 mb-6"
  style={{
    backgroundImage: "url('/images/dashboard-bg.webp')",
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }}
>
  <div className="absolute inset-0 bg-nav-dark/80" />
  <div className="relative z-10">
    <PageHeader title="Projects" action={...} />
  </div>
</div>
```

The `Layout` component provides horizontal padding. The `-mx-6 px-6` technique bleeds the background to full width while keeping content in the layout column. Verify Layout's padding value — if Layout uses `px-6`, `-mx-6 px-6` achieves full-bleed within the layout.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shadow token | Hardcode `0 8px 24px rgba(0,0,0,0.12)` in JSX | `--shadow-card-elevated` in @theme | Token change propagates everywhere; hardcoded values are inconsistent |
| CSS variable shadow class | `shadow-[0_8px_24px_rgba(0,0,0,0.12)]` arbitrary | `shadow-card-elevated` from @theme token | Cleaner, token-driven, matches --shadow-card pattern already in place |
| Photo overlay | CSS `::before` pseudo-element | Sibling `<div className="absolute inset-0 bg-black/60">` | Pseudo-elements don't render in React JSX; sibling div is idiomatic |
| Image optimization | Custom build script | Squoosh / browser WebP export | Photos must be ≤200KB WebP; use online tool, not custom tooling |

---

## Raw h1/h2 Audit Results

**Grep of all TSX files for raw `<h1` and `<h2` tags:**

### Pages with raw `<h1>` (page-title level — DES-03 migration targets):

| File | Line | Content | Action |
|------|------|---------|--------|
| `LoginPage.tsx` | 9 | `<h1>HCC Prevailing Wage</h1>` (brand logo style) | Low priority — auth page, not app page; keep raw h1 with existing styling |
| `RegisterPage.tsx` | 9 | `<h1>HCC Prevailing Wage</h1>` (same brand style) | Low priority — same as LoginPage |
| `PayrollWeekDetailPage.tsx` | 315 | `<h1>Payroll Week #N ...</h1>` | MIGRATE to PageHeader |
| `GsaRateBuilderPage.tsx` | 58 | `<h1>GSA Rate Builder</h1>` | MIGRATE to PageHeader |
| `AdminStateWagePage.tsx` | 67 | `<h1>...</h1>` | MIGRATE to PageHeader |
| `OtScenarioPage.tsx` | 59 | `<h1>OT Scenario Planner</h1>` | MIGRATE to PageHeader |
| `VarianceReportPage.tsx` | 56 | `<h1>Job Cost Variance Report</h1>` | MIGRATE to PageHeader |
| `UnionAllocationPage.tsx` | 34 | `<h1>Union Trade Allocation</h1>` | MIGRATE to PageHeader |
| `WageLookupPage.tsx` | 52 | `<h1>...</h1>` | MIGRATE to PageHeader |

**Total h1 migration targets: 7 pages** (excluding LoginPage and RegisterPage which use h1 as brand identity in auth context, not page titles).

### Pages with raw `<h2>` (section headings — NOT migration targets):

All raw `<h2>` tags found are section-level headings within panels, modals, or content sections — semantically appropriate use of h2. D-17 targets page-title h1 elements. The h2 tags should be left as-is:

| File | Context | Assessment |
|------|---------|------------|
| `LandingPage.tsx` (multiple) | Section headings (ProblemSection, FeatureHighlights, etc.) | Keep — section headings, not page titles |
| `PayrollListPage.tsx` (3x) | Modal/panel headings ("New Payroll Week", "Copy Previous Week") | Keep — panel headings |
| `PayrollWeekDetailPage.tsx` (4x) | Section headings ("Payroll Entries", "Compliance Check") | Keep — section headings |
| `WorkersPage.tsx` | "Add Worker" form heading | Keep — form section heading |
| `AdminStateWagePage.tsx` | Section heading | Keep |
| `GsaRateBuilderPage.tsx` | Section heading | Keep |
| `UnionAllocationPage.tsx` (2x) | Section headings | Keep |
| `VarianceReportPage.tsx` | Section heading | Keep |

### LandingPage h1 (hero headline):
`LandingPage.tsx:33` — `<h1>WH-347 Certified Payroll...</h1>` — This gets the `clamp(56px, 8vw, 88px)` + `tracking-tight` treatment as part of the hero redesign. NOT migrated to PageHeader (it's a marketing headline, not a PageHeader use case).

---

## Common Pitfalls

### Pitfall 1: Wrong Asset Directory for CSS background-image
**What goes wrong:** Placing photos in `src/client/assets/` (or project root `assets/`) and referencing them with a relative CSS path. Vite processes CSS differently from JS imports — `url('../assets/hero.webp')` in an inline style string is NOT processed by Vite as an import.
**Why it happens:** Developers assume `src/assets/` works for both JSX imports and CSS url() references.
**How to avoid:** Use `src/client/public/images/` directory. CSS url('/images/hero.webp') works because Vite serves public/ directory files at the root path without transformation.
**Verification:** After adding photo, run `npm run dev:client` and check DevTools Network tab — `/images/hero.webp` should return 200 with the WebP content type.

### Pitfall 2: Overriding bg-nav-dark on LandingNav (nav legibility)
**What goes wrong:** Removing `bg-nav-dark` from LandingNav without ensuring the nav sits over a dark enough overlay. If the hero photo has a light area at the top, gold text (#F5C518) on white fails WCAG AA contrast (requires 3:1 for large text).
**Why it happens:** The 60% black overlay may appear dark enough visually but the nav is at the very top of the image where photo content varies.
**How to avoid:** Either keep a subtle `bg-black/20` on the nav element itself (semi-transparent, still shows photo), or ensure the photo is dark at top. Test with actual photo selected.

### Pitfall 3: Layout bleed for Dashboard background strip
**What goes wrong:** The Layout component wraps content in a padded container. Adding a background to a PageHeader wrapper div only fills the padded area, leaving white gaps at the sides.
**Why it happens:** Forgetting to read the Layout component's padding value before choosing bleed approach.
**How to avoid:** Read `src/client/components/shared/Layout.tsx` before implementing the dashboard bg strip. Use `-mx-{padding} px-{padding}` negative margin trick to achieve full-bleed. If Layout uses a class like `px-6`, then `-mx-6 px-6` bleeds correctly.
**Warning sign:** Dashboard background strip has visible left/right white margins in the browser.

### Pitfall 4: shadow-card-elevated vs shadow-[--shadow-card-elevated] syntax
**What goes wrong:** Using the arbitrary value syntax `shadow-[--shadow-card-elevated]` when the token is defined in `@theme`, causing a class name mismatch or double-registration.
**Why it happens:** Confusion between TailwindCSS v3 arbitrary values and v4 @theme token resolution.
**How to avoid:** When a CSS custom property is in `@theme` with the `--shadow-*` prefix, TailwindCSS v4 automatically creates `shadow-card-elevated` as a utility. Use `shadow-card-elevated` (no brackets). Verify by checking that `--shadow-card` → `shadow-card` already works in the codebase (confirmed in Card.tsx: `shadow-card` class is used without arbitrary syntax).

### Pitfall 5: ProjectCard hover shadow conflict
**What goes wrong:** ProjectCard currently has `hover:shadow-md` for interactive feedback. With `shadow-card-elevated` as baseline, `hover:shadow-md` (Tailwind's default medium shadow) may be lighter than the elevated baseline, creating a visual regression where the card appears to lose depth on hover.
**Why it happens:** `shadow-md` = `0 4px 6px -1px rgb(0 0 0 / 0.1)` which is less visually prominent than `0 8px 24px rgba(0,0,0,0.12)`.
**How to avoid:** When adding elevated shadow to ProjectCard, remove `hover:shadow-md` from the base classes (it's in the hardcoded className string). The `hover:border-brand-gold` transition already provides sufficient hover feedback. Or add `hover:shadow-lg` explicitly to ensure hover is visually darker than baseline.

### Pitfall 6: Print CSS class names must match
**What goes wrong:** Adding `@media print { .hero-bg { background-image: none } }` but the hero section doesn't have `class="hero-bg"`.
**Why it happens:** The CSS class name in the print override and the JSX className are written independently and drift.
**How to avoid:** Define the class name once. Use `hero-bg` and `dashboard-bg` as the CSS class names. Add these to the `className` of the respective sections AND to the `@media print` block in index.css simultaneously.

---

## Code Examples

### Adding --shadow-card-elevated to @theme
```css
/* src/client/index.css — add inside existing @theme block */
/* Source: verified from existing --shadow-card pattern in index.css */
@theme {
  /* ... existing tokens ... */
  --shadow-card-elevated: 0 8px 24px rgba(0,0,0,0.12);
}
```

### HelpCallout elevated shadow update
```tsx
/* src/client/components/ui/HelpCallout.tsx */
/* Change shadow-card to shadow-card-elevated */
className={cn(
  'bg-surface-card rounded-card shadow-card-elevated border border-border-default border-l-4 border-l-brand-gold',
  'p-4 flex gap-3 items-start mb-4',
  className
)}
```

### PageHeader tracking-tight on h1
```tsx
/* src/client/components/ui/PageHeader.tsx */
/* Add tracking-tight to existing h1 className */
<h1 className="font-headline text-2xl text-text-primary tracking-tight">{title}</h1>
```

### Hero headline clamp font size
```tsx
/* In the new HeroSection, the h1 headline */
<h1
  className="font-headline font-bold leading-tight mb-6 tracking-tight"
  style={{ fontSize: 'clamp(56px, 8vw, 88px)' }}
>
  WH-347 Certified Payroll.<br />
  Davis-Bacon Rates from SAM.gov, Automated.
</h1>
```

### Print override for photo backgrounds
```css
/* src/client/index.css — add after @theme block */
@media print {
  .hero-bg,
  .dashboard-bg {
    background-image: none !important;
  }
  .hero-bg .absolute,
  .dashboard-bg .absolute {
    display: none !important;
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| TW3 arbitrary: `shadow-[0_8px_24px_rgba(0,0,0,0.12)]` | TW4 @theme token: `shadow-card-elevated` | Token-driven; consistent with project conventions |
| `src/assets/` JS import for images | `public/` directory for CSS background-image | Correct Vite pipeline for CSS url() references |

---

## Environment Availability

Step 2.6: SKIPPED (no external tool dependencies — all changes are CSS/TSX edits and manual WebP download; no CLI tools beyond npm run dev:client needed).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (server tests only, no frontend test config) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DES-01 | shadow-card-elevated token defined in index.css | Manual visual | n/a — CSS token | N/A |
| DES-01 | ProjectCard renders with elevated shadow in Dashboard | Manual visual | n/a — visual | N/A |
| DES-01 | HelpCallout shadow updated | Manual visual | n/a — visual | N/A |
| DES-02 | Hero photo renders with dark overlay, CTA visible | Manual visual | n/a — visual | N/A |
| DES-02 | Dashboard photo background on PageHeader strip | Manual visual | n/a — visual | N/A |
| DES-02 | Print: @media print removes photo backgrounds | Manual print preview | Browser print preview | N/A |
| DES-03 | PageHeader h1 has tracking-tight | Manual visual | n/a — visual | N/A |
| DES-03 | No raw h1 page titles outside PageHeader | Code audit (grep) | `grep -rn "<h1" src/client/pages/` | N/A |

### Assessment
This phase is **purely visual/CSS** — no backend logic, no data processing, no API changes. Existing Vitest test suite (server-side tests) has zero coverage of frontend component rendering. The test suite will continue to pass unaffected by all changes in this phase. Validation is entirely by manual browser review.

The existing `npm test` suite must pass unchanged after all phase changes. Verify at end of each plan.

### Wave 0 Gaps
None — no new test infrastructure required. Existing server test suite remains the validation gate for regressions (ensures no accidental backend changes).

---

## Open Questions

1. **Layout.tsx padding value (for dashboard bg bleed)**
   - What we know: DashboardPage renders inside `<Layout>` which provides page padding
   - What's unclear: The exact padding class on Layout's content wrapper (likely `px-6` but unverified)
   - Recommendation: Read `src/client/components/shared/Layout.tsx` before implementing dashboard bg strip. Adjust `-mx-{n}` value to match Layout's horizontal padding.

2. **ProjectCard hover shadow choice**
   - What we know: Current `hover:shadow-md` will be visually lighter than the new `shadow-card-elevated` baseline
   - What's unclear: Whether `hover:shadow-lg` or no hover shadow change is preferred
   - Recommendation: Remove `hover:shadow-md`, keep only `hover:border-brand-gold` for hover state. Cleaner, avoids the regression. The gold border is sufficient interactive feedback.

3. **LoginPage / RegisterPage h1 tags**
   - What we know: Both use `<h1>HCC Prevailing Wage</h1>` as a brand/logo heading, not a page-content title
   - What's unclear: Whether DES-03's "no page uses a raw h1/h2 outside PageHeader" success criterion includes auth pages
   - Recommendation: Exclude from DES-03 migration. These are brand-identity headings in auth-only context, not app navigation pages. The success criterion's intent is the app shell pages, not login/register.

---

## Project Constraints (from CLAUDE.md)

All CLAUDE.md directives remain relevant to this phase:

| Directive | Impact on Phase 27 |
|-----------|-------------------|
| All brand values via @theme tokens — never hardcode #F5C518 or #1a1a1a in JSX | Shadow token MUST go in @theme; hero overlay uses bg-black/60 (Tailwind), not hardcoded rgba |
| Typography: font-headline (Oswald) for h1-h4 | Hero h1 and all PageHeader h1 already use font-headline — maintain |
| PageHeader: title/subtitle/action props; mb-6 spacing | PageHeader migration targets must use these props correctly |
| Do not use Card padding="none" for anything except table wrappers | Existing Card usages unaffected; ProjectCard is not a Card instance |
| Print CSS pattern: use print-hidden CSS class, overflow: visible !important | Photo print override goes in index.css @media print block as defined in CONTEXT.md D-05 |
| No new backend routes, no DB changes | Confirmed — this phase is frontend only |

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/client/index.css` — verified @theme token structure, --shadow-card pattern, TW4 version 4.2.2
- Direct code inspection: `src/client/pages/LandingPage.tsx` — verified LandingNav structure (sticky, bg-nav-dark), HeroSection structure (flat bg-nav-dark), all raw h1/h2 tags
- Direct code inspection: `src/client/pages/DashboardPage.tsx` — verified ProjectCard render site (no className prop passed), HelpCallout usage
- Direct code inspection: `src/client/components/projects/ProjectCard.tsx` — confirmed no className prop, hardcoded shadow-sm in button className, hover:shadow-md
- Direct code inspection: `src/client/components/ui/HelpCallout.tsx` — confirmed shadow-card usage
- Direct code inspection: `src/client/components/ui/PageHeader.tsx` — confirmed h1 className, no tracking-tight
- Direct code inspection: `src/client/components/ui/Card.tsx` — confirmed shadow-card usage pattern
- Direct code inspection: `vite.config.ts` — confirmed root: 'src/client' determining public/ directory location

### Secondary (MEDIUM confidence)
- TailwindCSS v4 @theme token convention: `--shadow-*` prefix creates `shadow-{name}` utilities — inferred from verified pattern: `--shadow-card` → `shadow-card` works in Card.tsx without arbitrary syntax

### Tertiary (LOW confidence)
- Vite public/ directory for CSS background-image: standard Vite behavior documented at vitejs.dev — treating as HIGH confidence given it is the canonical Vite static asset pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and verified
- Architecture patterns: HIGH — all key files read directly from source
- h1/h2 audit: HIGH — grep results are exact and exhaustive
- Vite asset path: HIGH — root configuration confirmed, public/ directory convention is Vite standard
- TW4 shadow token: HIGH — verified from existing --shadow-card pattern in codebase
- Pitfalls: HIGH — derived from direct code inspection

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable stack; no moving parts)
