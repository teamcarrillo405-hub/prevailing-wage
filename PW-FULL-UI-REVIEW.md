# HCC Prevailing Wage — Full UI Review

**Audited:** 2026-04-24
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md)
**Screenshots:** Not captured — no dev server detected at localhost:3000, :5173, or :8080

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Industry-specific, action-oriented copy throughout; no generic labels |
| 2. Visuals | 2/4 | Navigation overload and inconsistent button vocabulary undermine hierarchy |
| 3. Color | 3/4 | Gold token used consistently; 8 files use raw `#F5C518` hex bypassing the token |
| 4. Typography | 3/4 | 7 distinct sizes in use; font-bold absent from system but appears in landing page |
| 5. Spacing | 3/4 | Generally consistent Tailwind scale; 4 arbitrary `[60vh]/[70vh]` values acceptable |
| 6. Experience Design | 3/4 | Loading/empty/error states present everywhere; no global ErrorBoundary |

**Overall: 18/24**

---

## Top 3 Priority Fixes

1. **Navigation bar is missing the primary workflow entry point** — Users land on `/dashboard` but the nav offers "Team, Billing, Wage Lookup, Cost Estimator, Coverage" — zero mention of "Projects" or "Dashboard." A user's first instinct is to look in the nav for where to go; they have to visually scan the page body instead. Fix: add a "Projects" NavLink as the first item in the nav and remove "Cost Estimator" and "Coverage" (admin tools) from the primary nav into a sub-menu or settings page.

2. **Two competing button vocabularies — `bg-brand-gold` Button component vs. raw `bg-gray-900` ad-hoc buttons** — At least 6 call-sites (PayrollListPage "Download WH-347" and modal CTAs, WorkersPage "Save", OtThresholdForm "Save Threshold", OtScenarioComparison, VarianceReportPage) render dark gray `bg-gray-900` buttons instead of using the `<Button>` component. This produces a jarring visual split: gold CTA on one side of the page, charcoal CTA on the other, with no hierarchy logic. Fix: replace all raw `px-4 py-2 bg-gray-900` button strings with `<Button variant="primary">` or `<Button variant="secondary">` as appropriate.

3. **ProjectDetailPage sub-nav renders six identical gold pill links with no visual hierarchy** — Workers, Payroll Weeks, OT Scenario Planner, Variance, Reports, Activity all appear as identical `bg-brand-gold text-xs` pills. There is no visual cue indicating which is the most important next step (Answer: Workers then Payroll Weeks). The WorkflowProgress component above correctly shows the 4-step flow but it is separated from the action buttons by the project metadata card. Fix: promote "Workers" and "Payroll Weeks" as primary `<Button variant="primary">` actions; demote the remaining four to `<Button variant="secondary">` or a horizontal tab bar.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

This is the app's strongest pillar. The team has invested heavily in domain-appropriate language throughout.

**Strengths:**
- CTAs are task-specific throughout: "Create Your First Project" (DashboardPage:269), "Create First Payroll Week" (PayrollListPage:224), "Add First Worker" (WorkersPage:392), "Create Account & Join" (AcceptInvitePage:146). No generic "Submit" or "OK" found anywhere.
- Error messages cite the concrete cause: "A record for this week ending date already exists." (ProjectDetailPage:147), "SSN must be exactly 9 digits." (WorkersPage:321).
- Empty states include actionable context: "Create your first project to start tracking certified payroll. You'll need your project location to pull prevailing wage rates from SAM.gov." (DashboardPage:267–268).
- The `TermTooltip` pattern on LandingPage and throughout app pages (Davis-Bacon, WH-347, CWHSSA, WD) is excellent UX for a specialized compliance domain — it builds user confidence without cluttering the UI.
- Landing page headline is sharp: "WH-347 Certified Payroll. Davis-Bacon Rates from SAM.gov, Automated." — specific, benefit-led, no marketing fluff.

**Minor note:**
- ReportsPage empty fringe breakdown reads: "No fringe benefit data found. Fringe breakdown requires CA-style itemized fringe entries (H&W, Pension, Vacation, Training columns)." — the parenthetical is developer-facing explanation, not user-facing guidance. Suggest: "Enter CA fringe items (H&W, Pension, Vacation, Training) in your payroll entries to see this breakdown."
- "Cancel" appears in multiple modal/inline contexts which is fine — these are affordances for reversible actions, not generic primary CTAs.

---

### Pillar 2: Visuals (2/4)

The landing page is visually polished and establishes a clear brand identity (hero photo with dark overlay, gold accent, Oswald headline font). The authenticated app falls significantly short of that standard.

**Navigation architecture problem:**
The top nav in `Layout.tsx` (lines 59–69) lists: Team · Billing · Wage Lookup · Cost Estimator · Coverage · Log Out. There is no "Dashboard" or "Projects" link. The brand logo links to `/dashboard`, but that convention is not obvious to first-time users. A contractor opening the app for the first time has no nav affordance pointing to their projects — the primary entity in the entire app.

**Focal point hierarchy on ProjectDetailPage:**
The WorkflowProgress component (4-step tracker) is the most useful UI element on the project detail page — it tells the user exactly what to do next. However it sits between `HelpCallout` and the metadata card, buried mid-page. A user who has not yet added workers will see "Add Workers" as step 2 incomplete, but the actual "Workers" link is below the project metadata card in a row of six identical gold pills. The visual eye-path is broken.

**Button vocabulary inconsistency:**
- `<Button variant="primary">` renders gold/dark text (Design system).
- PayrollListPage "Download WH-347" button (line 264): raw `bg-gray-900 text-white`.
- PayrollListPage modal "Preview Copy" (line 382) and "Confirm Copy" (line 438): raw `bg-gray-900 text-white`.
- WorkersPage "Save" for extra classification (line 859): raw `bg-gray-900 text-white`.
- OtThresholdForm (line 161): raw `bg-gray-900 text-white`.
- ProjectForm (line 402): raw `bg-[#F5C518] text-gray-900` (bypasses Button component).
- UnionTradeForm (line 81): raw `bg-[#F5C518] text-black`.
- VarianceReportPage (line 112): raw `bg-[#F5C518] text-black`.

This creates two competing button styles with no semantic distinction: gold = primary action vs. dark = also-a-primary-action. Users cannot build a mental model.

**Icon-only button without aria-label:**
ProjectDetailPage (line 619): the chevron expand/collapse button on sub-contractor rows has `aria-expanded` but no visible label and no `aria-label` text for screen readers or mouse users who hover.

**EmptyState component lacks an icon:**
The `EmptyState` component (`EmptyState.tsx`) renders heading + message + optional action, but no illustrative icon. Every empty state across the app (no projects, no workers, no payroll weeks, no subcontractors) shows a blank white area with text. A simple icon per context (e.g., FolderOpen for no projects, Users for no workers) would dramatically improve perceived polish.

---

### Pillar 3: Color (3/4)

The design system token set is well-structured (`index.css` lines 6–36): brand-gold, nav-dark, surface-*, border-default, text-primary/secondary, status-compliant/violation/warning.

**Token adherence — mostly good:**
- Navigation: `bg-nav-dark border-b-4 border-brand-gold` — correct use of tokens.
- Active nav item: `text-brand-gold border-brand-gold` — correct.
- Button component: `bg-brand-gold text-nav-dark` — correct.
- Badges: use `bg-status-compliant`, `bg-status-violation`, `bg-status-warning` — correct.
- Toast container: uses `bg-status-compliant`, `bg-status-violation`, `bg-brand-gold` — correct.
- LoadingSpinner: uses hardcoded `stroke="#F5C518"` (line 21) and `stroke="#e5e7eb"` (line 16) instead of tokens — minor, acceptable in SVG context.

**Raw hex violations (8 files):**
The following use `#F5C518` or `#6B7280` directly instead of token references:
- `GsaRateDisplay.tsx:50` — `text-[#F5C518]`
- `VarianceTrendChart.tsx:35,38,43,57,66` — chart strokes using raw hex (partially acceptable for Recharts props, but `#F5C518` should reference CSS var)
- `VarianceSummaryTable.tsx:93` — `text-[#F5C518]`
- `UnionTradeForm.tsx:81` — `bg-[#F5C518]` bypasses Button component entirely
- `UnionSummaryTable.tsx:54` — `text-[#F5C518]`
- `GsaRateBuilderPage.tsx:70,93` — `bg-[#F5C518]`, `text-[#F5C518]`
- `OtScenarioComparison.tsx:191` — `text-[#F5C518]`
- `LiveCalcDisplay.tsx:83` — `text-[#F5C518]`
- `ProjectForm.tsx:402` — `bg-[#F5C518]`

Additionally, `ProjectWageDeterminationsPanel.tsx` (lines 68, 76, 99) uses `text-blue-600` — a raw Tailwind color that does not exist in the design token set. This introduces an unintended third accent color (blue) for internal link actions.

**60/30/10 color split assessment:**
- 60% neutral (gray-50, surface-page, white cards) — correct.
- 30% nav-dark in headers and dark sections — correct.
- 10% brand-gold as accent — substantially correct, with the caveat that the 6 sub-nav pills on ProjectDetailPage all use `bg-brand-gold`, making gold feel like a navigation element rather than a CTA accent. This dilutes the brand-gold's salience as a "do this" signal.

---

### Pillar 4: Typography (3/4)

**Font system:**
- Headline font: Oswald (`--font-headline`) applied via `@layer base` to h1–h4 and via `font-headline` utility class.
- Body font: Inter (`--font-body`) as body default.
The two-font system is appropriate and applied consistently in most components.

**Sizes in use (from grep analysis):**
`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl` — 8 distinct sizes across the codebase. Abstract standard flags >4. However, the landing page alone legitimately needs the full range (hero at `clamp(56px,8vw,88px)` is separate). Within the authenticated app, the most common is `text-sm` with `text-xs` for meta/label text. The range is not problematic in practice — the sizes are used semantically, not arbitrarily.

**Weights in use:**
`font-medium`, `font-semibold`, `font-bold` — 3 weights in common use. `font-bold` appears primarily on LandingPage headings which is appropriate. The authenticated app correctly uses `font-semibold` for headings and `font-medium` for emphasis. No weight chaos.

**Issues:**
- `PageHeader.tsx` (line 15): `text-2xl` for page titles. This is fairly small for a page-level heading on a desktop tool — contractors viewing projects, payroll, workers benefit from a more commanding `text-3xl` heading.
- `EmptyState.tsx` (line 14): heading uses `font-headline text-lg` — appropriate.
- ReportsPage tabClass active state (line 151): `bg-brand-gold text-nav-dark` which inverts the text color on a gold background — correct — but `text-nav-dark` against gold is near-black on yellow, the contrast should be verified (WCAG AA requires 4.5:1 for small text).
- `WorkersPage` form section titles use `text-xs font-semibold uppercase tracking-wide` — good affordance for section labels but visually very small.

---

### Pillar 5: Spacing (3/4)

**Standard scale usage:**
The codebase uses Tailwind's standard spacing scale throughout (p-3, p-4, p-5, p-6, px-3, py-2, gap-2, gap-3, gap-4, mb-4, mb-6, mb-8, space-y-3, space-y-4). The spacing feels coherent within individual pages.

**Arbitrary values found:**
- `PayrollWeekDetailPage.tsx:2576` — `max-h-[60vh]` (modal scroll container)
- `PayrollWeekDetailPage.tsx:2716` — `max-h-[70vh]` (modal scroll container)
- `PayrollWeekDetailPage.tsx:2889` — `max-h-[70vh]` (modal scroll container)
- `ProjectDetailPage.tsx:292` — `min-w-[160px]` (inline flex item minimum width)

The viewport-height values on PayrollWeekDetailPage are appropriate — scroll containers in modals legitimately need `vh` constraints. The `min-w-[160px]` on CPR week form is also reasonable. No arbitrary spacing values that indicate sloppiness.

**Inconsistency between pages:**
- DashboardPage filter bar uses `mb-4` between sections.
- PayrollListPage uses no inter-section spacing wrapper — sections flow directly.
- ProjectDetailPage uses `mt-6 mb-8` before the sub-nav pill row, `mt-4` before the archive buttons, `mt-8` before the subcontractors section. The spacing cadence within this one page is inconsistent (6, 8, 4, 8 — no logic).

**Modal padding:**
Modals consistently use `p-6 max-w-lg` (DashboardPage:246, ProjectDetailPage:928, PayrollListPage:288) — good consistency.

**Sub-nav pill row (ProjectDetailPage lines 757–793):**
The six gold pills use `gap-3`, which is fine, but the individual pill padding is `px-3 py-1.5 text-xs` — very small touch targets (about 28px tall). WCAG recommends 44px minimum touch target height. These are links to major sub-pages that users navigate frequently.

---

### Pillar 6: Experience Design (3/4)

**Loading states:**
LoadingSpinner is used consistently across pages that fetch data: ProjectDetailPage, PayrollListPage, WorkersPage. DashboardPage uses SkeletonGrid for the project grid — excellent pattern that prevents layout shift. ReportsPage and WageLookupPage show text "Loading…" which is functional but lower quality than a skeleton. TeamPage shows "Loading..." text without a spinner.

**Error states:**
isError is handled in DashboardPage ("Failed to load projects. Please refresh."), ProjectDetailPage ("Project not found or access denied."), PayrollListPage ("Failed to load payroll weeks."), WorkersPage ("Failed to load workers."). Coverage is good. However:
- No global ErrorBoundary wraps the app in `App.tsx`. A component-level JS error (not a network error) will crash the entire tree with a blank white screen.
- Error messages are plain text with no recovery action. DashboardPage's error says "Please refresh" — but there is no retry button. Add `<Button onClick={() => refetch()}>Try Again</Button>` to each error state.

**Empty states:**
Comprehensively handled. Every major list (projects, workers, payroll weeks, subcontractors, CPR weeks) has a custom `EmptyState` with contextual heading, explanation, and action button. This is well above average for a B2B tool.

**Disabled states:**
The `Button` component correctly applies `disabled:opacity-50 disabled:cursor-not-allowed`. Mutation pending states are consistently reflected in button text ("Saving...", "Removing...", "Archiving..."). Double-click protection is implemented in PayrollListPage with `copyingRef` — a thoughtful UX detail.

**Confirmation for destructive actions:**
Archive project: modal confirmation with compliance warning (ProjectDetailPage lines 926–955). Worker delete: inline confirm row (WorkersPage lines 629–643). Subcontractor delete: inline confirm (ProjectDetailPage lines 582–610). All destructive actions have confirmation — good practice.

**Wayfinding — key gap:**
The WorkflowProgress steps on ProjectDetailPage are an excellent wayfinding mechanism, but they are purely informational — no step is clickable. A user seeing "Add Workers" as incomplete has to visually locate the Workers gold pill below the metadata card. The steps should be interactive: clicking "Add Workers" should navigate to `/projects/:id/workers`.

**Navigation gap:**
The app has 15+ routes accessible from the authenticated experience, but only 5 items in the nav (Team, Billing, Wage Lookup, Cost Estimator, Coverage). The dashboard/projects — the app's core — is only accessible via the brand logo link. There is no "Projects" nav item, no breadcrumb trail on sub-pages, and back links (e.g., "← Back to Project" in PayrollListPage:185) are plain text, not visually prominent.

---

## Files Audited

**Layout / Navigation:**
- `src/client/components/shared/Layout.tsx`
- `src/client/App.tsx`

**Design Tokens / Styles:**
- `src/client/index.css`

**Pages:**
- `src/client/pages/DashboardPage.tsx`
- `src/client/pages/ProjectDetailPage.tsx`
- `src/client/pages/PayrollWizardPage.tsx`
- `src/client/pages/PayrollListPage.tsx`
- `src/client/pages/WageLookupPage.tsx`
- `src/client/pages/WorkersPage.tsx`
- `src/client/pages/TeamPage.tsx`
- `src/client/pages/LandingPage.tsx`
- `src/client/pages/LoginPage.tsx`
- `src/client/pages/ReportsPage.tsx`

**UI Components:**
- `src/client/components/ui/Button.tsx`
- `src/client/components/ui/Card.tsx`
- `src/client/components/ui/Badge.tsx`
- `src/client/components/ui/PageHeader.tsx`
- `src/client/components/ui/ToastContainer.tsx`
- `src/client/components/ui/EmptyState.tsx`
- `src/client/components/shared/LoadingSpinner.tsx`

**Additional Components:**
- `src/client/components/ProjectWageDeterminationsPanel.tsx`
- `src/client/components/OtThresholdForm.tsx`

**Registry audit:** No `components.json` found — shadcn not initialized. Registry audit skipped.
