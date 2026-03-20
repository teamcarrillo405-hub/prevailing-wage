# Architecture Research

**Domain:** React + TailwindCSS v4 Design System Rollout (UI Polish + Landing Page) — v2.1
**Researched:** 2026-03-20
**Confidence:** HIGH — TailwindCSS v4 @theme verified against official docs; React patterns verified against direct codebase inspection

---

## Current State Baseline

The existing client has a minimal CSS foundation and no design system:

```
src/client/index.css (7 lines):
  @import "tailwindcss";
  @theme {
    --color-brand-gold: #F5C518;
    --font-headline: 'Oswald', sans-serif;
    --font-body: 'Inter', sans-serif;
  }
```

**Problems this creates:**
- No font loading (`index.html` has no Google Fonts link — fonts fall back to system sans-serif)
- No typography scale in @theme — pages use raw `text-2xl`, `text-xl` from Tailwind defaults without associating them with Oswald
- Raw hex values scattered across JSX: `border-[#F5C518]`, `bg-[#1a1a1a]`, `hover:border-[#F5C518]` in 10+ components
- No shared card or table styles — each component reinvents padding, borders, shadows inline
- No landing page — `App.tsx` wildcard `*` redirects straight to `/dashboard`, no public face

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    src/client/ (React + Vite)                    │
├───────────────────────┬─────────────────────────────────────────┤
│   Public Routes       │   Protected Routes (ProtectedRoute)      │
│  ┌─────────────┐      │  ┌──────────┐ ┌───────────┐ ┌────────┐  │
│  │ LandingPage │      │  │Dashboard │ │ProjectDet.│ │Workers │  │
│  │ LoginPage   │      │  │Payroll*  │ │Reports    │ │OTScen. │  │
│  │ RegisterPg  │      │  └──────────┘ └───────────┘ └────────┘  │
│  └─────────────┘      │       all pages wrapped in Layout        │
└───────────────────────┴──────────────────────────────────────────┤
                  CSS Layer (src/client/index.css)                  │
  ┌──────────────────────────────────────────────────────────────┐  │
  │  @import url("Google Fonts — Oswald + Inter")               │  │
  │  @import "tailwindcss";                                      │  │
  │  @theme { --color-* --font-* --text-* --radius-* ... }      │  │
  │  @layer base   { body font, h1-h4 font defaults }           │  │
  │  @layer components { .hcc-card .hcc-table .hcc-badge }      │  │
  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Current State |
|-----------|----------------|---------------|
| `index.css` | Single source of truth for all design tokens + base styles | EXISTS — minimal (3 @theme lines, no fonts, no layers) |
| `index.html` | HTML shell, font loading | EXISTS — no Google Fonts link tags |
| `App.tsx` | Router — public + protected route groups | EXISTS — no public landing route |
| `Layout.tsx` | App chrome: nav + page container | EXISTS — inline hex colors |
| `LandingPage.tsx` | Marketing homepage, public route | DOES NOT EXIST |
| `components/ui/Badge.tsx` | Status badge primitive with variant prop | DOES NOT EXIST |
| `components/ui/Card.tsx` | Card shell primitive | DOES NOT EXIST |
| `components/ui/PageHeader.tsx` | h1 + subtitle + action button pattern | DOES NOT EXIST |

---

## Recommended Project Structure

```
src/client/
├── index.css                     MODIFY — expand @theme, add @layer base + components
├── index.html                    MODIFY — add Google Fonts preconnect + link tags
├── App.tsx                       MODIFY — add "/" route for LandingPage, adjust wildcard
│
├── pages/
│   ├── LandingPage.tsx           CREATE — marketing homepage (public route)
│   ├── LoginPage.tsx             MODIFY — visual polish only
│   ├── DashboardPage.tsx         MODIFY — token classes, <PageHeader>, <Badge>
│   ├── ProjectDetailPage.tsx     MODIFY — token classes
│   ├── WorkersPage.tsx           MODIFY — hcc-table, token classes
│   ├── PayrollEntryPage.tsx      MODIFY — token classes
│   ├── PayrollWeekDetailPage.tsx MODIFY — hcc-table, token classes
│   └── ReportsPage.tsx           MODIFY — hcc-card, hcc-table, token classes
│
├── components/
│   ├── shared/
│   │   ├── Layout.tsx            MODIFY — token classes, HCC SVG logo
│   │   ├── ProtectedRoute.tsx    no change
│   │   └── LoadingSpinner.tsx    no change
│   ├── ui/                       CREATE directory
│   │   ├── Badge.tsx             CREATE — variant prop: gold | gray | green | red
│   │   ├── Card.tsx              CREATE — padding prop, hover border variant
│   │   └── PageHeader.tsx        CREATE — title + subtitle + action slot
│   └── projects/
│       ├── ProjectCard.tsx       MODIFY — use <Card> + <Badge> primitives
│       └── ProjectForm.tsx       no structural change
│
└── contexts/                     no change
```

### Structure Rationale

- **`index.css` as the sole @theme home:** TailwindCSS v4's `@theme` directive must live in the CSS file where `@import "tailwindcss"` resides. Splitting @theme into a separate file and importing it with `@import` causes the directive to fail silently (GitHub issue #18966 — confirmed, closed without a fix). All @theme content stays in `index.css`. If the file grows large, only `@layer components` can be safely split into a separate imported file.
- **`components/ui/` primitives:** Extract repeated inline patterns (badge spans, card divs, page-level h1+button combos) into typed React components. Eliminates inconsistency that accumulates when the same 5-class combo is copied across 10 pages independently.
- **`LandingPage` as a public React route:** No separate static site needed. React Router handles public routes natively — the `ProtectedRoute` wrapper only applies to the inner route group. Adding `<Route path="/" element={<LandingPage />} />` outside the protected group is all that's required. One deployment, shared CSS tokens, same Google Fonts.

---

## Architectural Patterns

### Pattern 1: Centralized @theme Design Tokens in index.css

**What:** All design tokens live in a single `@theme` block in `index.css`, immediately after the Google Fonts `@import` and the `@import "tailwindcss"` line. No `tailwind.config.js`. No separate tokens file.

**When to use:** Always, for this project. TailwindCSS v4 is CSS-first — `@theme` is both the token registry and the utility generator.

**Trade-offs:** The single-file constraint is enforced by v4's processing pipeline. Tokens defined in `@theme` generate utility classes automatically (`--color-brand-gold` → `bg-brand-gold`, `text-brand-gold`, `border-brand-gold`). This is the primary reason to use `@theme` over `:root` — `:root` variables are accessible but do not generate utilities.

**Correct order (order matters in v4):**
```css
/* 1. Font imports FIRST — before tailwindcss import */
@import url("https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap");

/* 2. Tailwind import */
@import "tailwindcss";

/* 3. @theme block — all design tokens */
@theme {
  /* Colors: generates bg-*, text-*, border-* utilities */
  --color-brand-gold: #F5C518;
  --color-brand-gold-hover: #d4a800;
  --color-nav: #1a1a1a;
  --color-surface: #ffffff;
  --color-surface-muted: #f9fafb;

  /* Font families: generates font-headline, font-body utilities */
  --font-headline: 'Oswald', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* Typography scale: generates text-display, text-title, text-section utilities */
  --text-display: 3rem;
  --text-display--line-height: 1.1;
  --text-display--font-weight: 700;
  --text-title: 1.875rem;
  --text-title--line-height: 1.2;
  --text-title--font-weight: 600;
  --text-section: 1.25rem;
  --text-section--line-height: 1.4;
  --text-section--font-weight: 600;

  /* Radius: generates rounded-card, rounded-badge utilities */
  --radius-card: 0.5rem;
  --radius-badge: 0.25rem;

  /* Shadow: generates shadow-card, shadow-modal utilities */
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08);
  --shadow-modal: 0 10px 25px -5px rgb(0 0 0 / 0.15);
}

/* 4. Base layer — element defaults (applied before utilities) */
@layer base {
  body {
    font-family: var(--font-body);
    background-color: var(--color-surface-muted);
  }
  h1, h2, h3, h4 {
    font-family: var(--font-headline);
  }
}

/* 5. Components layer — shared style recipes */
@layer components {
  /* ... see Pattern 2 */
}
```

### Pattern 2: @layer components for Shared Style Recipes

**What:** Repeated multi-class combos (data table rows, card shells, status badges) become named classes in `@layer components`. These classes reference `@theme` variables so they automatically reflect any token change. They can be overridden by utility classes in JSX.

**When to use:** When the same visual pattern (4+ classes) appears across 3+ components. Not for one-offs.

**Trade-offs:** Slightly breaks utility-first philosophy but eliminates the drift between components that must look identical. A developer adding a new payroll table can apply `hcc-table` instead of remembering 12 individual class names.

**Example (in index.css @layer components block):**
```css
@layer components {
  /* Card container — used across ProjectCard, modal dialogs, report sections */
  .hcc-card {
    background-color: var(--color-surface);
    border-radius: var(--radius-card);
    border: 1px solid var(--color-gray-200);
    box-shadow: var(--shadow-card);
    padding: --spacing(6);
  }

  /* Data table — consistent cell sizing across all tables in the app */
  .hcc-table {
    width: 100%;
    border-collapse: collapse;
  }
  .hcc-table th {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-gray-500);
    padding: --spacing(3) --spacing(4);
    border-bottom: 2px solid var(--color-gray-200);
    text-align: left;
  }
  .hcc-table td {
    font-size: var(--text-sm);
    color: var(--color-gray-800);
    padding: --spacing(3) --spacing(4);
    border-bottom: 1px solid var(--color-gray-100);
  }
  .hcc-table tr:last-child td {
    border-bottom: none;
  }
}
```

### Pattern 3: Public Route Before ProtectedRoute in React Router

**What:** Add `<Route path="/" element={<LandingPage />} />` as a sibling route before the `<Route element={<ProtectedRoute />}>` group. Change the `*` wildcard to redirect to `/` instead of `/dashboard`. Logged-in users navigating to `/` see the landing page with a "Go to Dashboard" link rather than an automatic redirect.

**When to use:** When the app needs a marketing homepage that is publicly accessible, but the main app requires auth.

**Trade-offs:** Simple — no separate deployment, no iframe, no CORS. The `ProtectedRoute` only wraps the protected group. The `LandingPage` is not wrapped at all.

**App.tsx change:**
```tsx
<Routes>
  <Route path="/" element={<LandingPage />} />           {/* public — NEW */}
  <Route path="/login" element={<LoginPage />} />         {/* public — unchanged */}
  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<DashboardPage />} />
    {/* ... all existing protected routes unchanged ... */}
  </Route>
  <Route path="*" element={<Navigate to="/" replace />} /> {/* was /dashboard */}
</Routes>
```

### Pattern 4: Primitive UI Components as Typed Wrappers

**What:** Create `components/ui/Badge.tsx`, `Card.tsx`, and `PageHeader.tsx` as typed React components that accept variant props and render the correct class combos. Pages import these primitives; raw inline badge spans and card divs are replaced.

**When to use:** For the 3-4 patterns repeated on every page: status badges, card containers, page-level h1+action-button headers.

**Trade-offs:** Small upfront creation cost; large consistency payoff across 10+ pages. A `Button.tsx` primitive is useful. A `TableRow.tsx` primitive is overkill because the `.hcc-table` CSS class covers table consistency more efficiently.

**Badge example:**
```tsx
// components/ui/Badge.tsx
type BadgeVariant = 'gold' | 'gray' | 'green' | 'red';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  gold:  'bg-brand-gold text-gray-900',
  gray:  'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-700',
  red:   'bg-red-100 text-red-700',
};

export function Badge({ variant, children }: {
  variant: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-badge ${VARIANT_CLASSES[variant]}`}>
      {children}
    </span>
  );
}
```

**PageHeader example:**
```tsx
// components/ui/PageHeader.tsx
export function PageHeader({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-title text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
```

---

## Data Flow

### Design Token to Rendered UI

```
@theme block in index.css
    ↓ (Vite processes @import "tailwindcss" + @theme at build time)
CSS custom properties on :root  +  generated utility classes (bg-brand-gold, etc.)
    ↓
@layer base sets body { font-family: var(--font-body) }
    ↓
React component uses utility class ("bg-brand-gold rounded-card shadow-card")
    ↓
Browser renders with resolved CSS variable values
```

### Landing Page to App Auth Flow

```
User visits "/"
    ↓
React Router matches LandingPage (no ProtectedRoute wrapping)
    ↓
LandingPage renders — CTA buttons link to /login and /register
    ↓
User clicks "Get Started" → LoginPage
    ↓
Successful auth → JWT httpOnly cookie set → navigate to /dashboard
    ↓
ProtectedRoute reads cookie → DashboardPage renders
```

### Component Theming Flow (after rollout)

```
@theme: --color-brand-gold defined
    ↓
Tailwind generates: bg-brand-gold, text-brand-gold, border-brand-gold utilities
    ↓
Badge.tsx uses: className="bg-brand-gold text-gray-900"
    ↓
ProjectCard.tsx uses: <Badge variant="gold">Federal</Badge>
    ↓
No raw hex values in JSX — any brand color change is a one-line edit in index.css
```

---

## Integration Points

### Existing Pages — Required Changes

| Page | What Changes | Why |
|------|-------------|-----|
| `index.html` | Add Google Fonts preconnect + `<link>` for Oswald + Inter | Fonts currently not loading — fall back to system sans-serif |
| `Layout.tsx` | Replace `bg-gray-900` with `bg-nav`, `border-[#F5C518]` with `border-brand-gold`, add SVG logo | Use tokens; replace text placeholder with actual logo |
| `DashboardPage.tsx` | Use `<PageHeader>` for h2+button, use `<Badge>` for inline status spans | Token-based typography + consistent badges |
| `ProjectCard.tsx` | Use `<Card>` primitive for shell, `<Badge>` for funding type + compliance chips, `hover:border-brand-gold` | Remove inline hex values |
| `WorkersPage.tsx` | Apply `hcc-table` class to worker table | Shared table styles |
| `PayrollWeekDetailPage.tsx` | Apply `hcc-table` class to payroll table | Shared table styles |
| `WageClassificationsTable.tsx` | Apply `hcc-table` class | Shared table styles |
| `ReportsPage.tsx` | Apply `hcc-card`, `hcc-table`, `<PageHeader>` | Token-based layout |
| `LoginPage.tsx` | Refine form card with `hcc-card`, use token colors for inputs | Visual polish — first impression |

### New Files to Create

| File | Type | Purpose |
|------|------|---------|
| `src/client/pages/LandingPage.tsx` | React page | Marketing homepage — public route at "/" |
| `src/client/components/ui/Badge.tsx` | Primitive component | Status badge with variant prop (gold/gray/green/red) |
| `src/client/components/ui/Card.tsx` | Primitive component | Card shell with optional padding variant |
| `src/client/components/ui/PageHeader.tsx` | Primitive component | Page-level title + subtitle + action slot |

### Files to Modify

| File | Change Type | Scope |
|------|------------|-------|
| `src/client/index.css` | Expand @theme + add @layer base + @layer components | Core foundation |
| `src/client/index.html` | Add Google Fonts link tags | One-time addition |
| `src/client/App.tsx` | Add "/" route, adjust wildcard redirect | Routing only |
| `src/client/components/shared/Layout.tsx` | Token classes + SVG logo | Visual polish |
| All page files (8 pages) | Apply token classes, use primitives | Polish pass |

---

## Build Order

Dependencies drive sequencing. Each phase must be complete and visually verified before the next.

```
Phase 1: CSS Foundation (no React changes — validates token pipeline)
  1a. src/client/index.html
        — add <link rel="preconnect" href="https://fonts.googleapis.com">
        — add <link href="...Oswald:wght@400;500;600;700&family=Inter..." rel="stylesheet">
  1b. src/client/index.css
        — add Google Fonts @import at top (before @import "tailwindcss")
        — expand @theme with full token set
        — add @layer base (body font, h1-h4 font)
        — add @layer components (hcc-card, hcc-table)
  Verify: open app — Oswald renders in nav, Inter in body, bg-brand-gold works

Phase 2: Primitive UI Components (no page changes)
  2a. src/client/components/ui/Badge.tsx
  2b. src/client/components/ui/Card.tsx
  2c. src/client/components/ui/PageHeader.tsx
  Verify: temporarily use one primitive in DashboardPage, check render

Phase 3: Layout + Shared Components
  3a. src/client/components/shared/Layout.tsx — token classes + SVG logo
  Verify: all protected pages still render; nav looks correct

Phase 4: Landing Page + Routing
  4a. src/client/pages/LandingPage.tsx — full marketing page
  4b. src/client/App.tsx — add "/" public route, adjust wildcard
  Verify: "/" loads unauthenticated; "/dashboard" still requires auth

Phase 5: Page Polish (each page independently verifiable)
  5a. LoginPage.tsx — first impression; affects unauth users
  5b. DashboardPage.tsx + ProjectCard.tsx — most-visited page
  5c. ProjectDetailPage.tsx
  5d. WorkersPage.tsx + WageClassificationsTable.tsx
  5e. PayrollEntryPage.tsx + PayrollWeekDetailPage.tsx
  5f. ReportsPage.tsx
  5g. OtScenarioPage.tsx, WageLookupPage.tsx (lower priority)
  Verify after each: run existing 181 tests; no regressions
```

---

## Anti-Patterns

### Anti-Pattern 1: Splitting @theme Into an Imported File

**What people do:** Create `src/client/tokens.css` with `@theme { ... }` and add `@import "./tokens.css"` inside `index.css`.

**Why it's wrong:** TailwindCSS v4 processes `@theme` only in the main CSS entry file where `@import "tailwindcss"` lives. When a file containing `@theme` is loaded via `@import`, the directive fails silently — all custom tokens are unrecognized and fall back to defaults. This is a known confirmed issue (GitHub #18966, closed but unresolved by Tailwind team — workaround is to not split the file).

**Do this instead:** Keep all `@theme` content directly in `index.css`. If the file grows large (400+ lines), only `@layer components` content is safe to split into a separate `components.css` that is imported after `@import "tailwindcss"`.

### Anti-Pattern 2: Raw Hex Values in JSX After Tokens Exist

**What people do:** Continue writing `border-[#F5C518]` and `bg-[#1a1a1a]` after defining `--color-brand-gold` and `--color-nav` in `@theme`.

**Why it's wrong:** Defeats the design system. A brand color change requires hunting through 10+ JSX files instead of editing one variable. Arbitrary value syntax (`[]`) also bypasses Tailwind's hover/focus variant generation.

**Do this instead:** After Phase 1 is complete, do a one-time pass to replace all raw hex values in JSX with generated token utility classes. Use grep to find `\[#` patterns as a checklist.

### Anti-Pattern 3: Landing Page as a Separate Static HTML File

**What people do:** Create `public/landing.html` or a separate Vite build for the marketing page.

**Why it's wrong:** Two build artifacts, two CSS systems, no shared components, routing inconsistencies. Login/register CTAs from a separate HTML file require different session handling.

**Do this instead:** `LandingPage.tsx` as a public React route at `/`. Same CSS tokens. Same Google Fonts. Same `<Link>` components. One deployment.

### Anti-Pattern 4: Typography Without @layer base Defaults

**What people do:** Apply `font-headline` and `font-body` classes manually on every heading and paragraph across 10+ pages.

**Why it's wrong:** Inconsistent application is guaranteed at scale. Any new component created without explicitly adding font classes inherits browser defaults (usually Times New Roman for headings).

**Do this instead:** Set font defaults in `@layer base` on `body` (Inter) and `h1, h2, h3, h4` (Oswald). Pages then only add size, weight, and color — never the font family itself.

### Anti-Pattern 5: Google Fonts via JSX Instead of HTML link Tag

**What people do:** Import Google Fonts with a `<link>` inside a React component or `useEffect`.

**Why it's wrong:** React components mount after initial paint. Fonts loaded via component render cause a flash of unstyled text (FOUT) — the page renders with fallback fonts, then repaints when the custom fonts load.

**Do this instead:** Add the Google Fonts `<link>` tag directly in `src/client/index.html` `<head>`, with a `<link rel="preconnect">` before it. Fonts begin loading before any JavaScript executes.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (single user) | Monolith + single index.css is correct. No design system tooling overhead needed. |
| 5-50 users | No changes needed. Design system as built handles this without modification. |
| Multi-tenant SaaS | Wrap `--color-brand-gold` overrides in `[data-theme="tenant-slug"]` selectors in `@layer base`. The primitives and `.hcc-table` / `.hcc-card` classes stay stable — only variable values change per tenant. |

---

## Sources

- [TailwindCSS v4 @theme directive — official docs](https://tailwindcss.com/docs/theme) — HIGH confidence
- [TailwindCSS v4 adding custom styles with @layer — official docs](https://tailwindcss.com/docs/adding-custom-styles) — HIGH confidence
- [TailwindCSS v4 font-size --text-* customization — official docs](https://tailwindcss.com/docs/font-size) — HIGH confidence
- [TailwindCSS v4 font-family --font-* customization — official docs](https://tailwindcss.com/docs/font-family) — HIGH confidence
- [GitHub issue #18966 — @theme fails when imported via @import in v4](https://github.com/tailwindlabs/tailwindcss/issues/18966) — HIGH confidence (confirmed limitation)
- Direct codebase inspection: `src/client/index.css`, `index.html`, `App.tsx`, `Layout.tsx`, `ProjectCard.tsx`, `DashboardPage.tsx` — HIGH confidence

---

*Architecture research for: HCC Prevailing Wage v2.1 — Design Polish + Landing Page*
*Researched: 2026-03-20*
