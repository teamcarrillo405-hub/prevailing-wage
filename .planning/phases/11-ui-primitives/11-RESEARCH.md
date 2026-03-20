# Phase 11: UI Primitives - Research

**Researched:** 2026-03-20
**Domain:** React component authoring with TailwindCSS v4 utility classes, clsx + tailwind-merge composition
**Confidence:** HIGH — all findings based on direct codebase inspection and confirmed Phase 10 output

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Reusable Card component with standard padding and border-radius, used for project cards, worker cards, report cards | Design tokens `--radius-card`, `--shadow-card`, `--color-surface-card`, `--spacing-card` exist in index.css. Generated utilities: `rounded-card`, `shadow-card`, `bg-surface-card`. |
| UI-02 | Button variants available: primary (gold fill), secondary (outlined), ghost — one clear primary CTA per screen | `--color-brand-gold` token exists, generates `bg-brand-gold`, `border-brand-gold`, `text-brand-gold`. DashboardPage has inline `bg-[#F5C518]` that confirms the target visual. |
| UI-03 | Badge component with semantic colors — green (compliant), red (violation), yellow (warning), gray (no data) — consistent across all uses | Status tokens confirmed in index.css: `--color-status-compliant`, `--color-status-violation`, `--color-status-warning`. Generates `bg-status-compliant`, `text-status-compliant`, etc. ProjectCard.tsx has the inline badge pattern to replace. |
| UI-04 | PageHeader component with page title + optional action slot (e.g., "Add Worker" button placement) | DashboardPage.tsx lines 32-39 have the exact inline pattern this replaces: `flex items-center justify-between mb-8` wrapper + h2 + button. |
| UI-05 | Empty state component with heading and action-prompt copy — used for: no projects, no workers, no payroll weeks | DashboardPage.tsx lines 62-69 have the inline empty state. WorkersPage and PayrollListPage have analogous patterns. |
</phase_requirements>

---

## Summary

Phase 11 creates five new files in `src/client/components/ui/` — Card, Button, Badge, PageHeader, and EmptyState. No existing files are modified in this phase. No new npm packages are required: `clsx` and `tailwind-merge` are confirmed NOT installed (they do not appear in package.json), but the constraint says they are already installed. Direct inspection shows they are absent — the planner must add an install step for both.

The Phase 10 token foundation is fully in place. `index.css` now contains `--radius-card`, `--shadow-card`, `--color-surface-card`, `--color-border-default`, `--color-status-compliant`, `--color-status-violation`, `--color-status-warning`, `--color-brand-gold`, and `--color-nav-dark`. All generated Tailwind utility classes from those tokens are available.

The five primitives are standalone, purely presentational, and have no API dependencies. They accept variant props and render Tailwind class combinations — nothing more. The planner can define each as a single wave. The correct output directory is `src/client/components/ui/` (does not exist yet; must be created).

**Primary recommendation:** Create all five primitives using Tailwind utility classes directly (no cn() helper required given the simplicity), install clsx and tailwind-merge first, then define a `cn()` utility at `src/client/lib/cn.ts` that both packages support.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TailwindCSS v4 | ^4.2.2 (installed) | Utility class generation from @theme tokens | Already the project CSS layer; tokens from Phase 10 are now live |
| clsx | ^2.x | Conditional class name composition | Safe conditional class joining without string concat bugs |
| tailwind-merge | ^3.x | Merge Tailwind classes, last-one-wins deduplication | Prevents class conflicts when callers pass `className` overrides to primitives |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React 19 | ^19.2.4 (installed) | Component rendering | All primitives are functional React components |
| TypeScript | ^5.9.3 (installed) | Prop type safety | Variant props typed as string unions, not raw strings |

### Important Finding: clsx and tailwind-merge Are NOT Installed

Direct inspection of `package.json` shows neither `clsx` nor `tailwind-merge` in `dependencies` or `devDependencies`. The additional context states they are "already installed" but the package.json contradicts this. The planner MUST include an install task.

**Installation:**
```bash
npm install clsx tailwind-merge
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| clsx + tailwind-merge | Raw template literals | Template literals work but produce duplicate/conflicting classes when callers pass overrides. Not worth the simplicity gain. |
| clsx + tailwind-merge | `classnames` package | `classnames` is the older API; `clsx` is the faster, smaller modern replacement. Same mental model. |

---

## Architecture Patterns

### Recommended Project Structure
```
src/client/
├── lib/
│   └── cn.ts                  # CREATE — cn() utility wrapping clsx + tailwind-merge
├── components/
│   └── ui/                    # CREATE directory
│       ├── Card.tsx            # UI-01
│       ├── Button.tsx          # UI-02
│       ├── Badge.tsx           # UI-03
│       ├── PageHeader.tsx      # UI-04
│       └── EmptyState.tsx      # UI-05
```

No other files change in Phase 11. Page integration (replacing inline patterns with these primitives) is Phase 14.

### Pattern 1: cn() Utility for Class Composition

**What:** A single `cn()` helper that combines `clsx` (conditional class joining) with `twMerge` (Tailwind deduplication). Every primitive uses it internally to merge base classes with caller-provided overrides.

**When to use:** Always, in every primitive, for the `className` prop merge.

**Example:**
```typescript
// src/client/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Pattern 2: Variant Map Record

**What:** Variant-to-class-string mappings defined as a `Record<VariantType, string>` constant at module scope. The component indexes into this record using the variant prop.

**When to use:** For Badge (4 variants), Button (3 variants). Avoids if/else chains and ensures exhaustiveness via TypeScript.

**Example (Badge):**
```typescript
type BadgeVariant = 'compliant' | 'violation' | 'warning' | 'neutral';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  compliant: 'bg-status-compliant/15 text-status-compliant',
  violation: 'bg-status-violation/15 text-status-violation',
  warning:   'bg-status-warning/15 text-status-warning',
  neutral:   'bg-gray-100 text-gray-600',
};
```

Note: TailwindCSS v4 supports opacity modifiers on custom color tokens (`bg-status-compliant/15`). This gives the soft tinted background that badge UIs require without needing separate `--color-status-compliant-light` tokens.

### Pattern 3: Optional className Prop for Override Safety

**What:** Every primitive accepts an optional `className?: string` prop and merges it last via `cn(baseClasses, className)`. This lets consuming pages override specific utilities without fighting the primitive's defaults.

**When to use:** On all five primitives. Critical for Card (different pages need different margin/width), Button (pages may need full-width on mobile), PageHeader (margin variations across pages).

**Example (Card):**
```typescript
interface CardProps {
  children: React.ReactNode;
  padding?: 'default' | 'compact' | 'none';
  className?: string;
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  default: 'p-6',
  compact: 'p-4',
  none:    'p-0',
};

export function Card({ children, padding = 'default', className }: CardProps) {
  return (
    <div className={cn(
      'bg-surface-card rounded-card shadow-card border border-border-default',
      PADDING_CLASSES[padding],
      className
    )}>
      {children}
    </div>
  );
}
```

### Pattern 4: Action Slot as React.ReactNode

**What:** PageHeader's right-side action area accepts `action?: React.ReactNode` — not a callback or a label string. The caller passes a complete `<Button>` element (or any node), which PageHeader simply renders in the right-aligned slot.

**When to use:** PageHeader. This is the correct React composition pattern for optional render slots — avoids prop drilling for button variants, click handlers, disabled states, etc.

**Example (PageHeader):**
```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="font-headline text-2xl text-text-primary">{title}</h1>
        {subtitle && (
          <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  );
}
```

### Pattern 5: EmptyState with Structured Copy Props

**What:** EmptyState accepts `heading: string` and `body: string` props (not children) for the text content. This constrains the component to a single consistent visual shape and prevents drift where one page puts a paragraph and another puts a list.

**When to use:** EmptyState. Three use cases identified: no projects (DashboardPage), no workers (WorkersPage), no payroll weeks (PayrollListPage).

**Example:**
```typescript
interface EmptyStateProps {
  heading: string;
  body: string;
  action?: React.ReactNode;
}

export function EmptyState({ heading, body, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <p className="font-headline text-lg text-text-primary mb-2">{heading}</p>
      <p className="text-sm text-text-secondary mb-6">{body}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Hardcoded hex values in primitives:** The whole point is that primitives reference design tokens. `bg-[#F5C518]` in a primitive defeats the system.
- **Compound/smart components:** Primitives must have zero data fetching, no useQuery, no API calls. They are pure rendering logic.
- **Default export components:** Use named exports (`export function Card`) so IDE autocomplete works correctly across the project.
- **Wrapping in an index.ts barrel immediately:** Skip the barrel file for now — Phase 14 will reveal actual import patterns; a premature barrel adds no value and creates a refactor risk.
- **Yellow text on gold background:** `text-brand-gold` on `bg-brand-gold` is illegible. Primary Button uses `text-nav-dark` (near-black `#1a1a1a`) on gold fill — matches existing DashboardPage "New Project" button pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conditional class joining | String interpolation with ternary chains | clsx | clsx handles falsy values, arrays, objects — template literals silently include "undefined" or "false" as class strings |
| Tailwind class deduplication | Manual class priority logic | tailwind-merge | Without twMerge, `cn('p-6', 'p-4')` produces both classes; the browser applies the last one but the output is unpredictable when Tailwind reorders utilities |
| Opacity variants on custom tokens | Separate light-color tokens | TailwindCSS v4 opacity modifier `/15` | `bg-status-compliant/15` generates the soft tinted badge background without needing `--color-status-compliant-light` in @theme |

---

## Common Pitfalls

### Pitfall 1: TailwindCSS v4 Opacity Modifier Syntax on Custom Tokens

**What goes wrong:** Developer writes `bg-status-compliant bg-opacity-15` — the old v3 pattern. The bg-opacity utility does not exist in TailwindCSS v4.

**Why it happens:** TailwindCSS v4 changed to the `/` modifier syntax for all opacity. The old separate `bg-opacity-*` utilities are removed.

**How to avoid:** Always use `bg-status-compliant/15` (slash modifier inline) for translucent backgrounds. This works on all `@theme` color tokens.

**Warning signs:** Any `bg-opacity-` or `text-opacity-` class in the codebase — these are v3 utilities that silently do nothing in v4.

### Pitfall 2: Button Focus State Accessibility

**What goes wrong:** Button uses `focus:outline-hidden` (the v4 rename from `focus:outline-none`) but nothing replaces the visible focus ring, breaking keyboard navigation.

**Why it happens:** `focus:outline-hidden` preserves the accessibility tree but removes visual indicator. For Buttons (interactive elements), there must be a visible focus state.

**How to avoid:** Button component should pair `focus:outline-hidden` with `focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2`. This shows the ring only for keyboard navigation, not mouse clicks.

**Warning signs:** Pressing Tab through the page and losing track of focus position.

### Pitfall 3: Token Name Collision — "status-neutral" Not Defined

**What goes wrong:** Badge variant `neutral` references `bg-status-neutral` but this token is NOT in index.css. The Phase 10 output defines `--color-status-compliant`, `--color-status-violation`, `--color-status-warning` — but no `--color-status-neutral`.

**Why it happens:** The success criteria references "gray" as the fourth Badge variant. The gray utilities come from Tailwind's built-in color scale, not a custom token.

**How to avoid:** Use `bg-gray-100 text-gray-600` (built-in Tailwind) for the neutral/no-data Badge variant — do not attempt to use `bg-status-neutral` which does not exist.

**Warning signs:** Badge neutral variant renders with no background at all (token resolves to empty).

### Pitfall 4: Card Shadow Token Applies Only to the Card Component

**What goes wrong:** Developer uses `shadow-card` on buttons or badges.

**Why it happens:** The token name suggests it's a generic shadow level, but it's intentionally soft (0.08 opacity) for card containers. Applied to small elements it's invisible.

**How to avoid:** `shadow-card` for Card component only. Use `shadow-sm` (Tailwind built-in) for any other element that needs subtle elevation.

### Pitfall 5: Missing ui/ Directory

**What goes wrong:** Creating a component file at `src/client/components/ui/Badge.tsx` fails because the `ui/` directory does not exist.

**Why it happens:** The directory has never been created — Phase 11 is the first phase to use it.

**How to avoid:** Create the directory (or let the Write tool create it implicitly) before writing component files. Confirm `ui/` exists after first file creation.

---

## Code Examples

Verified patterns combining Phase 10 tokens with component authoring:

### cn() Utility
```typescript
// src/client/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Card Component (UI-01)
```typescript
// src/client/components/ui/Card.tsx
import { cn } from '../../lib/cn';

interface CardProps {
  children: React.ReactNode;
  padding?: 'default' | 'compact' | 'none';
  className?: string;
}

const PADDING_CLASSES = {
  default: 'p-6',
  compact: 'p-4',
  none:    'p-0',
} as const;

export function Card({ children, padding = 'default', className }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-card rounded-card shadow-card border border-border-default',
        PADDING_CLASSES[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
```

### Button Component (UI-02)
```typescript
// src/client/components/ui/Button.tsx
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:   'bg-brand-gold text-nav-dark hover:bg-yellow-400 border border-transparent',
  secondary: 'bg-transparent text-text-primary border border-border-default hover:border-brand-gold hover:text-nav-dark',
  ghost:     'bg-transparent text-text-secondary hover:text-text-primary border border-transparent',
};

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold text-sm px-4 py-2 rounded-sm',
        'transition-colors duration-150',
        'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

### Badge Component (UI-03)
```typescript
// src/client/components/ui/Badge.tsx
import { cn } from '../../lib/cn';

type BadgeVariant = 'compliant' | 'violation' | 'warning' | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

// Note: 'neutral' uses built-in Tailwind gray — --color-status-neutral does NOT exist in @theme
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  compliant: 'bg-status-compliant/15 text-status-compliant',
  violation: 'bg-status-violation/15 text-status-violation',
  warning:   'bg-status-warning/15 text-status-warning',
  neutral:   'bg-gray-100 text-gray-600',
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block text-xs font-medium px-2 py-0.5 rounded-sm',
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
```

### PageHeader Component (UI-04)
```typescript
// src/client/components/ui/PageHeader.tsx
import { cn } from '../../lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-8', className)}>
      <div>
        <h1 className="font-headline text-2xl text-text-primary">{title}</h1>
        {subtitle && (
          <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="ml-4 flex-shrink-0">{action}</div>
      )}
    </div>
  );
}
```

### EmptyState Component (UI-05)
```typescript
// src/client/components/ui/EmptyState.tsx
import { cn } from '../../lib/cn';

interface EmptyStateProps {
  heading: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ heading, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-16', className)}>
      <p className="font-headline text-lg text-text-primary mb-2">{heading}</p>
      <p className="text-sm text-text-secondary mb-6">{body}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
```

---

## Existing Inline Patterns Being Replaced

These are the specific existing inline patterns in the codebase that Phase 11 creates the building blocks to replace (Phase 14 does the actual replacement):

### DashboardPage.tsx — Existing inline patterns

```typescript
// Line 32-39: PageHeader pattern (what UI-04 replaces)
<div className="flex items-center justify-between mb-8">
  <h2 className="font-headline text-2xl text-gray-900">Projects</h2>
  <button className="bg-[#F5C518] text-gray-900 font-semibold text-sm px-4 py-2 rounded hover:bg-yellow-400 transition-colors">
    New Project
  </button>
</div>

// Lines 62-69: EmptyState pattern (what UI-05 replaces)
<div className="text-center py-16 text-gray-500">
  <p className="text-lg font-medium mb-2">No projects yet</p>
  <p className="text-sm">Click "New Project" to create your first prevailing wage project.</p>
</div>
```

### ProjectCard.tsx — Existing inline badge patterns

```typescript
// Lines 59-65: Badge patterns (what UI-03 replaces)
<span className="inline-block text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
  {/* contract type */}
</span>
<span className="inline-block text-xs font-medium px-2 py-0.5 bg-[#F5C518] text-gray-900 rounded">
  {/* funding type — note: uses raw hex, not token */}
</span>

// Lines 71-84: Compliance badge patterns (violation/clean/no-payroll)
<span className="inline-block text-xs font-medium px-2 py-0.5 bg-red-100 text-red-700 rounded">Violations</span>
<span className="inline-block text-xs font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded">Clean</span>
<span className="inline-block text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded">No payroll</span>
```

---

## Token Availability Reference

Tokens confirmed present in `src/client/index.css` after Phase 10:

| Token | Generated Utilities | Used By |
|-------|--------------------|---------|
| `--color-brand-gold` | `bg-brand-gold`, `text-brand-gold`, `border-brand-gold` | Button primary, Badge gold |
| `--color-nav-dark` | `bg-nav-dark`, `text-nav-dark` | Button primary text |
| `--color-surface-card` | `bg-surface-card` | Card background |
| `--color-border-default` | `border-border-default` | Card border |
| `--color-text-primary` | `text-text-primary` | PageHeader title, EmptyState heading |
| `--color-text-secondary` | `text-text-secondary` | PageHeader subtitle, EmptyState body |
| `--color-status-compliant` | `bg-status-compliant/15`, `text-status-compliant` | Badge compliant |
| `--color-status-violation` | `bg-status-violation/15`, `text-status-violation` | Badge violation |
| `--color-status-warning` | `bg-status-warning/15`, `text-status-warning` | Badge warning |
| `--radius-card` | `rounded-card` | Card |
| `--radius-sm` | `rounded-sm` | Badge, Button |
| `--shadow-card` | `shadow-card` | Card |

**NOT available — use Tailwind built-ins instead:**
- No `--color-status-neutral` token — use `bg-gray-100 text-gray-600`
- No `--spacing-card` token for Tailwind class generation — use `p-6` directly

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Important Constraint: No React Component Test Infrastructure

The existing Vitest configuration uses `environment: 'node'` — it is configured exclusively for server-side API route tests. There is no `jsdom` environment, no `@testing-library/react`, and no component test setup. The 181-test suite is entirely server-side.

The UI primitives in Phase 11 are purely presentational — no API dependencies, no state management, no side effects. Automated component testing would require installing `@testing-library/react` and configuring a `jsdom` environment, which is scope expansion beyond this phase.

**Recommended approach:** The five primitive components are verified visually by rendering one on an existing page during implementation. No new test infrastructure is warranted for Phase 11.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| UI-01 | Card renders with padding and border-radius | Visual verification | n/a | No jsdom — visual only |
| UI-02 | Button primary/secondary/ghost visually distinct | Visual verification | n/a | Visual only |
| UI-03 | Badge renders 4 semantic color variants correctly | Visual verification | n/a | Visual only |
| UI-04 | PageHeader renders title + optional subtitle + right-aligned action | Visual verification | n/a | Visual only |
| UI-05 | EmptyState renders heading and action-prompt copy | Visual verification | n/a | Visual only |

### Verification Method

Each primitive is verified by temporarily importing and rendering it in DashboardPage.tsx (or a similar existing page) during the implementation wave. The verification is manual browser inspection, not automated assertion.

**Full suite after phase:** Run `npm test` to confirm the 181 existing server-side tests pass without regression. No new test files are needed or expected for Phase 11.

### Wave 0 Gaps

None — no test files needed for this phase. Existing `vitest.config.ts` and test infrastructure requires no changes.

---

## Open Questions

1. **clsx + tailwind-merge install confirmation**
   - What we know: Neither package appears in package.json (confirmed by direct inspection)
   - What's unclear: Whether they were installed but not saved, or never installed
   - Recommendation: Include `npm install clsx tailwind-merge` as the first task in Wave 0 — the install is safe to run even if somehow already present (npm will skip)

2. **Button rounded-sm vs rounded-card**
   - What we know: `--radius-sm` (0.25rem) and `--radius-card` (0.5rem) are both available
   - What's unclear: Which radius for Button — DashboardPage uses `rounded` (default 0.25rem) on its inline button
   - Recommendation: Use `rounded-sm` for Button (matches existing inline button visual), `rounded-card` for Card only

3. **Badge variant naming — semantic vs. color**
   - What we know: REQUIREMENTS.md uses "green/red/yellow/gray" labels; the phase description uses "compliant/violation/warning/neutral" semantic names
   - What's unclear: Which naming convention the consuming phases (Phase 14) will prefer
   - Recommendation: Use semantic names (`compliant | violation | warning | neutral`) — they communicate intent, not implementation. Phase 14 page integration will use semantic names naturally.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/client/index.css` — confirmed Phase 10 token set
- Direct codebase inspection: `package.json` — confirmed missing clsx/tailwind-merge
- Direct codebase inspection: `src/client/pages/DashboardPage.tsx` — inline patterns for UI-04, UI-05
- Direct codebase inspection: `src/client/components/projects/ProjectCard.tsx` — inline badge patterns for UI-03
- Direct codebase inspection: `src/client/App.tsx` — routing structure (no changes in Phase 11)
- Direct codebase inspection: `vitest.config.ts` — node environment, no jsdom
- `.planning/research/ARCHITECTURE.md` — architecture decisions, component structure
- `.planning/research/STACK.md` — stack decisions, existing library inventory

### Secondary (MEDIUM confidence)
- TailwindCSS v4 opacity modifier syntax (`/15`) — documented in ARCHITECTURE.md pattern examples, consistent with v4 CSS-first approach

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json inspected directly; missing packages identified precisely
- Architecture: HIGH — existing component patterns inspected; token availability confirmed in index.css
- Pitfalls: HIGH — token gaps (missing status-neutral), missing packages, and v4 opacity syntax verified from source files
- Test strategy: HIGH — vitest.config.ts inspected; node environment confirmed, no jsdom

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable — no fast-moving dependencies in this phase)
