# Phase 12: App Shell + Global Layout - Research

**Researched:** 2026-03-20
**Domain:** React shared Layout component, TailwindCSS v4 design token adoption, UI primitive integration
**Confidence:** HIGH — based entirely on direct codebase inspection; no assumptions

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHELL-01 | Dark nav (#1a1a1a) with gold (#F5C518) accent present on every protected page — no page uses a white or default nav | Layout.tsx currently uses `bg-gray-900` and `border-[#F5C518]` — needs migration to `bg-nav-dark` and `border-brand-gold` tokens; all 8 protected pages route through Layout so one fix propagates everywhere |
| SHELL-02 | Typography hierarchy enforced globally — Oswald for page titles and section headers, Inter for body text, labels, table data | `@layer base` already sets Inter on body and Oswald on h1-h4 globally; pages use `font-headline` on h2/h3 elements explicitly, which works since h2/h3 inherit from @layer base; remaining gaps are per-page page titles using raw h2 instead of PageHeader component |
| SHELL-03 | Consistent card-based layout with uniform spacing tokens across all pages — all card-based sections use Card primitive with uniform padding | 8+ inline `bg-white border border-gray-200 rounded-lg p-6` patterns found across 5 pages; none currently use the Card primitive; this is the primary adoption work for this phase |
</phase_requirements>

---

## Summary

Phase 12 implements three requirements that are structurally simpler than they look. The audit reveals a single-file fix opportunity: Layout.tsx has two hardcoded hex values (`bg-gray-900`, `border-[#F5C518]`, `hover:text-[#F5C518]`) that, once replaced with design tokens, satisfies SHELL-01 across all 8 protected pages simultaneously — because every protected page uses Layout and none roll their own nav.

SHELL-02 (typography hierarchy) is already 80% complete by design: Phase 10 set `@layer base` so Inter covers the body globally and Oswald covers h1-h4 globally. The remaining gap is per-page h2 titles that use raw `font-headline text-2xl text-gray-900` patterns instead of the PageHeader primitive created in Phase 11. Replacing these is a mechanical adoption task.

SHELL-03 (card-based layout) is the primary work: 8+ inline card patterns across 5 pages (`bg-white border border-gray-200 rounded-lg p-6` and variants) need to be replaced with `<Card>`. The Card primitive exists and is ready — it just has zero adoption outside of no page currently using it.

**Primary recommendation:** Fix Layout.tsx first (2-3 class changes, SHELL-01 complete), then adopt PageHeader in pages (SHELL-02 gap closure), then adopt Card in pages (SHELL-03). Three focused tasks, each independently verifiable.

---

## Current State Audit (Direct Codebase Inspection)

### Layout.tsx — Current State

File: `src/client/components/shared/Layout.tsx`

```tsx
<nav className="bg-gray-900 border-b-4 border-[#F5C518]">
  <Link className="font-headline text-xl text-white tracking-wide hover:text-[#F5C518] transition-colors">
```

Three hardcoded values need token replacement:
- `bg-gray-900` → `bg-nav-dark` (`--color-nav-dark: #1a1a1a` is already in @theme)
- `border-[#F5C518]` → `border-brand-gold`
- `hover:text-[#F5C518]` → `hover:text-brand-gold`

After those three changes, SHELL-01 is complete for all 8 protected pages.

### Pages That Use Layout (All Protected Pages)

Every protected page imports and wraps in Layout — none roll their own nav:

| Page | Uses Layout | Has Own Nav? |
|------|-------------|--------------|
| DashboardPage.tsx | YES | No |
| ProjectDetailPage.tsx | YES | No |
| WorkersPage.tsx | YES | No |
| PayrollEntryPage.tsx | YES | No |
| PayrollListPage.tsx | YES | No |
| PayrollWeekDetailPage.tsx | YES | No |
| OtScenarioPage.tsx | YES | No |
| ReportsPage.tsx | YES | No |

LoginPage.tsx does NOT use Layout (it's a public page with its own centered layout). This is correct — LoginPage is not a protected page.

Pages that have their own internal nav links (ProjectDetailPage sub-page links) are row-level `<Link>` elements inside the main content area, not a secondary nav bar. These are fine.

### Typography Gap — SHELL-02

`@layer base` in index.css sets `h1, h2, h3, h4 { font-family: var(--font-headline) }` and `body { font-family: var(--font-body) }`. This means:

- Body text, labels, table data: **Inter — already correct globally**
- Headings (h1-h4): **Oswald — already correct globally if rendered as h elements**

Remaining gaps where Oswald is expected but may not render correctly:

| Location | Current Pattern | Gap |
|----------|----------------|-----|
| DashboardPage | `<h2 className="font-headline text-2xl text-gray-900">Projects</h2>` | Uses explicit `font-headline` and h2 element — Oswald renders correctly; should migrate to `<PageHeader title="Projects">` |
| ProjectDetailPage | `<h2 className="font-headline text-3xl text-gray-900 mb-2">{project.name}</h2>` | h2 + explicit font-headline — Oswald renders; should migrate to `<PageHeader>` |
| DashboardPage modal | `<h3 className="font-headline text-xl text-gray-900 mb-5">New Project</h3>` | h3 is covered by @layer base — Oswald renders; this is fine |

Conclusion: Typography is not broken anywhere — the @layer base ensures Oswald on all heading elements. The SHELL-02 requirement is about enforcing the hierarchy via the PageHeader primitive so future pages automatically get the correct hierarchy pattern. This is a consistency + pattern enforcement task, not a visual fix.

### Card Pattern Gaps — SHELL-03

All instances of raw inline card patterns that should use the `<Card>` primitive:

| File | Line Pattern | Migrate to Card? |
|------|-------------|-----------------|
| `DashboardPage.tsx:45` | `<div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">` | Modal dialog — NO (modals have different shadow/overlay context; Card is for page content) |
| `ProjectDetailPage.tsx:60` | `<div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">` | YES — project details card |
| `LoginPage.tsx:20` | `<div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">` | YES — but LoginPage is not a Layout-wrapped page; this is PAGE-07 work, not Phase 12 |
| `PayrollListPage.tsx:77` | `<div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">` | YES — payroll weeks list container |
| `PayrollWeekDetailPage.tsx:156` | `<div className="bg-white rounded-lg border border-gray-200 mb-6">` | YES — week summary section |
| `PayrollWeekDetailPage.tsx:218` | `<div className="bg-white rounded-lg border border-gray-200 mb-6 py-12 text-center">` | YES — empty state container (can also use EmptyState) |
| `PayrollWeekDetailPage.tsx:225` | `<div className="bg-white rounded-lg border border-gray-200">` | YES — payroll entries table wrapper |
| `WorkersPage.tsx:255` | `<div className="bg-white rounded-lg border border-gray-200 p-5">` | YES — individual worker cards |
| `WorkersPage.tsx:466` | `<div className="bg-white rounded-lg border border-gray-200 p-6">` | YES — add worker form container |
| `ProjectCard.tsx:48` | `<button className="w-full text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-[#F5C518]...">` | PARTIAL — this is a clickable button; can use Card with className override for hover state |

The `<Card>` primitive signature: `padding?: 'default' | 'sm' | 'none'` and `className?` for overrides. It uses `cn()` so className additions are safe.

### Hardcoded Hex Values Remaining in Layout.tsx

These are the ONLY remaining hardcoded hex values relevant to Phase 12:
- `src/client/components/shared/Layout.tsx` — 3 instances (`bg-gray-900`, `border-[#F5C518]`, `hover:text-[#F5C518]`)

Note: Many other files still have hardcoded `[#F5C518]` values (RegisterForm, LoginForm, OtThresholdForm, ProjectCard, WorkersPage, PayrollEntryPage, etc.) — these are OUT OF SCOPE for Phase 12. Phase 14 (Page-by-Page Polish) addresses them. Phase 12 only fixes the shared Layout.tsx and adopts primitives for the card/header patterns.

### Design Tokens Available in @theme

All tokens needed for Phase 12 are already in `src/client/index.css`:

| Token | Value | Generated Utility |
|-------|-------|-------------------|
| `--color-nav-dark` | `#1a1a1a` | `bg-nav-dark`, `text-nav-dark`, `border-nav-dark` |
| `--color-brand-gold` | `#F5C518` | `bg-brand-gold`, `text-brand-gold`, `border-brand-gold` |
| `--color-surface-card` | `#ffffff` | `bg-surface-card` |
| `--color-border-default` | `#e5e7eb` | `border-border-default` |
| `--radius-card` | `0.5rem` | `rounded-card` |
| `--shadow-card` | `0 1px 3px...` | `shadow-card` |

The Card primitive already uses all of these. No new tokens need to be added.

### UI Primitives — Current Adoption

| Primitive | File Exists | Used in Pages |
|-----------|-------------|---------------|
| Card | `components/ui/Card.tsx` | ZERO pages — needs adoption |
| Button | `components/ui/Button.tsx` | ZERO pages — needs adoption |
| Badge | `components/ui/Badge.tsx` | ZERO pages — needs adoption |
| PageHeader | `components/ui/PageHeader.tsx` | ZERO pages — needs adoption |
| EmptyState | `components/ui/EmptyState.tsx` | ZERO pages — needs adoption |

Phase 12 scope: adopt Card and PageHeader in protected pages. Badge, Button, EmptyState adoption is PAGE-01 through PAGE-07 work (Phase 14).

---

## Standard Stack

### Core (No Changes Needed — Already in Place)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React | 18.x | Component framework | In place |
| React Router DOM | 6.x | Routing — Layout wraps protected route group | In place |
| TailwindCSS v4 | 4.x | Utility CSS — token system already built | In place |
| `clsx` + `tailwind-merge` | latest | `cn()` helper for conditional class merging in primitives | In place (`src/client/lib/utils.ts`) |

### No New Dependencies

Phase 12 requires zero new npm packages. All work is CSS class replacement and React component adoption.

---

## Architecture Patterns

### Pattern 1: Single Layout Fix Propagates to All Protected Pages

Because every protected page uses `<Layout>`, updating Layout.tsx once achieves SHELL-01 globally. This is the entire point of the Layout pattern.

**Correct approach:**
```tsx
// src/client/components/shared/Layout.tsx — AFTER changes
<nav className="bg-nav-dark border-b-4 border-brand-gold">
  <Link className="font-headline text-xl text-white tracking-wide hover:text-brand-gold transition-colors">
```

No page files need to be touched for SHELL-01.

### Pattern 2: PageHeader Adoption for SHELL-02

The PageHeader primitive (created in Phase 11) has this signature:
```tsx
// src/client/components/ui/PageHeader.tsx
export function PageHeader({ title, subtitle, action, className }: PageHeaderProps)
// Renders: <h1 className="font-headline text-2xl text-text-primary">
// With: flex items-center justify-between mb-6
```

Current pages use `<h2>` for page-level titles (DashboardPage: `<h2>Projects</h2>`, ProjectDetailPage: `<h2>{project.name}</h2>`). Migrating to `<PageHeader title="...">` upgrades these to `<h1>` with the correct semantic heading level and the standard margin.

One consideration: DashboardPage currently pairs its h2 with a "New Project" button using `flex items-center justify-between mb-8`. PageHeader's action slot handles this exact pattern:
```tsx
<PageHeader
  title="Projects"
  action={<Button onClick={() => setShowForm(true)}>New Project</Button>}
/>
```

The mb-6 vs mb-8 difference: Phase 11 research confirmed PageHeader uses mb-6 (the spec value). The existing DashboardPage uses mb-8. After migration, the spacing reduces slightly. This is correct behavior — mb-6 is the design system standard.

### Pattern 3: Card Primitive Adoption for SHELL-03

The Card primitive signature:
```tsx
// Existing API:
<Card padding="default">  // p-6
<Card padding="sm">       // p-4
<Card padding="none">     // p-0 (for tables that need their own padding)
<Card className="...">    // escape hatch via cn()
```

The `hover:border-[#F5C518]` on ProjectCard (a button, not a div) cannot be a Card directly. Approach: keep ProjectCard as a `<button>` wrapper but replace its inner card styling with token classes:
```tsx
// ProjectCard.tsx — within Phase 12 scope (hover border only)
className="... hover:border-brand-gold ..."
// Full ProjectCard restructure with Card primitive → Phase 14 (PAGE-01)
```

For PayrollWeekDetailPage and WorkersPage, the table-wrapper cards use `padding="none"` since the table renders with its own cell padding.

### Pattern 4: What Is OUT OF SCOPE for Phase 12

Do NOT touch during this phase:
- App.tsx routing (correct as-is; Phase 13 handles landing page routing)
- Auth model or ProtectedRoute
- LoginPage, RegisterPage — public pages not wrapped in Layout (Phase 14 / PAGE-07)
- Per-page inline button colors (`bg-[#F5C518]` on submit buttons) — Phase 14
- Badge adoption in pages — Phase 14
- WageClassificationsTable, OtScenarioComparison, and other non-layout components — Phase 14
- Any new state management or API calls

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card container | Custom div with manually typed classes | `<Card>` from `components/ui/Card.tsx` | Already built in Phase 11 with correct tokens |
| Page title + action layout | New h1+button flex div | `<PageHeader>` from `components/ui/PageHeader.tsx` | Already built in Phase 11 |
| Class merging with overrides | String concatenation | `cn()` from `lib/utils.ts` | Handles Tailwind class conflicts correctly via tailwind-merge |
| New design tokens | Hardcoded hex values | Existing @theme tokens in `index.css` | All needed tokens already exist: `nav-dark`, `brand-gold`, `surface-card`, etc. |

---

## Common Pitfalls

### Pitfall 1: bg-nav-dark vs bg-gray-900 Visual Difference

`--color-nav-dark: #1a1a1a` is slightly darker than `bg-gray-900` (which is `#111827` in Tailwind). Wait — `#1a1a1a` is actually LIGHTER than `#111827`. Check before changing:
- `#1a1a1a` = RGB(26, 26, 26)
- `#111827` = RGB(17, 24, 39) — Tailwind gray-900

The brand spec calls for `#1a1a1a` (nav-dark), not `#111827` (gray-900). The token is correct. The visual difference is subtle but the brand-correct value is `bg-nav-dark`. This is a brand alignment fix, not a regression.

### Pitfall 2: Card Shadow vs Existing Box Shadow

The Card primitive uses `shadow-card` which resolves to `0 1px 3px 0 rgb(0 0 0 / 0.08)` — a very subtle shadow. Current inline card patterns use either no shadow or `shadow-sm`. The DashboardPage modal uses `shadow-xl` — this is NOT a candidate for Card replacement (modals need stronger shadow). Only page-content card containers should use Card.

### Pitfall 3: PageHeader Changes h2 → h1 Semantically

Current pages use `<h2>` for page titles (e.g., DashboardPage `<h2>Projects</h2>`). PageHeader renders `<h1>`. This is the CORRECT semantic change — the page title should be an h1. However, verify that no page already has an h1 elsewhere before migrating (if it does, the h2 should stay as h2 and PageHeader should not be used there, or PageHeader needs an as prop — which it does not have in the current implementation).

DashboardPage: no h1 exists → safe to use PageHeader.
ProjectDetailPage: `<h2 className="font-headline text-3xl...">` is the page title → safe to migrate to PageHeader.

### Pitfall 4: Card padding="none" for Table Wrappers

Tables need their cells to control padding, not a parent container. When wrapping a table in Card, use `padding="none"`:
```tsx
<Card padding="none">
  <table className="w-full">...
```
Using the default `p-6` padding on a table wrapper creates a gap between card edge and table header that looks wrong.

### Pitfall 5: Don't Break the 181-Test Suite

Phase 12 is purely visual — no logic, no API calls, no state changes. The 181 existing tests are all server-side (routes, services, compliance). They will not catch visual regressions but they must remain green. After each file change, confirm `npm test` stays green before moving to the next file.

---

## Code Examples

### SHELL-01: Layout.tsx Token Migration

```tsx
// src/client/components/shared/Layout.tsx — complete updated nav
<nav className="bg-nav-dark border-b-4 border-brand-gold">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
    <Link to="/dashboard" className="font-headline text-xl text-white tracking-wide hover:text-brand-gold transition-colors">
      HCC Prevailing Wage
    </Link>
    <button
      onClick={handleLogout}
      className="text-sm text-gray-300 hover:text-white px-3 py-1.5 border border-gray-600 hover:border-gray-400 rounded transition-colors"
    >
      Log Out
    </button>
  </div>
</nav>
```

Only 3 class values change. The Log Out button styling does not change (it uses standard Tailwind grays, not brand tokens — correct).

### SHELL-02: PageHeader Adoption in DashboardPage

```tsx
// Before:
<div className="flex items-center justify-between mb-8">
  <h2 className="font-headline text-2xl text-gray-900">Projects</h2>
  <button onClick={() => setShowForm(true)} className="bg-[#F5C518] text-gray-900 ...">
    New Project
  </button>
</div>

// After:
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';

<PageHeader
  title="Projects"
  action={
    <Button onClick={() => setShowForm(true)}>
      New Project
    </Button>
  }
/>
```

Note: The Button import is from Phase 11 but its adoption here is part of SHELL-02/SHELL-03 work since it eliminates the last `bg-[#F5C518]` in DashboardPage.

### SHELL-03: Card Adoption — ProjectDetailPage

```tsx
// Before:
<div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg">
  <dl>...</dl>
</div>

// After:
import { Card } from '../components/ui/Card';

<Card className="max-w-lg">
  <dl>...</dl>
</Card>
```

### SHELL-03: Card Adoption — Table Wrappers

```tsx
// Before (PayrollWeekDetailPage):
<div className="bg-white rounded-lg border border-gray-200 mb-6">
  <table>...</table>
</div>

// After:
<Card padding="none" className="mb-6">
  <table>...</table>
</Card>
```

### SHELL-03: Card Adoption — Worker Cards (WorkersPage)

```tsx
// Before:
<div className="bg-white rounded-lg border border-gray-200 p-5">

// After:
<Card padding="sm">  // p-4 is close to p-5; use sm for worker cards
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 12 |
|--------------|------------------|---------------------|
| Hardcoded `bg-gray-900` in nav | `bg-nav-dark` token | One-line fix in Layout.tsx |
| Hardcoded `border-[#F5C518]` in nav | `border-brand-gold` token | One-line fix in Layout.tsx |
| Inline `bg-white border border-gray-200 rounded-lg p-6` | `<Card>` primitive | Mechanical adoption across 5 pages |
| Raw `<h2 className="font-headline...">` + adjacent button | `<PageHeader title action>` | Adoption in 2 pages (Dashboard, ProjectDetail) |

---

## Open Questions

1. **ProjectCard hover border** — ProjectCard is a `<button>` element with `hover:border-[#F5C518]`. It cannot be wrapped in Card directly. The cleanest Phase 12 fix is to replace `hover:border-[#F5C518]` with `hover:border-brand-gold` in ProjectCard without restructuring the component as a Card. The full structural Card adoption for ProjectCard is Phase 14 (PAGE-01).
   - What we know: `hover:border-brand-gold` is a valid generated utility class.
   - Recommendation: Change only the hover class in Phase 12; leave full ProjectCard restructure to Phase 14.

2. **PayrollListPage card pattern** — `PayrollListPage.tsx:77` uses `divide-y divide-gray-100` inside the card container. Card primitive does not include divide classes. Use `<Card padding="none" className="divide-y divide-gray-100">` — the `cn()` helper merges these correctly.
   - Recommendation: Use Card with padding="none" and className for divide utilities.

3. **DashboardPage modal** — The modal dialog (`bg-white rounded-lg shadow-xl`) should NOT become a Card. Modals need `shadow-xl` not `shadow-card`. This is not in SHELL-03 scope.
   - Recommendation: Leave modal div as-is.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | Nav renders with bg-nav-dark and border-brand-gold classes | manual-only | Visual browser check — no automated test covers CSS class rendering | N/A |
| SHELL-02 | Page titles render in Oswald, body in Inter | manual-only | Visual browser check — typography is not tested by existing test suite | N/A |
| SHELL-03 | Card-based sections use Card primitive with uniform padding | manual-only | Visual browser check — component structure is not in server test suite | N/A |

All three SHELL requirements are visual/layout requirements. The existing 181 tests are server-side (routes, compliance logic, database). There are no client-side component tests in the current test suite (no React Testing Library, no Playwright).

**Regression guard:** `npm test` (full 181-test suite) must remain green after each file change. This confirms no server-side regressions, even though it does not validate the visual changes.

### Sampling Rate

- **Per task commit:** `npm test` — confirm all 181 tests still pass
- **Per wave merge:** `npm test` — full suite
- **Phase gate:** All 181 tests green + manual visual check of: DashboardPage nav, ProjectDetailPage card, WorkersPage worker cards, PayrollWeekDetailPage table cards

### Wave 0 Gaps

None — existing test infrastructure (Vitest + server tests) covers regression detection for the server-side code. No new test files are needed for Phase 12 because the SHELL requirements are visual-only and the existing tests serve as regression guards for logic.

If client-side component testing is desired in the future, that is a separate infrastructure investment (React Testing Library + jsdom config) not in scope for this phase.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/client/components/shared/Layout.tsx` — confirmed 3 hardcoded hex values needing token replacement
- Direct codebase inspection: `src/client/index.css` — confirmed all needed tokens exist (`nav-dark`, `brand-gold`, `surface-card`, `border-default`, `radius-card`, `shadow-card`)
- Direct codebase inspection: `src/client/index.html` — confirmed Google Fonts (Oswald + Inter) loaded via HTML link tag (Phase 10 complete)
- Direct codebase inspection: `src/client/components/ui/` — confirmed all 5 primitives exist (Card, Button, Badge, PageHeader, EmptyState)
- Direct codebase inspection: grep for `bg-white border border-gray-200 rounded-lg` — confirmed 8+ inline card patterns across 5 pages
- Direct codebase inspection: grep for `\[#F5C518\]|bg-gray-900` — confirmed Layout.tsx has 3 instances; other files out of Phase 12 scope
- Direct codebase inspection: `src/client/pages/` — confirmed all 8 protected pages import Layout; none have own nav

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 10 and 11 decisions confirmed as complete deliverables
- `.planning/research/ARCHITECTURE.md` — token system and Layout architecture decisions from v2.1 planning

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct file inspection, no assumptions
- Architecture: HIGH — Layout.tsx read directly; all patterns confirmed from source
- Pitfalls: HIGH — based on actual token values and component APIs read from source

**Research date:** 2026-03-20
**Valid until:** 30 days — stack is stable; no fast-moving dependencies in scope
