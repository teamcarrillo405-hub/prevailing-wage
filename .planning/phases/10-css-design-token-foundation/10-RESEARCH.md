# Phase 10: CSS Design Token Foundation - Research

**Researched:** 2026-03-20
**Domain:** TailwindCSS v4 @theme token system, CSS-first design system establishment, accessibility (forced-color mode), Google Fonts loading
**Confidence:** HIGH — grounded in direct codebase audit of all 33 TSX source files + official TailwindCSS v4 documentation

---

## Summary

Phase 10 establishes the token pipeline that every subsequent v2.1 phase depends on. The current `index.css` is 7 lines with a minimal @theme block — brand color and two font families defined, no font loading, no typography scale, no spacing or radius tokens. The `index.html` has zero Google Fonts link tags, so both Oswald and Inter fall back to system fonts in every browser right now.

The actual scope of hardcoded brand values in the codebase is **significantly larger than the STATE.md flags suggest**. DESIGN-03 covers the 7 `style={{...}}` inline instances (confirmed), but there are also 65 occurrences of the arbitrary value `[#F5C518]` across className strings in 24 files. Phase 10's requirements are scoped to only the 7 inline style instances (DESIGN-03) and the 44 `focus:outline-none` instances (DESIGN-04). The className arbitrary values are out of scope for Phase 10 — they will be resolved naturally during Phase 11-14 component and page polish. This scoping decision must be preserved by the planner.

The `focus:outline-none` count is also larger than STATE.md reported. The live grep found 44 occurrences across 10 files (not 5 in LoginForm/RegisterForm/GsaRateForm as flagged). All 44 must be migrated in DESIGN-04. The vitest suite is server-side only (node environment) — no automated tests can verify CSS or visual correctness. All Phase 10 verification is manual browser inspection.

**Primary recommendation:** Execute Phase 10 in four sequential tasks: (1) Google Fonts in index.html, (2) expand @theme + add @layer base in index.css, (3) migrate all 7 inline style brand values to className utilities, (4) migrate all 44 focus:outline-none instances to focus:outline-hidden + focus:ring-brand-gold.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DESIGN-01 | HCC brand colors (gold #F5C518, dark #1a1a1a) applied via named CSS tokens — not hardcoded hex values — so a single @theme change propagates everywhere | @theme already has --color-brand-gold. Needs --color-nav-dark and supporting surface/border tokens. Once defined, all downstream components will use bg-brand-gold, border-brand-gold utilities instead of [#F5C518]. |
| DESIGN-02 | Oswald (headlines) and Inter (body) loaded correctly via Google Fonts link in index.html — currently falling back to system fonts | Confirmed: index.html has NO Google Fonts link tags. index.css has no @import url() for fonts. Both fonts must be added to index.html head with preconnect hints. @layer base must set body { font-family: var(--font-body) } and h1-h4 { font-family: var(--font-headline) } to activate globally. |
| DESIGN-03 | All 7 hardcoded inline brand values in JSX replaced with design token references | Confirmed 7 instances: ManualWageEntryForm (line 169), WageClassificationsTable (line 23), AdminStateWagePage (line 121), WageLookupPage (line 81), ReportsPage (lines 140, 169, 242). The WageClassificationsTable `<tr>` case requires verifying bg-brand-gold works on tr elements before broad application (STATE.md research flag). |
| DESIGN-04 | All focus:outline-none instances migrated to focus:outline-hidden (TailwindCSS v4 renamed utility) | Live audit found 44 instances across 10 files — not 5 as previously flagged. See file-by-file breakdown in Common Pitfalls section. The ring-[#F5C518] arbitrary value in focus rings must also be replaced with ring-brand-gold as part of this same pass. |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new packages needed for Phase 10)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TailwindCSS v4 | ^4.2.2 | Utility-first CSS + @theme token system | Already installed via @tailwindcss/vite plugin |
| Vite | ^8.0.0 | CSS processing, HMR | Already installed; processes @tailwindcss at build time |

### No New Packages Required

Phase 10 is pure CSS and find-and-replace in existing TSX files. No npm installs needed.

The `motion`, `react-intersection-observer`, and `lucide-react` packages documented in STACK.md are for Phases 13-14 (landing page, page polish). Do not install them in Phase 10.

### Installation

None required for Phase 10.

---

## Architecture Patterns

### Recommended index.css Structure After Phase 10

```
src/client/index.css (current: 7 lines)
  Line 1:  @import url("Google Fonts — Oswald + Inter")
  Line 3:  @import "tailwindcss";
  Line 5:  @theme { ... all tokens ... }
  Line N:  @layer base { body, h1-h4 font defaults }
```

CRITICAL ordering constraint: Google Fonts @import MUST come before @import "tailwindcss". The @import "tailwindcss" line must be the second import. @theme MUST follow the tailwindcss import in the same file.

### Pattern 1: Additive @theme Token Expansion

**What:** Add new tokens to the existing @theme block. Never use `--color-*: initial` or `--*: initial`.

**When to use:** Always when adding brand tokens in this project.

**Correct expansion:**
```css
/* 1. Font loading — MUST be before @import "tailwindcss" */
@import url("https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap");

/* 2. Tailwind */
@import "tailwindcss";

/* 3. @theme — additive only, NEVER use --color-*: initial */
@theme {
  /* EXISTING — do not change */
  --color-brand-gold: #F5C518;
  --font-headline: 'Oswald', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* ADD — brand surface colors */
  --color-nav-dark: #1a1a1a;
  --color-surface-muted: #f9fafb;
  --color-border-default: #e5e7eb;

  /* ADD — radius tokens */
  --radius-card: 0.5rem;
  --radius-badge: 0.25rem;

  /* ADD — shadow tokens (use v4 names, not v3 shadow-sm) */
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08);
}

/* 4. @layer base — font defaults applied to all elements */
@layer base {
  body {
    font-family: var(--font-body);
    background-color: var(--color-surface-muted);
  }
  h1, h2, h3, h4 {
    font-family: var(--font-headline);
  }
}
```

### Pattern 2: Google Fonts via index.html (not JSX)

**What:** Add preconnect hints and stylesheet link to `src/client/index.html` head. ALSO add as CSS @import at the top of index.css (belt-and-suspenders for Vite build pipeline).

**Why index.html is the primary location:** Fonts loaded via HTML link tag begin downloading before any JavaScript executes, eliminating flash of unstyled text (FOUT). A React component or CSS @import loads fonts after the JS bundle parses.

**Correct index.html addition:**
```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HCC Prevailing Wage</title>
  <!-- ADD: Font preconnect (improves load time) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <!-- ADD: Font stylesheet (loads before JS) -->
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
```

**Font weights to load:** Only 400, 500, 600, 700 for both families. Loading the full 100-900 range adds 600-900ms TTFB. The app uses only these four weights.

### Pattern 3: Inline Style to className Migration

**What:** Replace `style={{ backgroundColor: '#F5C518' }}` with `className="bg-brand-gold"`. Replace conditional `style={{ backgroundColor: condition ? '#F5C518' : undefined }}` with `className={condition ? 'bg-brand-gold' : ''}`.

**WageClassificationsTable special case:** The `<tr>` element at line 23 uses `style={{ backgroundColor: '#F5C518' }}`. TailwindCSS v4 generates `bg-brand-gold` as a standard CSS class that targets `background-color`. This applies correctly to `<tr>` elements in Chromium, Firefox, and Safari. However, the STATE.md research flag says to verify this before applying broadly. The planner must include a verification step after this specific change.

**ReportsPage font migration:** Three instances use `style={{ fontFamily: 'Oswald, sans-serif' }}`. The `@theme` token `--font-headline: 'Oswald', sans-serif` already exists and generates a `font-headline` utility class. Replace with `className="font-headline"`. After @layer base sets h1-h4 defaults, verify these ReportsPage elements are not already heading elements that would pick up the base style automatically.

### Pattern 4: focus:outline-none to focus:outline-hidden Migration

**What:** Global find-and-replace `focus:outline-none` with `focus:outline-hidden` in all TSX files.

**Why this is safe as a mechanical replace:** `outline-hidden` is the direct v4 rename of what `outline-none` was intended to do in v3 — hide the browser outline while preserving accessibility tree awareness. The gold ring (`focus:ring-2 focus:ring-[#F5C518]`) provides the visible focus indicator. The companion replace of `ring-[#F5C518]` with `ring-brand-gold` ensures the focus ring uses the token.

**Files containing focus:outline-none (44 total instances across 10 files):**

| File | Count |
|------|-------|
| pages/WorkersPage.tsx | 16 |
| components/projects/ProjectForm.tsx | 6 |
| components/SamplePayrollForm.tsx | 5 |
| components/PayrollWeekForm.tsx | 4 |
| components/OtScenarioComparison.tsx | 4 |
| components/OtThresholdForm.tsx | 3 |
| components/auth/RegisterForm.tsx | 2 |
| components/auth/LoginForm.tsx | 2 |
| pages/ReportsPage.tsx | 1 |
| components/GsaRateForm.tsx | 1 |

**Note:** WorkersPage.tsx line 442 and line 550 use `focus:outline-none` WITHOUT a focus:ring companion (they use `focus:border-yellow-400` instead). These two instances need individual attention — do not mechanically replace without ensuring an accessible focus indicator remains.

### Anti-Patterns to Avoid

- **Using `--color-*: initial`:** Wipes all default Tailwind colors across all 33 components simultaneously. No test will catch this. Recovery requires removing the line.
- **Splitting @theme into imported files:** TailwindCSS v4 GitHub issue #18966 (confirmed, closed without fix) — @theme in an imported CSS file fails silently. All @theme content stays in index.css.
- **Loading Google Fonts inside a React component:** Causes FOUT — page renders with fallback fonts, then repaints when JS-mounted link element resolves.
- **Adding @import "tailwindcss" before Google Fonts @import:** CSS import order matters; fonts must be first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font loading | Custom font-face declarations from downloaded files | Google Fonts link tag in index.html | Google serves correct font formats per browser, handles caching, CDN delivery |
| Token-to-utility mapping | JavaScript theme objects, CSS-in-JS | @theme in index.css | TailwindCSS v4 auto-generates bg-*, text-*, border-*, shadow-*, rounded-* utilities from every @theme variable |
| Focus ring accessibility | Custom :focus pseudo-class CSS blocks | focus:outline-hidden + focus:ring-brand-gold | Tailwind utilities handle cross-browser normalization correctly |

**Key insight:** TailwindCSS v4's @theme is both the variable store and the utility class generator. Any `--color-X`, `--radius-X`, `--shadow-X` token defined in @theme auto-creates `bg-X`, `border-X`, `text-X`, `rounded-X`, `shadow-X` utility classes with no additional configuration. Defining tokens manually in a `:root` block creates CSS variables but does NOT generate utilities.

---

## Common Pitfalls

### Pitfall 1: STATE.md Counts Are Understated — Real Scope is Larger

**What goes wrong:** Planning tasks based on STATE.md's "5 confirmed focus:outline-none instances" or "7 hardcoded inline brand values" will result in incomplete work. The live codebase audit found:
- 44 `focus:outline-none` instances (not 5) across 10 files
- 7 `style={{...}}` inline brand value instances (confirmed correct)
- 65 additional `[#F5C518]` occurrences in className attributes across 24 files (outside Phase 10 scope, but important for planner awareness)

**How to avoid:** DESIGN-04 tasks must target all 44 instances. Use the file-by-file table above.

**Important scope boundary:** The 65 className `[#F5C518]` instances are NOT in Phase 10's requirements (DESIGN-03 specifies only inline styles). They will be replaced during Phase 11-14 component/page polish. Do not include them in Phase 10 tasks.

### Pitfall 2: WageClassificationsTable tr Background Verification Required

**What goes wrong:** `bg-brand-gold` on `<tr>` elements has browser-specific CSS specificity behavior. Some browsers require `!important` or a more specific selector to override table background colors set at the `<tr>` level.

**How to avoid:** The DESIGN-03 migration of WageClassificationsTable must include a browser verification step. If `bg-brand-gold` on `<tr>` does not render correctly, use Tailwind's `[&>tr]:bg-brand-gold` parent-child selector or keep a minimal `style={{ backgroundColor: 'var(--color-brand-gold)' }}` using the CSS variable rather than the hex literal.

**Why this matters:** STATE.md Phase 11 flag explicitly says: "WageClassificationsTable uses `style={{ backgroundColor: '#F5C518' }}` on a `<tr>` element — verify className='bg-brand-gold' on tr before applying broadly."

### Pitfall 3: @theme Color Namespace Wipe

**What goes wrong:** Adding `--color-*: initial` wipes all default Tailwind colors (gray, red, green, blue, etc.). All 33 components using text-gray-*, bg-red-*, bg-green-* for compliance status silently lose their colors.

**Warning sign:** After any @theme edit, if the app renders with only black text and white backgrounds, `--color-*: initial` was introduced.

**How to avoid:** Add tokens only. Never use initial namespace syntax. Add a comment at the top of @theme: `/* NEVER add --color-*: initial — wipes all 33 component default colors */`

### Pitfall 4: WorkersPage focus:outline-none at Lines 442 and 550

**What goes wrong:** These two instances use `focus:outline-none focus:border-yellow-400` without a `focus:ring` companion. Mechanically replacing `outline-none` with `outline-hidden` is correct, but the `focus:border-yellow-400` arbitrary color should also be migrated to `focus:border-brand-gold` for token consistency. If left as `focus:border-yellow-400`, these two inputs will have a slightly different gold on focus compared to the rest of the app.

### Pitfall 5: No Automated Tests Exist for CSS/Visual Changes

**What goes wrong:** Developer assumes the 181-test vitest suite will catch CSS regressions. It will not — the entire suite runs in node environment targeting server-side logic only. No browser, no DOM, no CSS.

**How to avoid:** All Phase 10 verification is manual: open the app in browser, tab through form inputs, check network tab for font loading, verify token propagation visually. The planner must specify explicit manual verification steps for each task, not `npm run test`.

### Pitfall 6: @layer base Font Defaults Must Not Break Existing Typography

**What goes wrong:** Adding `h1, h2, h3, h4 { font-family: var(--font-headline); }` to @layer base may conflict with components that already explicitly set `font-headline` via utility class. The result is harmless (same value applied twice) but the planner should note that the opposite risk — components that explicitly DON'T want Oswald — does not exist in this codebase (all headings should use Oswald per brand spec).

---

## Code Examples

### Verified: Correct @theme Expansion (additive only)

```css
/* Source: TailwindCSS v4 official docs — https://tailwindcss.com/docs/theme */

@import url("https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap");

@import "tailwindcss";

@theme {
  /* Existing tokens — do not remove */
  --color-brand-gold: #F5C518;
  --font-headline: 'Oswald', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* New tokens — additive only */
  --color-nav-dark: #1a1a1a;
  --color-surface-muted: #f9fafb;
  --radius-card: 0.5rem;
  --radius-badge: 0.25rem;
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08);
}

@layer base {
  body {
    font-family: var(--font-body);
  }
  h1, h2, h3, h4 {
    font-family: var(--font-headline);
  }
}
```

### Verified: DESIGN-03 Inline Style Migration Patterns

```tsx
// BEFORE — style={{...}} with hardcoded hex
<button style={{ backgroundColor: '#F5C518' }}>Submit</button>
<h2 style={{ fontFamily: 'Oswald, sans-serif' }}>Section Title</h2>
<button style={{ backgroundColor: loading ? undefined : '#F5C518' }}>Upload</button>
<tr style={{ backgroundColor: '#F5C518' }}> {/* WageClassificationsTable line 23 */}

// AFTER — className with token utility
<button className="bg-brand-gold">Submit</button>
<h2 className="font-headline">Section Title</h2>
<button className={loading ? '' : 'bg-brand-gold'}>Upload</button>
<tr className="bg-brand-gold"> {/* verify renders in browser — see Pitfall 2 */}
```

### Verified: DESIGN-04 focus:outline-none Migration

```tsx
// BEFORE (TailwindCSS v4 — outline-none sets outline: 2px solid transparent,
//          which can interfere with forced-color mode)
className="... focus:outline-none focus:ring-2 focus:ring-[#F5C518]"

// AFTER (correct v4 utility + token reference)
className="... focus:outline-hidden focus:ring-2 focus:ring-brand-gold"

// Special case — lines with focus:border instead of focus:ring
// BEFORE
className="... focus:outline-none focus:border-yellow-400"
// AFTER
className="... focus:outline-hidden focus:border-brand-gold"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` for token definition | `@theme` block in CSS | TailwindCSS v4 (2025) | Config file is no longer needed for token definition; CSS-first |
| `outline-none` for hiding focus outlines | `outline-hidden` | TailwindCSS v4 rename | Old class sets transparent 2px outline, not true hidden; broken in forced-color mode |
| `shadow` for default shadow | `shadow-sm` | TailwindCSS v4 (scale shifted) | v4's `shadow-sm` = v3's `shadow`; new code must use v4 names |
| `ring` for 3px ring | `ring` for 1px ring | TailwindCSS v4 | Ring width changed default; `ring-2` is explicit and safe |

**Deprecated/outdated in this project:**
- `[#F5C518]` arbitrary values in className: deprecated once @theme token exists — use `brand-gold` utilities
- `tailwind.config.js`: not present in this project (correct — @theme is the v4 way)
- `@theme inline`: only needed when token value references another CSS variable; not needed for literal string values

---

## Open Questions

1. **Google Fonts @import vs. index.html link tag — is dual loading needed?**
   - What we know: The ARCHITECTURE.md research shows the @import goes before @import "tailwindcss" in index.css. index.html link tag loads fonts before JS.
   - What's unclear: Whether Vite's CSS processing with @tailwindcss/vite plugin handles the Google Fonts @import correctly at build time, or whether it requires the index.html path.
   - Recommendation: Use both. index.html for pre-JS loading (prevents FOUT), CSS @import as fallback for any build pipeline that strips the HTML head. Belt-and-suspenders adds no performance cost (browser deduplicates same-URL font requests).

2. **Should Phase 10 clear className [#F5C518] instances or only style={{}} instances?**
   - What we know: DESIGN-03 says "All 7 hardcoded inline brand values" — the word "inline" refers to inline styles (style={{}}), not className arbitrary values.
   - What's unclear: The success criterion says "No `style={{ backgroundColor: '#F5C518' }}`... inline values remain" — confirming only style={{}} is in scope.
   - Recommendation: Phase 10 clears only the 7 inline style instances. The 65 className [#F5C518] instances remain and are resolved during Phase 11-14 component rewrites. Document this boundary explicitly in tasks to prevent scope creep.

---

## Validation Architecture

> workflow.nyquist_validation is not set to false in config.json — validation section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |
| Environment | node — server-side only; NO browser/DOM tests exist |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| DESIGN-01 | Brand color token defined in @theme, generates bg-brand-gold utility | manual-only | n/a | CSS token changes have no server-side test coverage |
| DESIGN-02 | Oswald + Inter fonts load from Google Fonts, no system fallback visible | manual-only | n/a | Font loading is a browser network/render concern; no automated test possible |
| DESIGN-03 | 7 inline style={{}} instances replaced with className utilities | manual-only | `grep -rn "style={{" src/client/ \| grep -E "F5C518\|Oswald"` (should return 0) | Shell grep confirms absence; visual browser check confirms correct rendering |
| DESIGN-04 | 44 focus:outline-none → focus:outline-hidden; gold focus ring in forced-color mode | manual-only | `grep -rn "focus:outline-none" src/client/` (should return 0) | Shell grep confirms migration; tabbing through forms verifies ring behavior |

### Sampling Rate

- **Per task commit:** Shell grep verification (grep commands above — fast, zero test infrastructure needed)
- **Per wave merge:** Full vitest suite (`npm run test` — 181 tests) to confirm no server-side regressions from TSX edits
- **Phase gate:** Full suite green + all 4 manual browser checks before closing Phase 10

### Wave 0 Gaps

None — Phase 10 has no testable server-side behavior. The existing 181-test suite provides regression coverage for the server. No new test files needed. Visual verification is inherently manual.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase audit — `src/client/index.css` (7 lines, confirmed minimal), `src/client/index.html` (confirmed no Google Fonts), all 33 TSX files via grep — 2026-03-20
- `vitest.config.ts` — confirmed node environment, no browser testing
- `package.json` — confirmed Vitest 4.1.0, no Playwright/Cypress
- [TailwindCSS v4 @theme directive — official docs](https://tailwindcss.com/docs/theme) — additive token strategy, utility class generation
- [TailwindCSS v4 upgrade guide — official docs](https://tailwindcss.com/docs/upgrade-guide) — outline-none → outline-hidden rename, shadow scale shift
- [GitHub issue #18966 — @theme fails when imported via @import in v4](https://github.com/tailwindlabs/tailwindcss/issues/18966) — confirmed @theme must stay in index.css

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — CSS ordering patterns, @layer base/components structure (2026-03-20, verified against live codebase)
- `.planning/research/PITFALLS.md` — pitfall catalog with phase assignments (2026-03-20)
- `.planning/research/STACK.md` — token additions, no new packages for Phase 10 (2026-03-20)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing Tailwind v4 + Vite confirmed installed
- Architecture: HIGH — directly verified against live index.css (7 lines), index.html (no fonts), and TSX grep counts
- Pitfalls: HIGH — counts from live grep; WageClassificationsTable tr behavior flagged by prior research, confirmed in source

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable — TailwindCSS v4 @theme API is stable; Google Fonts URLs are stable)

---

## Key Discovery: Scope Correction

The most important finding from this research is that STATE.md's "5 confirmed focus:outline-none instances" is wrong by a factor of ~9x. The live codebase has **44 instances across 10 files**. The planner must size DESIGN-04 tasks accordingly. WorkersPage.tsx alone has 16 instances. This is a find-and-replace pass across 10 files, not a 5-line fix.

The 65 className `[#F5C518]` arbitrary values across 24 files are explicitly out of Phase 10 scope — they belong to Phase 11-14 component rewrites. Including them in Phase 10 would triple the task scope and create merge conflicts with the UI primitives work coming in Phase 11.
