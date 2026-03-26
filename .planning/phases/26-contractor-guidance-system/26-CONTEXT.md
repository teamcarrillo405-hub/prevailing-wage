# Phase 26: Contractor Guidance System - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver four layers of in-app guidance so first-time contractors understand every step of the Davis-Bacon compliance workflow without consulting external documentation:

1. **Landing page how-it-works** — visible above the fold, contractor-friendly language (UX-05)
2. **Per-page help callouts** — persistent info card on Dashboard, Project Detail, Workers, Payroll Entry, Payroll Week Detail (UX-06)
3. **Empty state next-step instructions** — specific guidance + action buttons on all pages (UX-07)
4. **Inline compliance term tooltips** — `?` icon after terms like Davis-Bacon, WH-347, prevailing wage, CWHSSA, WD (UX-08)

This phase does NOT include: dark mode, feature tours, onboarding overlays, or help center / external documentation links.

</domain>

<decisions>
## Implementation Decisions

### Tooltip / ? Icon (UX-08)

- **D-01:** Build a custom React component (`TermTooltip` or `HelpTip`) — no new dependencies (no Radix, no Headless UI). ~30 lines, `useState` open/close, CSS positioning. Consistent with existing codebase pattern.
- **D-02:** `?` icon appears **inline with the term** wherever it appears in the UI — e.g., `Davis-Bacon <QuestionIcon />` renders inline. Not limited to help callouts.
- **D-03:** Must handle both desktop hover AND iPad tap (onClick toggle, not hover-only). Clicking outside or pressing Escape closes it.

### Help Callout Design (UX-06)

- **D-04:** Create a new `HelpCallout` component at `src/client/components/ui/HelpCallout.tsx` with `icon`, `title`, and `body` props. Consistent styling across all 5 pages.
- **D-05:** Visual style: subtle Card (uses existing Card component or equivalent token classes) with a light info icon, short headline, and 1-2 sentence body. No warning/error visual treatment.
- **D-06:** **Always visible — no dismiss.** Compliance software benefits from persistent guidance; contractors revisit pages weeks later. No localStorage state needed.
- **D-07:** Positioned **below PageHeader**, above main page content on each page.

### Empty State Content Strategy (UX-07)

- **D-08:** Every empty state = **text + action button**. The `message` tells the contractor exactly what to do; the `action` prop renders a Button that takes them there. Full guidance, no guessing.
- **D-09:** Pages needing empty states updated or added:
  - **Workers page** — No workers added yet (needs new EmptyState)
  - **Payroll Week list** (Project Detail) — No payroll weeks created yet (needs new EmptyState)
  - **Payroll Entry** — Verify current message is specific enough; update if too generic
  - **Dashboard** — Verify current message is specific enough; update if too generic
- **D-10:** `EmptyState` component shape (`heading`, `message`, `action`) is correct — no component changes needed, only content and action wiring.

### Landing Page How-It-Works (UX-05)

- **D-11:** Move `HowItWorksSection` to be the **first section directly after the hero** — reorder `LandingPage.tsx` section sequence. Existing intermediate section moves down.
- **D-12:** **Rewrite steps in contractor-friendly language** — speak to a GC who doesn't know what Davis-Bacon is. Emphasize compliance protection, not technical features.
- **D-13:** **Add a "Add Workers" step** — current 3 steps (Create Project → Enter Payroll → Generate WH-347) skip the workers step. Expand to 4-step flow: Create Project → Add Workers → Enter Weekly Payroll → Generate & Submit WH-347.

### Claude's Discretion

- Exact wording of tooltip definitions for each compliance term (Davis-Bacon, WH-347, prevailing wage, CWHSSA, WD) — keep to 1-2 plain sentences
- Tooltip positioning logic (above/below, collision detection) — keep simple, bias toward showing above the term
- Info icon choice for HelpCallout — use a standard ℹ️ / circle-info icon from whatever icon library is already in use
- Specific help callout copy per page — write in contractor terms, focus on "what to do here" + "why it matters for compliance"
- Whether `HelpCallout` wraps the existing `Card` component or replicates its token classes directly

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Component Patterns
- `src/client/components/ui/EmptyState.tsx` — Existing EmptyState component; action prop accepts ReactNode; extend content only
- `src/client/components/ui/Card.tsx` — Token-based card pattern; HelpCallout should match this styling approach
- `src/client/components/ui/Button.tsx` — Button variants; action buttons in EmptyState use this
- `src/client/pages/LandingPage.tsx` — Contains existing HowItWorksSection; section reorder happens here

### Requirements
- `.planning/REQUIREMENTS.md` §UX-05, UX-06, UX-07, UX-08 — Full acceptance criteria for this phase

### Design Tokens
- `src/client/index.css` — All @theme tokens; HelpCallout and TermTooltip MUST use these only, no hardcoded hex

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EmptyState` (`src/client/components/ui/EmptyState.tsx`): Has `heading`, `message`, `action?: ReactNode` — already wired on Dashboard, PayrollEntry, WorkerComplianceHistory. Workers page and Payroll Week list need it added.
- `Card` (`src/client/components/ui/Card.tsx`): `padding` prop ('default'|'sm'|'none'), `className` via `cn()` — HelpCallout can wrap or mirror this pattern.
- `HowItWorksSection` (`src/client/pages/LandingPage.tsx:92`): 3-step grid with Lucide icons, currently 3rd section. Needs reorder + 4th step + content rewrite.

### Established Patterns
- All brand values via `@theme` tokens — never hardcode `#F5C518` or `#1a1a1a` in JSX
- `cn()` utility for className merging
- No Radix UI, no Headless UI — custom implementations preferred
- `useRef` for synchronous guards (not useState) — relevant if tooltip has double-click/rapid-open concerns
- `focus:outline-hidden` (Tailwind v4) not `focus:outline-none`

### Integration Points
- 5 pages need `HelpCallout` added: `DashboardPage.tsx`, `ProjectDetailPage.tsx`, `WorkersPage.tsx`, `PayrollEntryPage.tsx`, `PayrollWeekDetailPage.tsx`
- 2-4 pages need `EmptyState` added or content updated (see D-09)
- `TermTooltip` component used inline wherever compliance terms appear across pages + landing page
- `LandingPage.tsx` section order changes (HowItWorksSection moves up)

</code_context>

<specifics>
## Specific Ideas

- The 4-step landing page flow should be: **Create Project → Add Workers → Enter Weekly Payroll → Generate & Submit WH-347**
- Help callouts should be subtle info cards — not error/warning treatment; think "a knowledgeable colleague whispered what to do here"
- TermTooltip `?` appears inline immediately after the term, desktop hover + iPad tap toggle

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 26-contractor-guidance-system*
*Context gathered: 2026-03-26*
