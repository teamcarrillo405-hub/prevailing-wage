# UI/UX Superiority Execution Plan

Date: 2026-05-04

Goal: make PrevWage the easiest and most confidence-building prevailing wage platform for construction contractors. The product should feel faster and clearer than Knowify, less bureaucratic than B2Gnow/eComply, more complete than FLC/FLAG wage lookup, and more transparent than Miter on source logic, blockers, evidence, and corrections.

## North Star

A construction contractor should be able to complete this flow without training:

1. Create account with HCC membership number.
2. Complete onboarding once.
3. Create a public works project.
4. Confirm the system-selected wage determination.
5. Add or import workers.
6. Enter or import payroll.
7. Resolve clear blockers.
8. Export the correct certified payroll package.
9. Download an evidence packet.

If a user has to understand compliance jargon before the product helps them, the UX has failed.

## Hard Competitive Standard

| Competitor | Their UI/UX advantage | Our required counter |
| --- | --- | --- |
| FLC/FLAG wage tools | Official source trust. | Show source provenance everywhere: WD number, modification, county, construction type, source date, sync date, and confidence. |
| Knowify | Contractor-friendly construction workflow, job costing, time tracking, QuickBooks story. | Make project setup, payroll import, QuickBooks shell, and rate logic feel like one contractor workflow instead of separate compliance pages. |
| B2Gnow/eComply | Enterprise compliance depth, CPR collection, statuses, agency trust. | Make the contractor path lighter: fewer steps, direct blocker fixes, stronger plain-English explanations, and audit packets. |
| Miter | Strong "automatic payroll and certified reports" promise. | Prove automation in-product: auto-rate from WD, auto-fringe, auto-blocker explanation, auto-export checklist, visible audit trail. |

## Product Design Principles

1. Contractor first, admin second.
2. One primary action per page.
3. Automatic first, manual override second.
4. Every calculated rate must show its source.
5. Every blocker must have a direct fix path.
6. Every workflow should end in a contractor artifact: WH-347, state export, evidence packet, or status proof.
7. Copilot must know the page, explain the issue, and propose safe corrections.
8. Advanced settings should never crowd the daily contractor workflow.

## Superiority Score Gates

The product is not superior until these gates pass.

| Gate | Passing standard |
| --- | --- |
| First-time project setup | A new contractor can create a project and confirm the correct WD in under 5 minutes. |
| First clean payroll | A contractor can create/import a payroll week, fix one seeded error, and export WH-347 in under 10 minutes. |
| Rate confidence | Every worker rate shown in payroll displays source WD/mod/classification and manual override state. |
| Blocker correction | Clicking any blocker lands on a visible fix panel with the exact field/action needed. |
| Navigation clarity | Primary nav has no more than 7 contractor-facing items; admin/API/security settings are grouped. |
| Evidence confidence | Payroll week page shows evidence completeness and one evidence packet action. |
| Copilot usefulness | On each core page, copilot can identify the page, summarize the user's next action, and prepare safe fixes. |
| Demo trust | No dead links, fake videos, placeholder testimonials, or unsupported direct-submission claims. |

## P0: Demo-Superior UI Fixes

These are the next build items because they directly affect demos and investor confidence.

1. Fix broken public trust routes.
   - Add `/reviews` route or remove every `/reviews` link.
   - Remove or replace placeholder video/testimonial claims.
   - Acceptance: no public nav/footer link falls through wildcard redirect.

2. Simplify authenticated navigation.
   - Keep daily contractor nav visible: Projects, Field, Wage Lookup, Reports, Team, Integrations.
   - Move Security, API Keys, Webhooks, Billing, Coverage, Copilot, Growth, and admin pages into Settings/Admin grouping.
   - Acceptance: contractor can identify daily work path in 3 seconds.

3. Create a "Today" dashboard lane.
   - Top of dashboard shows: overdue payroll, payroll due this week, missing WD, zero/missing rates, rejected/missing subcontractor CPRs, and ready-to-submit weeks.
   - Acceptance: user sees the next action without scrolling.

4. Make project setup wage-first.
   - Project creation should automatically open the likely WD confirmation step when state/county/type are known.
   - The project page should show "Primary wage source" above secondary metadata.
   - Acceptance: no user has to manually hunt for wage lookup after project creation.

5. Make all payroll blockers corrective.
   - Blocker cards must include action label, destination, and plain-English expected result.
   - If the blocker is WD-related, land on the WD panel with a clear "Confirm this WD" control.
   - If the blocker is rate-related, land on the worker/payroll row with the rate source and fix.
   - Acceptance: blocker click always reveals the exact fix target above the fold.

6. Expose rate provenance everywhere rates appear.
   - Show base, fringe, source, WD mod, labor type, apprentice percentage source, and override status.
   - Acceptance: Elena/Jose-style zero-rate confusion cannot happen silently.

7. Improve landing page proof.
   - Replace gradient placeholder with product screenshot or real construction image plus visible product UI.
   - Add a concise workflow strip: Set up project, confirm WD, import payroll, fix blockers, export package.
   - Replace unsupported testimonials with demo-safe proof or label them as scenario examples.
   - Acceptance: homepage proves product workflow in the first viewport.

8. Upgrade copilot from chat to page assistant.
   - Page context is already wired; next step is page-specific suggested actions.
   - Acceptance: copilot opens with a page-aware prompt and can prepare a safe correction where allowed.

## P1: Launch-Superior Workflows

1. Guided project setup wizard.
   - Split project setup into contractor-friendly sections: project basics, funding/rule type, location, wage source, defaults, imports.
   - Preserve advanced fields behind "More settings."

2. Import reconciliation center.
   - One screen for mapped/unmapped workers, classifications, rates, fringes, deductions, and projects.
   - Show exact correction needed before payroll review.

3. Required forms checklist.
   - For each project/week, show WH-347 and state/local export requirements supported by the app.
   - Be explicit when direct portal submission is not supported.

4. Subcontractor operations board.
   - Prime view by week: not invited, invited, draft, submitted, rejected, accepted, non-performance.
   - Add resend/reminder and correction request actions.

5. Evidence packet preview.
   - Human-readable packet view before download.
   - Include WD source, payroll, corrections, photos/GPS, signatures, and audit events.

6. Mobile field polish.
   - Field clock and evidence capture must be thumb-friendly, offline-tolerant, and fast.
   - Admin corrections should be clear and audit-logged.

## P2: Market Moat

1. Compliance brain with cited reasoning.
   - Retrieval over DOL/SAM wage docs, WH-347 guidance, project data, and product docs.
   - Clear line between legal information and workflow recommendation.

2. Integration marketplace.
   - QuickBooks live OAuth, Procore import, spreadsheet templates, payroll provider profiles.

3. Portal export profiles.
   - LCPtracker/eComply-style field exports where practical.
   - Submission history and export manifest retained.

4. Predictive compliance.
   - Underpayment exposure, fringe strategy, overtime exposure, apprentice ratio risk, rejection risk.

## Page-Level Build Plan

| Page | Current issue | Required fix |
| --- | --- | --- |
| Landing | Strong message but weak visual proof and placeholder trust elements. | Real product workflow visual, proof strip, no unsupported testimonials, no dead links. |
| Register/onboarding | Good direction, but must clearly use HCC membership and business defaults. | Make onboarding answers visibly drive project/import defaults. |
| Dashboard | Powerful but dense. | Add top "Today" lane and reduce scroll to first action. |
| New project | User can feel sent away to wage lookup. | Confirm WD as part of setup, then return to project ready state. |
| Project detail | Too many similar actions compete. | Promote Primary Wage Source, Workers, Payroll, Evidence. Demote secondary tools. |
| Wage lookup | Useful expert tool. | Keep as expert/backup, with stronger project handoff and copy-to-project actions. |
| Workers | Rate/classification complexity can confuse users. | Labor type first, then trade/classification, then system-derived rate source. |
| Payroll week | Most important page. | Submit-ready score, corrective blockers, rate provenance, required forms, evidence packet. |
| Field clock | GPS/time corrections must match field reality. | Address-based/geofence support, admin correction flow, clearer audit wording. |
| Reports | Valuable but secondary. | Focus on compliance risk, exports, underpayment prevented, sub status. |
| Settings/admin | Too visible in daily nav. | Group behind settings/admin so contractors are not distracted. |

## Implementation Order

1. Fix dead `/reviews` route and public trust placeholders. **Done 2026-05-04.**
2. Simplify authenticated navigation. **Done 2026-05-04.**
3. Add dashboard Today lane. **Done 2026-05-04.**
4. Promote project wage source and project next action hierarchy.
5. Add rate provenance component and use it in workers/payroll. **Done 2026-05-04 for core worker/payroll displays.**
6. Make blocker destinations land on visible fix panels. **Started 2026-05-04: payroll blocker clicks now show a visible fix-target banner and scroll/highlight the affected section or row.**
7. Add landing page product workflow visual/proof section. **Started 2026-05-04: hero now shows the four-step contractor workflow in the first viewport.**
8. Expand copilot page-specific suggested actions. **Started 2026-05-04: Copilot now shows page-specific helper prompts for dashboard, project, workers, payroll, wage lookup, field clock, and settings pages.**
9. Add required forms checklist.
10. Add evidence packet preview. **Done 2026-05-16: evidence packet preview filters, manifest, expanded packet contents, and required-vs-collected navigation are in place.**
11. Polish mobile field capture. **Done 2026-05-16: Field Clock now separates capture, correction, source filtering, offline status, and review labels.**
12. Run 50-scenario contractor QA and compare against score gates.

## Acceptance Test Matrix

| Test | Must pass |
| --- | --- |
| Public route test | `/`, `/login`, `/register`, `/pricing`, `/reviews`, `/case-studies`, `/contact`, `/security`, `/api-docs` load without wildcard redirect. |
| Contractor nav test | New user can find Projects, Field, Wage Lookup, Reports, Team, Integrations without reading docs. |
| First project test | Create federal project and confirm WD without leaving user confused. |
| Zero-rate test | Worker/payroll rows cannot show zero base rate without an explanation and fix action. |
| Blocker test | Every blocker click lands on a visible fix area with the field/action highlighted or explained. |
| Copilot context test | Copilot knows page name, project/week context, visible blockers, and next step. |
| Mobile test | Dashboard, project, workers, payroll, field clock, and sub upload work at 375px. |
| Competitor demo test | In 10 minutes, demo proves something Knowify/Miter/eComply do not show as clearly: source-proven rates, corrective blockers, and audit-ready packet. |

## Implementation Log

### 2026-05-04 P0 Slice

- Added `/reviews` as a real public route served by the reviews/testimonials page.
- Updated page inventory so `/reviews` is no longer listed as a broken wildcard route.
- Simplified authenticated desktop navigation to contractor-first daily paths: Projects, Field, Wage Lookup, Reports, Team, Integrations, Settings.
- Grouped Security, API Keys, Webhooks, SSO, MFA, Billing, Coverage Admin, and Copilot Audit under Settings/Admin instead of crowding daily work.
- Added a dashboard "Today" lane above the fold with urgent fixes, payroll due, setup gaps, subcontractor CPR gaps, and clean project count.
- Removed fake video embed from the reviews page and replaced it with demo proof cards.
- Replaced "name withheld" public trust placeholders with explicitly labeled demo scenarios.
- Added first-viewport landing workflow proof: set up project, confirm WD, check payroll, export package.
- Added first-pass rate-source hints on worker classifications and payroll week rate cells, including explicit zero-rate fix language.
- Verified with `npm run build`.

### 2026-05-04 P0 Continuation

- Added reusable `RateProvenance` UI component for consistent base/fringe/source/override/missing-rate language.
- Applied `RateProvenance` to worker classification rates and payroll week rate snapshots.
- Added a visible payroll fix-target banner after clicking submit-ready blockers so users know what section or row they were sent to fix.
- Strengthened Required Forms guidance with explicit portal-language: PrevWage prepares the package and evidence trail; users still upload to eComply, LCPtracker, DIR, L&I, or other portals unless a live integration is configured.
- Verified with `npm run build`.

### 2026-05-04 Copilot/Evidence Pass

- Confirmed the Evidence Dashboard already previews packet readiness, required vs collected evidence, weekly proof, and JSON/CSV packet exports.
- Added page-specific Copilot prompts so the assistant guides users differently on dashboard, project, workers, payroll, wage lookup, field clock, and settings pages.
- Verified with `npm run build`.

### 2026-05-16 Competitive/MVP Readiness Pass

- Updated the competitive scorecard against LCPtracker, eMars, PRISM, Prevail, and WagePath using current public/official product pages.
- Marked the evidence packet preview as complete for MVP: required-vs-collected evidence boxes navigate to filtered details, packet exports include an audit manifest, and JSON/CSV packets include WD, workers, payroll, corrections, forms, photos, GPS/time, signatures, subcontractor evidence, certifications, and submission history.
- Marked mobile field capture polish as complete for MVP: Field Clock now labels worker GPS, worker no-GPS, admin-entered, and admin-corrected evidence with review status and offline capture state.
- Added integration readiness visibility for live OAuth versus CSV/import fallback so demos do not imply live QuickBooks/Procore availability without configured credentials.

## Claim We Can Make After P0

"PrevWage is a contractor-first prevailing wage command center that confirms wage determinations, applies source-proven rates, catches payroll blockers before submission, guides corrections with Copilot, and prepares audit-ready certified payroll packages."

## Claims To Avoid Until Built

- Direct submission to every agency portal.
- Complete replacement for eComply/LCPtracker when a contract requires those portals.
- Full state/local coverage beyond supported forms and rules.
- Legal advice.
- Fully autonomous payroll correction without user approval.
