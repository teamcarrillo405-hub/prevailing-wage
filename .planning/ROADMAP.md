# Roadmap: HCC Prevailing Wage

## Milestones

- ✅ **v1.0** Foundation + Wage Engine + Payroll + Differentiators — Phases 1-5 (shipped 2026-03-19)
- ✅ **v2.0** Contractor UX Overhaul + Compliance — Phases 6-9 (shipped 2026-03-20)
- 🔄 **v2.1** Design Polish + Landing Page — Phases 10-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 Foundation + Wage Engine + Payroll + Differentiators (Phases 1-5) — SHIPPED 2026-03-19</summary>

Auth, project creation, SAM.gov wage determination fetch and cache, workers/classifications, weekly payroll entry, WH-347 PDF generation, CSV export, OT scenario comparison, union allocations, GSA rate builder, job cost variance reporting with PDF.

Plans are not archived here — built before GSD structure. See MILESTONES.md.

</details>

<details>
<summary>✅ v2.0 Contractor UX Overhaul + Compliance (Phases 6-9) — SHIPPED 2026-03-20</summary>

- [x] **Phase 6: WH-347 2025 Compliance Foundation** — programName/J/RA field, multi-page WH-347, certApprentices boolean from real data (4/4 plans — 2026-03-20)
- [x] **Phase 7: Compliance Engine + Payroll Week View** — under-wage/CWHSSA OT detection, PayrollWeekDetailPage, one-click WH-347 (4/4 plans — 2026-03-20)
- [x] **Phase 8: Dashboard + UX Polish** — compliance badges on project cards, nav links, missing-data warnings, WH-347 per row (4/4 plans — 2026-03-20)
- [x] **Phase 9: Reports** — fringe benefit summary and worker pay history reports (4/4 plans — 2026-03-20)

Archive: `.planning/milestones/v2.0-ROADMAP.md`

</details>

### 🔄 v2.1 Design Polish + Landing Page (Phases 10-14)

- [x] **Phase 10: CSS Design Token Foundation** — HCC brand tokens in @theme, Google Fonts, inline style migration, focus utility fix (completed 2026-03-20)
- [ ] **Phase 11: UI Primitives** — Card, Button, Badge, PageHeader, EmptyState reusable components
- [ ] **Phase 12: App Shell + Global Layout** — dark nav on all protected pages, typography hierarchy, consistent card spacing
- [ ] **Phase 13: Landing Page + Routing** — full marketing homepage at public route "/", auth-aware routing
- [ ] **Phase 14: Page-by-Page Polish** — Dashboard, Project Detail, Workers, Payroll Entry, Payroll Week Detail, Reports, Login/Register

## Phase Details

### Phase 10: CSS Design Token Foundation
**Goal**: The token pipeline is established — every color, font, spacing, and shadow value is defined once in @theme and propagates to all 33 components via utility classes, with no hardcoded brand values remaining in JSX
**Depends on**: Nothing (first v2.1 phase)
**Requirements**: DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04
**Success Criteria** (what must be TRUE):
  1. Changing the gold value in one line of index.css updates every gold element in the app with no JSX edits required
  2. Oswald headlines and Inter body text render correctly in all browsers — no system-font fallback visible
  3. No `style={{ backgroundColor: '#F5C518' }}` or `style={{ fontFamily: 'Oswald' }}` inline values remain anywhere in the codebase
  4. All form inputs with `focus:outline-none` have been replaced with `focus:outline-hidden` and gold focus rings display correctly in forced-color mode
**Plans**: 3 plans
Plans:
- [ ] 10-01-PLAN.md — Google Fonts load + full @theme token expansion + @layer base font defaults
- [ ] 10-02-PLAN.md — Migrate 7 inline brand style instances to className token utilities
- [ ] 10-03-PLAN.md — Migrate all 44 focus:outline-none instances to focus:outline-hidden

### Phase 11: UI Primitives
**Goal**: Five shared primitive components exist and are ready to use — Card, Button variants, Badge, PageHeader, and EmptyState — all referencing design tokens from Phase 10
**Depends on**: Phase 10
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. A Card component wraps content with consistent padding and border-radius and accepts an optional padding variant
  2. Primary (gold fill), secondary (outlined), and ghost Button variants are visually distinct — one primary CTA per screen rule is enforced by component design
  3. Badge component renders green (compliant), red (violation), yellow (warning), and gray (no data) semantic variants — correct color on each variant
  4. PageHeader renders a page title with optional subtitle and a right-aligned action slot usable by any page
  5. EmptyState renders a heading and action-prompt copy — usable on no-projects, no-workers, and no-payroll-weeks screens
**Plans**: 2 plans
Plans:
- [ ] 11-01-PLAN.md — Install clsx/tailwind-merge + cn() utility + Card, Button, Badge components (UI-01, UI-02, UI-03)
- [ ] 11-02-PLAN.md — PageHeader and EmptyState components (UI-04, UI-05)

### Phase 12: App Shell + Global Layout
**Goal**: Every protected page shares the same dark nav with gold accent, Oswald/Inter typography hierarchy, and uniform card-based spacing — without touching each page individually
**Depends on**: Phase 11
**Requirements**: SHELL-01, SHELL-02, SHELL-03
**Success Criteria** (what must be TRUE):
  1. Navigating through Dashboard, Project Detail, Workers, Payroll Entry, Payroll Week Detail, Reports, and Login pages — every page shows the dark (#1a1a1a) nav with gold (#F5C518) accent, no white or default nav visible
  2. Page titles render in Oswald, body text and table data render in Inter — visible typographic distinction between headings and data on every page
  3. All card-based sections use the Card primitive with uniform padding — no page has ad-hoc card divs with differing padding values
**Plans**: 3 plans
Plans:
- [ ] 10-01-PLAN.md — Google Fonts load + full @theme token expansion + @layer base font defaults
- [ ] 10-02-PLAN.md — Migrate 7 inline brand style instances to className token utilities
- [ ] 10-03-PLAN.md — Migrate all 44 focus:outline-none instances to focus:outline-hidden

### Phase 13: Landing Page + Routing
**Goal**: A full marketing homepage exists at "/" that converts general contractors by naming WH-347, Davis-Bacon, and SAM.gov in the first viewport, with correct auth-aware routing so authenticated users reach the dashboard and new users reach registration
**Depends on**: Phase 10
**Requirements**: LANDING-01, LANDING-02, LANDING-03, LANDING-04, LANDING-05, LANDING-06, LANDING-07
**Success Criteria** (what must be TRUE):
  1. Visiting "/" while logged out shows the landing page — the hero section names "WH-347," "Davis-Bacon," and "SAM.gov" above the fold with a "Create Free Account" primary CTA
  2. Clicking "Create Free Account" on the landing page navigates to /register (not /login) — a new user can complete registration without being dead-ended
  3. Visiting "/" while logged in redirects to /dashboard — authenticated users never see the marketing page
  4. Visiting an unknown URL while logged in redirects to /dashboard; while logged out redirects to "/"
  5. All six landing page sections render: hero, problem, how-it-works, feature highlights, trust signals, and CTA close with footer
**Plans**: 3 plans
Plans:
- [ ] 10-01-PLAN.md — Google Fonts load + full @theme token expansion + @layer base font defaults
- [ ] 10-02-PLAN.md — Migrate 7 inline brand style instances to className token utilities
- [ ] 10-03-PLAN.md — Migrate all 44 focus:outline-none instances to focus:outline-hidden

### Phase 14: Page-by-Page Polish
**Goal**: Every existing app page uses the Card, Badge, Button, PageHeader, and EmptyState primitives from Phase 11, with no ad-hoc inline styling, and each page is individually verifiable against its success criteria
**Depends on**: Phase 12
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05, PAGE-06, PAGE-07
**Success Criteria** (what must be TRUE):
  1. Dashboard shows project cards using the Card primitive; the compliance badge on each card displays violation count or "Compliant" in the correct semantic color; an empty dashboard shows the EmptyState component prompting "Create your first project"
  2. Workers page shows worker cards using the Card primitive; address and SSN missing-data warnings use the Badge component with an action link — not plain inline text
  3. Payroll Entry form fields have consistent label/input styling; the submit button uses the primary gold variant; secondary actions use the secondary or ghost variant
  4. Payroll Week Detail table has visible row structure (borders or alternating rows); violation badges are prominent using the Badge primitive — not unstyled inline text
  5. Reports page tables have clear column alignment and header distinction; printing the page omits nav chrome (print CSS applied)
  6. Login and Register pages use the gold primary button, display the HCC brand, and share a consistent form layout
**Plans**: 3 plans
Plans:
- [ ] 10-01-PLAN.md — Google Fonts load + full @theme token expansion + @layer base font defaults
- [ ] 10-02-PLAN.md — Migrate 7 inline brand style instances to className token utilities
- [ ] 10-03-PLAN.md — Migrate all 44 focus:outline-none instances to focus:outline-hidden

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5. Foundation → Differentiators | v1.0 | All | Complete | 2026-03-19 |
| 6. WH-347 2025 Compliance Foundation | v2.0 | 4/4 | Complete | 2026-03-20 |
| 7. Compliance Engine + Payroll Week View | v2.0 | 4/4 | Complete | 2026-03-20 |
| 8. Dashboard + UX Polish | v2.0 | 4/4 | Complete | 2026-03-20 |
| 9. Reports | v2.0 | 4/4 | Complete | 2026-03-20 |
| 10. CSS Design Token Foundation | 3/3 | Complete    | 2026-03-20 | - |
| 11. UI Primitives | v2.1 | 0/2 | Not started | - |
| 12. App Shell + Global Layout | v2.1 | 0/? | Not started | - |
| 13. Landing Page + Routing | v2.1 | 0/? | Not started | - |
| 14. Page-by-Page Polish | v2.1 | 0/? | Not started | - |
