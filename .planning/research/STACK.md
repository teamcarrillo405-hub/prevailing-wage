# Stack Research

**Domain:** Design system polish + marketing landing page (v2.1 additions to existing React + TailwindCSS v4 app)
**Researched:** 2026-03-20
**Confidence:** HIGH

---

## Context: What Already Exists (Do Not Re-research)

The following are confirmed installed and working. This research covers ONLY what is needed for v2.1 new features.

| Technology | Version (package.json) | Status |
|------------|----------------------|--------|
| React 19 + Vite | ^19.2.4 / ^8.0.0 | Installed |
| TailwindCSS v4 | ^4.2.2 | Installed, `@tailwindcss/vite` plugin |
| `clsx` + `tailwind-merge` | installed in v2.0 | Installed |
| Recharts 3 | ^3.8.0 | Installed |
| @tanstack/react-query | ^5.91.0 | Installed |
| react-hook-form + zod | ^7.71.2 / ^4.3.6 | Installed |
| Oswald + Inter fonts | Loaded via `@theme` in index.css | Configured |
| Brand gold `#F5C518` | Defined as `--color-brand-gold` in `@theme` | Configured |

**Existing `@theme` block in `index.css`:**
```css
@import "tailwindcss";

@theme {
  --color-brand-gold: #F5C518;
  --font-headline: 'Oswald', sans-serif;
  --font-body: 'Inter', sans-serif;
}
```

This is the correct TailwindCSS v4 CSS-first token approach. Fonts and brand color are already registered as utility-generating CSS custom properties.

---

## Recommended Additions for v2.1

### Core Libraries — New Installs

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `motion` | ^12.38.0 | Scroll-triggered entry animations on the landing page hero, feature grid, and CTA | Framer Motion rebranded to `motion` in late 2024. v12.x fully supports React 19. Import path is `motion/react`. Provides `<motion.div>`, `whileInView`, `initial`/`animate` declarative props. Best-in-class for marketing landing page animations — used by Framer and Figma at scale (30M+ npm downloads/month). Adds roughly 30KB gzip when tree-shaken to used components only. CSS-only transitions won't cut it for staggered feature-card reveals or hero text entry. |
| `react-intersection-observer` | ^10.0.3 | `useInView` hook for triggering class-based animations when sections scroll into viewport | When `motion` is too heavy for a specific effect (e.g., adding a class once to trigger a CSS transition), this 2KB hook is the right tool. v10.0.3 is the current stable. Works independently of `motion` — use both where appropriate. Replaces manual `IntersectionObserver` instantiation in every component. |
| `lucide-react` | ^0.577.0 | SVG icon set for landing page feature icons and app UI polish | 577 icons, fully tree-shakeable (each icon is its own import), TypeScript types included, no sprite sheets. Works with Tailwind utility classes (`className="w-5 h-5 text-brand-gold"`). The project constraint (per memory) bans emojis in UI — SVG icons are the required alternative. Lucide is the standard pairing with Tailwind utility-first projects. |

### Design Token Extensions — CSS Only, No New Packages

The following additions belong in `index.css` inside the existing `@theme` block. They extend the token system without adding npm dependencies.

```css
@theme {
  /* Existing */
  --color-brand-gold: #F5C518;
  --font-headline: 'Oswald', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* Add: typography scale */
  --font-size-display: 3.5rem;   /* 56px — landing page hero headline */
  --font-size-h1: 2.25rem;       /* 36px — page titles */
  --font-size-h2: 1.75rem;       /* 28px — section headers */
  --font-size-h3: 1.25rem;       /* 20px — card headers */
  --font-size-body: 1rem;        /* 16px — body copy */
  --font-size-small: 0.875rem;   /* 14px — labels, captions */

  /* Add: spacing tokens for card/table consistency */
  --spacing-card: 1.5rem;        /* 24px — card padding */
  --radius-card: 0.75rem;        /* 12px — card border-radius */
  --radius-badge: 9999px;        /* pill badges */

  /* Add: brand surface colors */
  --color-surface-dark: #1a1a1a;    /* dark nav, matching existing PROJECT.md spec */
  --color-surface-mid: #242424;     /* slightly lighter dark surface */
  --color-surface-light: #f9fafb;   /* light page background */
  --color-border: #e5e7eb;          /* table/card borders */
  --color-text-muted: #6b7280;      /* secondary text */

  /* Add: shadow tokens */
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-card-hover: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}
```

TailwindCSS v4's `@theme` generates utility classes from every custom property. Defining `--color-surface-dark` means `bg-surface-dark`, `text-surface-dark`, and `border-surface-dark` utility classes are auto-generated with no config file needed. This is the correct CSS-first v4 pattern — do not use a `tailwind.config.js` for these.

---

## What Is NOT Needed

| Library | Why Not | What to Use Instead |
|---------|---------|-------------------|
| `shadcn/ui` or any component library | PROJECT.md explicitly forbids new UI frameworks. Additionally, shadcn has known transparency rendering issues with Tailwind v4 (confirmed in Tailwind GitHub discussions). Radix UI's maintenance status is uncertain as of 2025. | Hand-rolled components using Tailwind utility classes + clsx + tailwind-merge |
| `Material UI (MUI)` | Opinionated design system fights the custom HCC brand. Adds ~300KB to bundle. Style override battles with Tailwind. | Same — utility classes + design tokens |
| `@tailwindcss/typography` plugin | This plugin styles HTML-rendered markdown (blog posts, prose content). The landing page and app pages are all structured JSX, not rendered markdown. Adding it for headline/body styles when `@theme` custom fonts are already registered adds 20KB of CSS and no benefit. | Use the existing `--font-headline` and `--font-body` tokens. Typography hierarchy is a set of reusable class combinations — document them in a `typography.ts` constants file, not a plugin. |
| `@tanstack/react-table` | Landing page and polished data displays use read-only tables. TanStack Table is appropriate for sortable/filterable data grids. Pay history and fringe reports are static read-only — native `<table>` + Tailwind styling is sufficient. | Plain HTML `<table>` elements with Tailwind utility classes |
| `styled-components` / CSS modules | The project is already committed to Tailwind utility classes. Mixing paradigms creates inconsistency and doubles tooling. | Tailwind utility classes only |
| `@fontsource/oswald` or `@fontsource/inter` | These fonts are presumably loaded via link tags or CSS import already. Adding npm font packages adds ~500KB of font files to the bundle. | Verify Google Fonts `<link>` is in `index.html`; if not, add the link tag, not an npm package |
| `gsap` (GreenSock) | Powerful but 50KB+ gzip, overkill for landing page entry animations. API is imperative, not declarative — fights React's model. | `motion` package handles all required landing page animations declaratively |

---

## Typography Hierarchy Implementation

TailwindCSS v4 handles typography through utility class combinations. The correct approach is to define a shared `cn()` helper function and typography class constants — not a plugin.

**Pattern: `src/client/lib/typography.ts`**
```typescript
// Define reusable typography class strings as named constants
// Apply via className={typography.h1} in components
export const typography = {
  display: 'font-headline text-display font-bold tracking-tight leading-none',
  h1:      'font-headline text-h1 font-bold tracking-tight',
  h2:      'font-headline text-h2 font-semibold tracking-tight',
  h3:      'font-headline text-h3 font-semibold',
  body:    'font-body text-body leading-relaxed',
  small:   'font-body text-small text-text-muted',
  label:   'font-body text-small font-medium uppercase tracking-wide',
} as const;
```

This approach uses the `@theme` tokens already defined, generates no new CSS, and creates a single authoritative source for all type sizes — ensuring consistency across the landing page and all app pages.

---

## Landing Page Architecture

The landing page is a single React route component at `/`. It requires no additional routing beyond what `react-router-dom` (already installed) provides. All animation is handled by the `motion` package.

**Component structure to build:**
```
src/client/pages/LandingPage.tsx          — root route "/"
src/client/components/landing/
  HeroSection.tsx                         — headline, subhead, CTA buttons
  FeatureGrid.tsx                         — 3-column feature cards with Lucide icons
  SocialProofSection.tsx                  — "Davis-Bacon compliance built for GCs"
  PricingCTA.tsx                          — single CTA to register
src/client/components/shared/
  Button.tsx                              — primary/secondary/ghost variants
  Badge.tsx                               — status pill variants (already noted in v2.0)
  Card.tsx                                — standard card container
```

No new packages needed for routing, data fetching, or state management on the landing page. It is static content.

---

## Installation

```bash
# New production dependencies for v2.1
npm install motion@^12.38.0 react-intersection-observer@^10.0.3 lucide-react@^0.577.0
```

No new dev dependencies needed. All three packages ship TypeScript declarations.

Verify Google Fonts link exists in `src/client/index.html` — if not, add:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `motion@12.x` | React 19, Vite | Import from `motion/react` not `framer-motion`. `framer-motion` package still works but is the legacy alias. Use `motion` package for new projects. React Compiler compatible. |
| `react-intersection-observer@10.x` | React 19, SSR | Zero dependencies. Uses native `IntersectionObserver` API (supported in all modern browsers). No polyfill needed for this app's target audience (contractors on desktop browsers). |
| `lucide-react@0.577.x` | React 19, TypeScript | Tree-shakeable — only imported icons are bundled. Works with Tailwind `className` prop directly. No CSS import needed. |
| `tailwind-merge@3.x` (existing) | TailwindCSS v4.x | Already installed in v2.0. v3.x is specifically for Tailwind v4. |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| `motion` (v12) | `react-spring` | react-spring is better for physics-based drag/gesture interactions. For marketing page enter animations and hover effects, `motion`'s declarative `whileInView` is the right mental model. |
| `lucide-react` | `heroicons`, `phosphor-icons` | heroicons is fine if already in a project. lucide has a larger icon set (577 vs ~292 heroicons). `phosphor-icons` offers multiple weight variants — useful for app UIs but not needed here. |
| `react-intersection-observer` | Native `IntersectionObserver` hook | Use native only for one-off cases. For multiple animated sections on a landing page, `useInView` from react-intersection-observer removes boilerplate correctly. |
| CSS `@theme` token extensions | `tailwind.config.js` | TailwindCSS v4 CSS-first approach deprecates `tailwind.config.js` for token definition. The `@theme` block in CSS is the authoritative v4 pattern. |
| Hand-rolled components | shadcn/ui copy-paste | shadcn/ui has Tailwind v4 compatibility bugs (transparent dropdowns). Hand-rolling is 10-30 lines per component and is fully controlled. |

---

## Sources

- [motion npm package](https://www.npmjs.com/package/motion) — v12.38.0 confirmed current, React 19 fully supported (HIGH confidence)
- [Motion for React docs](https://motion.dev/docs/react) — `motion/react` import path, `whileInView` API (HIGH confidence)
- [react-intersection-observer npm](https://www.npmjs.com/package/react-intersection-observer) — v10.0.3 confirmed current (HIGH confidence)
- [lucide-react npm](https://www.npmjs.com/package/lucide-react) — v0.577.0 confirmed current, tree-shakeable (HIGH confidence)
- [tailwind-merge npm](https://www.npmjs.com/package/tailwind-merge) — v3.x targets Tailwind v4 confirmed (HIGH confidence)
- [Tailwind CSS v4 @theme docs](https://tailwindcss.com/docs/theme) — CSS-first token system, utility class generation from custom properties (HIGH confidence)
- [Tailwind v4 + Radix/shadcn transparency bug](https://github.com/tailwindlabs/tailwindcss/discussions/17137) — confirmed compatibility issue, reinforces not using shadcn (MEDIUM confidence)
- [Framer Motion + Tailwind 2025 stack](https://dev.to/manukumar07/framer-motion-tailwind-the-2025-animation-stack-1801) — community validation of the pairing (MEDIUM confidence)
- Existing codebase — `index.css`, `package.json`, `vite.config.ts` reviewed directly (HIGH confidence)

---

*Stack research for: HCC Prevailing Wage v2.1 — Design Polish + Landing Page*
*Researched: 2026-03-20*
