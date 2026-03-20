# Requirements: v2.1 — Design Polish + Landing Page

**Milestone:** v2.1
**Status:** Draft — pending user approval
**Last updated:** 2026-03-20

---

## v1 Requirements

### Category: Design Foundation (DESIGN)

*Token system that all page polish and landing page work depends on.*

- [ ] **DESIGN-01:** User sees HCC brand colors (gold #F5C518, dark #1a1a1a) applied via named CSS tokens — not hardcoded hex values — so a single @theme change propagates everywhere
- [ ] **DESIGN-02:** User sees Oswald (headlines) and Inter (body) loaded correctly via Google Fonts link in index.html — currently falling back to system fonts
- [ ] **DESIGN-03:** All 7 hardcoded inline brand values in JSX replaced with design token references
- [ ] **DESIGN-04:** All 5 `focus:outline-none` instances migrated to `focus:outline-hidden` (TailwindCSS v4 renamed utility)

### Category: UI Primitives (UI)

*Reusable components that pages share — define once, use everywhere.*

- [ ] **UI-01:** Reusable Card component with standard padding and border-radius, used for project cards, worker cards, report cards
- [ ] **UI-02:** Button variants available: primary (gold fill), secondary (outlined), ghost — one clear primary CTA per screen
- [ ] **UI-03:** Badge component with semantic colors — green (compliant), red (violation), yellow (warning), gray (no data) — consistent across all uses
- [ ] **UI-04:** PageHeader component with page title + optional action slot (e.g., "Add Worker" button placement)
- [ ] **UI-05:** Empty state component with heading and action-prompt copy — used for: no projects, no workers, no payroll weeks

### Category: App Shell (SHELL)

*Global layout and navigation that applies to all protected pages.*

- [ ] **SHELL-01:** Dark nav (#1a1a1a) with gold accent (#F5C518) present on every protected page — no page uses a white or default nav
- [ ] **SHELL-02:** Typography hierarchy enforced globally — Oswald for page titles and section headers, Inter for body text, labels, table data
- [ ] **SHELL-03:** Consistent card-based layout with uniform spacing tokens across all pages

### Category: Page Polish (PAGE)

*Visual polish applied to each existing app page using design tokens and UI primitives.*

- [ ] **PAGE-01:** Dashboard — project cards use Card primitive, compliance badge shows violation count or "Compliant", empty state prompts "Create your first project"
- [ ] **PAGE-02:** Project Detail — navigation links visually clear, workflow sections have consistent header hierarchy
- [ ] **PAGE-03:** Workers page — worker cards use Card primitive, missing-data warnings (address/SSN) elevated with Badge + action link
- [ ] **PAGE-04:** Payroll Entry form — form fields have consistent label/input styling, button hierarchy uses primary/secondary variants
- [ ] **PAGE-05:** Payroll Week Detail — data table has visible row structure (borders or alternating rows), violation badges are prominent (not just inline text)
- [ ] **PAGE-06:** Reports page — table data display with clear column alignment and header distinction; print-friendly (no nav chrome on print)
- [ ] **PAGE-07:** Login and Register pages — form layout consistent, primary button uses gold variant, HCC brand visible

### Category: Landing Page (LANDING)

*Public marketing page at "/" — independent of app, shares design tokens.*

- [ ] **LANDING-01:** Hero section — outcome-focused headline, 1-2 sentence subhead, "Create Free Account" primary CTA, secondary "See How It Works" anchor link, product screenshot (no hardhat stock photos)
- [ ] **LANDING-02:** Problem section — 3 contractor pain points framed as problems the user already feels (manual rate lookup, WH-347 errors, late violation discovery)
- [ ] **LANDING-03:** How It Works section — 3-step workflow with icons: Create project → Enter payroll → Generate WH-347
- [ ] **LANDING-04:** Feature highlights — 4-6 benefits-framed features (e.g., "Wage rates auto-populated from federal database," not "SAM.gov integration")
- [ ] **LANDING-05:** Trust signals section — compliance currency ("January 2025 WH-347 form"), regulatory alignment, specificity statement, product screenshot as proof
- [ ] **LANDING-06:** CTA close + footer — repeated primary CTA, footer with login link, HCC logo, contact
- [ ] **LANDING-07:** Public route "/" serves LandingPage.tsx — authenticated users are redirected to /dashboard; wildcard catches all unknown routes with auth-aware behavior (authenticated → /dashboard, unauthenticated → /)

---

## Future Requirements

*Selected during scoping as post-v2.1 work.*

- WH-347 download with explicit "Generating..." → "Download ready" state feedback (scope expansion, add to v2.2)
- Workflow progress indicator on Project Detail (Create → Workers → Payroll → WH-347) (v2.2)
- Compliance preflight summary before WH-347 download (v2.2)
- Apprentice ratio daily check (COMP-03) — complex compliance rule (v2.2+)
- PDF reports (fringe benefit summary, worker pay history) — on-screen works, PDF deferred (v2.2+)

---

## Out of Scope

- Dark mode toggle — CSS complexity, compliance software is often printed or screen-shared; not needed
- Customizable dashboard widgets — QuickBooks anti-pattern; fixed well-designed layout preferred
- Feature tour/onboarding overlay — empty states with action prompts are more effective
- Hamburger nav on desktop — compliance software users expect full nav visible on desktop
- Inline editing in payroll tables — audit trail risk; dedicated edit views are correct
- Generic hardhat stock photography — brand differentiator; use product screenshots instead
- State-specific forms (CA DIR, WA L&I) — federal WH-347 only
- Mobile native app — web-first

---

## Traceability

*Maps each REQ-ID to a phase.*

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DESIGN-01 | Phase 10 | Complete |
| DESIGN-02 | Phase 10 | Complete |
| DESIGN-03 | Phase 10 | Complete |
| DESIGN-04 | Phase 10 | Complete |
| UI-01 | Phase 11 | Complete |
| UI-02 | Phase 11 | Complete |
| UI-03 | Phase 11 | Complete |
| UI-04 | Phase 11 | Complete |
| UI-05 | Phase 11 | Complete |
| SHELL-01 | Phase 12 | Pending |
| SHELL-02 | Phase 12 | Pending |
| SHELL-03 | Phase 12 | Pending |
| LANDING-01 | Phase 13 | Pending |
| LANDING-02 | Phase 13 | Pending |
| LANDING-03 | Phase 13 | Pending |
| LANDING-04 | Phase 13 | Pending |
| LANDING-05 | Phase 13 | Pending |
| LANDING-06 | Phase 13 | Pending |
| LANDING-07 | Phase 13 | Pending |
| PAGE-01 | Phase 14 | Pending |
| PAGE-02 | Phase 14 | Pending |
| PAGE-03 | Phase 14 | Pending |
| PAGE-04 | Phase 14 | Pending |
| PAGE-05 | Phase 14 | Pending |
| PAGE-06 | Phase 14 | Pending |
| PAGE-07 | Phase 14 | Pending |
