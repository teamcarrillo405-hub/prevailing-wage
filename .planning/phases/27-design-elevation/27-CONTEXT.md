# Phase 27: Design Elevation - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Elevate the app's visual design to match HCC website quality — construction photography, dark gold gradients, and elevated card depth that distinguishes HCC from generic compliance software.

Three requirement clusters:

1. **DES-01 — Card elevation** — Dashboard project cards get elevated shadow; HelpCallout matches; all other cards stay subtle
2. **DES-02 — Hero photography** — Full-bleed infrastructure photo with dark overlay + floating nav; Dashboard gets a second subtle dark photo as page header background
3. **DES-03 — Typography rhythm** — Tighter Oswald letter-spacing on H1 headlines only; full audit/migration of raw h1/h2 → PageHeader across the codebase

This phase does NOT include: new pages, new backend routes, dark mode, mobile-specific layouts, animation/transitions, or any DB changes.

</domain>

<decisions>
## Implementation Decisions

### Photography (DES-02 input)

- **D-01:** Source is **Unsplash / Pexels stock** — free, no attribution required on Unsplash. Download the best available bridge/highway/infrastructure photo and one secondary construction scene for the dashboard.
- **D-02:** **Two photo spots** — hero on LandingPage + a subtle dark photo behind the DashboardPage page header area (desaturated/low-opacity).
- **D-03:** Hero scene = **infrastructure / bridge / highway** — aligns with Davis-Bacon's federal public works context.
- **D-04:** Dashboard background = **subtle dark photo, low opacity** — behind the dashboard page header strip, not behind cards themselves.
- **D-05:** Assets stored as **WebP <200KB** each, referenced via CSS `background-image` (not Vite import). A `@media print` override removes all dark overlays so printed/exported views stay clean.

### Hero Layout (DES-02)

- **D-06:** **Full-bleed photo, centered text** — photo covers 100vw, dark overlay `bg-black/60`, headline + subhead + CTA centered. Classic construction-site hero pattern.
- **D-07:** Oswald headline: `clamp(56px, 8vw, 88px)` — matches roadmap spec exactly.
- **D-08:** Subhead: Inter 20px. CTA: gold button (existing `bg-brand-gold` Button primary variant).
- **D-09:** **Nav floats over the hero photo** — nav bar is transparent or semi-transparent on top of the photo. This means `LandingPage` nav must switch to `position: fixed` or the hero section must use negative margin-top to sit behind the nav. Implementation agent decides the cleaner approach; must keep nav fully legible (gold logo/links visible against the dark photo).
- **D-10:** Non-landing pages keep the current dark nav bar `bg-nav-dark` — the floating treatment is landing page only.

### Card Shadow Scope (DES-01)

- **D-11:** **Dashboard project cards only** receive elevated shadow `0 8px 24px rgba(0,0,0,0.12)`. Applied as a `className` prop on ProjectCard instances inside DashboardPage — not a global Card default change.
- **D-12:** **HelpCallout** gets the elevated shadow too — update the HelpCallout component's shadow class to match `shadow-[0_8px_24px_rgba(0,0,0,0.12)]`.
- **D-13:** All other Card instances (workers, payroll, reports, modals) retain the existing `shadow-card` token (`0 1px 3px 0 rgb(0 0 0 / 0.08)`).
- **D-14:** Do NOT change `--shadow-card` in `index.css` — it's used everywhere. Add a new `--shadow-card-elevated` token instead: `0 8px 24px rgba(0,0,0,0.12)` — then apply `shadow-[--shadow-card-elevated]` at DashboardPage + HelpCallout.

### Typography Rhythm (DES-03)

- **D-15:** **Tracking-tight Oswald letter-spacing applies to H1 headlines only** — specifically `PageHeader` title and the LandingPage hero headline. Subheadings, card titles, nav items, badges stay at Oswald default tracking.
- **D-16:** Apply `tracking-tight` inside the `PageHeader` component itself (the `<h1>` element) so all page titles get it automatically. Landing page hero headline gets it explicitly.
- **D-17:** **Full h1/h2 audit** — grep all `.tsx` files for raw `<h1` and `<h2` tags that are not inside PageHeader. Migrate every one found to the appropriate design primitive (PageHeader for page titles, existing section heading classes for landing page sections).

### Claude's Discretion

- Exact Unsplash/Pexels search query and image selection (seek dark-toned, high-contrast infrastructure scenes that work with a 60% overlay)
- Whether nav float uses CSS `position: sticky` with transparent bg-to-overlay, or hero uses negative `mt` offset
- Exact `tracking-tight` implementation in PageHeader (add to existing title className)
- New `--shadow-card-elevated` token naming and exact CSS variable declaration location in `index.css`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Key Files
- `src/client/pages/LandingPage.tsx` — Hero section + nav; DES-02 hero photo and nav float happen here
- `src/client/pages/DashboardPage.tsx` — Dashboard photo background + ProjectCard elevated shadow (DES-01 + DES-02)
- `src/client/components/ui/Card.tsx` — Must NOT change the default shadow here
- `src/client/components/ui/HelpCallout.tsx` — Gets elevated shadow (D-12)
- `src/client/components/ui/PageHeader.tsx` — Gets `tracking-tight` on H1 (D-16)
- `src/client/index.css` — Add `--shadow-card-elevated` token here (D-14); print media override for photo backgrounds (D-05)

### Design Tokens
- `src/client/index.css` — All @theme tokens; new `--shadow-card-elevated` must go here, no hardcoded values in JSX
- Current `--shadow-card`: `0 1px 3px 0 rgb(0 0 0 / 0.08)` — DO NOT CHANGE
- New token: `--shadow-card-elevated: 0 8px 24px rgba(0,0,0,0.12)`

### Requirements
- `.planning/REQUIREMENTS.md` §DES-01, DES-02, DES-03 — Full acceptance criteria for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Asset Strategy
- No WebP assets currently exist in the codebase. Create `src/client/assets/` directory (or `public/` — implementation agent chooses the correct Vite approach for CSS `background-image` references).
- CSS `background-image: url(...)` is used instead of `<img>` to allow the overlay pattern: `background-size: cover`, `background-position: center`, `::before` pseudo-element for the dark overlay, or a sibling `<div>` with `absolute inset-0 bg-black/60`.
- Print override: `@media print { .hero-bg, .dashboard-bg { background-image: none !important; } }` — prevents dark overlays from printing.

### Nav Float Consideration
- Current nav in `LandingPage.tsx` is a normal-flow element — hero starts below it. D-09 requires nav to sit on top of the photo. Common approach: add `absolute inset-x-0 top-0 z-10 bg-transparent` to the landing page nav, and ensure hero section uses `min-h-screen` or fixed height so photo fills behind it.
- Protected page nav (Navbar component) is separate — does NOT change.

### Typography Audit Scope
- Phase 26 already migrated `PayrollListPage` from raw `<h1>` to `PageHeader`.
- Phase 27 D-17 requires a full grep of all remaining `<h1` and `<h2` raw tags in TSX files to find and migrate any remaining outliers.

### ProjectCard Shadow Injection
- `ProjectCard` component likely accepts `className` prop (or the DashboardPage could wrap in a container). Implementation agent should check whether to pass `shadow-[--shadow-card-elevated]` as a prop or apply it at the DashboardPage render site.

</code_context>

<specifics>
## Specific Guidance

- The dark overlay on the hero photo must be dark enough (60%) for white Oswald text + gold CTA to pass WCAG AA contrast
- Dashboard background photo: apply at very low opacity (15–25%) or use a dark-tinted version — cards should still be clearly readable against it
- Print media override is mandatory for the hero and dashboard photo backgrounds; compliance software is frequently printed
- `--shadow-card-elevated` token is the correct pattern — mirrors how `--shadow-card` already works; never hardcode `0 8px 24px` directly in a component

</specifics>

<deferred>
## Deferred Ideas

None — all discussed topics stayed within DES-01/02/03 scope.

</deferred>

---

*Phase: 27-design-elevation*
*Context gathered: 2026-03-26*
