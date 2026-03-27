# Feature Research

**Domain:** Prevailing wage compliance management — contractor-facing certified payroll submission tooling
**Researched:** 2026-03-19 (functional features) / 2026-03-20 (UI design + landing page) / 2026-03-23 (v2.3 workflow efficiency + audit readiness) / 2026-03-24 (v2.4 state forms, contractor guidance, compliance filter, CSV export)
**Confidence:** HIGH (regulatory requirements); MEDIUM-HIGH (design patterns via live competitor research)

---

## Part 1: Functional Feature Landscape (v2.0 Research — 2026-03-19)

*This section covers the compliance and payroll features researched for v2.0. All features below are now shipped.*

### Regulatory Foundation

Grounded in:
- **Davis-Bacon Act** and **Copeland Act** (29 CFR Part 3, Part 5)
- **Contract Work Hours and Safety Standards Act (CWHSSA)** — governs OT on federal contracts
- **WH-347 form** (revised January 2025, OMB No. 1235-0008, valid through 01/31/2028)
- **29 CFR 5.5(a)(3)(ii)** — weekly certified payroll submission requirements
- DOL WHD enforcement patterns from published investigations

### Critical 2025 WH-347 Change

The WH-348 (separate Statement of Compliance) no longer exists as a standalone form. It has been consolidated onto the WH-347. This affects the existing "Statement of Compliance form generation" requirement — it is now part of WH-347 generation, not a separate document. The existing pdf-lib overlay must be updated to reflect the January 2025 revision.

---

### Table Stakes — What a GC Must Have to Submit a Compliant WH-347 Package

| Feature | Why Required | Regulatory Basis | Complexity | Dependency on Existing Features |
|---------|--------------|-----------------|------------|----------------------------------|
| **Under-wage flag** — alert when worker's hourly rate falls below applicable WD rate | Most common DOL violation; workers must be paid "not less than" the prevailing rate | 29 CFR 5.5(a)(1); WH-347 certification language | LOW | Requires rate snapshots on payroll entries (already done), WD data (already fetched) |
| **CWHSSA OT error flag** — alert when OT hours exist but are paid at straight time or below prevailing rate | CWHSSA requires 1.5x for hours > 40/week on federal contracts; $10/day/violation in liquidated damages | CWHSSA; 29 CFR 5.8 | LOW | Requires hours-by-day entry (already done) |
| **Missing SSN/address flag** — block or warn before WH-347 generation if worker data is incomplete | WH-347 requires last 4 SSN and worker address; submission is invalid without them | WH-347 form instructions; 29 CFR 5.5(a)(3) | LOW | Requires worker records (already done) |
| **Journeyworker / Registered Apprentice classification field** | 2025 WH-347 added mandatory J/RA checkbox per worker row; previously implicit | WH-347 Rev. Jan 2025 — new required field | LOW | Requires worker classification model update |
| **Apprentice ratio compliance check** — flag when apprentices exceed the permitted ratio per trade per day | Apprentices in excess of ratio must be paid journeyworker rate; ratio is applied daily | 29 CFR 5.2; 29 CFR 5.5(a)(4) | MEDIUM | Requires J/RA classification field above; requires daily hours breakdown |
| **WH-347 accessible from payroll week view** — one-click PDF generation | GC workflow: enter payroll → generate form → submit; any friction causes version errors | Workflow completeness | LOW | Requires existing fillWh347() function; needs route from payroll week UI |
| **Statement of Compliance integrated into WH-347 PDF** | WH-348 is now part of WH-347 (Jan 2025 revision); separate form is outdated | WH-347 Rev. Jan 2025 | MEDIUM | Requires pdf-lib overlay update to 2025 form; certification checkboxes 1, 2, 3, 6 always required |
| **Fringe benefit summary report** — per worker per project, showing hours x hourly fringe credit | 2025 WH-347 requires itemized fringe breakdown (total credit, cash-in-lieu); auditors review this | WH-347 Rev. Jan 2025 fringe columns; 29 CFR 5.26 | MEDIUM | Requires fringe rate data stored per classification (check existing union/GSA rate model) |
| **Worker pay history report** — all payroll weeks for a worker on a project | DOL investigators cross-reference payroll records across weeks; 3-year retention required | 29 CFR 3.4(b); 29 CFR 5.5(a)(3)(ii)(G) | LOW | Requires querying across payroll_entries by worker + project |
| **Dashboard — project compliance status** | Contractors with multiple projects need to see which ones have open violations before submission; enterprise tools (LCPtracker) lead with this | Workflow completeness; mirrors LCPtracker/B2GNow pattern | MEDIUM | Requires compliance flag data to exist before dashboard can surface it |
| **No-work-week certification** | If no work was performed in a week, federal agencies still require a "no work" certified payroll submission; omitting this is a common audit finding | 29 CFR 5.5(a)(3)(ii)(A); eBacon guidance | LOW | Standalone feature; UI needs a "no work this week" toggle on payroll entry |

### Differentiators — Features That Reduce Contractor Risk Beyond Minimum Compliance

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Classification mismatch warning** — flag when worker is doing sheet metal work but classified as laborer | Most frequent DOL investigation trigger (per DOL enforcement releases); proactive catch vs reactive penalty | HIGH | Requires text/trade mapping; scope risk — defer unless job descriptions are captured |
| **Payroll week completeness indicator** — show which workers have entered hours vs not for a given week | Prevents missing-worker submissions; LCPtracker shows this in their contractor dashboard | LOW | Query workers on project vs workers with payroll_entries in that week |
| **Fringe benefit cash-in-lieu calculation** — compute cash equivalent when no bona fide plan exists | 2025 WH-347 added explicit cash-in-lieu column; many contractors don't know they need this | MEDIUM | Requires fringe rate model to distinguish funded vs unfunded fringe |
| **Submission checklist per week** — show required steps before WH-347 can be submitted (hours complete, flags cleared, signed) | Mirrors LCPtracker workflow; prevents partial submissions | LOW | Depends on compliance flags being implemented first |
| **Wage determination expiration alert** — warn when cached WD is approaching 30-day refresh | Contractors who use stale WDs may underpay after a rate increase | LOW | Requires reading WD cache timestamps (already stored in wdolSync.ts logic) |
| **Multi-week compliance summary** — show trend of violations across all payroll weeks on a project | DOL investigators review first 4-5 weeks in detail; contractor needs visibility into this window | MEDIUM | Aggregation query across compliance_flags table |

### Anti-Features — Functional (v2.0)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Auto-submit to agency portal** | Contractors want one-click submission | Each agency has different submission portals (LCPtracker, B2GNow, agency email); no standard API; auto-submit creates liability if form has errors | Generate PDF + provide download; contractor submits manually with eyes on the document |
| **Payroll integration (QuickBooks/ADP)** | Reduces double entry | Creates reconciliation complexity; prevailing wage needs rate-locked snapshots that payroll systems don't preserve; already marked out of scope | Manual entry is the compliance audit trail — document this explicitly in UI as intentional |
| **Real-time DOL rate sync** | Contractors want always-current rates | WDs are published on a schedule; real-time sync creates rate instability mid-payroll-week; rate snapshots at entry time are the correct compliance pattern | 30-day cache + monthly sync (already implemented); alert on stale WD |
| **State-specific forms (CA DIR, WA L&I)** | Multi-state contractors need these | State form formats vary significantly; federal WH-347 is the universal baseline; out of scope for v2 | Clearly document federal-only scope; add state forms as a named future milestone |

---

## Part 2: UI Design Polish + Landing Page Features (v2.1 Research — 2026-03-20)

*This section covers design feature research for transforming the existing app from generic to professional SaaS quality, and for the marketing landing page. Competitors analyzed: LCPtracker, Elation Systems, Hammr. Design benchmarks: QuickBooks Online, ADP, SaaSUI pattern library.*

### Context

All functional features are shipped in v2.0. The question is: what design patterns are table stakes for professional payroll/compliance SaaS, what differentiates great from generic, and what does a competitive B2B landing page for this niche require?

---

### Table Stakes — Design Features Users Expect in Professional Payroll SaaS

Missing or broken = product feels unfinished, regardless of how functional the underlying features are.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Consistent typography scale | Headers, body, labels must follow a clear hierarchy everywhere — not arbitrary sizes | LOW | Oswald + Inter already specified in brand; must be enforced across all pages, not just some |
| Card-based layout with uniform padding and border-radius | Every modern SaaS uses card containers; mismatched padding signals amateurism to evaluating buyers | LOW | TailwindCSS makes this straightforward; define a single reusable card class |
| Status/compliance badges with clear color semantics | Compliance software must signal pass/fail/warning at a glance without reading text | LOW | Green = compliant, red = violation, yellow = warning; partially built in v2.0, needs consistency |
| Data tables with visible structure | Row spacing, alternating row styling or borders, column alignment, header distinction from body | LOW | Dense tables without structure fail in payroll contexts — auditors and contractors scan rows |
| Empty states with guidance copy | When a project has no workers or no payroll weeks, users need a prompt to act — not a blank screen | LOW | Prevents "is this broken?" confusion for new users; apply on every list/table view |
| Form validation with inline error messages | Payroll entry errors must surface at the field level, not after submit | LOW | Critical for compliance — wrong rate or hour count must be caught at the field |
| Loading states on async operations | PDF generation, SAM.gov lookups, and payroll saves take time; spinners prevent uncertainty | LOW | React Query is in stack; use isLoading states consistently |
| Breadcrumb or contextual navigation showing location | Users navigating Project > Workers > Payroll > WH-347 must always know where they are | LOW | Navigation already exists per v2.0; needs visual hierarchy reinforcement |
| Clear primary action button hierarchy | One primary CTA per screen; secondary actions visually subordinate (lower contrast, outlined) | LOW | Inconsistent button sizing/color = generic; define primary/secondary/ghost variants |
| Dark nav bar with HCC brand colors | Industry standard for SaaS; white nav feels like a template or demo | LOW | Dark #1a1a1a nav, gold #F5C518 accent — already defined; must be applied on every page |
| Mobile-responsive layout that does not break | Contractors access software on tablets and phones on job sites | MEDIUM | TailwindCSS responsive utilities; not mobile-native but tables and forms must reflow correctly |
| Compliance flag callouts that are visually prominent | Audit-triggering violations must be impossible to miss — not buried in table row text | LOW | Color-coded callout blocks or badge components with icon + label, not inline text only |

### Differentiators — Design Features That Separate HCC from Competitors

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| HCC brand cohesion: dark nav + gold accent applied rigorously throughout | LCPtracker and Elation both use generic enterprise blue; HCC's dark/gold is visually distinctive in this category | LOW | Competitive differentiator available at near-zero cost — apply brand system with discipline |
| Compliance status above the fold on dashboard with clear counts | Competitors bury compliance status inside project details; show "2 violations / 3 projects" from the dashboard card | LOW | Already partially built; elevate visually with badge counts on project cards |
| Workflow progress indicator on project detail page | Show which steps are complete (Project created > Workers added > Payroll entered > WH-347 ready) — competitors lack this | MEDIUM | Reduces support burden; increases contractor confidence in their workflow position |
| Outcome-focused empty states with action prompts | "Add your first payroll week to begin compliance tracking." vs "No data found." | LOW | High value, low effort; requires writing copy for each empty state |
| WH-347 download with explicit loading/success feedback | "Generating WH-347..." spinner transitioning to "Download ready" button signals confidence | LOW | Already built; add state feedback — absence of feedback creates uncertainty |
| Compliance preflight before WH-347 download | Brief summary of open violations in the current week before allowing download — acts as a final check | MEDIUM | Deters accidental submission of non-compliant payroll |
| Print-optimized report styling | Compliance reports get printed and submitted to agencies; clean print CSS is rare in this category | LOW | At minimum, on-screen reports should print cleanly without nav and chrome |
| "Missing data" worker cards with specific action prompts | Surface incomplete worker data (missing address, SSN) as actionable cards, not buried text warnings | LOW | Already flagged in v2.0; elevate to card-level warnings with "Fix now" links |

### Anti-Features — Design Patterns to Explicitly Avoid

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Rearrangeable/customizable dashboard widgets | "Power user customization" sounds appealing | QuickBooks 2025 dashboard overhaul generated widespread user complaints specifically because custom widget layouts were disrupted by updates; adds complexity without value for a focused compliance tool | Fixed, well-designed dashboard layout — users learn it once and rely on it |
| Animated transitions throughout the app | Feels modern at first glance | Animations on data-heavy compliance screens slow cognition and add perceived latency; auditors and payroll admins are not impressed by motion | Reserve animation for state changes only (e.g., compliance badge updating on save); calm design as default |
| Dark mode toggle | Users commonly ask for it; looks like a feature | Adds significant CSS complexity with TailwindCSS v4; compliance software is often printed or screen-shared; a single well-designed light theme is preferable | Design a consistent, well-contrasted light theme; dark nav already provides visual interest without full dark mode |
| Inline editing in compliance tables | Reduces click count; seems convenient | Inline editing in payroll tables creates accidental edits and audit trail ambiguity; regulators expect deliberate, confirmed data entry | Dedicated edit views with explicit save/cancel for all payroll data |
| Feature tour overlays on first login | Looks like SaaS onboarding best practice | For a focused app with clear navigation, overlays interrupt workflow and are dismissed immediately; completion rates are low | Contextual empty states with action prompts are more effective than guided tours for simple workflows |
| Hamburger nav on desktop at all screen sizes | Mobile-responsive patterns tempt devs to use hamburger everywhere | Compliance software users at desks expect full nav visible — hamburger on desktop signals a mobile port, not a desktop product | Full top nav on desktop (> 768px); hamburger only on mobile breakpoints |
| Modal-heavy payroll workflows | Modals "keep users in context" | Deep payroll entry in a modal is inaccessible, loses state on refresh, and is criticized in LCPtracker user reviews for deep nesting | Dedicated pages for payroll entry and worker management; modals only for confirmations and brief alerts |
| Generic stock photography of hardhat workers on landing page | Every SaaS landing page seems to use it | Every competitor already uses this imagery; it signals category membership, not differentiation | Use HCC brand colors + actual product screenshots; show the compliance dashboard in action |

---

## Landing Page Feature Requirements

### Mandatory Sections

| Section | Purpose | Content Notes |
|---------|---------|---------------|
| Hero | Answer "what, who, why" in under 5 seconds | Outcome-focused headline (e.g., "Davis-Bacon Compliance Without the Paperwork"). 1-2 sentence subhead. Primary CTA + secondary CTA. Product screenshot or UI mockup. No stock worker photos. |
| Problem/Pain Acknowledgment | Show you understand the contractor's reality | 2-3 pain points: manual rate lookup, WH-347 errors, violations discovered too late. Frame as pain the buyer already feels. |
| How It Works | Reduce evaluation friction with a workflow view | 3-step flow: Create project > Enter payroll > Generate WH-347. Icon + brief description per step. Enforces simplicity vs LCPtracker complexity. |
| Feature Highlights | Translate app features into contractor outcomes | 4-6 features framed as benefits. "Wage rates auto-populated from federal database" not "SAM.gov integration." Compliance-focused framing. |
| Social Proof / Trust Signals | Reduce perceived risk for compliance software buyers | At launch stage: compliance currency signals ("January 2025 WH-347 form"), specificity ("federal and federally-assisted projects"), outcome metrics (see table below). |
| CTA Close | Capture hesitant visitors before they leave | Repeat primary CTA. Add low-friction fallback: "Questions? Email us." |
| Footer | Legal + navigation | Privacy policy, login link, HCC logo, contact. |

### CTA Strategy

- **Primary CTA:** "Create Free Account" — imperative, self-serve implied, no friction language
- **Secondary CTA:** "See How It Works" — anchors to How It Works section for hesitant visitors
- Use identical CTA label and style throughout page: hero, mid-page after features, and footer close
- Avoid: "Learn More" (passive, used by LCPtracker and Elation — feels gatekept), "Contact Sales" (enterprise signal for a self-serve tool)

### Social Proof for a Launch-Stage Niche B2B Product

Traditional client logos and testimonials may not be available at launch. Effective alternatives for compliance buyers:

| Social Proof Type | Example Implementation | Why It Works |
|-------------------|-----------------------|-------------|
| Compliance currency signal | "January 2025 WH-347 form — latest DOL revision" | Auditors and contractors recognize this form by name; showing the current form signals competence |
| Regulatory alignment statement | "Compliant with Davis-Bacon Act and CWHSSA requirements" | Reduces perceived legal risk for a regulated purchase |
| Specificity of scope | "Built for federal and federally-assisted construction projects" | Niche specificity = immediate relevance to target buyer |
| Outcome-anchored metrics | "180+ compliance checks automated per payroll week" (grounded in test suite scale) | Specific numbers outperform vague claims; shows the system is thorough |
| Product screenshot as proof | Dashboard with real-looking compliance badges and project cards | Showing working UI is social proof that this is a real, usable product |
| Regulatory document link | Link to DOL WH-347 instructions as reference | Builds credibility with buyers who verify their compliance tools against DOL source |

### Landing Page Anti-Patterns

- **Generic hardhat stock photography** — every competitor uses it; use product UI screenshots and HCC brand colors instead
- **Feature-list framing** ("SAM.gov integration", "pdf-lib PDF generation") — contractors don't evaluate features, they evaluate outcomes
- **Vague CTAs** ("Learn More", "Get Started") — use action-specific language tied to the outcome
- **No mention of pricing philosophy** — compliance buyers distrust pages that hide pricing entirely; at minimum: "Simple pricing for contractors" with a contact/register link
- **Wall-of-text feature descriptions** — compliance buyers are busy; use icons + 2-3 sentence max per feature
- **Empty logo bar** — if no recognizable client logos exist yet, omit the logo bar entirely; a logo section with no names signals an empty client list and reduces credibility
- **Hero headline starting with the product name** — "HCC Prevailing Wage helps you..." is not an outcome; lead with the contractor's problem being solved

---

## Competitor Design Analysis

### Visual Design Patterns

| Element | LCPtracker | Elation Systems | Hammr | HCC Target (v2.1) |
|---------|------------|-----------------|-------|-------------------|
| Primary color | Enterprise blue (#426bae, #0073a8) | Blue (#1570BD) + navy (#051A53) | Orange accent | Dark (#1a1a1a) + gold (#F5C518) — distinctive in category |
| Typography | Generic enterprise sans-serif | Manrope/Roboto | Merriweather/Inter/Poppins | Oswald (headlines) + Inter (body) |
| Landing page hero CTA | "Learn More" (weak, passive) | "Contact Us" (enterprise-gated) | "Request a Demo" (sales-gated) | "Create Free Account" (self-serve, frictionless) |
| Social proof approach | Government agency case studies + client logos | Generic compliance credentials | ADP/Paychex/QuickBooks logo carousel | Compliance currency signals + product screenshots |
| Navigation | Complex mega-menu (7+ products) | Standard horizontal nav with dropdowns | Clean top nav | Dark top nav, clear workflow links, no mega-menu needed for single product |
| Dashboard feel | Compliance dashboard, enterprise complexity | Certified payroll data-entry focus | Payroll-first with CPR generation | Project cards with compliance badges, clear violation counts, calm design |
| Overall aesthetic | 2015-era enterprise software | 2018-era enterprise software | Modern but predictable SaaS template | HCC brand-forward, calm, compliance-first |

### Key Finding from Competitor Research

LCPtracker and Elation both look like legacy enterprise software: blue palettes, generic photography, "Contact Us" gated demos that signal expensive sales processes. Hammr is the most modern competitor (clean typography, clear CTA, product screenshots) but uses a standard SaaS template with no brand personality.

HCC's opportunity: the dark/gold brand palette is genuinely distinctive in this category. Every competitor uses blue. Executing the HCC brand rigorously — not just on the landing page but inside every app page — creates visual differentiation that is low-cost to achieve and high-impact for differentiation in a niche market where buyers compare screenshots before demos.

---

## Feature Dependencies (v2.1 Design)

```
Typography Scale (defined once in Tailwind config)
    └──enables──> Card Consistency
    └──enables──> Table Polish
    └──enables──> Empty State Design
    └──enables──> Landing Page Typography

Color Token System (semantic: success/warning/danger/neutral)
    └──enables──> Compliance Badge Consistency
    └──enables──> Form Validation Colors
    └──enables──> Landing Page Brand Colors

Compliance Badge System
    └──requires──> Color Tokens (defined above)
    └──enhances──> Dashboard Summary Cards

Empty States
    └──requires──> Copy (written per page/view)
    └──independent of──> any data model changes

WH-347 Loading/Success State
    └──requires──> Loading state component (spinner)
    └──independent of──> PDF generation logic

Landing Page
    └──independent of──> App UI Polish (separate routes, no shared components required)
    └──should share──> Design tokens (typography, colors, spacing)
```

---

## MVP Definition (v2.1 Design Polish)

### Must Ship

- [ ] Typography hierarchy enforced across all pages — Oswald for page/section headers, Inter for body, consistent size scale
- [ ] Card padding + border-radius standardized — single reusable card class applied everywhere
- [ ] Compliance badges with semantic colors — green/red/yellow with icon, consistent across all uses
- [ ] Data table structure — header distinction, row borders or alternating backgrounds, proper cell padding
- [ ] Dark nav + gold accent on every page — no page uses a white or inconsistent nav
- [ ] Primary button hierarchy — one primary per screen, secondary/ghost variants visually subordinate
- [ ] Empty states with action-oriented copy — at minimum for: no projects, no workers, no payroll weeks
- [ ] Landing page — hero, how it works, feature highlights, trust signals, CTA close, footer

### Add After Core Polish

- [ ] WH-347 download loading/success state feedback — "Generating..." to download button
- [ ] Workflow progress indicator on project detail — steps: project created / workers added / payroll entered / WH-347 ready
- [ ] Compliance preflight summary before WH-347 download — brief violation count display
- [ ] Print CSS for on-screen reports — before PDF reports are built in v2.2

### Defer

- [ ] PDF reports (fringe benefit summary, worker pay history) — deferred per PROJECT.md
- [ ] Apprentice ratio daily check (COMP-03) — complex compliance rule, deferred per PROJECT.md

---

## Feature Prioritization Matrix (v2.1)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Typography hierarchy across all pages | HIGH | LOW | P1 |
| Card/layout consistency (padding, border-radius) | HIGH | LOW | P1 |
| Compliance badges with semantic colors | HIGH | LOW | P1 |
| Data table structure polish | HIGH | LOW | P1 |
| Dark nav + gold accent on all pages | HIGH | LOW | P1 |
| Landing page (hero + features + CTA) | HIGH | MEDIUM | P1 |
| Empty states with action prompts | MEDIUM | LOW | P1 |
| Primary button hierarchy | MEDIUM | LOW | P1 |
| WH-347 loading/success state feedback | MEDIUM | LOW | P2 |
| Workflow progress indicator | MEDIUM | MEDIUM | P2 |
| Compliance preflight before WH-347 | MEDIUM | MEDIUM | P2 |
| Print CSS for on-screen reports | LOW | LOW | P2 |
| Dark mode | LOW | HIGH | P3 |
| Customizable dashboard widgets | LOW | HIGH | P3 |
| Feature tour/onboarding overlay | LOW | HIGH | P3 |

---

## Sources

**Competitor UI Research (live pages, 2026-03-20):**
- [LCPtracker — Solutions page](https://lcptracker.com/solutions/lcptracker)
- [LCPtracker — Homepage](https://lcptracker.com/)
- [Elation Systems — Homepage](https://www.elationsys.com/)
- [Hammr — Prevailing Wage Landing Page](https://www.hammr.com/prevailing-wage-software-for-construction)

**SaaS Design Pattern Research:**
- [SaaSUI Design Library](https://www.saasui.design/) — 22+ SaaS UI pattern categories
- [SaaS UI Design Trends 2026](https://www.saasui.design/blog/7-saas-ui-design-trends-2026) — calm design, strategic minimalism, progressive disclosure
- [B2B SaaS Aesthetic Design — Influencers Time](https://www.influencers-time.com/b2b-saas-how-aesthetic-design-boosts-trust-and-conversions/) — trust signals, professional vs amateurish design
- [QuickBooks Dashboard Community Thread — December 2025](https://quickbooks.intuit.com/learn-support/en-us/do-more-with-quickbooks/new-dashboard-everyone-hates-it-right-december-2025/00/1590198) — anti-patterns: buried navigation, broken data viz

**Landing Page Research:**
- [B2B SaaS Landing Page Best Practices — Flow Agency](https://www.flow-agency.com/blog/b2b-saas-landing-page-best-practices/)
- [B2B SaaS Landing Page Best Practices — SaaS Hero](https://www.saashero.net/design/saas-landing-page-best-practices/)
- [Social Proof for B2B SaaS — Landing Rabbit](https://landingrabbit.com/blog/social-proof)
- [9 B2B Landing Page Lessons from 2025](https://instapage.com/blog/b2b-landing-page-best-practices)

**v2.0 Functional Feature Sources (2026-03-19):**
- [DOL WH-347 Form Instructions and Current Form (Rev. Jan 2025)](https://www.dol.gov/agencies/whd/forms/wh347)
- [eCFR 29 CFR Part 5 — Davis-Bacon Labor Standards Provisions](https://www.ecfr.gov/current/title-29/subtitle-A/part-5)
- [LCPtracker — FAQ on revised WH-347](https://lcptracker.com/blog-post/faq-how-to-complete-the-revised-wh-347-form/)
- [B2GNow Prevailing Wage Labor Compliance Software](https://b2gnow.com/solutions/prevailing-wage-labor-compliance/)
- [Points North — WH-347 Updates 2025](https://www.points-north.com/trends-and-insights/wh-347-updates-2025)
- [Points North — Most Common Prevailing Wage Compliance Errors](https://www.points-north.com/trends-and-insights/prevailing-wage-investigations-the-most-common-contractor-errors)
- [eBacon — Davis-Bacon Certified Payroll Requirements](https://www.ebacon.com/prevailing-wage-info/davis-bacon-certified-payroll-requirements/)

---

*Feature research for: HCC Prevailing Wage — v2.0 compliance features (2026-03-19) + v2.1 UI design polish and landing page (2026-03-20)*

---
---

## Part 3: v2.3 Contractor Workflow Efficiency + Audit Readiness (2026-03-23)

*This section covers the 6 new features for v2.3. All v2.2 features are shipped. Focus is on expected behavior, edge cases, UX patterns, DOL-specific requirements, and dependencies.*

**Confidence:** HIGH for DOL requirements (verified against official DOL instructions, CA DIR FAQ, LCPtracker CODOT guides); MEDIUM-HIGH for UX patterns (verified against eMars, LCPtracker industry standard behavior).

---

### Table Stakes — All 6 Features

All 6 v2.3 features are table stakes for contractors doing regular federal work. They are not differentiators — they are the absence of friction that makes the tool usable past the first few projects. Contractors evaluating prevailing wage software expect every one of these.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Copy previous payroll week | Every certified payroll platform (eMars, LCPtracker, Miter) offers this. Re-entering the same 8 workers every week is the #1 daily time cost. | MEDIUM | Worker set + hours copy; dates and submission status never copy. Must handle no-prior-week gracefully. |
| WH-347 submission tracking | DOL mandates sequential payroll numbering starting at #1 per project. Without tracking submitted status, contractors lose audit trail. | MEDIUM | Fields: submitted_at, agency name, submitted_by, payroll_number. Status states: draft / submitted / amended. |
| Payroll amendment workflow | DOL/contracting agencies require corrected payrolls when hours, rates, or missing deductions are wrong. Industry-standard amendment suffix: original #15-0, corrected #15-1 (LCPtracker/CA DIR pattern). | HIGH | Hardest of the 6. New payroll week record linked to original. Does not overwrite original. Mandatory remarks field. |
| Project completion / archive | Contractors run 5–20 projects. Completed projects clog the active dashboard. "Complete" is a status, not a deletion — auditors may request records years later. | LOW | Soft status change. Archived hidden from dashboard by default. Must be reversible. |
| Dashboard search + filter | Contractors with multiple concurrent projects need to find a specific project fast. Name search and status filter are a baseline expectation. | LOW | Filter by: name text, compliance status, funding type, archive toggle. Empty-state distinguishes "no results" from "no projects." |
| Per-worker compliance history | When WHD investigates, they ask for all records for a specific worker across all projects and weeks. This is the audit-response feature. | MEDIUM | Violation type, week, project, dollar delta. Paginate at 50 rows. CSV export. |

---

### Feature 1: Copy Previous Payroll Week

**What gets copied:**
- Worker set from the prior week (all workers who had payroll entries that week)
- Hours per day per worker (ST and OT) as a starting point — contractor edits from there
- Trade classification assignments (rarely change week-to-week)

**What never gets copied:**
- Week ending date — always blank, user selects the new week
- Submission status — new week always starts as `draft`
- Fringe rate snapshots — re-fetched from the worker's current classification at entry save time (existing app behavior; do not break this)
- Deductions — deductions vary week to week (garnishments, health, union dues); copying them causes incorrect net pay and compliance errors

**Edge cases:**
- No prior week exists: Show "No previous week to copy from" inline message; do not disable the payroll entry form, just omit the copy action
- Prior week was for a different subset of workers: Copy only workers who appeared in that week; do not auto-add workers added to the project after that week
- Prior week had zero hours for a worker: Include that worker with zero hours — contractor may want them on the list
- Worker was removed from the project since the prior week: Skip that worker silently (they no longer belong to the project)
- First week of a project: No prior week exists — treat identically to "no prior week" edge case above

**UX pattern:**
- "Copy from prior week" button on the new payroll week creation screen or payroll week detail header, labeled with the prior week's ending date: "Copy from week ending Mar 14, 2026"
- After copy, display pre-filled entry form with prior hours populated and editable
- Do not auto-save — contractor must explicitly save each entry (preserves the existing deliberate-save pattern)
- No confirmation modal needed — this is non-destructive; user always reviews before saving

**DOL note:** No-work weeks are still required submissions under 29 CFR 5.5(a)(3)(ii)(A). The prior-week selector must not skip no-work weeks — those are valid priors to copy from (they produce a zero-hours pre-fill, which is correct).

---

### Feature 2: WH-347 Submission Tracking

**Fields to track (new columns on `payroll_weeks` or a `payroll_week_submissions` child table):**
- `submission_status` — enum: `draft` | `submitted` | `amended`
- `submitted_at` — timestamp, nullable (null = draft)
- `submitted_to_agency` — free text string, e.g. "HUD Chicago Field Office"
- `submitted_by` — user display name or ID at time of marking submitted (audit trail; single-user app, but record it)
- `payroll_number` — string, sequential per project starting at "1" (integer-compatible until amendments exist, then supports "15-1" format — see Feature 3)

**DOL requirement on payroll numbering:** Each weekly payroll for a project must be numbered sequentially starting at 1 (29 CFR 5.5(a)(3)(ii); WH-347 Box 2). The payroll number is printed on the WH-347. Auto-assign `payroll_number` when the week is created, not when it is submitted — the number is a sequence position, not a submission confirmation.

**Status states in detail:**
- `draft` — created, payroll entered, WH-347 may have been downloaded for review but not marked submitted to the agency
- `submitted` — contractor has marked it submitted to an agency; `submitted_at` and `submitted_to_agency` are set
- `amended` — a correction was filed after submission; the original week record remains in `submitted` state; a new week record (the amendment) carries `amended` status and is linked via `parent_week_id`

**Re-submission (same data, administrative re-send):** Allow "update submission" on a `submitted` week to overwrite `submitted_at` and `submitted_to_agency` in place. This is not an amendment — payroll data did not change. Use case: contractor submitted to wrong agency, needs to re-send.

**Amendment (payroll data changed):** Creates a new record — see Feature 3. Do not conflate re-send with amendment.

**UX pattern:**
- "Mark Submitted" button on Payroll Week Detail — opens a small modal with one field: agency name (pre-filled with the most recent agency used on this project, if available) + confirm button
- Submitted weeks show a "Submitted" badge with `submitted_at` date and agency name on the payroll list
- Draft weeks show a "Draft" badge
- Amended weeks show an "Amended" badge linking to the amendment record
- Payroll list column order: payroll number, week ending, status badge, submitted date, agency

---

### Feature 3: Payroll Amendment Workflow

**DOL/Davis-Bacon rules:**
- A contractor must submit a corrected payroll when hours of work, rate of pay, or missing deductions contain errors (29 CFR 5.5; CA DIR FAQ)
- The WH-347 "Additional Remarks" section must explain the reason for the correction — this field is mandatory if resubmitting
- No formal federal DOL "amendment number" standard exists, but the industry-standard pattern (LCPtracker, CA DIR, CODOT guides) is suffix notation: original payroll #15 becomes #15-0 on first submission; first amendment is #15-1; second amendment would be #15-2

**What an amended WH-347 looks like:**
- Payroll number printed as "15-1"
- Additional Remarks field contains the amendment reason ("Correcting OT hours for J. Smith, week ending 2026-03-14")
- All other fields are identical to a normal WH-347 for that week
- The `fillWh347()` function must write the amendment payroll number and the remarks field

**Data model:**
- Create a new `payroll_weeks` record with `submission_status = 'amended'` and a `parent_week_id` foreign key pointing to the original week
- Original week record is immutable once submitted — `submission_status` stays `submitted`; do not overwrite it
- Amendment week gets `payroll_number` = "15-1" (string)
- Amendment numbering logic: find the original's `payroll_number` (e.g., "15" or "15-0"), determine the next suffix, assign "15-1". If "15-1" already exists, assign "15-2"
- Pre-fill the amendment week with entries copied from the original week (reuse Copy Previous Week logic — same copy function, different source record)
- Compliance engine runs fresh on the amendment's entries — the amendment may introduce or clear violations

**`payroll_number` column type:** Must be `text` (not `integer`) to support amendment suffixes. If currently stored as integer, this requires a migration. The suffix convention means "15" and "15-0" are both acceptable for the original; pick one and be consistent — "15" for the original, "15-1" for the first amendment is the cleanest pattern.

**Amendment pre-fill:** User only needs to fix the affected entries. Present all entries from the original week pre-filled; user edits only what changed. Unchanged workers carry through correctly.

**Link to original week:** Amendment detail view shows "Amendment of Payroll #15 (week ending 2026-03-14)" with a link to the original week detail.

**UX pattern:**
- "File Amendment" button on a `submitted` week's detail page — only visible on submitted weeks, not drafts
- Opens modal: "You are creating an amendment to Payroll #15. Describe the correction (required)." — text area for remarks, required
- Creates new payroll week record; navigates user directly to the amendment's payroll entry view
- Amendment appears in payroll list as a distinct row with "Amended" badge and "Amendment of #15" secondary label
- Amendment week generates its own WH-347 with the amendment payroll number in Box 2 and the remarks populated

**What an amendment is vs. a re-send:** Amendment = payroll data changed. Re-send = same data, administrative re-submission (update in place on the original record). Build both. They are separate actions.

---

### Feature 4: Project Completion / Archive

**What "complete" means:**
- No hard DOL definition — the WH-347 "Final Certified Payroll" checkbox on the last week's form is the DOL signal, not a project-level status
- For app purposes: contractor explicitly marks the project complete; this is a voluntary, deliberate action
- Do NOT auto-complete based on "all weeks submitted" — contractors have gaps, multi-phase work, and incomplete submissions that don't reflect actual project status
- Project completion is a workflow lifecycle status, not a compliance state

**Archive vs. delete:**
- Never delete — Davis-Bacon records must be preserved for 3 years minimum after project completion (29 CFR 3.9). Delete is an anti-feature in this regulatory domain.
- "Complete" and "archive" are effectively the same action: marking complete moves the project off the active dashboard
- Archived/completed projects remain fully accessible — contractor can click in, view all payroll weeks, generate WH-347s for historical weeks

**Reversibility:** Always allow unarchive. Scope changes, stop-work orders, or data corrections may require reactivating a project. Unarchive must be a one-click action from the project detail page.

**Final WH-347 "Final Certified Payroll" checkbox:**
- The WH-347 form has a "Final Certified Payroll" checkbox (Box 1, Submission Type). This is separate from project archive status.
- When the contractor marks a project complete AND generates a WH-347, prompt: "Is this the final payroll submission for this project?" If yes, check the Final box in the WH-347 PDF.
- Do not auto-check it — final payroll determination is the contractor's call.

**Dashboard behavior:**
- Default view: active projects only (`archive_status = 'active'`)
- Toggle or filter: "Show Archived" reveals archived/completed projects
- Archived project cards use a visually subdued treatment (muted border, grey status badge, reduced opacity or secondary color) but remain fully clickable

**Audit trail fields:** Add `archived_at` timestamp and `archived_by` (user ID) to project record.

**Edge case — archiving a project with unsubmitted weeks:** Do not block archiving. Show a warning: "2 payroll weeks have not been marked submitted. Archive anyway?" The contractor may have legitimate reasons (project cancelled, data correction pending). Warning only, not a hard block.

---

### Feature 5: Dashboard Search + Filter

**Filter dimensions:**
- **Name search** — text input, partial match, case-insensitive. Most common action.
- **Compliance status** — dropdown: All / Compliant / Has Violations / No Payroll. Aligns with existing Badge variants.
- **Funding type** — dropdown: All / Federal / State / Local. Already a field on projects.
- **Archive status** — toggle: Active (default) / All (active + archived) / Archived Only.

**Filter logic:** All filters are additive (AND). A contractor filtering for "federal + has-violations + active" sees only active federal projects with at least one violation.

**What is NOT worth filtering at this scale:**
- Date range — over-engineered for a contractor with fewer than 50 projects
- State/county — too granular; the search vector for finding a project is almost always name or compliance status
- Contract value — not stored in the current model

**Empty state when no results:**
- "No projects match your filters." with a "Clear filters" link
- Visually distinct from the "no projects at all" empty state — do not reuse the same EmptyState component copy; distinguish "no results" from "no projects created yet"

**UX pattern:**
- Search input + filter dropdowns in a filter bar above the project card grid
- Filter state reflected in URL query params (e.g., `?status=has-violations&funding=federal`) so the contractor can bookmark a filtered view
- Filter state does NOT persist in localStorage — compliance software sessions should feel fresh on each visit
- Active filter badges below the filter bar showing what's applied, each with an "x" to remove individually
- "Clear all filters" link when any filter is active

**Performance note:** Filtering should happen client-side on already-fetched project list data (not a new server request per filter change) — project counts are small enough that the full list is always fetched.

---

### Feature 6: Per-Worker Compliance History

**Data to surface per row:**
- Worker name
- Project name (linked to project detail)
- Payroll week ending date
- Violation type: `under-wage` | `cwhssa-ot` | `apprentice-ratio`
- Dollar delta — actual gross vs. required gross (already calculated by compliance engine for `under-wage` and `cwhssa-ot` violations; display "N/A" for `apprentice-ratio` which has no dollar delta)
- Week submission status: draft / submitted / amended (new in v2.3)

**Why this view matters for audits:** WHD investigators ask for all payroll records for a specific worker across all projects and weeks. This view answers that in one screen instead of requiring the contractor to navigate into each week of each project. At FY2025 enforcement levels ($259M recovered for 177,000 employees), having this ready is the difference between a 1-hour response and a 2-day paper search.

**Pagination:** Paginate at 50 rows per page. A contractor with 5 projects × 20 weeks × 8 workers can have up to 800 entries in the compliance engine; rendering all without pagination is a performance problem. Show total result count above the table.

**Sort order:** Default descending by week ending date (most recent violations first — audits typically focus on the most recent work period first).

**Filtering within the view:**
- Worker name text search
- Violation type filter (All / Under-Wage / CWHSSA OT / Apprentice Ratio)
- Project filter (dropdown of user's projects)
- Date range filter (from / to week ending date) — justified here because DOL investigations are time-bounded and auditors specify the investigation window

**CSV export:** Export the full filtered result set, not just the current page. Columns: Worker Name, SSN Last 4, Trade Classification, Project Name, Week Ending, Violation Type, Dollar Delta, Week Status.

**Access points:**
- From a worker's profile page as a "Compliance History" tab or section
- From a top-level "Compliance" nav item showing all violations across all workers and projects (the audit-response entry point)

**Data source:** Queries existing `compliance_flags` table (or equivalent) joined to `payroll_entries`, `payroll_weeks`, `workers`, `projects`. No new compliance logic — this is a reporting view over already-computed data.

---

### Feature Dependencies (v2.3)

```
WH-347 Submission Tracking
    └──required by──> Payroll Amendment Workflow
                          (amendment links to parent_week_id; parent must have submission_status field
                           and must be in 'submitted' state for "File Amendment" to be available)

    └──enhances──> Per-Worker Compliance History
                          (week submission status column in the history view depends on submission_status)

Copy Previous Payroll Week
    └──enhances──> Payroll Amendment Workflow
                          (amendment pre-fill reuses the same copy-entries-from-week logic;
                           build Copy first, call the same function from the amendment flow)

Project Completion / Archive
    └──enhances──> Dashboard Search + Filter
                          (archive status is one of the filter dimensions;
                           build Archive first so Filter includes it from day one)

Dashboard Search + Filter
    ──independent of──> Copy Previous Payroll Week
    ──independent of──> Per-Worker Compliance History

Per-Worker Compliance History
    ──independent of──> Copy Previous Payroll Week
    ──independent of──> Project Completion / Archive
    ──benefits from──> WH-347 Submission Tracking (week status column)
```

### Dependency Notes

- **Submission Tracking must be built before Amendments.** The amendment creates a new `payroll_weeks` record with `parent_week_id` pointing to the original. The "File Amendment" button only appears on weeks in `submitted` state — which only exists after Submission Tracking is built.
- **`payroll_number` column type must be resolved before both features are built.** Currently `payroll_number` is likely an integer. Submission Tracking assigns it sequentially as an integer. Amendment Workflow requires string format ("15-1"). Decide at migration time: store as `text`, format consistently as "1", "2", "15-1". Do not change the type mid-milestone.
- **Copy Previous Week enhances Amendments at zero extra cost.** If Copy is built first, the amendment pre-fill is a single call to the copy function with the original week as the source. If built after, it requires duplicating the copy logic. Build Copy first.
- **Archive status is a filter dimension.** If Dashboard Filter is built before Archive, the filter must have a placeholder for archive status or be updated after Archive ships. Build Archive first to avoid two passes.

---

### Build Order Recommendation for v2.3

Given the dependencies above, the correct phase ordering for the roadmap is:

1. **WH-347 Submission Tracking** — creates `submission_status`, `payroll_number`, `submitted_at`, `submitted_to_agency` on `payroll_weeks`. Everything else depends on this data model. Also establishes the `payroll_number` column type decision.
2. **Copy Previous Payroll Week** — independent of #1, but building it before amendments means the amendment pre-fill reuses this logic at no extra cost.
3. **Payroll Amendment Workflow** — depends on #1 (submission status, parent_week_id) and benefits from #2 (copy logic). Highest complexity — deserves its own phase.
4. **Project Completion / Archive** — independent, low complexity. Build before Filter.
5. **Dashboard Search + Filter** — independent, low complexity. Benefits from Archive being in the model.
6. **Per-Worker Compliance History** — independent data view. Goes last because it consumes existing compliance data and benefits from submission status being in the model.

---

### Anti-Features (v2.3)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-complete project when all weeks submitted | Seems logical — if everything's submitted, it's done | "All weeks submitted" is unknowable — contractors don't always submit no-work weeks; final week may not be the last entered; project scope may expand | Explicit "Mark Complete" button; contractor decides |
| Delete project or payroll week | Cleanup feels good | Davis-Bacon records must be kept 3+ years (29 CFR 3.9); deletion destroys audit trail; a DOL investigation 18 months after project close would find missing records | Archive (soft status) only; never delete |
| Overwrite original payroll week on amendment | Simpler model, fewer records | Auditors and DOL investigators need both original and corrected submissions; overwriting is evidence destruction | New linked record; original is immutable once submitted |
| Auto-number amendments globally across projects | Seems systematic | Payroll numbers are per-project; cross-project amendment numbering doesn't match DOL conventions or contractor mental model | Sequential per-project; amendment suffix per-original-payroll-number |
| Copy all fields including deductions | Maximum pre-fill, less typing | Deductions vary weekly (garnishments, union dues, health contributions); copying them produces incorrect net pay and flags false compliance violations | Copy worker set + hours only; leave deductions blank for deliberate re-entry |
| Inline editing in compliance history table | Convenient, reduces click count | Breaks audit trail; payroll entry edit views exist for deliberate correction; same rationale as existing v2.x constraint | Link from compliance history rows to the payroll week detail for edits |
| Permanent delete of amendment record | "I filed an amendment by mistake" | Amendment records are legal submissions once generated; allow voiding/cancelling an unsent amendment, but not deletion of a sent one | Cancel/void state on amendment before it is sent; no delete after marking submitted |

---

### DOL/Davis-Bacon Specific Requirements (v2.3)

| Requirement | Source | Impact on Feature |
|-------------|--------|-------------------|
| Sequential payroll numbering starting at #1 per project | 29 CFR 5.5(a)(3)(ii); WH-347 Box 2 | Submission Tracking auto-assigns `payroll_number` at week creation, not at submission |
| No-work weeks still require submission | DOL WH-347 instructions | Copy Previous Week must not skip no-work weeks in the prior-week selector |
| Records retained 3 years post-completion | 29 CFR 3.9 | Archive only (soft status); never delete |
| Corrected payrolls must explain error in Additional Remarks | CA DIR FAQ; LCPtracker CODOT guide | Amendment workflow requires a mandatory reason/remarks field before the amendment is created |
| Amendment suffix notation (e.g., #15-1) | LCPtracker industry standard; CA DIR; CODOT guide | `payroll_number` must be stored as text to support suffixes |
| Final Certified Payroll checkbox on last week | WH-347 form Box 1, Submission Type field | Project completion flow should prompt to regenerate WH-347 with the Final box checked |
| Statement of Compliance required on every submission | DOL WH-347 instructions | Submission Tracking records who marked it submitted (audit trail) |
| Back wages, no cap, civil penalties up to $10K+ per violation | DOL FY2025 enforcement data | Per-worker compliance history must surface dollar delta — auditors use this to calculate back pay owed |

---

### Feature Prioritization Matrix (v2.3)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| WH-347 Submission Tracking | HIGH — foundation for audit trail | MEDIUM | P1 |
| Copy Previous Payroll Week | HIGH — daily time savings | MEDIUM | P1 |
| Payroll Amendment Workflow | HIGH — compliance correction path | HIGH | P1 |
| Per-Worker Compliance History | HIGH — audit-response capability | MEDIUM | P1 |
| Project Completion / Archive | MEDIUM — dashboard hygiene | LOW | P2 |
| Dashboard Search + Filter | MEDIUM — grows with project count | LOW | P2 |

**Priority key:**
- P1: Must ship in v2.3
- P2: Should ship in v2.3; defer only if P1 runs over

---

## v2.3 Sources

- [DOL WH-347 Form Instructions](https://www.dol.gov/agencies/whd/forms/wh347) — payroll numbering, final payroll checkbox, statement of compliance
- [CODOT LCPtracker Prime Payroll Guide](https://www.codot.gov/business/civilrights/assets/design-bid-build-process-guides-1/4a-3-certify-payroll-in-lcptracker-prime.pdf) — amendment suffix notation (#15-0, #15-1), remarks requirement
- [CA DIR FAQ — Certified Payroll Reporting](https://www.dir.ca.gov/Public-Works/FAQ-certified-payroll-reporting.html) — corrected payroll rules, amendment workflow, remarks mandatory on resubmission
- [LCPtracker FAQ — How to Complete the Revised WH-347](https://lcptracker.com/blog-post/faq-how-to-complete-the-revised-wh-347-form/) — amendment workflow industry standard
- [eMars Certified Payroll System](https://emarsinc.com) — copy-from-previous-week feature confirmation
- [Points North — WH-347 Updates 2025](https://www.points-north.com/trends-and-insights/wh-347-updates-2025) — 2025 form tracking requirements
- [Points North — True Cost of Davis-Bacon Violations](https://www.points-north.com/trends-and-insights/the-real-cost-of-davis-bacon-violations) — penalty scale, back wage calculation
- [DOL Davis-Bacon Final Rule 2023](https://www.dol.gov/agencies/whd/government-contracts/construction/rulemaking-davis-bacon) — current regulatory framework
- [29 CFR 3.9 — Records Retention](https://www.ecfr.gov/current/title-29/subtitle-A/part-3/section-3.9) — 3-year retention requirement
- [DOL FY2025 Enforcement Data](https://www.workwisecompliance.com/blog/dol-complaint-audit-investigation-guide.html) — $259M recovered, 177,000 employees; audit trigger patterns

---

*Feature research for: HCC Prevailing Wage — v2.3 contractor workflow efficiency + audit readiness*
*Researched: 2026-03-23*

---
---

## Part 4: v2.4 State Forms, Contractor Guidance, Compliance Filter, CSV Export (2026-03-24)

*This section covers 5 new feature areas for v2.4. All v2.3 features are shipped. Focus is on California DIR forms, Washington L&I forms, contractor guidance UX patterns, dashboard compliance status filter, and CSV export field specification.*

**Confidence:** HIGH for CA DIR form fields (cross-referenced against official A-1-131 form and eCPR guidelines); MEDIUM for WA L&I form fields (statute verified, form field details from multiple secondary sources — official online portal is the authoritative source); MEDIUM for UX patterns (industry software behavior documented, not direct product access); HIGH for CSV export fields (grounded in existing compliance data model).

---

### Feature 1: California DIR State Certified Payroll Forms

#### What California Actually Requires

California public works contractors face **two separate filing obligations** that are often confused:

**1. DAS-140 and DAS-142 — Apprenticeship Notification (NOT certified payroll forms)**

These are apprenticeship committee notification forms, not certified payroll forms. They are unrelated to weekly payroll submission but are part of the broader California public works compliance picture.

- **DAS-140** ("Public Works Contract Award Information"): Filed once within 10 days of contract award, before work begins. Notifies each relevant apprenticeship committee that the contractor will use apprentices on the project. One form per craft/trade. **Not a payroll form. Not part of the eCPR system.**
- **DAS-142**: Filed at least 72 hours before apprentices are needed on-site. Requests dispatch of apprentice(s) from a specific apprenticeship program. Filed throughout the project as workforce needs change. **Not a payroll form.**

**Verdict:** DAS-140 and DAS-142 are out of scope for this app's payroll compliance engine. They are apprentice coordination forms, not certified payroll records. The milestone context identifies DAS-140 alongside certified payroll — this is a common contractor confusion. The correct California certified payroll form is the A-1-131 / eCPR submission.

**2. A-1-131 / eCPR — California's Actual Certified Payroll Form**

The California certified payroll form is officially the **"Public Works Payroll Reporting Form" (A-1-131)**, issued by the Division of Labor Standards Enforcement (DLSE). Since SB 854 (effective August 2014), submission must be electronic via California DIR's **eCPR system** rather than paper for most public works projects.

**Filing requirement:** Contractors submit at least monthly; weekly submission recommended as best practice and matches the DOL WH-347 cadence.

**Submission pathway:** Electronic submission only, via the California DIR Public Works portal at efiling.dir.ca.gov/eCPR. Paper A-1-131 accepted only for projects exempt from eCPR electronic filing.

**Fillable PDF:** The paper A-1-131 form exists (dir.ca.gov/dlse/forms/pw/dlseforma-1-131.pdf) but is not the standard submission vehicle. The app should generate a completed A-1-131 PDF that the contractor submits via the eCPR portal — the contractor does not mail a paper form.

---

#### California A-1-131 / eCPR — Field Specification

**Project-Level Header Fields (appear once per submission):**

| Field | Notes | Present on WH-347? |
|-------|-------|--------------------|
| Contractor/Employer Name | Legal entity name | Yes (Box 1) |
| Contractor's CSLB License Number | California contractor license — NOT on federal WH-347 | CA-only |
| Contractor Address | Street, city, state, zip | Yes |
| Specialty License Number | For electrical (C-10), plumbing (C-36), HVAC (C-20), etc. — CA-only | CA-only |
| Self-Insured Certificate Number | WC self-insurance certificate if applicable — CA-only | CA-only |
| Workers' Compensation Policy Number | Active WC policy; required for CA prevailing wage compliance | CA-only |
| Project Name / Description | Project name | Yes (Box 1) |
| Project or Contract Number | Awarding agency contract ID | Yes (Box 1) |
| Awarding Body Name and Address | Agency that awarded the contract | Yes (Box 1) |
| Payroll Number | Sequential per project | Yes (Box 2) |
| Week Ending Date | Saturday of the payroll week | Yes (Box 3) |
| Prime / Subcontractor indicator | Whether this is prime or sub submission | Yes (indicated in Box 1) |

**Worker Row Fields (one row per worker per week):**

| Field | Notes | Present on WH-347? |
|-------|-------|--------------------|
| Employee Name | Full legal name | Yes |
| Employee Address | Street address | Yes |
| Social Security Number | Last 4 per privacy rules (verify against current DIR guidance before implementing) | Yes (last 4) |
| Number of Withholding Exemptions | Federal/CA withholding allowances — not on WH-347 | CA-only |
| Work Classification | Must match DIR wage determination classification | Yes |
| Hours Worked Each Day | Sunday through Saturday (7 columns — WH-347 uses Mon-Sat only) | Partial — WH-347 omits Sunday |
| Overtime Hours | Separate OT column | Yes |
| Total Hours | Sum of all days | Yes |
| Hourly Rate of Pay (Base) | Straight time base rate | Yes |
| Fringe Benefits Rate | Hourly fringe credit | Yes (updated in Jan 2025 WH-347) |
| Gross Amount Earned | Total gross wages for the week | Yes |
| Federal Tax Deduction | Federal income tax withheld | Yes |
| State Tax Deduction | California state income tax | Similar to WH-347 |
| FICA / Social Security | | Yes |
| SDI (State Disability Insurance) | CA-mandatory payroll deduction | CA-only |
| Other Deductions | Voluntary/other deductions with itemized labels | Yes |
| Net Wages Paid | Gross minus all deductions | Yes |
| Journeyworker / Apprentice Indicator | J or RA designation | Yes (Jan 2025 WH-347 added this) |

**California-Specific Fields Not on Federal WH-347 (summary):**
1. **Contractor's CSLB License Number** — California contractor license; confirms contractor is licensed for the work
2. **Specialty License Number** — Required for specialty trades (electrical, plumbing, HVAC, low-voltage, etc.)
3. **Self-Insured Certificate Number** — If contractor self-insures workers' comp rather than carrying a policy
4. **Workers' Compensation Policy Number** — Active WC policy for the contractor; CA requires proof of coverage on certified payroll
5. **State Disability Insurance (SDI) deduction column** — CA-mandatory payroll deduction; no federal equivalent
6. **Number of Withholding Exemptions** — W-4 exemption count; not on WH-347
7. **Sunday column in hours-per-day grid** — WH-347 covers Mon-Sat; A-1-131 includes Sunday

**Certification Statement (bottom of form):**
Signer certifies under penalty of perjury that records are originals or true, full, and correct copies depicting actual disbursements of wages paid. Fields: signer's printed name, position/title, business name, signature, date.

---

#### What to Build for CA DIR Compliance

**Primary deliverable:** PDF generation of the A-1-131 form using pdf-lib coordinate overlay (same pattern as WH-347).

**Key implementation notes:**
- Use the official paper A-1-131 PDF from DIR as the template (same approach as WH-347 coordinate overlay)
- Five new data model fields required at project/contractor level: CSLB license number, specialty license number, WC policy number, self-insured cert number — none of these are per-worker
- SDI deduction: add as a per-entry deduction field labeled "SDI" (accurate) or capture under "other deductions" with label (acceptable for v2.4 first iteration)
- Number of Withholding Exemptions: add as worker-level field on worker profile
- Sunday column: the payroll entry model already stores ST/OT hours per day (Mon-Sat); add a Sunday column to the hours entry model
- The eCPR electronic filing system is a separate submission channel — the app generates the A-1-131 PDF; the contractor manually uploads it to DIR's eCPR portal. Do NOT attempt to integrate with eCPR's XML upload API in this milestone.

**Confidence:** MEDIUM-HIGH. A-1-131 form structure confirmed from official CA DIR form PDF and multiple secondary sources. California-specific fields identified clearly. LOW confidence on one specific point: whether DIR currently requires full SSN vs. last-4 on A-1-131 (privacy rules have shifted since the form was designed; verify against current DIR guidance before implementing).

---

### Feature 2: Washington L&I Prevailing Wage Forms

#### What Washington Actually Requires

Washington state public works compliance requires **three filings** per contractor per project, managed through the online **PWIA (Prevailing Wage Intent and Affidavit) system** at secure.lni.wa.gov:

1. **Statement of Intent to Pay Prevailing Wages** — Filed immediately after contract award, before work begins. Required from prime contractor AND every subcontractor independently.
2. **Affidavit of Wages Paid** — Filed after all work under the contract is complete. Required from prime AND every subcontractor.
3. **Certified Payroll Report (F700-065-000)** — Filed at least monthly (weekly recommended) throughout the project.

**Critical workflow dependency:** The Intent to Pay must be **approved by L&I's Industrial Statistician** AND on file before the contractor can receive their first payment. Filing must happen before any payment disbursement, regardless of when work starts. This is a harder deadline than the federal WH-347 requirement.

**Threshold note:** For contracts under $2,500, a combined Intent/Affidavit short form is available. For contracts over $10,000, the Intent must include the prevailing wage rate for each classification and the contractor's registration certificate number (RCW 39.12.040).

**No offline PDF for Intent or Affidavit:** Both forms are submitted exclusively through the My L&I Contractor Portal (PWIA system). L&I does not distribute a downloadable PDF for current Intent/Affidavit submissions. The F700-065-000 certified payroll report does have a downloadable PDF.

---

#### Washington Statement of Intent — Field Specification

Filed via PWIA system online. Required fields per RCW 39.12.040 and L&I documentation:

| Field | Notes |
|-------|-------|
| Contractor Name | Legal entity name |
| Contractor UBI (Unified Business Identifier) | Washington state business registration number |
| Contractor Registration Certificate Number | L&I contractor registration; required for contracts >$10,000 |
| Project Name and Description | Sufficient detail to identify the project |
| Project Location / Address | Street, city, county, state |
| Awarding Agency Name | Public agency that awarded the contract |
| Awarding Agency Contact | Contact for the agency administering the contract |
| Contract Number / Award Number | Agency-assigned contract identifier |
| Contract Amount | Estimated contract value |
| Project Start Date | Anticipated start of work |
| Project Completion Date | Anticipated end of work |
| Trade / Work Classification | Craft(s) to be employed; one Intent record per trade classification |
| Prevailing Wage Rate | Applicable prevailing wage rate for each listed classification |
| Fringe Benefit Rate | Hourly fringe rate for each classification |
| Estimated Number of Workers | Per classification |
| Workers' Compensation Account Number | L&I WC account; verifies active coverage |
| Prime vs. Subcontractor | Whether filing as prime or sub; who is the prime if subcontractor |

**Approval process:** After online submission, L&I's Industrial Statistician reviews and approves. Approval confirms wage rates are listed correctly for the classifications indicated — it does not certify whether the contractor's classification choice is appropriate for the work performed.

---

#### Washington Affidavit of Wages Paid — Field Specification

Filed after all work under the contract is complete. Same PWIA portal.

| Field | Notes |
|-------|-------|
| Reference to the approved Intent | Links back to the filed and approved Intent to Pay |
| Contractor Name, UBI, Registration Number | Same identifiers as Intent |
| Project Name, Number, Awarding Agency | Same as Intent |
| Trade / Work Classification | Per classification (should match what was stated in Intent) |
| Actual Wage Rate Paid | Straight-time rate actually paid (not the prevailing rate minimum) |
| Actual Fringe Benefit Rate Paid | Fringe actually paid or provided |
| Hours Worked per Classification | Total hours per trade for the full project duration |
| Statement of Compliance | Contractor certifies wages were paid at or above prevailing rate |
| Signature and Date | Under penalty of perjury |

---

#### Washington Certified Payroll Report (F700-065-000) — Field Specification

Weekly/monthly payroll record form. This is the closest Washington analog to the federal WH-347.

| Field | Notes |
|-------|-------|
| Project Name | |
| Awarding Agency | |
| Contract Number | |
| Contractor Name, Address | |
| Payroll Period | Week or month covered |
| Employee Name | Full legal name |
| Employee Address | Required to be retained; may appear on detailed version |
| Trade / Occupation | Per worker per classification |
| Straight Time Rate | Actual rate paid |
| Overtime Rate | |
| Hourly Rate of Usual Benefits (Fringe) | |
| Hours Worked Each Day (ST and OT) | Per worker, per day |
| Total Hours | |
| All Itemized Deductions | Must be itemized from gross wages |
| Net Wages | Gross minus deductions |
| Certification Statement | Contractor certifies compliance with RCW 39.12 |

**Washington-Specific Fields Not on Federal WH-347:**

| Field | Purpose |
|-------|---------|
| UBI (Unified Business Identifier) | WA state business registration; required on Intent and Affidavit |
| L&I Contractor Registration Certificate Number | Required on Intent for contracts >$10,000 |
| Workers' Compensation Account Number | Active L&I WC account; required on Intent |
| Awarding Agency Reference on Affidavit | Links payment disbursement to filed forms |

---

#### What to Build for WA L&I Compliance

**Primary deliverables:**
1. **F700-065-000 Certified Payroll PDF** — Use pdf-lib coordinate overlay on the official F700-065-000 form, same pattern as WH-347. This is the highest-priority WA deliverable because it maps directly from the existing payroll data model.
2. **Statement of Intent reference PDF** — Generate a pre-filled summary document (not a submission artifact) that the contractor uses as a data entry guide when completing the PWIA portal online. Label it clearly: "Use this information to complete your online filing at secure.lni.wa.gov/pwia."
3. **Affidavit of Wages Paid reference PDF** — Same approach: project-level wage summary for contractor reference; contractor files manually in My L&I portal.

**Key implementation notes:**
- New project-level fields needed: UBI, L&I Registration Certificate Number, WC Account Number — conditional display; only shown/required when project state = Washington
- The Intent and Affidavit are NOT direct PDF submissions to L&I — the app generates reference documents, not submission artifacts
- F700-065-000 is the form with the clearest data mapping to existing payroll records; build this first

**Data source blocker (MEDIUM severity):** The SAM.gov WDOL API does not contain Washington L&I prevailing wage rates. Washington publishes its own prevailing wage schedules at lni.wa.gov/licensing-permits/public-works-projects/prevailing-wage-rates/ but these are not available via API. For v2.4: allow the contractor to manually enter the applicable WA prevailing wage rates at project creation for Washington projects. Full L&I rate table integration is a future milestone.

**Confidence:** MEDIUM. Form field lists confirmed from RCW 39.12.040 and multiple L&I secondary sources. Portal-only filing for Intent/Affidavit confirmed (this is an important constraint — the app cannot generate submission-ready PDFs for these two forms). Data source blocker for WA wage rates is confirmed and must be addressed in requirements.

---

### Feature 3: Contractor Guidance UX

#### Research Basis

Direct research into competitor software UI (LCPtracker, Procore, Sage, B2GNow) yielded general capability descriptions but not specific UX documentation — these are closed SaaS products. Patterns below are grounded in: (a) LCPtracker contractor training materials and DOT agency guides, (b) established UX discipline on progressive disclosure and field-worker guidance, (c) prior research on compliance tool patterns.

#### What Industry Compliance Tools Do for Contractor Guidance

From LCPtracker contractor manuals and CODOT/DOT prime contractor training guides:

**Pattern observed in LCPtracker:** Workflow-oriented navigation where each step (Data Entry → Certify → Submit) is only activated when the prior step is complete. The contractor cannot certify until payroll entries exist; cannot submit until certified. This enforced sequencing eliminates partial submissions. Every payroll week carries an explicit status: Data Entry / Certified / Approved / Rejected. Rejected submissions show inline rejection reasons. When a week is in Rejected status, a top-of-page callout reads: "This payroll was rejected by [Agency]. Reason: [reason]. Action required: correct and resubmit." The contractor never guesses what to do next.

**Pattern observed:** Mathematical validation fires at entry time, not after form submission. When a wage entry falls below the prevailing rate, the system flags it inline before the entry is saved.

#### Applicable UX Patterns for HCC App (5 concrete patterns)

**Pattern 1: Inline contextual tooltips on compliance-sensitive fields**

Where to apply: Rate entry, fringe benefit amount, OT classification, J/RA designation, deduction fields.

What: An info icon next to the field label; hover/tap expands a 1-2 sentence explanation in a popover — not a modal, not a separate help page.

Specific copy recommendations:
- J/RA designation: "Select Journeyworker for fully qualified tradespeople. Select Registered Apprentice only for workers enrolled in a DOL-approved apprenticeship program — unenrolled workers must be paid journeyworker rates."
- Fringe rate field: "Enter the hourly amount you contribute to health, pension, vacation, and other benefits. This is separate from the base wage and must meet the prevailing wage fringe rate for this trade."
- OT threshold: "CWHSSA requires 1.5x overtime for all hours over 40 in a workweek on federal contracts. This applies regardless of any state overtime rules."
- SSN last 4: "Last 4 digits only. Required on the WH-347 form for worker identification — do not enter the full Social Security number."

**Pattern 2: Step-level status on payroll weeks (extends v2.3 submission tracking)**

Already shipped: 4-step workflow indicator on Project Detail (Create → Workers → Payroll → WH-347). For v2.4: add a week-level status badge that evolves: Draft → Compliant / Has Violations → Submitted. This gives contractors immediate orientation on each week's state without clicking into the week.

**Pattern 3: Instructional empty states with specific action guidance**

Where: Every list view — project list, worker list, payroll week list, compliance history.

What: When a list is empty, show (a) what this page is for, (b) the specific action to take, (c) why it matters. Do not reuse the same copy across different empty states — each has a different compliance purpose.

Recommended copy per context:
- No workers on a project: "Add your crew before entering payroll. Each worker needs a trade classification to match the prevailing wage rate for your project. Workers without a classification cannot be included on a WH-347."
- No payroll weeks: "Create your first payroll week to begin tracking wages. Federal law requires a certified payroll submission for every week work is performed on a Davis-Bacon project — including weeks with no work."
- No violations in compliance history: "No violations found. This worker's pay meets prevailing wage requirements across all projects on record."
- No projects on dashboard: "Create your first project to get started. You'll need the project location, awarding agency, and contract start date to look up the correct prevailing wage rates."

**Pattern 4: Positive compliance confirmation on preflight (extends existing preflight modal)**

The existing preflight modal before WH-347 download shows violations. Add the positive branch: when all checks pass, show: "All compliance checks passed. This payroll meets prevailing wage requirements." A positive confirmation reduces anxiety for contractors new to compliance software who are uncertain whether a clean pass means the check ran correctly or was skipped.

**Pattern 5: Contextual "what happens next" after key actions**

After marking a payroll week submitted: "Marked as submitted to [Agency Name]. Keep a copy of the WH-347 in your project file — federal records retention requires 3 years after project completion."
After archiving a project: "Project archived. You can restore it at any time from the project detail page."
After generating a WH-347: "WH-347 downloaded. Submit it to the agency listed in your contract. Most agencies require submission within 7 days of the payroll period end."
After flagging a violation: "Compliance flag found. Correct the issue before submitting this payroll — violations on submitted payrolls may trigger DOL back-wage liability."

These can be implemented as brief toast notifications or inline callouts immediately below the action button, not persistent banners.

#### Complexity by Pattern

| Guidance Element | Complexity | Notes |
|-----------------|------------|-------|
| Inline field tooltips (info icon + popover) | LOW | Small Tooltip component; no external library; reusable across all forms |
| Enhanced empty state copy | LOW | Copywriting + updating existing EmptyState component props; no data model changes |
| Positive compliance confirmation on preflight | LOW | Conditional branch in existing preflight modal logic |
| Post-action contextual toasts | LOW | Toast/notification component (simple); or inline callout in existing UI |
| Week-level status badge on payroll list | LOW-MEDIUM | Badge logic already exists from v2.3 submission tracking; just needs display extension |

#### Anti-Patterns to Avoid

| Pattern | Why Problematic | Better Alternative |
|---------|-----------------|-------------------|
| Onboarding modal tour on first login | Dismissed immediately; blocks content; compliance users are task-focused | Instructional empty states at each entry point |
| Generic "help" link opening external docs | Pulls user away from app mid-task | 1-2 sentence contextual tooltip at the field level |
| Persistent warning banners after the issue is resolved | Creates compliance fatigue — contractors start ignoring all banners | Badges and callouts that clear as soon as data is corrected |
| Long instruction paragraphs on form pages | Contractors don't read them; creates visual noise | 2-sentence max per tooltip; one sentence of action guidance per empty state |
| Hard-blocking incomplete data when not legally required | Frustrates legitimate edge cases; creates "trapped" UX | Warn clearly with specific message; allow proceeding; document the warning was shown |

---

### Feature 4: Dashboard Compliance Status Filter

#### What This Feature Is

A filter on the project dashboard that lets the contractor see which projects have open violations vs. are compliant vs. have no payroll entered. Enables batch triage before a submission deadline.

#### Standard Status Buckets

Based on compliance software conventions and regulatory binary pass/fail logic:

| Status | Definition | Badge Variant |
|--------|------------|---------------|
| Compliant | All payroll weeks with entries have no active violations | `compliant` (green) |
| Has Violations | At least one payroll week has at least one unresolved violation | `violation` (red) |
| No Payroll | Project exists; no payroll entries have been created yet | `neutral` (grey) |
| Archived | Project is archived/completed | Muted secondary styling |

**Why 4 discrete buckets, not a percentage health score:** Percentage scores (e.g., "83% compliant") are meaningless in a regulatory context — 1 violation on 1 entry is equally non-compliant as 50. Contractors evaluate projects by "does this need attention?" not by a health percentage. Binary pass/fail aligns with how DOL investigators assess compliance.

#### Implementation Specifics

**Batch compliance summary endpoint (new):**
The current dashboard queries compliance per project card independently (N queries). A compliance status filter requires a single batch endpoint: `GET /api/projects/compliance-summary` returns `{ projectId, status: 'compliant' | 'has-violations' | 'no-payroll' }` for all active projects in one DB query. Implement as a SQL aggregation (GROUP BY project + CASE WHEN), not application-code looping.

**Filter integration:**
- Extends v2.3 dashboard search + filter (same filter bar, additive AND logic)
- New dropdown: All / Compliant / Has Violations / No Payroll
- URL persistence: `?compliance=has-violations` — consistent with existing filter URL pattern

**Empty state when filter returns zero results:**
"No [status] projects found." with "Clear filters" link. Distinct from the "no projects at all" empty state.

**Project card badge update:**
The compliance badge on project cards already exists (v2.0). For v2.4, ensure it reflects the same 4-bucket vocabulary consistently so the filter behavior and the card badge agree visually.

**Performance note:** For 20 projects × 20 weeks × 8 workers, per-JS-loop compliance recalculation on dashboard load is a performance anti-pattern. The batch SQL aggregation must happen at the database level.

---

### Feature 5: CSV Export from Per-Worker Compliance History

#### Purpose

When WHD investigators arrive, they request payroll records for specific workers across all projects. The per-worker compliance history page (shipped v2.3) shows this data on-screen. CSV export converts that view into a file the contractor can email to the investigator or attach to their audit response.

#### Field Specification (17 columns)

All sourced from the existing v2.3 data model:

| Column Header | Data Source | Notes |
|---------------|------------|-------|
| Worker Name | workers.name | Full legal name |
| SSN Last 4 | workers.ssn_last4 | Partial SSN; sufficient for identity confirmation |
| Trade Classification | payroll_entries.classification | Classification at time of entry (snapshot, not current) |
| Project Name | projects.name | |
| Project Contract Number | projects.contract_number | Omit column if field is not stored |
| Week Ending Date | payroll_weeks.week_ending_date | ISO 8601 format: YYYY-MM-DD |
| Payroll Number | payroll_weeks.payroll_number | Supports amendment suffixes (e.g., "15-1") |
| Total Hours | payroll_entries.total_hours | Sum of all ST + OT hours for the week |
| Base Rate Paid | payroll_entries.base_rate_snapshot | Rate locked at entry time |
| Fringe Rate Paid | payroll_entries.fringe_rate_snapshot | Rate locked at entry time |
| Gross Wages Paid | Computed: hours x (base + fringe) | Calculated from snapshots |
| Required Base Rate | payroll_entries.required_rate | Prevailing wage rate from WD at time of entry |
| Violation Type | compliance_flags.violation_type | under-wage / cwhssa-ot / apprentice-ratio / (empty if none) |
| Dollar Delta | compliance_flags.dollar_delta | Underpayment amount; empty for apprentice-ratio |
| Week Submission Status | payroll_weeks.submission_status | draft / submitted / amended |
| Submitted To Agency | payroll_weeks.submitted_to_agency | Agency name; empty if draft |
| Submitted Date | payroll_weeks.submitted_at | ISO 8601 date; empty if draft |

#### Export Scope

- Export the full filtered result set, not the current page (consistent with v2.3 per-worker history spec)
- Apply all active filters (worker name search, violation type, project, date range) to the export
- If no filters active, export all compliance history for the authenticated user

#### CSV Formatting

- Headers in row 1
- Dates as YYYY-MM-DD (ISO 8601 — sorts correctly in Excel without locale confusion)
- Dollar amounts as plain numbers with 2 decimal places, no currency symbols, no commas (clean for Excel import)
- Empty cells where data is absent: empty string (not "N/A", not "null", not "0")
- Encoding: UTF-8 with BOM (Windows Excel opens UTF-8 CSV without character corruption when BOM is present; special characters in worker names render correctly)
- Filename: `compliance-history-[YYYY-MM-DD].csv` with the export date

#### Implementation

- Generate server-side in Node.js; stream as `text/csv` with `Content-Disposition: attachment`
- Add `format=csv` query parameter to the existing compliance history endpoint — same query path, alternate response format
- Do not create a separate route; extend the existing `/api/workers/:id/compliance-history` endpoint

---

### Feature Dependencies (v2.4)

```
California A-1-131 Form
    └──requires──> New project/contractor fields: CSLB license, specialty license,
                   WC policy number, self-insured cert number (project-level additions)
    └──requires──> Sunday column on hourly entry grid (data model extension)
    └──requires──> Withholding exemptions on worker profile (worker-level addition)
    └──requires──> pdf-lib coordinate overlay (existing capability — same as WH-347)
    └──independent of──> Washington L&I forms

Washington L&I Forms
    └──requires──> New project fields: UBI, L&I registration cert number, WC account number
    └──BLOCKED by──> Washington prevailing wage data source
                    (SAM.gov has no WA state rates — resolution: manual rate entry for WA projects)
    └──F700-065-000 maps directly──> existing payroll data model (no new data required)
    └──independent of──> California DIR forms

Dashboard Compliance Status Filter
    └──requires──> Batch compliance summary endpoint (new DB-level aggregation)
    └──extends──> v2.3 dashboard search + filter (additive, same filter bar)
    └──independent of──> state forms, CSV export, contractor guidance

CSV Export from Compliance History
    └──requires──> v2.3 compliance history page and endpoint (already shipped)
    └──requires──> v2.3 submission tracking fields (submitted_at, submitted_to_agency, submission_status)
    └──independent of──> state forms, compliance filter, contractor guidance

Contractor Guidance UX
    └──enhances──> all existing pages (additive — no new data model changes)
    └──independent of──> state forms, CSV export, compliance filter
```

---

### Anti-Features (v2.4)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Direct eCPR XML upload to CA DIR portal | One-click CA submission | DIR's eCPR XML schema has changed multiple times; API integration creates fragile dependency on a government system | Generate A-1-131 PDF; instruct contractor to upload to eCPR portal manually |
| Direct PWIA submission to WA L&I | Same as above for WA | PWIA is a portal workflow with a human approval step — no API for automated submission | Generate WA reference PDFs; instruct contractor to file in My L&I |
| Full SSN display in CSV export or PDF | "Auditors need SSN" | Full SSN is a PII risk; last 4 is sufficient for prevailing wage identity confirmation and is what WH-347 requires | Last 4 only everywhere — document that this is the regulatory standard |
| Auto-pull WA prevailing wage rates from L&I | Eliminate manual entry | L&I's wage schedule is not available via public API; scraping is fragile and legally ambiguous | Manual rate entry per project for WA; batch WA rate seed table is a future milestone |
| DAS-140 / DAS-142 form generation | Contractor asks "can I do my CA apprentice forms here?" | These are apprenticeship notification forms, not certified payroll — different data model, different recipients (apprenticeship committees not DIR), different compliance chain | Document clearly: DAS-140/142 are out of scope for a payroll tool; this app handles certified payroll only |
| Combined CA+WA compliance enforcement | Build one rules engine that covers both states | California and Washington have materially different prevailing wage definitions, OT thresholds, and enforcement rules; a unified rules engine would produce incorrect state-specific compliance checks | Federal compliance engine (existing) for federal projects; state-specific compliance is a future milestone after state wage rates are properly integrated |

---

### Compliance Confidence Summary (v2.4)

| Area | Confidence | Primary Source | Gaps |
|------|------------|---------------|------|
| CA DAS-140/142 identified as non-payroll forms | HIGH | Multiple sources: Miter, LumberFi, ABC SoCal, DIR FAQ | None |
| CA A-1-131 project-level field list | HIGH | CA DIR official form (dlseforma-1-131.pdf) + multiple secondary sources | None at this level |
| CA A-1-131 worker-level field list | MEDIUM-HIGH | Official form cross-referenced with secondary sources | Full SSN vs. last-4 not definitively confirmed in current DIR guidance; verify before implementing |
| CA eCPR electronic filing requirement | HIGH | CA DIR official guidance; SB 854 statute | None |
| WA Intent to Pay field list | MEDIUM | RCW 39.12.040 + L&I secondary sources | Portal-only — exact current field labels require PWIA portal access to verify |
| WA Affidavit of Wages Paid field list | MEDIUM | RCW 39.12.040 + L&I secondary sources | Same gap as Intent |
| WA F700-065-000 field list | MEDIUM | Multiple secondary sources (informedcontractors.com, points-north.com) | Official form PDF binary; field labels confirmed by cross-reference |
| WA prevailing wage data source blocker | HIGH | Confirmed: SAM.gov does not serve WA state wages; L&I has no public API | Resolution identified: manual rate entry for v2.4 |
| Contractor guidance UX patterns | MEDIUM | LCPtracker contractor training manuals; CODOT guides | No direct product access; patterns inferred from training docs and industry convention |
| Dashboard compliance filter design | MEDIUM-HIGH | Industry convention + RAG status dashboard patterns | LCPtracker internal UI not accessible |
| CSV export field list | HIGH | Grounded directly in v2.3 data model | No gaps; all 17 fields exist in current schema |

---

## v2.4 Sources

- [California DIR — Certified Payroll Reporting](https://www.dir.ca.gov/public-works/certified-payroll-reporting.html) — eCPR system overview, SB 854 electronic filing requirement
- [California DIR — eCPR FAQ (SB 854)](https://www.dir.ca.gov/Public-Works/ecprfaq.html) — Electronic filing mandate, exemptions
- [California DIR — FAQ on Certified Payroll Reporting](https://www.dir.ca.gov/Public-Works/FAQ-certified-payroll-reporting.html) — Submission rules, corrections, monthly minimum
- [California DIR — A-1-131 Form (official)](https://www.dir.ca.gov/dlse/forms/pw/dlseforma-1-131.pdf) — Official CA certified payroll form (paper version)
- [Miter — DAS-140 and DAS-142 Guide](https://www.miter.com/post/das-140-142-forms-guide) — Confirms DAS-140/142 are apprenticeship notification forms, not CPR forms
- [LumberFi — DAS-140 and DAS-142 Easy Guide](https://www.lumberfi.com/blog/das-140-and-142-forms-easy-guide-for-contractors) — Field descriptions confirming scope of both forms
- [ABC SoCal — DAS-140 Contractors Guide](https://abcsocal.org/das-140-california-contractors-guide-to-apprentice-contract-award-notices/) — Submission timing and apprenticeship committee notification requirements
- [Washington RCW 39.12.040](https://app.leg.wa.gov/RCW/default.aspx?cite=39.12.040) — Statutory required fields for Intent and Affidavit; contractor registration requirement for contracts >$10,000
- [Washington L&I — Contractors/Employers](https://lni.wa.gov/licensing-permits/public-works-projects/contractors-employers/) — Intent/Affidavit filing requirements and timing
- [Washington L&I — PWIA Step-by-Step Instructions](https://lni.wa.gov/licensing-permits/_docs/pwia-step-by-step-instructions.pdf) — PWIA portal filing workflow
- [MRSC — Navigating Intents and Affidavits for Prevailing Wages (March 2025)](https://mrsc.org/stay-informed/mrsc-insight/march-2025/intents-affidavits-prevailing-wages) — Current WA compliance overview including payment dependency on Intent approval
- [Points North — Washington Prevailing Wage](https://www.points-north.com/state-by-state-certified-payroll-reporting/washington) — WA certified payroll record requirements; F700-065-000 field details
- [Procore — Washington Prevailing Wage](https://www.procore.com/library/prevailing-wages-washington) — WA compliance overview
- [Informedcontractors.com — F700-065-000](https://www.informedcontractors.com/F700-065-000-washington-certified-payroll-report.html) — F700-065-000 form purpose and field list
- [CODOT — LCPtracker Getting Started](https://www.codot.gov/business/civilrights/compliance/systems/lcp) — LCPtracker workflow roles and weekly submission requirement
- [LCPtracker — Active Insights](https://lcptracker.com/active-insights) — Compliance dashboard and reporting capabilities (Power BI-based)
- [RAG Status Dashboard Best Practices — Mastt](https://www.mastt.com/blogs/project-rag-status-dashboard) — Red/Amber/Green status pattern design; why discrete buckets outperform continuous scores

---

*Feature research for: HCC Prevailing Wage — v2.4 state forms, contractor guidance, compliance filter, CSV export*
*Researched: 2026-03-24*

---

## Part 6: v2.5 Feature Research — CA eCPR XML Export and WA PWIA Submission Assist (2026-03-26)

**Milestone context:** Subsequent milestone. All payroll entry, worker, project, and compliance data is already in the DB from v2.4. This milestone is about transforming existing data into submission-ready artifacts for CA and WA state portals. No new data collection is needed beyond a few small new project-level fields.

**Confidence:** HIGH for CA XML schema (official XSD + CPRSample.xml confirmed stable through June 2025 per Sunburst Software); HIGH for WA XML schema (parsed actual XSD at lni.wa.gov/xmlschema.xsd); MEDIUM for WA Intent to Pay portal field names (confirmed conceptually from multiple sources, portal screens not enumerable without login).

---

### Data Already in DB (Do Not Re-collect)

- **CA projects:** contractor name, CSLB license, workers comp policy, PWCR, contractor address, project county/city/zip, payroll weeks with per-worker hours (ST/OT by day), workClass, gross wages, deductions, fringe rates (snapshotted as single value)
- **WA projects:** UBI, L&I account number, workers comp info, project county, workers with 4-letter WA trade codes, payroll weeks with hours by day (ST/OT), wage rates, fringe breakdown (pension/medical/vacation/holiday stored separately per v2.4 WA form)

---

### Table Stakes (Must Ship for Milestone to Have Any Value)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CA eCPR XML generation per payroll week | This is the entire CA deliverable -- XML file for manual upload to CA DIR portal | MEDIUM | Schema from CPRSample.xml confirmed stable since Jan 2016; no change in 2024 DIR overhaul |
| CA eCPR XML file download | User must download the file to upload manually to efiling.dir.ca.gov/eCPR | LOW | Standard Content-Disposition: attachment response |
| CA eCPR XML filename convention | DIR may reject incorrectly named files | LOW | Convention: [FEIN]_[ProjectID]_[WeekEnding]_[PayrollNum].xml |
| CA eCPR XML correct root and namespace | Upload fails if namespace or root element is wrong | LOW | Root: CPR:eCPR with CPR namespace per official schema |
| DIR Project ID stored on CA project | projectID is the portal lookup key; wrong value causes rejected upload | LOW | New column dir_project_id on projects table; editable field in CA project detail |
| CA eCPR workClass mapping | Work classification must match CA craft names in the XML | MEDIUM | Map from existing trade_classifications.classification; CA uses free-text not codes |
| CA fringe disaggregation | CA XML requires healthWelfare / pension / vacation / training as separate elements; current CA entry uses single fringeRateSnapshot | MEDIUM | Need new columns on payroll entries for CA projects: ca_fringe_health_welfare, ca_fringe_pension, ca_fringe_vacation, ca_fringe_training -- plus UI fields in CA payroll entry form |
| CA deductions section in XML | Required XML block; missing causes schema validation failure | LOW | Map FICA, federal/state withholding, other deductions from existing payroll entry deduction fields |
| CA training fund contribution field | California-specific deduction line item; element must be present even if zero | LOW | Map from ca_fringe_training; default to 0.00 if blank |
| WA submission assist summary page | Core WA deliverable given no confirmed portal API; pre-populated data for manual entry | MEDIUM | Print/copy-friendly page covering Intent to Pay pre-fill and Affidavit summary |
| WA Intent to Pay pre-fill summary | Contractor must file Intent immediately after award; app pre-populates all known fields | LOW | Fields: contractor name, UBI, registration number, project name, county, awarding agency, start/end dates, trade classifications |
| WA Affidavit of Wages Paid summary | Filed after project completion; per-worker/per-trade wage totals | MEDIUM | Aggregated from payroll entries: employee name/address, trade code, ST rate, OT rate, benefit rate, total ST/OT hours, total wages, itemized deductions |
| WA certified payroll XML export | L&I PWIA portal accepts XML upload -- highest-value WA deliverable | HIGH | Schema parsed from official XSD; root: WaPWCPR > projectIntent (intentId) > payroll > payrollWeek > employees > employee > tradeHoursWages |
| WA Intent ID stored on WA project | intentId is required in WA XML to link payroll to approved intent | LOW | New column wa_intent_id on projects table; editable in WA project detail after portal approval |
| WA trade code validation | 4-letter trade codes (CARP, ELEC, LABO, etc.) strictly enforced by WA XSD enum | LOW | Already captured in DB from v2.4 WA form; verify against official XSD enum values |
| WA county per trade entry in XML | county is required at tradeHoursWage level -- not just project level | LOW | Propagate projects.county down to each tradeHoursWage element |
| WA fringe fields per trade entry | XSD requires hourlyPensionRateAmt, hourlyMedicalAmt, hourlyVacationAmt, hourlyHolidayAmt, apprenticeBenefitAmt as separate elements | MEDIUM | v2.4 WA form stores these separately; confirm DB column names match expected XSD mapping |
| WA apprentice conditional fields | If apprenticeFlg=true, 6 additional required fields (apprenticeId, apprenticeState, apprenticeOccpnName, apprenticeStepName, apprenticeStepBeginHours, apprenticeStepEndHours) | MEDIUM | v2.0 added J/RA flag; verify all 6 sub-fields are stored; gap likely on some fields |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| CA eCPR pre-flight validation UI | Shows missing required fields before generating XML -- prevents wasted upload attempts | MEDIUM | Check: FEIN present, projectID set, all workers have workClass, fringe disaggregated, SSN limitation flagged |
| CA eCPR week selector | Export any historical week, not just current; needed for catching up on prior weeks | LOW | Dropdown of all payroll weeks for the project |
| WA XML pre-flight validation | Surface missing intentId, incomplete apprentice fields, missing fringe breakdowns before generating | MEDIUM | WA XSD has many conditional-required fields; pre-flight catches them before upload rejection |
| WA submission checklist UI | Step-by-step guide: (1) file Intent in portal, (2) post on jobsite, (3) submit monthly CPRs via XML, (4) file Affidavit after completion | LOW | Turns portal-only scope into a guided workflow; this is where the WA UX value lives |
| Awarding agency field on project | Required for both CA and WA filings; store once, reuse in all exports | LOW | Add awarding_agency column to projects; shared between CA and WA |
| Contract number field on project | Required for WA Intent to Pay; useful for CA too | LOW | Add contract_number column to projects |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Direct CA portal API submission | Eliminates manual upload step | CA DIR eCPR portal has no public API; efiling.dir.ca.gov is session-authenticated; any attempt risks account lockout or ToS violation | Generate XML for manual upload -- this is the documented and only supported path |
| Direct WA PWIA portal API submission | Same motivation | No confirmed public contractor-facing API for My L&I PWIA submissions | WA XML upload (portal-supported) plus guided manual summary |
| State-specific prevailing wage rate fetch | Auto-populate CA/WA rates into forms | CA and WA have separate rate schedules; adding state WD sources requires a separate rate engine rewrite -- completely different milestone scope | Continue using existing federal WD snapshots; state form data reuses the same payroll entries already in the DB |
| Full SSN storage for XML submission | Both CA and WA XML technically require full SSN in the file | Full SSN storage requires encryption at rest, strict access controls, and security audit -- violates the existing design decision to store only last 4 digits | Flag in pre-flight UI that user must enter full SSNs at the portal; generate XML with masked placeholder XXX-XX-[last4] as a data-entry guide |
| Batch multi-week XML (all weeks in one file) | Less clicking | CA DIR schema has a single forWeekEnding per file -- batch not supported. WA technically supports multi-week but adds complexity not justified by savings | Week selector with single-week download |
| In-browser XSD validation | Developer-quality validation | Heavy XML library dependency for minor benefit; server generates from fixed templates that already conform | Server-side validation before download; flag obvious errors (missing required fields) without full XSD parse |

---

### CA eCPR XML Required Fields Reference

Based on official CPRSample.xml (dir.ca.gov) and confirmed-stable schema (CPR.xsd, unchanged through June 2025).

Root element: CPR:eCPR with CPR namespace (http://www.dir.ca.gov/Public-Works/CPRSchema)

#### Contractor Section

| XML Element | Required | Source in DB |
|-------------|----------|--------------|
| CPR:contractorName | Yes | User company name or project contractor field |
| CPR:contractorLicense > CPR:licenseType | Yes | "CSLB" for CA contractors |
| CPR:contractorLicense > CPR:licenseNum | Yes | projects.cslbLicenseNumber (v2.4) |
| CPR:contractorPWCR | Yes | projects.pwcrNumber (v2.4); "NA" if exempt |
| CPR:contractorFEIN | Yes | User profile FEIN field (verify stored; add if missing) |
| CPR:contractorAddress > street/city/state/zip | Yes | User profile address |
| CPR:insuranceNum | Yes | projects.wcPolicyNumber (v2.4) |
| CPR:contractorEmail | Yes | users.email |

#### Project Section

| XML Element | Required | Source in DB |
|-------------|----------|--------------|
| CPR:awardingBody | Conditional | projects.awarding_agency (new column) |
| CPR:contractAgency | Yes | Agency code; "CA-DIR" or awarding body code |
| CPR:projectID | Yes (preferred) | projects.dir_project_id (new column) |
| CPR:projectLocation > street/city/county/state/zip | Yes | projects address fields |

#### Payroll Section (per week)

| XML Element | Required | Source in DB |
|-------------|----------|--------------|
| CPR:forWeekEnding | Yes | payroll_weeks.weekEndingDate |
| CPR:payrollNum | Yes | Sequential integer (1, 2, 3...); amendments: "1-1" |

#### Per-Employee

| XML Element | Required | Source in DB |
|-------------|----------|--------------|
| CPR:name (id=SSN attr) | Yes | workers.firstName/lastName; SSN masked |
| CPR:address | Yes | workers.address |
| CPR:ssn | Yes | Placeholder XXX-XX-[ssnLast4]; flag in pre-flight |
| CPR:workClass | Yes | trade_classifications.classification |
| CPR:hrsWorkedEachDay x7 (date, ST, OT, DT) | Yes | payroll_entries daily columns |
| CPR:totHrs ST/OT/DT | Yes | Derived totals |
| CPR:hrlyPayRate ST/OT/DT | Yes | baseRateSnapshot; OT=1.5x, DT=2.0x |
| CPR:grossAmountEarned > thisProject/allWork | Yes | payroll_entries.grossWage |
| CPR:deductionsContribPay > healthWelfare | Yes | ca_fringe_health_welfare (new column) |
| CPR:deductionsContribPay > pension | Yes | ca_fringe_pension (new column) |
| CPR:deductionsContribPay > vacation | Yes | ca_fringe_vacation (new column) |
| CPR:deductionsContribPay > training | Yes | ca_fringe_training (new column) |
| CPR:deductionsContribPay > FICA | Yes | Existing deduction field |
| CPR:deductionsContribPay > withholding | Yes | Existing deduction field |
| CPR:deductionsContribPay > totalDeductions | Yes | Derived sum |
| CPR:netWagePaidWeek | Yes | grossWage minus totalDeductions |
| CPR:checkNum | Optional | Not stored; omit or leave empty |

**Fringe disaggregation note:** CA XML requires four separate fringe elements. The existing CA payroll entry form uses a single fringeRateSnapshot. This is the largest scope item in the CA feature track -- it requires a DB migration, UI changes to the CA payroll entry form, and XML generator logic. The recommended approach is to add the four new fringe columns and update the CA entry form, not to prompt the user at export time.

---

### WA PWIA Required Fields Reference

#### Intent to Pay (portal manual entry -- no API; submission assist pre-populates a copy-ready summary)

| Field | Required | Source in DB |
|-------|----------|--------------|
| Contractor company name | Yes | User profile |
| UBI number | Yes | projects.ubiNumber (v2.4) |
| Contractor registration license number | Yes | projects.contractorRegNumber (v2.4) |
| Contact name, phone, email | Yes | User profile |
| Prime or subcontractor | Yes | Project setting |
| Project name | Yes | projects.name |
| Project number / contract number | Yes | projects.contract_number (new column) |
| County where work performed | Yes | projects.county |
| City where work performed | Yes | Derived from project address |
| Awarding agency | Yes | projects.awarding_agency (new column; shared with CA) |
| Estimated start date | Yes | projects.startDate |
| Estimated end date | Yes | projects.estimated_end_date (new column) |
| Trade classifications to be used | Yes | trade_classifications for this project |
| Estimated hours per trade | Yes | Computed from existing payroll data at export time |

Filing timing: Immediately after contract award, before work begins. Payment is blocked until L&I approves the Intent.

#### Affidavit of Wages Paid (portal manual entry -- submission assist generates structured summary)

| Field | Required | Source in DB |
|-------|----------|--------------|
| Intent ID | Yes | projects.wa_intent_id (new column) |
| Project name and number | Yes | projects |
| Date work completed | Yes | Last payroll week date or new field |
| Per worker: name and address | Yes | workers |
| Per worker: trade and occupation | Yes | trade_classifications |
| Per worker: straight time rate | Yes | payroll_entries.baseRateSnapshot |
| Per worker: hourly benefit rate | Yes | payroll_entries.fringeRateSnapshot |
| Per worker: total ST and OT hours | Yes | Aggregated from all payroll_entries for this project |
| Per worker: total gross wages | Yes | Aggregated from payroll_entries.grossWage |
| Per worker: itemized deductions | Yes | Aggregated from deduction fields |

Filing timing: After project completion. Retainage cannot be released until all affidavits are L&I-approved (45-60 day window post-completion).

#### WA Certified Payroll XML (schema: official lni.wa.gov/xmlschema.xsd -- HIGH confidence)

Root: WaPWCPR. Links to approved intent via projectIntent > intentId.

| XML Element | Required | Notes |
|-------------|----------|-------|
| projectIntent > intentId | Yes | Blocks upload if absent; stored in projects.wa_intent_id |
| payrollWeek > endOfWeekDate | Yes | ISO date yyyy-mm-dd |
| payrollWeek > noWorkPerformFlag | Conditional | true for no-work weeks |
| payrollWeek > amendedFlag | Conditional | true if amendment_number IS NOT NULL |
| employee > firstName / lastName | Yes | |
| employee > ssn | Yes | Masked placeholder; flag in pre-flight |
| employee > address1 / city / state / zip | Yes | |
| employee > grossPay | Yes | |
| tradeHoursWage > trade | Yes | 4-letter code; validated against XSD enum |
| tradeHoursWage > jobClass | Conditional | Required if not apprentice |
| tradeHoursWage > county | Yes | Required per trade entry; from projects.county |
| tradeHoursWage > regularHourRateAmt | Yes | baseRateSnapshot |
| tradeHoursWage > overtimeHourRateAmt | Conditional | Required if OT hours present |
| tradeHoursWage > hourlyPensionRateAmt | Yes | 0.00 if none |
| tradeHoursWage > hourlyMedicalAmt | Yes | 0.00 if none |
| tradeHoursWage > hourlyVacationAmt | Yes | 0.00 if none |
| tradeHoursWage > hourlyHolidayAmt | Yes | 0.00 if none |
| tradeHoursWage > apprenticeBenefitAmt | Yes | 0.00 if not apprentice |
| tradeHoursWage > apprenticeFlg | Yes | boolean |
| tradeHoursWage > apprenticeId | Conditional | Required if apprenticeFlg=true |
| tradeHoursWage > apprenticeState | Conditional | WA / OR / MT / AK; required if apprenticeFlg=true |
| tradeHoursWage > apprenticeOccpnName | Conditional | Required if apprenticeFlg=true |
| tradeHoursWage > apprenticeStepName | Conditional | Required if apprenticeFlg=true |
| tradeHoursWage > apprenticeStepBeginHours | Conditional | Required if apprenticeFlg=true; integer |
| tradeHoursWage > apprenticeStepEndHours | Conditional | Required if apprenticeFlg=true; integer |
| tradeHoursWage > regularDay1Hours to Day7Hours | Optional | Daily ST hours; 0-24, 2 decimals |
| tradeHoursWage > overtimeDay1Hours to Day7Hours | Optional | Daily OT hours |

---

### Feature Dependencies (v2.5)

```
CA eCPR XML Generation
    requires --> dir_project_id on projects [new column]
    requires --> awarding_agency on projects [new column]
    requires --> contract_number on projects [new column]
    requires --> CA fringe disaggregation [new columns on payroll_entries + CA entry UI changes -- LARGEST SCOPE ITEM]
    requires --> user FEIN stored [verify existing; add field if missing]

CA eCPR XML Download
    requires --> CA eCPR XML Generation

CA Pre-flight Validation
    enhances --> CA eCPR XML Download (prevents rejected uploads)

WA Certified Payroll XML Generation
    requires --> wa_intent_id on projects [new column]
    requires --> awarding_agency on projects [shared with CA]
    requires --> contract_number on projects [shared with CA]
    requires --> estimated_end_date on projects [new column]
    requires --> all apprentice sub-fields stored on workers [audit v2.0/v2.4 DB -- gap likely]

WA Submission Assist Summary
    requires --> WA project data (all v2.4 fields present)
    requires --> awarding_agency, contract_number, estimated_end_date [new columns]

WA Pre-flight Validation
    enhances --> WA Certified Payroll XML Generation
```

**Dependency notes:**

- CA fringe disaggregation is the largest new scope item. Single fringeRateSnapshot must be split into four separate fringe fields in the CA payroll entry form. This requires a DB migration (add-only), UI changes to CA payroll entry, and XML generator logic reading four fields. Existing CA payroll entries with the old single value need a migration strategy -- recommended: add new columns with NULL default and require users to fill them in going forward; show a warning on older entries in the pre-flight check.
- SSN masking is a fixed constraint. Both CA and WA XML technically require full SSN, but the app does not store full SSNs by design. Resolve with a pre-flight warning explaining the limitation. Do NOT add full SSN storage.
- dir_project_id, wa_intent_id, awarding_agency, contract_number, estimated_end_date are all small new columns on the projects table. Audit existing schema before writing migrations -- some may already exist from v2.4 work.
- Apprentice sub-fields: v2.0 added J/RA flag; v2.4 captured additional data for WA. Audit workers/trade_classifications tables for apprenticeId, apprenticeState, apprenticeOccpnName, apprenticeStepName, apprenticeStepBeginHours, apprenticeStepEndHours before building the WA XML generator.

---

### New DB Columns Required for v2.5

| Column | Table | Purpose | State |
|--------|-------|---------|-------|
| dir_project_id | projects | CA DIR portal project ID (from awarding agency) | CA |
| ca_fringe_health_welfare | payroll_entries | CA fringe disaggregation: health and welfare hourly rate | CA |
| ca_fringe_pension | payroll_entries | CA fringe disaggregation: pension hourly rate | CA |
| ca_fringe_vacation | payroll_entries | CA fringe disaggregation: vacation hourly rate | CA |
| ca_fringe_training | payroll_entries | CA fringe disaggregation: training fund hourly contribution | CA |
| wa_intent_id | projects | WA L&I-assigned Intent ID after portal approval | WA |
| awarding_agency | projects | Name of awarding public agency | CA + WA |
| contract_number | projects | Contract or purchase order number | CA + WA |
| estimated_end_date | projects | Project estimated completion date | WA |

Verify each against current schema before writing migrations. Use add-only migrations per project constraints (never drop columns).

---

### MVP for v2.5

#### Ship in This Milestone

- [ ] CA fringe disaggregation: new DB columns and CA payroll entry UI fields and migration -- required blocker for valid CA XML
- [ ] DIR Project ID, awarding agency, contract number fields on CA project detail -- required for XML
- [ ] CA eCPR XML generation and download (per week, with pre-flight validation) -- core CA deliverable
- [ ] WA Intent ID, awarding agency, contract number, estimated end date fields on WA project detail -- required for WA
- [ ] WA submission assist summary page (Intent pre-fill and Affidavit summary) -- core WA deliverable
- [ ] WA certified payroll XML generation and download (with pre-flight validation) -- high-value WA deliverable

#### Defer to Future Milestone

- [ ] CA amendment XML support -- base export must be validated by real users first
- [ ] Export history log (per-week download tracking) -- useful but not blocking
- [ ] State-specific prevailing wage rate integration -- separate milestone, large scope

---

### v2.5 Sources

- [CA DIR CPRSample.xml (official)](https://www.dir.ca.gov/Public-Works/CPR/CPRSample.xml) -- authoritative CA XML element names and structure
- [CA DIR eCPR XML Guidelines (Jan 2016)](https://www.dir.ca.gov/Public-Works/CPR/eCPRXMLGuideline.pdf) -- confirmed stable schema
- [CA DIR eCPR Certified Payroll Reporting page](https://www.dir.ca.gov/public-works/certified-payroll-reporting.html)
- [CA DIR eCPR FAQ (SB 854)](https://www.dir.ca.gov/Public-Works/ecprfaq.html)
- [Sunburst Software -- 2024 CA DIR changes (June 2025)](https://www.sunburstsoftwaresolutions.com/2024-ca-dir.htm) -- confirmed XML schema unchanged through 2024 overhaul
- [WA L&I official XML schema (XSD)](https://www.lni.wa.gov/licensing-permits/_docs/xmlschema.xsd) -- parsed directly; all WA XML field names are HIGH confidence
- [WA L&I PWIA step-by-step instructions](https://lni.wa.gov/licensing-permits/_docs/pwia-step-by-step-instructions.pdf)
- [WA L&I contractors/employers page](https://lni.wa.gov/licensing-permits/public-works-projects/contractors-employers/)
- [MRSC -- Navigating Intents and Affidavits (March 2025)](https://mrsc.org/stay-informed/mrsc-insight/march-2025/intents-affidavits-prevailing-wages) -- Intent/Affidavit timing and payment dependency
- [Murow DC -- DIR eCPR Upload Guide](https://murowdc.com/dir-registration-and-uploads/ecpr-upload/) -- Contractor-facing eCPR upload field requirements
- [Points North -- Washington Prevailing Wage](https://www.points-north.com/state-by-state-certified-payroll-reporting/washington) -- WA trade codes and certified payroll record requirements

---

*Feature research for: HCC Prevailing Wage -- v2.5 CA eCPR XML export and WA PWIA submission assist*
*Researched: 2026-03-26*
