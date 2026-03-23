# Feature Research

**Domain:** Prevailing wage compliance management — contractor-facing certified payroll submission tooling
**Researched:** 2026-03-19 (functional features) / 2026-03-20 (UI design + landing page) / 2026-03-23 (v2.3 workflow efficiency + audit readiness)
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
