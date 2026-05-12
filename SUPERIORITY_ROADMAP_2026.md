# Prevailing Wage Superiority Roadmap 2026

Date: 2026-05-02

Purpose: define what currently beats us, what the main competitors still do not appear to solve well, and the concrete build plan to make this product superior for construction contractors.

## Positioning Decision

We should not try to become another agency-first compliance portal. The winning product is contractor-first: it helps a contractor import payroll, match the right wage determination, catch mistakes before submission, fix the data, create the required package, chase subcontractors, and explain every issue in plain language.

The market already has mature compliance systems. Our advantage has to be workflow intelligence, simplicity, and correction speed.

## What Beats Us Today

| Competitor | Where they beat us | Why it matters | What we need to neutralize it |
| --- | --- | --- | --- |
| Knowify | Construction operations, QuickBooks workflow, job costing, time tracking, project management, invoices, WIP-style contractor finance. | Contractors already live in accounting and job-cost workflows. If compliance feels separate, they will resist it. | Strong QuickBooks path, job-cost-aware prevailing wage checks, onboarding defaults, import reconciliation, and a demo lane that starts with contractor data. |
| B2Gnow / eComply | Agency-grade labor compliance, certified payroll collection, subcontractor profile setup, CPR/CHR submission training, dashboards, audits, vendor/compliance ecosystem. | Public owners, primes, and agencies trust systems that collect from many contractors and provide audit evidence. | Prime/subcontractor workflow, reviewer status board, audit-ready evidence packages, agency/export compatibility, and contractor training that does not require an hour-long course. |
| LCPtracker | Mature certified payroll, workforce reporting, prime/agency/subcontractor roles, daily reporting, field interviews, payroll partner ecosystem, public-agency adoption. | It is already embedded in many public jobs, so contractors may be required to use it. | Export/import compatibility, agency-ready packages, payroll connectors, mobile field evidence, and a faster pre-check layer that prevents rejected submissions. |
| FLC / FLAG wage search | Official federal OFLC wage data authority and national downloadable wage data for immigration-related prevailing wage. | Buyers trust official data. Even when it is not the same as Davis-Bacon construction wage determinations, official data creates credibility expectations. | Show data provenance, sync status, source timestamps, county/state coverage, and explain the difference between DBA construction wage determinations and OFLC wage data. |

## Competitor Gaps We Can Exploit

These are the gaps where public product materials suggest there is room to win. Some competitors may have partial private features, so these should be framed as product opportunities, not claims that they definitely lack every capability.

| Gap | Why it matters for contractors | Build response |
| --- | --- | --- |
| Contractor-first AI compliance copilot | Most tools still require the user to understand compliance screens and manually resolve rejected payroll. | Copilot should inspect the selected project/week, explain the issue, propose a fix, apply allowed changes, and leave an audit trail. |
| Pre-submission rejection prevention | Contractors lose time when errors are discovered after upload to an agency portal. | Build a "submit-ready" score, blocker list, estimated dollar impact, and one-click repair workflow before export/submission. |
| Wage determination provenance and confidence | Contractors need to know which WD, modification, county, classification, and fringe basis drove the result. | Every rate decision should show source, timestamp, county/project match, mod number, and confidence/warning state. |
| Import reconciliation across payroll systems | Real contractors have messy QuickBooks, ADP, Paychex, Sage, Gusto, spreadsheet, and PDF workflows. | Build a reconciliation center that maps workers, classes, jobs, counties, fringes, apprentices, deductions, and unmapped rows before payroll review. |
| Subcontractor chase automation | Prime contractors often spend more time chasing missing or corrected CPRs than calculating their own payroll. | Add subcontractor status, due dates, reminders, resend requests, non-performance weeks, exception notes, and escalation history. |
| Evidence packet, not just form generation | Contractors need a defensible package if audited. | Generate a project/week packet: WH-347, statement of compliance, WD source, classifications, fringe basis, worker time, photos/signatures, notes, and corrections. |
| Plain-language business impact | Existing compliance tools often tell users what is wrong, not what it will cost or how to fix it. | Show underpayment exposure, missing data, likely rejection reason, and recommended next step in contractor language. |
| Fast demo and self-service onboarding | Hour-long training is a barrier for small contractors. | "First clean payroll in 10 minutes" path using HCC membership, company profile, accounting system, trade defaults, sample import, and guided fix. |
| Construction-specific field evidence | Mobile daily logs and field interviews exist, but contractor-side evidence is often not tied tightly to payroll corrections. | Tie photos, worker attestations, GPS/time punches, foreman notes, and daily reports directly to the payroll week and compliance exceptions. |
| Transparent launch readiness | Buyers and investors need to see exactly what is live, seeded, tested, and still roadmap. | Maintain readiness matrix, source coverage report, test status, and demo script as product assets. |

## Superior Product Strategy

The goal is to combine:

- Knowify's contractor ease and accounting workflow.
- B2Gnow/eComply and LCPtracker's compliance depth and audit expectations.
- A new AI-guided correction layer that helps construction contractors get to a clean, defensible payroll package faster.

Our product should become the contractor's prevailing wage command center, even when the final submission must still happen in another agency portal.

## P0: Demo Superiority

Target: a demo-ready product that clearly feels easier and smarter than the alternatives.

1. Guided first-clean-payroll lane
   - Seed one realistic contractor, one federal project, one subcontractor, one payroll week with intentional errors, and one corrected package.
   - Dashboard CTA: "Get this week submit-ready."
   - Completion output: WH-347 package plus evidence and source summary.

2. Submit-ready score
   - Project/week score with blockers, warnings, and passed checks.
   - Checks should include WD assigned, worker classification mapped, county match, base/fringe minimums, apprentice flag, overtime warning, missing signature, missing subcontractor CPR, and export readiness.

3. Copilot repair center
   - The copilot should detect actionable items, explain why they matter, and apply safe fixes only after user approval.
   - Safe P0 actions: assign missing WD when project match is clear, fill zero rates from WD, recompute totals, mark non-performance week draft, prepare import review prompts.
   - Every applied fix must create an audit event.

4. Import reconciliation center
   - Handle QuickBooks/spreadsheet-style import problems before payroll review.
   - Required mappings: worker, project, week ending, job classification, regular/overtime hours, base rate, fringe cash, fringe plan, deductions.
   - Show unmapped rows and suggested corrections.

5. Contractor onboarding intelligence
   - Use HCC membership number, trade type, usual counties, employee count, payroll provider, accounting software, union/non-union, apprenticeship usage, and subcontractor usage.
   - Use answers to preselect defaults for projects, imports, classifications, and demo guidance.

6. Evidence packet
   - Generate a project/week folder-style view with forms, WD source, modification data, worker payroll, correction history, signatures, notes, and attachments.
   - The packet should be downloadable and investor-demo friendly.

7. Subcontractor status board
   - Show each subcontractor's CPR status: not invited, invited, draft, submitted, rejected, accepted, non-performance.
   - Add reminders, due dates, missing item notes, and resend request.

8. Landing page proof
   - Homepage should say exactly what the system does for construction contractors.
   - Show the demo promise: import payroll, verify rates, fix issues, export audit-ready certified payroll.
   - Avoid overclaiming direct government submission until it is actually built.

## P1: Launch Superiority

Target: a product contractors can use on live federal Davis-Bacon work with confidence.

1. Real QuickBooks Online integration
   - OAuth, company connection, project/customer import, employee import, time/payroll import, sync audit log.

2. Payroll ecosystem compatibility
   - Spreadsheet templates for ADP, Paychex, Gusto, Sage, QuickBooks, and generic payroll exports.
   - Later: direct connectors where APIs make business sense.

3. Agency-ready exports
   - WH-347 package.
   - CSV/XLSX formats aligned for common upload workflows.
   - Export profile templates for LCPtracker/eComply-style fields where legally and technically practical.

4. Reviewer portal
   - Prime contractor and internal reviewer roles.
   - Approve/reject week, request correction, comment thread, full audit history.

5. Apprenticeship and special rules engine
   - Apprentice ratios, proof requirements, trainee/apprentice classification warnings, fringe basis differences, overtime rules, paid holiday warnings where applicable.

6. Mobile PWA field evidence
   - Foreman-friendly daily logs, worker sign-off, photo capture, GPS/time context where appropriate, offline draft support.

7. Trust and security hardening
   - Role-based access controls, tenant isolation tests, immutable audit events for compliance actions, backup/restore documentation, SOC 2 readiness checklist.

8. Launch operations
   - Demo seed command, support playbook, onboarding checklist, known limitation page, source sync report, and legal/compliance disclaimer.

## P2: Market Moat

Target: capabilities that make the system meaningfully harder to copy.

1. Compliance brain with cited reasoning
   - Retrieval over DOL, WHD, wage determinations, CFR references, state/local rules when expanded, internal product docs, and customer project data.
   - Answers must cite sources and separate legal information from recommended workflow.

2. Predictive compliance and job-cost forecasting
   - Estimate underpayment exposure before payroll is finalized.
   - Forecast fringe cash/plan decisions, overtime exposure, and classification mix cost.

3. Multi-state expansion factory
   - State/local rule modules with source provenance, effective dates, test fixtures, and review workflow.

4. Integration marketplace
   - QuickBooks, payroll providers, time clocks, document storage, e-signature, and public portal export profiles.

5. Compliance analytics
   - Repeat error patterns, subcontractor reliability, time-to-approval, rejection causes, underpayment prevented, and project risk ranking.

## Engineering Build Order

This is the next logical order because each step strengthens the demo and supports launch.

1. Add submit-ready score service and tests.
2. Add submit-ready panel to payroll week and dashboard.
3. Expand copilot actions to consume submit-ready findings.
4. Build import reconciliation page and mapping persistence.
5. Add evidence packet page and downloadable package manifest.
6. Build subcontractor status board and reminders.
7. Add QuickBooks connection shell with OAuth-ready architecture and mock/demo mode.
8. Add export profiles for WH-347 and generic agency upload.
9. Add mobile field evidence polish.
10. Add trust/readiness page for demo and investor review.

## Definition Of Superior

We can credibly say we are superior when the system can demonstrate these outcomes:

- A construction contractor can create an account with HCC membership and complete onboarding without subscription friction.
- A contractor can create or import a federal Davis-Bacon project and see the wage determination source, county coverage, and modification status.
- A payroll week can be imported, checked, corrected, signed, and exported with less manual compliance knowledge than the current market requires.
- The system catches rate, fringe, classification, missing WD, missing signature, missing subcontractor CPR, and import mapping problems before submission.
- Copilot can explain and apply safe corrections with audit history.
- Prime contractors can see subcontractor payroll status and chase missing/corrected CPRs.
- The evidence packet is strong enough to support demo, audit review, and investor diligence.
- The product clearly states source coverage, limitations, and what is not yet direct government submission.

## Demo Claim Now

Safe claim after the current hardening work:

"We are building a contractor-first prevailing wage command center that imports payroll, verifies Davis-Bacon wage logic, flags issues, guides corrections with an AI copilot, and prepares audit-ready certified payroll evidence."

Avoid claiming:

- Direct submission to every agency portal.
- Full replacement for LCPtracker/eComply when a project contract requires those portals.
- Legal advice.
- Complete state/local prevailing wage coverage before the state/local rule modules are built.

## Sources Reviewed

- Knowify QuickBooks construction integration: https://knowify.com/quickbooks/
- Knowify integrations and payroll ecosystem: https://knowify.com/integrations/
- B2Gnow/eComply labor compliance and certified payroll management: https://b2gnow.com/
- B2Gnow eComply contractor training overview: https://help.b2gnowsupport.com/hc/en-us/articles/42223895051540-eComply-Contractor-Training-Program
- LCPtracker solutions for certified payroll, agencies, primes, subcontractors, daily reporting: https://lcptracker.com/solutions/
- DOE weekly DBA payroll tracking with LCPtracker: https://www.energy.gov/infrastructure/weekly-dba-payroll-tracking-lcptracker
- DOL OFLC wage data downloads: https://flag.dol.gov/wage-data/wage-data-downloads
- DOL OFLC wage search: https://flag.dol.gov/wage-data/wage-search

