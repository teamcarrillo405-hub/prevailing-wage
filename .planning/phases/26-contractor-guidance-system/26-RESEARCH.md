# Phase 26: Contractor Guidance System — Research

**Researched:** 2026-03-26
**Domain:** React UI component authoring (custom primitives, TailwindCSS v4, tooltip accessibility, empty state patterns)
**Confidence:** HIGH — all findings drawn directly from live codebase inspection and locked design decisions in CONTEXT.md / UI-SPEC.md

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Build a custom React component (`TermTooltip` or `HelpTip`) — no new dependencies (no Radix, no Headless UI). ~30 lines, `useState` open/close, CSS positioning. Consistent with existing codebase pattern.

**D-02:** `?` icon appears **inline with the term** wherever it appears in the UI. Not limited to help callouts.

**D-03:** Must handle both desktop hover AND iPad tap (onClick toggle, not hover-only). Clicking outside or pressing Escape closes it.

**D-04:** Create a new `HelpCallout` component at `src/client/components/ui/HelpCallout.tsx` with `icon`, `title`, and `body` props. Consistent styling across all 5 pages.

**D-05:** Visual style: subtle Card (uses existing Card component or equivalent token classes) with a light info icon, short headline, and 1-2 sentence body. No warning/error visual treatment.

**D-06:** **Always visible — no dismiss.** No localStorage state needed.

**D-07:** Positioned **below PageHeader**, above main page content on each page.

**D-08:** Every empty state = **text + action button**. The `message` tells the contractor exactly what to do; the `action` prop renders a Button that takes them there.

**D-09:** Pages needing empty states updated or added:
- **Workers page** — No workers added yet (needs new EmptyState)
- **Payroll Week list** (PayrollListPage) — No payroll weeks created yet (needs new EmptyState)
- **Payroll Entry** — Verify current message is specific enough; update if too generic
- **Dashboard** — Verify current message is specific enough; update if too generic

**D-10:** `EmptyState` component shape (`heading`, `message`, `action`) is correct — no component changes needed, only content and action wiring.

**D-11:** Move `HowItWorksSection` to be the **first section directly after the hero** — reorder `LandingPage.tsx` section sequence. Existing intermediate section (ProblemSection) moves down.

**D-12:** **Rewrite steps in contractor-friendly language.**

**D-13:** **Add a "Add Workers" step** — expand to 4-step flow: Create Project → Add Workers → Enter Weekly Payroll → Generate & Submit WH-347.

### Claude's Discretion

- Exact wording of tooltip definitions for each compliance term (provided verbatim in UI-SPEC.md — use those)
- Tooltip positioning logic (above/below, collision detection) — keep simple, bias toward showing above the term
- Info icon choice for HelpCallout — use `Info` from lucide-react (already confirmed in UI-SPEC.md)
- Specific help callout copy per page — full copy table provided in UI-SPEC.md
- Whether `HelpCallout` wraps the existing `Card` component or replicates its token classes directly

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-05 | Homepage includes a plain-language explainer section: what the system is, who it's for, and a step-by-step "how it works" flow for contractors unfamiliar with Davis-Bacon compliance | HowItWorksSection already exists in LandingPage.tsx; needs section reorder (position 3 after hero) + 4-step content rewrite + subheading update |
| UX-06 | Each major page (Dashboard, Project Detail, Workers, Payroll Entry, Payroll Week Detail) has contextual help text explaining what to do at that step and why it matters | New HelpCallout component; 5 page insertions; all copy defined in UI-SPEC.md; PageHeader pattern confirmed in 4 of 5 pages (PayrollListPage needs PageHeader migration too) |
| UX-07 | Empty states on all pages include specific next-step instructions, not generic "no data" messages | EmptyState component confirmed ready (no API change needed); 4 empty states need new content or new wiring; PayrollListPage has raw inline empty state that needs replacement |
| UX-08 | Compliance terms (Davis-Bacon, WH-347, prevailing wage, CWHSSA, WD) have inline `?` icon tooltips with plain-English definitions — accessible on desktop and iPad | New TermTooltip component; definitions provided in UI-SPEC.md; touch/hover dual interaction pattern confirmed; no new dependencies |
</phase_requirements>

---

## Summary

Phase 26 is a pure frontend content and component phase. No backend changes, no new npm packages, no database migrations. The work is additive: two new UI primitive components (`HelpCallout`, `TermTooltip`), content updates to five existing pages plus the landing page, and replacement of one raw inline empty state in `PayrollListPage.tsx`.

The design system is fully locked. All tokens, typography, icon library (lucide-react), and component patterns are established. The phase has precise specifications in the UI-SPEC.md for every piece of copy, every icon, every color token, and every interaction state. The planner's job is to decompose this into sequenced tasks — not to make design decisions.

The most significant discovery from code inspection is that `PayrollListPage.tsx` does not currently use the `PageHeader` primitive (it uses a raw `<h1>` inline) and its empty state is a raw inline `<div>` rather than the `EmptyState` component. Both need to be aligned before HelpCallout can be added in the standard pattern.

**Primary recommendation:** Implement in four sequential waves: (1) new primitives `HelpCallout` + `TermTooltip`, (2) landing page UX-05, (3) page HelpCallouts + empty state upgrades UX-06/07, (4) inline TermTooltip placement UX-08.

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x (existing) | Component authoring | Project stack |
| TailwindCSS v4 @theme | 4.x (existing) | Design tokens, utility classes | Established design system |
| lucide-react | existing | Icon set for `HelpCallout` Info icon + `TermTooltip` HelpCircle icon | Already used throughout LandingPage.tsx and page files |
| react-router-dom | existing | Link navigation in EmptyState action buttons | Existing router |

### No New Dependencies Required

All phase 26 work uses existing primitives. The CONTEXT.md decision D-01 explicitly prohibits new dependencies (no Radix UI, no Headless UI). The `TermTooltip` uses `useState` + `useRef` + `useEffect` (document click listener) — all built-in React.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

No new directories needed. New files are:

```
src/client/components/ui/
├── HelpCallout.tsx          # NEW — info card shown below PageHeader
├── TermTooltip.tsx          # NEW — inline compliance term definition popup
├── EmptyState.tsx           # EXISTING — no changes to API
├── Card.tsx                 # EXISTING — HelpCallout mirrors its token classes
├── Button.tsx               # EXISTING — used in EmptyState action slots
└── PageHeader.tsx           # EXISTING — HelpCallout goes immediately after this

src/client/pages/
├── LandingPage.tsx          # EDIT — section reorder + HowItWorksSection rewrite
├── DashboardPage.tsx        # EDIT — add HelpCallout + update empty states
├── ProjectDetailPage.tsx    # EDIT — add HelpCallout
├── WorkersPage.tsx          # EDIT — add HelpCallout + add EmptyState
├── PayrollEntryPage.tsx     # EDIT — add HelpCallout + update empty state copy
├── PayrollListPage.tsx      # EDIT — PageHeader migration + HelpCallout + EmptyState upgrade + TermTooltip
└── PayrollWeekDetailPage.tsx# EDIT — add HelpCallout + TermTooltip
```

### Pattern 1: HelpCallout Component

**What:** Static info card placed between PageHeader and page content. Non-interactive, always visible, no dismiss.

**When to use:** All 5 protected-app pages (Dashboard, ProjectDetail, Workers, PayrollEntry, PayrollWeekDetail) + PayrollListPage.

**Exact visual spec (from UI-SPEC.md):**
```tsx
// src/client/components/ui/HelpCallout.tsx
import React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

interface HelpCalloutProps {
  icon: LucideIcon;
  title: string;
  body: string;
  className?: string;
}

export function HelpCallout({ icon: Icon, title, body, className }: HelpCalloutProps) {
  return (
    <div
      className={cn(
        'bg-surface-card rounded-card shadow-card border border-border-default border-l-4 border-l-brand-gold',
        'p-4 flex gap-3 items-start mb-4',
        className
      )}
    >
      <Icon className="w-4 h-4 text-brand-gold flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-body text-sm font-bold text-text-primary">{title}</p>
        <p className="font-body text-sm text-text-secondary leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
```

**Insertion pattern in pages:**
```tsx
// After <PageHeader ... /> and before first content block
<HelpCallout
  icon={LayoutDashboard}
  title="Your Active Projects"
  body="Each project tracks a separate federal job. Add workers and enter payroll weekly to keep your certified payroll current and DOL-ready."
/>
```

**Critical note:** The `border-l-4` combined with `border border-border-default` requires careful Tailwind ordering. The left border override (`border-l-brand-gold`) must come after the base `border` class so Tailwind v4 resolves it correctly.

### Pattern 2: TermTooltip Component

**What:** Inline button rendering a `?` icon that toggles a definition popover. Opens on hover (desktop) and click/tap (iPad). Closes on Escape, click-outside, and mouse-leave.

**When to use:** Inline immediately after compliance terms: Davis-Bacon, WH-347, prevailing wage, CWHSSA, WD.

**Exact interaction spec (from UI-SPEC.md + D-01/D-02/D-03):**
```tsx
// src/client/components/ui/TermTooltip.tsx
import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TermTooltipProps {
  term: string;
  definition: string;
  className?: string;
}

export function TermTooltip({ term, definition, className }: TermTooltipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Click-outside close
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Escape key close
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <span ref={containerRef} className={cn('relative inline-flex items-baseline gap-0.5', className)}>
      {term}
      <button
        type="button"
        aria-label={`Definition of ${term}`}
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center p-1 text-text-secondary hover:text-brand-gold transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-1"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 mb-1 z-50 max-w-xs bg-nav-dark text-white text-xs leading-relaxed p-3 rounded-sm shadow-card"
        >
          {definition}
        </span>
      )}
    </span>
  );
}
```

**Usage inline in JSX:**
```tsx
<TermTooltip
  term="Davis-Bacon"
  definition="A federal law requiring contractors on federal or federally funded construction projects to pay workers the locally prevailing wage for their trade. Wages are set by the Department of Labor and published on SAM.gov."
/>
```

**Touch/hover note:** The `onMouseEnter`/`onMouseLeave` handles desktop hover; `onClick` handles tap toggle. On iPad, `onMouseEnter` does not fire — tap fires only `onClick`. The toggle logic (`v => !v`) means clicking on desktop will also open/close, which is acceptable.

### Pattern 3: EmptyState with Action Button

**What:** Existing `EmptyState` component (`heading`, `message`, `action?: ReactNode`) used with a `<Button>` or `<Link>` in the `action` slot.

**Confirmed component API (from EmptyState.tsx inspection):**
```tsx
interface EmptyStateProps {
  heading: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}
```

**Pattern for navigation action (Link + Button classes):**
```tsx
// When the action navigates to another page, use Link with Button styling
// (Button renders <button>, cannot wrap <Link> that renders <a>)
import { Link } from 'react-router-dom';

<EmptyState
  heading="No workers on this project yet"
  message="Add every worker before entering payroll. Federal Davis-Bacon rules require all workers to be classified and logged — even if they worked only one day."
  action={
    <Link
      to={`/projects/${projectId}/workers`}
      className="inline-flex items-center justify-center font-semibold rounded-sm transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 bg-brand-gold text-nav-dark hover:bg-brand-gold/90 border border-transparent text-sm px-4 py-2"
    >
      Add First Worker
    </Link>
  }
/>
```

**Pattern when action uses `onClick` (stay on page / open modal):**
```tsx
<EmptyState
  heading="No projects yet"
  message="Create your first project to start tracking certified payroll. You'll need your project location to pull prevailing wage rates from SAM.gov."
  action={
    <Button onClick={() => setShowForm(true)}>Create Your First Project</Button>
  }
/>
```

**IMPORTANT — Link vs Button in action slot:** Per the established codebase pattern (confirmed in Phase 14 decision), `Button` renders a `<button>` element and must NOT wrap a `<Link>`. For navigation actions in empty states, copy the Button primary class string directly onto a `<Link>` element.

### Pattern 4: LandingPage Section Reorder

**What:** Move `HowItWorksSection` from position 4 (currently after ProblemSection) to position 3 (directly after HeroSection).

**Current order in LandingPage.tsx (confirmed by inspection):**
1. LandingNav
2. HeroSection
3. ProblemSection  ← currently here
4. HowItWorksSection  ← needs to move up
5. FeatureHighlightsSection
6. TrustSignalsSection
7. CTACloseSection
8. LandingFooter

**Target order (per D-11 and UI-SPEC.md):**
1. LandingNav
2. HeroSection
3. HowItWorksSection  ← moved to position 3
4. ProblemSection  ← moves down
5. FeatureHighlightsSection
6. TrustSignalsSection
7. CTACloseSection
8. LandingFooter

**HowItWorksSection changes (per D-12, D-13, UI-SPEC.md):**
- Add `Users` to lucide-react imports (for step 2 icon)
- Change subheading from "Three steps from contract award to certified payroll" to "Four steps from contract award to certified payroll submission"
- Replace 3-item `steps` array with 4-item array per UI-SPEC.md table
- Grid changes from `md:grid-cols-3` to `md:grid-cols-4` (or `md:grid-cols-2 lg:grid-cols-4` for responsive)
- Step 1: FolderPlus — Create Your Project
- Step 2: Users — Add Your Workers (new step, `Users` icon)
- Step 3: ClipboardList — Enter Weekly Payroll
- Step 4: FileCheck — Generate and Submit Your WH-347

### Anti-Patterns to Avoid

- **Hardcoded hex values:** Never use `#F5C518`, `#1a1a1a`, `#111827`, etc. in JSX. All colors must reference @theme tokens.
- **`focus:outline-none` (Tailwind v3 syntax):** Use `focus:outline-hidden` (TailwindCSS v4 rename). This is a confirmed STATE.md decision.
- **Button wrapping Link:** `<Button><Link></Link></Button>` is invalid HTML (button contains a element). Copy Button class strings directly onto Link instead.
- **Hover-only tooltips:** `TermTooltip` must respond to `onClick` for iPad compatibility. Hover-only fails on touch devices.
- **Importing from `src/server` in client files:** All client interfaces are defined locally in the page file. See STATE.md Phase 22 decision.
- **Async `useState` as synchronous guard:** Use `useRef` for rapid click prevention where needed (not applicable to TermTooltip, but pattern is established for other components).

---

## Critical Code Findings

### PayrollListPage.tsx Gaps (High-Impact Discovery)

`PayrollListPage.tsx` does NOT currently use the standard primitives. It requires migration before HelpCallout can be added:

1. **No PageHeader:** Uses a raw `<h1 className="text-2xl font-headline text-gray-900">Payroll Weeks</h1>` inside a flex container. Must be replaced with `<PageHeader title="Payroll Weeks" />` with the `+ New Week` button in the `action` prop slot.

2. **Raw inline empty state:** The empty state at line 200-210 is:
   ```tsx
   <div className="text-center py-16 text-gray-500">
     <p className="text-sm">No payroll weeks yet.</p>
     <Link to={...} className="...">Create the first week</Link>
   </div>
   ```
   This must be replaced with `<EmptyState>` using the spec copy from UI-SPEC.md.

3. **Raw "New Week" button:** Uses hardcoded `bg-gray-900 text-white` — not a Button primitive. Should be migrated to `<Button>` for consistency, though this is secondary to the empty state and HelpCallout work.

The planner should treat `PayrollListPage.tsx` as a partial refactor in addition to a content update.

### TermTooltip Placement Audit

Terms to find and wrap across all affected files (from UI-SPEC.md):

| Term | Pages Where It Appears |
|------|------------------------|
| Davis-Bacon | LandingPage (hero h1, HowItWorksSection descriptions), DashboardPage HelpCallout body, WorkersPage HelpCallout body |
| WH-347 | LandingPage (hero h1), PayrollWeekDetailPage HelpCallout body |
| prevailing wage | LandingPage descriptions, PayrollEntryPage HelpCallout body |
| CWHSSA | LandingPage feature description (Shield card) |
| WD | No page-level occurrence found in current code — may appear in WageLookupPage or inline worker classification UI |

**Important scoping decision needed:** The UI-SPEC.md says "inline wherever compliance terms appear across pages + landing page." A full audit is required during execution. The planner should include a task to audit occurrences before wrapping.

### Dashboard Empty State — Two Cases

`DashboardPage.tsx` already has two `EmptyState` usages:

1. `projects.length === 0` — currently: heading "No projects yet", message `Click "New Project" to create your first prevailing wage project.` — **needs update** to spec copy.

2. `filteredProjects.length === 0` — currently: complex dynamic message based on active filters — **needs update** to spec heading "No projects match this filter" with a Clear Filters action button that calls `setSearchParams({})`.

### PayrollEntryPage Empty State — Needs Update

Current empty state at line 106-115 in PayrollEntryPage.tsx:
- heading: "No workers assigned yet"
- message: "Add workers to this project first, or run a quick check with sample data to preview calculations."
- action: "Try with sample workers" (calls `setUseMock(true)`)

Spec requires (from UI-SPEC.md):
- heading: "No entries for this week"
- message: "Add payroll entries for each worker. Each entry records the hours, classification, and pay rate used for WH-347 compliance."
- action: "Add Payroll Entry" (Button)

**Note:** The current empty state fires when `workerRows.length === 0` (no workers assigned to project). The spec empty state targets a different condition (workers exist but no entries for this week). The planner must understand this distinction — the existing empty state may need to remain OR be clarified. The spec copy "No entries for this week" suggests a week-level empty state on PayrollEntryPage after workers are added.

### Workers Page — No EmptyState Currently

`WorkersPage.tsx` (lines 85-200 reviewed) has no EmptyState component usage. The workers list renders conditionally but there is no empty state branch — it simply shows nothing when `workers.length === 0`. A new EmptyState block is required.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip popup | Custom CSS absolute positioning from scratch | Pattern in TermTooltip spec above | Z-index, viewport collision, and cleanup already solved |
| Click-outside detection | Polling or window-level focus checks | `document.addEventListener('mousedown', handler)` in `useEffect` with cleanup | Standard React pattern, cleanup required |
| Icon set | Custom SVG icons | lucide-react `HelpCircle` + `Info` (already installed) | Consistent with existing codebase |
| Token-based card styling | Hardcoded div with bg-white and boxShadow | `Card` component or mirror its class string | Phase 10 decision: token-only styling |
| Navigation in EmptyState | window.location.href | React Router `<Link>` with Button classes copied | SPA navigation, no full page reload |

---

## Common Pitfalls

### Pitfall 1: TailwindCSS v4 `focus:outline-none` vs `focus:outline-hidden`

**What goes wrong:** Using `focus:outline-none` (TailwindCSS v3 syntax) in new components causes unexpected behavior in forced-color/high-contrast mode.

**Why it happens:** TailwindCSS v4 renamed the utility. The old name may still compile (Tailwind compatibility layer) but the semantics differ slightly.

**How to avoid:** Always use `focus:outline-hidden` in new components. Confirmed in STATE.md [Phase 10] and CLAUDE.md.

**Warning signs:** Searching for `focus:outline-none` in new component files.

### Pitfall 2: Button Renders `<button>`, Not `<a>`

**What goes wrong:** `<Button><Link to="...">Text</Link></Button>` produces invalid HTML (`<button>` cannot contain `<a>`).

**Why it happens:** The Button component always renders `<button {...props}>`. There is no `asChild` prop — this was a deliberate decision in Phase 14.

**How to avoid:** For navigation actions in EmptyState, copy the Button primary variant class string directly onto `<Link>`. The class string is in Button.tsx: `bg-brand-gold text-nav-dark font-semibold hover:bg-brand-gold/90 border border-transparent inline-flex items-center justify-center font-semibold rounded-sm transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 text-sm px-4 py-2`.

### Pitfall 3: TermTooltip Hover + Click Conflict on Desktop

**What goes wrong:** If both `onMouseEnter` (open) and `onClick` (toggle) are active, clicking on desktop will open via hover then immediately close via click toggle.

**Why it happens:** `onMouseEnter` fires before `onClick`. After hover opens the tooltip, `onClick` runs and toggles it closed.

**How to avoid:** On desktop, `onClick` should only toggle when the tooltip is NOT already open from hover. One approach: track whether opened via hover vs click. Simpler approach per spec: on desktop, hover controls the panel independently from click — `onMouseEnter` sets `open(true)`, `onMouseLeave` sets `open(false)`. Click only matters for touch devices where hover does not fire. Since touch fires `onClick` but not `onMouseEnter`/`onMouseLeave`, the two modes are naturally separated on iPad.

**Confirmed approach from UI-SPEC.md:** The spec explicitly states "Opens on desktop hover (onMouseEnter/onMouseLeave) AND on click/tap (onClick toggle)." The natural device separation means this works: hover-enter opens, hover-leave closes on desktop. Tap click-toggles on iPad. No conflict in practice because `onMouseLeave` would close before click could fire on desktop.

### Pitfall 4: `border-l-4` Override in TailwindCSS v4

**What goes wrong:** `className="border border-border-default border-l-4 border-l-brand-gold"` — the `border` shorthand may not be overridden by the later `border-l-4 border-l-brand-gold` if Tailwind specificity rules apply unexpectedly.

**Why it happens:** TailwindCSS v4 resolves class conflicts differently from v3 in some cases.

**How to avoid:** Use the UI-SPEC's exact class string: `bg-surface-card rounded-card shadow-card border border-border-default border-l-4 border-l-brand-gold p-4`. Test visually — if the gold left border does not appear, add `![border-l-brand-gold]` or restructure to avoid the shorthand conflict.

### Pitfall 5: PayrollListPage Lacks PageHeader — HelpCallout Pattern Fails Without It

**What goes wrong:** Adding `<HelpCallout ... />` to `PayrollListPage.tsx` before migrating to `PageHeader` means it goes below an ad-hoc flex container, not below a consistent PageHeader component. The visual result is inconsistent with all other pages.

**Why it happens:** `PayrollListPage.tsx` predates the PageHeader primitive and was never migrated.

**How to avoid:** Migrate `PayrollListPage.tsx` to `PageHeader` as part of the UX-06 task for that page. The `+ New Week` button goes into the `action` prop.

---

## Code Examples

### HelpCallout — Complete Verified Pattern

Per UI-SPEC.md and Card.tsx inspection:
```tsx
// HelpCallout.tsx
// Card token classes verified against src/client/components/ui/Card.tsx
// 'bg-surface-card rounded-card shadow-card border border-border-default'
// Padding 'sm' = 'p-4' per Card.tsx PADDING_CLASSES
// Left border accent: border-l-4 border-l-brand-gold (added)
// Info icon: lucide-react Info, 16px (w-4 h-4), text-brand-gold
```

### TermTooltip — Verified Lucide Icons

Both icons already imported in LandingPage.tsx and other pages:
- `HelpCircle` — used for the `?` trigger button
- `Info` — used for HelpCallout icon

Confirmed lucide-react is in `package.json` dependencies.

### HowItWorksSection — Required Lucide Icon Addition

Current imports in `LandingPage.tsx`:
```tsx
import { FolderPlus, ClipboardList, FileCheck, Shield, CheckCircle, Clock, FileText, Database } from 'lucide-react';
```

New step 2 requires `Users` icon. Must add to import:
```tsx
import { FolderPlus, ClipboardList, FileCheck, Shield, CheckCircle, Clock, FileText, Database, Users } from 'lucide-react';
```

### EmptyState with Link Action — Verified Pattern

From Button.tsx inspection, primary variant class string:
```tsx
// Primary button classes (from Button.tsx VARIANT_CLASSES + SIZE_CLASSES):
// 'bg-brand-gold text-nav-dark font-semibold hover:bg-brand-gold/90 border border-transparent'
// + 'inline-flex items-center justify-center font-semibold rounded-sm'
// + 'transition-colors duration-150'
// + 'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2'
// + 'text-sm px-4 py-2'
```

---

## Page-by-Page Integration Summary

| Page | File | HelpCallout | EmptyState | TermTooltip | Notes |
|------|------|-------------|------------|-------------|-------|
| LandingPage | LandingPage.tsx | N/A | N/A | Davis-Bacon, WH-347, prevailing wage, CWHSSA in section text | Section reorder + 4-step rewrite |
| Dashboard | DashboardPage.tsx | Add (LayoutDashboard icon) | Update 2 existing (spec copy + Clear Filters action) | Davis-Bacon if in copy | Below PageHeader (mb-6 already on PageHeader) |
| Project Detail | ProjectDetailPage.tsx | Add (Workflow icon) | None needed | WH-347 if in copy | Below PageHeader, above WorkflowProgress |
| Workers | WorkersPage.tsx | Add (Users icon) | Add new (workers.length === 0 branch) | None in current page text | Workers page has NO empty state currently |
| Payroll Entry | PayrollEntryPage.tsx | Add (ClipboardList icon) | Update existing (spec copy + real action) | prevailing wage if in copy | Current empty state condition differs from spec — see pitfall |
| Payroll List | PayrollListPage.tsx | Add (FileCheck icon) | Replace raw inline (EmptyState component) | WH-347 in list items possibly | PageHeader migration required first |
| Payroll Week Detail | PayrollWeekDetailPage.tsx | Add (FileCheck icon) | None needed | WH-347, CWHSSA, prevailing wage | No PageHeader currently — uses raw heading |

**Note on PayrollWeekDetailPage:** Reading lines 106+ confirms this page does NOT have a PageHeader import or usage. It uses an inline back button + raw heading pattern. The planner should confirm whether to add PageHeader here or insert HelpCallout after the existing back button.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 26 is purely frontend component and content work. No external CLI tools, services, databases, or runtimes beyond the project's existing Node.js/Vite stack are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts present) |
| Config file | `vitest.config.ts` — environment: `node`, setupFiles: `./tests/helpers/db.ts` |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |

**Important:** The existing test suite is server-side only (routes, services, compliance logic). There are no frontend component tests. Phase 26 introduces no backend logic, so no new server tests are required. Visual/interaction validation must be done via browser inspection.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-05 | Landing page HowItWorksSection visible above fold, 4-step content | manual-only | Browser inspection | N/A |
| UX-06 | HelpCallout appears on 5 pages below PageHeader | manual-only | Browser inspection | N/A |
| UX-07 | Empty states show spec copy + action buttons | manual-only | Browser inspection | N/A |
| UX-08 | TermTooltip shows on hover (desktop) + tap (iPad sim) | manual-only | Browser inspection | N/A |
| — | TypeScript compilation | automated | `npm run build` (tsc + vite build) | ✅ tsconfig.json |
| — | Server tests still pass after changes | automated | `npm test` | ✅ tests/ |

**Rationale for manual-only:** All UX requirements are visual/interactive and there is no frontend testing framework (no Playwright, Cypress, React Testing Library, or Vitest browser mode) established in this project. The vitest config confirms `environment: 'node'` — frontend component testing is out of scope.

**TypeScript compilation is the primary automated gate.** All new component files must compile without errors. `npm run build` runs `tsc` and Vite build.

### Wave 0 Gaps

None — no new test files or framework configuration are required. Existing `npm test` and `npm run build` provide sufficient automated validation for a UI content phase.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Raw inline empty state in PayrollListPage | EmptyState component | Consistency with other pages |
| 3-step HowItWorksSection | 4-step flow including "Add Workers" | UX-05 compliance |
| Generic empty state copy | Spec-driven contractor-focused copy | UX-07 compliance |

---

## Open Questions

1. **PayrollWeekDetailPage — PageHeader or not?**
   - What we know: This page uses a back button + raw heading pattern (no PageHeader). See lines 106-115 of PayrollWeekDetailPage.tsx (not fully read but pattern confirmed from beginning of file review).
   - What's unclear: Should HelpCallout be inserted after the raw heading, or should PageHeader be migrated first for consistency?
   - Recommendation: Migrate to PageHeader for consistency with the other 4 pages. The page already has all the imports needed. Low risk since it's a layout-only change.

2. **PayrollEntryPage empty state condition mismatch**
   - What we know: Current empty state fires on `workerRows.length === 0` (no worker-classification pairs exist). Spec copy says "No entries for this week" — which implies workers exist but no payroll entries have been submitted for the current week.
   - What's unclear: Are these different states that both need empty state treatment, or should the existing condition be kept and the copy updated?
   - Recommendation: Keep the existing condition (`workerRows.length === 0`) but update the heading/message to be more specific: "No workers assigned to this project yet" with action "Add Workers" (Link to workers page). The UI-SPEC copy for Payroll Entry ("No entries for this week") may target a different scenario. Planner should use the `workerRows.length === 0` condition and write copy that is accurate to what's happening.

3. **TermTooltip placement scope — landing page**
   - What we know: The landing page already has compliance terms in prose (hero h1, feature descriptions). Wrapping them in `TermTooltip` would change the hero h1 from a plain string to JSX with interactive elements.
   - What's unclear: Is tooltip placement in landing page copy desirable, or is it app-only?
   - Recommendation: Focus TermTooltip on the protected app pages. Landing page terms are marketing copy — a tooltip there is unusual. The UI-SPEC says "inline wherever compliance terms appear across pages + landing page" — include it, but keep h1 text as-is and only wrap occurrences in paragraph/body text where a `<span>` can be inserted without affecting heading semantics.

---

## Project Constraints (from CLAUDE.md)

- All brand values via `@theme` tokens — never hardcode hex values in JSX
- `focus:outline-hidden` (TailwindCSS v4) NOT `focus:outline-none`
- No `asChild` prop on Button — copy secondary/primary class strings directly to `<a>` or `<Link>` for non-button elements
- `useRef` for synchronous guards; `useState` is async/batched (not applicable to Phase 26 but established pattern)
- Blob URL revoke after 100ms setTimeout (not applicable to Phase 26)
- Workers.ts lines 108/115 — known pre-existing TS errors, do not fix
- Migrations are add-only SQL — not applicable to Phase 26 (no schema changes)
- `PageHeader` uses `mb-6` spacing — this is the spacing between PageHeader and what follows, so HelpCallout sits immediately in that flow

---

## Sources

### Primary (HIGH confidence)

- `src/client/components/ui/EmptyState.tsx` — direct inspection, confirmed API: `heading`, `message`, `action?: ReactNode`
- `src/client/components/ui/Card.tsx` — direct inspection, confirmed token classes and padding prop
- `src/client/components/ui/Button.tsx` — direct inspection, confirmed variant classes and no `asChild`
- `src/client/components/ui/PageHeader.tsx` — direct inspection, confirmed `mb-6` and prop shape
- `src/client/pages/LandingPage.tsx` — direct inspection, confirmed section order and HowItWorksSection structure
- `src/client/pages/DashboardPage.tsx` — direct inspection, confirmed existing EmptyState usages
- `src/client/pages/WorkersPage.tsx` — direct inspection, confirmed no EmptyState currently
- `src/client/pages/PayrollListPage.tsx` — direct inspection, confirmed no PageHeader and raw inline empty state
- `src/client/pages/PayrollEntryPage.tsx` — direct inspection, confirmed existing EmptyState condition
- `src/client/pages/ProjectDetailPage.tsx` — direct inspection, confirmed PageHeader usage pattern
- `src/client/index.css` — direct inspection, confirmed all @theme tokens
- `.planning/phases/26-contractor-guidance-system/26-CONTEXT.md` — locked decisions D-01 through D-13
- `.planning/phases/26-contractor-guidance-system/26-UI-SPEC.md` — full copywriting contract, color/typography/spacing spec
- `CLAUDE.md` — project coding rules and design token requirements
- `.planning/STATE.md` — historical decisions, pattern confirmations

### Secondary (MEDIUM confidence)

- `vitest.config.ts` + `tests/` directory scan — test infrastructure is server-only, no frontend test framework

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries confirmed from package.json and existing imports
- Architecture: HIGH — component patterns confirmed from live source files
- Pitfalls: HIGH — all pitfalls derived from STATE.md decisions and code inspection
- Copy/Specs: HIGH — all copy, colors, and interaction specs are locked in UI-SPEC.md

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable frontend codebase, no external API dependencies)
