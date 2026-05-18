# Prevailing Wage Finish Plan

Last updated: 2026-05-16

## Mission

Finish the Prevailing Wage platform as a contractor-first prevailing wage command center for federal, state, and local prevailing wage work that is easier to use than current market tools while remaining accurate, auditable, and production-pilot ready.

The system must help a contractor answer, without guesswork:

- What rules apply to this project?
- Which jurisdiction controls the project: federal, state, local, or a layered combination?
- Who worked, when, and under which classification?
- Were workers paid correctly, including overtime, fringe, deductions, contributions, apprenticeship rules, and non-performance time?
- What forms must be submitted?
- What evidence exists, what is missing, and what needs correction?
- Can a reviewer or auditor understand the record without editing payroll data?

## Current Baseline

As of 2026-05-16:

- `npm run build` passed.
- `npm test -- --run` passed.
- Full section UI audit reported `lowestScore: 10` and `notTen: []`.
- Recent work improved Project Settings, Payroll Week, Project Home, Field Clock, navigation, readiness panels, fix actions, PDF alignment, and UI polish.

Do not regress this baseline.

## Definition Of Done

The project is not finished until all of these are true:

- Build passes: `npm run build`.
- Tests pass: `npm test -- --run`.
- Full browser UI audit passes with every reviewed section at `10/10`.
- No route has obvious dead buttons, broken links, console errors, horizontal overflow, hidden primary actions, unusable mobile layouts, or redundant repeated panels.
- Every compliance blocker or warning explains the exact issue and has a fix action that lands on the exact field or section.
- Payroll imports, manual entries, deductions, contributions, fringe credits, gross pay, net pay, overtime, and form totals reconcile.
- Generated WH-347, CA A-1-131, CPR packages, reports, and evidence packets match source data, calculate correctly, and are visually aligned.
- Every generated form has a calculation verification test and a visual placement verification pass.
- Required forms, evidence packet, CPR submission, and reviewer/auditor flows work from realistic project data.
- State-specific language and preflight messages are clear enough for a contractor user.
- Public/product claims are accurate and do not overstate legal, agency, integration, or security capabilities.
- The platform is ready for a California production pilot using at least 5 workers, 2 payroll weeks, 1 subcontractor, required forms, evidence uploads, exports, and reviewer signoff.
- The platform has a mapped expansion path from California pilot to federal Davis-Bacon, state prevailing wage, and local ordinance workflows.

## Calculation Accuracy Contract

Calculation correctness is a release blocker. Do not treat a form or report as complete because it visually looks correct.

For every payroll week, worker, classification, jurisdiction, and generated output, verify:

- Regular hours.
- Overtime hours.
- Double-time hours where applicable.
- Non-performance or no-work classifications where applicable.
- Base hourly rate.
- Fringe benefit rate.
- Hourly fringe credit.
- Cash fringe paid.
- Employer-paid benefit contributions.
- Employee deductions.
- Taxes if captured or imported.
- Union dues if captured or imported.
- Health, pension, vacation, training, and other benefit deductions or contributions.
- Gross wages.
- Total deductions.
- Net wages.
- Total package value.
- Apprentice ratio or apprentice rule checks where applicable.
- Week-ending dates.
- Project, contractor, subcontractor, worker, classification, and awarding agency identity.

Rules:

- Source payroll data must remain traceable from import/manual entry through validation, reports, forms, and evidence packet.
- Rounding must be consistent, documented, and tested.
- A calculated value must not be duplicated in separate components with separate logic.
- If a value is missing, estimated, manually overridden, or imported from a payroll provider, the UI and audit record must show that source.
- Any mismatch between source payroll, calculated values, and generated form values must block export until resolved or explicitly reviewed.
- The system must distinguish employee deductions from employer contributions and fringe credits.
- The system must not silently infer legally sensitive values when source data is missing.

Acceptance:

- Unit tests cover payroll math, overtime, fringe, deductions, contributions, gross, net, rounding, and jurisdiction-specific rule differences.
- Integration tests verify that the same calculated values appear consistently in payroll screens, reports, WH-347, CA A-1-131, CPR packages, and evidence packet.
- Browser tests confirm mismatch warnings and fix actions work from the UI.
- A five-worker, two-week fixture passes all calculation checks.

## PDF And Form Verification Protocol

Forms and PDFs must pass both data verification and visual verification.

Required checks:

- Every field on WH-347 and CA A-1-131 must map to a named source field or calculated field.
- Each mapped field must have a test fixture showing expected output.
- Numeric fields must use the correct column, format, precision, and sign.
- Text boxes and overlays must be transparent unless the official form requires visible fill styling.
- Font size must fit within the field without clipping.
- Dates, names, classifications, rates, hours, deductions, gross, net, fringe, and signatures must land in the correct locations.
- Blank fields must be intentionally blank, with a reason documented in the mapping.
- Multi-worker and multi-page output must preserve row alignment.
- Download blockers must explain exactly which fields are missing and provide fix actions to the relevant UI section.

Verification steps:

1. Generate forms from the five-worker, two-week pilot fixture.
2. Extract or inspect generated field values where technically possible.
3. Compare generated values against expected fixture totals.
4. Open the generated PDF/form visually.
5. Check alignment, clipping, transparency, text sizing, page breaks, and row order.
6. Fix every mismatch before continuing.

Acceptance:

- Form output is not considered complete until expected source values, calculated values, and visual placement all pass.
- WH-347 and CA A-1-131 each have their own mapping checklist.
- Any future form added to the system must include the same mapping and verification process.

## Autonomous Build Checklist

Before an autonomous agent starts implementation:

- Read `PLAN.md` fully.
- Read the main readiness and UX documents listed in this plan.
- Inspect `package.json`, tests, route structure, payroll calculation code, PDF generation code, and form mapping code.
- Identify the current test commands before editing.
- Create or update a task log while working so each completed phase is traceable.

For each phase:

- Define exact acceptance criteria before editing.
- Locate affected files.
- Implement.
- Add or update tests.
- Run relevant tests.
- Run build.
- Run browser verification for UI changes.
- Run form/PDF verification for output changes.
- Update docs only after behavior is verified.

Do not mark a phase complete if:

- Calculations are untested.
- PDF placement is visually unchecked.
- A blocker says something is wrong but does not identify the exact field or fix.
- A warning remains after the user corrects the underlying data.
- A button or link does not produce the expected result.
- A route is polished visually but confusing in workflow order.

## Codex Features To Enable These Goals

Use Codex as the execution agent for the full finish plan.

Core capabilities to use:

- Local repo inspection: read routes, components, services, tests, PDF generation code, payroll math, schemas, fixtures, and documentation before editing.
- Scoped code edits: update only the files required for the active phase and avoid unrelated refactors.
- Test execution: run unit, integration, build, lint, typecheck, and targeted tests after each phase.
- Browser automation: use Playwright to create projects, workers, payroll weeks, evidence, forms, reports, and submissions through the real UI.
- Visual verification: capture screenshots of important pages and generated outputs to check spacing, alignment, clipping, responsiveness, and workflow clarity.
- PDF/form verification: generate WH-347, CA A-1-131, CPR packages, reports, and evidence packets, then compare mapped values against source data and expected calculations.
- Calculation validation: trace imported/manual payroll values through gross, deductions, contributions, fringe, net pay, reports, and PDFs.
- Regression control: re-run full build, tests, and browser audits after meaningful changes.
- Documentation updates: keep `PLAN.md`, readiness docs, competitive analysis, and pilot UAT notes aligned with actual product behavior.
- GitHub support: review repo state, prepare intentional commits, and push only after verification when instructed.

Recommended Codex workflow:

1. Pick one phase from this plan.
2. Inspect the current implementation.
3. Write down the exact acceptance criteria for that phase.
4. Implement the smallest complete set of changes.
5. Add or update tests and fixtures.
6. Run command-line tests.
7. Run Playwright walkthroughs for affected user flows.
8. Verify calculations and generated forms when payroll or reporting changes.
9. Update documentation.
10. Report completed work, commands run, evidence reviewed, and remaining risks.

Codex should not mark a phase complete based only on code changes. Completion requires working UI behavior, passing tests, and verified output.

## Execution Rules

Work phase by phase. After each phase:

1. Inspect the affected code before editing.
2. Implement the smallest complete improvement that satisfies the acceptance criteria.
3. Add or update focused tests when behavior changes.
4. Run relevant tests.
5. Run `npm run build` and `npm test -- --run` before marking the phase complete.
6. Run browser verification for any UI, PDF, navigation, or workflow change.
7. Update this plan or the relevant readiness document if scope changes.

If the same test fails twice in a row, stop and report the failure, attempted fixes, and likely cause.

Do not delete user data, reset the repo, rewrite unrelated files, or make destructive changes unless explicitly instructed.

## SPARC Methodology

Use SPARC for every new feature or meaningful redesign:

- Specification: define the user, workflow, input data, outputs, risks, and acceptance criteria.
- Pseudocode: outline the state changes, validation logic, navigation, and test cases before implementation.
- Architecture: identify affected files, data contracts, components, services, forms, and generated outputs.
- Refinement: implement in small working slices, removing redundancy and keeping UI focused.
- Completion: verify with tests, browser walkthroughs, screenshots when useful, and documentation updates.

## Phase 0 - Baseline And Audit Infrastructure

Goal: make the project repeatably verifiable.

Tasks:

- Confirm install/build/test commands from `package.json`.
- Run `npm run build`.
- Run `npm test -- --run`.
- Add or promote a tracked full-section Playwright audit script if one is not already tracked.
- The audit should cover the main workflow routes: public landing, dashboard, project list, project home, settings, wage determination, workers, payroll week, imports, evidence, forms, submissions, subcontractors, field clock, reports, reviewer/auditor views, and mobile breakpoints.
- The audit should flag console errors, broken actions, horizontal overflow, unreachable primary actions, missing accessible labels, unusable mobile density, repeated panels, and layout dead space.
- Add an npm script for the full UI audit if the repo does not already have one.

Acceptance:

- Build and unit tests pass.
- Full UI audit can be run by command.
- Audit output clearly reports lowest score, failed sections, and evidence paths.

## Phase 1 - Product Truth, Legal Positioning, And Launch Claims

Goal: ensure the product presents itself accurately.

Tasks:

- Review public landing pages, onboarding copy, help text, empty states, export language, and report language.
- Remove or soften unsupported claims about legal compliance, agency acceptance, direct filing, security certifications, or live integrations.
- Confirm disclaimers clearly explain that the platform assists with compliance workflows and does not replace legal/payroll review.
- Keep competitive positioning strong but truthful: contractor-first command center, guided corrections, audit-ready evidence, payroll verification, and export preparation.

Acceptance:

- No unsupported claims remain.
- Contractor value is still clear.
- No UI flow implies a form was filed with an agency unless the system actually filed it.

## Phase 2 - Project Setup And Required Forms

Goal: make project setup impossible to misunderstand.

Tasks:

- Review Project Home and Project Settings for redundant project panels and repeated information.
- Ensure setup is ordered around the contractor workflow: jurisdiction, project facts, awarding agency, wage source, workers, payroll weeks, required forms, evidence, submission.
- Add or verify jurisdiction selection for federal, state, local, and layered projects.
- Capture the controlling agency, funding source, project location, contract type, wage determination source, and applicable local ordinance where relevant.
- Improve project-specific required forms checklist.
- Add exact validation messages for missing or invalid project fields.
- Every required field error must explain what is wrong, why it matters, and how to fix it.
- Ensure fix actions land on the exact section or field.
- Confirm California-specific required form wording is clear.

Acceptance:

- A new user can understand what to do first from Project Home.
- Required forms are visible from the project workflow.
- Updating awarding agency and other project facts persists correctly.
- Jurisdiction selection drives required forms, wage source prompts, validation rules, and export expectations.
- Every setup blocker has a precise fix target.

## Phase 2A - Jurisdiction Rule Architecture

Goal: map the product so it can support federal, state, and local prevailing wage requirements without hardcoding one-off California assumptions everywhere.

Tasks:

- Define a jurisdiction model that supports federal, state, local, and layered rules on the same project.
- Map federal Davis-Bacon baseline requirements, including wage determinations, classifications, fringe benefits, certified payroll, WH-347, statement of compliance, apprenticeship considerations, and evidence expectations.
- Map state requirements with California as the first production pilot, including state-specific forms, CPR expectations, awarding agency fields, apprenticeship rules, overtime rules, deductions/contributions, and evidence.
- Map local requirements as overlays, including city, county, school district, transit agency, housing authority, port/airport authority, and other local public agency requirements.
- Add a rule precedence strategy for conflicts or layered requirements, such as federal funding plus stricter state or local rules.
- Keep rule logic data-driven where practical: jurisdiction, agency type, form requirements, wage source, validation rules, submission package, evidence checklist, and explanatory copy.
- Add user-facing language that explains why a federal, state, local, or layered rule applies.
- Add tests for jurisdiction selection, required form selection, wage source prompts, validation output, and export package differences.

Acceptance:

- A project can be classified as federal, state, local, or layered.
- Required forms and validation requirements change based on jurisdiction.
- California remains the first fully tested state workflow.
- Federal Davis-Bacon support is mapped clearly enough for implementation and testing.
- Local requirements can be added without rewriting the core payroll week or evidence workflows.
- The system never hides uncertainty: if a local ordinance or agency-specific rule is not configured, the UI flags it for user review.

## Phase 3 - Payroll Automation And Import Reconciliation

Goal: reduce manual payroll work and close the competitive gap against mature payroll tools.

Tasks:

- Review payroll import, worker roster import, manual payroll entry, and provider mapping flows.
- Support clear capture or import of deductions, taxes, union dues, health insurance, pension, vacation, training, other contributions, fringe credits, and payments.
- Separate employee deductions from employer contributions and fringe credits.
- Add reconciliation views for imported gross, deductions, net pay, fringe, hours, overtime, and classification.
- Save provider mappings so repeated imports do not require cleanup.
- Flag missing deduction/contribution detail before export.
- Add user-facing explanation that payroll systems usually remain the source of truth for taxes and deductions unless integrated.
- Preserve a competitive-gap note for deeper payroll/provider integrations.

Acceptance:

- A realistic payroll file can be imported or manually entered without hidden required data.
- Deduction and contribution totals are visible, editable where appropriate, and included in exports.
- Reconciliation identifies mismatch causes, not just generic failures.
- Tests cover import mapping, deductions, contributions, fringe credits, gross pay, and net pay.

## Phase 4 - Payroll Week Work Zones And Exports

Goal: make each payroll week feel like a guided workbench, not a long form.

Tasks:

- Maintain the work-zone structure: readiness, workers/pay entries, compliance checks, required forms, evidence, exports, certification, and submission status.
- Remove dead space and right-margin-only layouts.
- Keep critical actions visible but avoid duplicated project information.
- Ensure warning and blocker cards have useful fix actions that scroll to exact sections.
- Add clear signature/certification controls and acknowledged-review states.
- Verify WH-347 and CA A-1-131 generated forms for alignment, transparent text boxes, number sizing, and correct column placement.
- Verify zero deductions, total deductions, total pay, net pay, fringe credits, and hourly credit fields land in correct locations.

Acceptance:

- Payroll Week can be completed by a user without guessing where to go.
- Missing signature, missing payroll entries, evidence review, and form blockers all resolve correctly after correction.
- Generated PDFs/forms match source names, weeks, rates, hours, deductions, gross, net, and fringe values.
- Five-worker test data produces aligned exports.

## Phase 5 - Subcontractor Operations

Goal: make subcontractor compliance visible and manageable.

Tasks:

- Review subcontractor invite, upload, status, rejection, correction, reminder, and evidence flows.
- Add clear statuses for not invited, invited, pending, submitted, rejected, corrected, approved, late, and non-performance.
- Ensure reminders are safe, understandable, and do not imply external email delivery unless configured.
- Make subcontractor evidence and payroll submissions visible in project readiness and evidence packet views.

Acceptance:

- A general contractor can see exactly which subcontractors are blocking submission.
- Subcontractor correction loops are understandable.
- Reviewer/auditor users can inspect subcontractor records without editing payroll data.

## Phase 6 - Evidence Packet And Audit Readiness

Goal: make audit evidence easy to inspect before export or review.

Tasks:

- Build or polish evidence packet preview with filters by week, worker, subcontractor, form, issue type, and source.
- Include wage determinations, worker records, payroll entries, correction history, forms, photos, field evidence, GPS/time evidence when available, signatures, certifications, and submission history.
- Add missing-evidence explanations and fix actions.
- Generate an audit manifest that lists what is included and what is missing.

Acceptance:

- Evidence packet can be reviewed before download.
- Required vs collected evidence boxes are clickable and navigate to useful filtered details.
- Missing evidence updates after the user fixes the underlying item.

## Phase 7 - Field Clock And Mobile Capture

Goal: prepare for a later employee-facing app while keeping current field capture usable.

Tasks:

- Continue improving Field Clock layout so it is not a long undifferentiated list.
- Make mobile capture fast: worker, project, classification, check-in/out, photo, notes, location consent, and supervisor review.
- Add clear distinction between admin-entered time, worker-entered time, corrected time, and payroll-approved time.
- Support offline/poor-network messaging if PWA behavior exists.
- Keep employee app as a future expansion unless explicitly added.

Acceptance:

- Field Clock is usable on mobile and desktop.
- Time evidence is clearly labeled by source and review status.
- Admin corrections do not silently overwrite original evidence.

## Phase 8 - Roles, Security, And Integrations

Goal: harden production-pilot behavior.

Tasks:

- Verify role-based access for admin, contractor, subcontractor, reviewer/auditor, and field user if present.
- Confirm reviewer/auditor flows are read-only where required.
- Check tenant/project isolation assumptions.
- Review API routes and server actions for authorization checks.
- Prepare environment variable documentation for live services such as QuickBooks, Procore, SAM, Resend, storage, and auth providers.
- Add sandbox integration tests or mocked contract tests where live credentials are unavailable.
- Confirm public security claims match actual implementation.

Acceptance:

- Unauthorized users cannot access or mutate restricted project data.
- Missing live credentials fail with clear setup messages.
- Integration placeholders are visibly marked as sandbox/mock/demo where appropriate.

## Phase 9 - Competitive Superiority Scorecard

Goal: document where the platform is superior and where competitors still lead.

Tasks:

- Update `COMPETITIVE_ANALYSIS.md`, `LAUNCH_READINESS_MATRIX.md`, and any UX scorecard docs.
- Compare against LCPtracker, eMars, PRISM, Prevail, and WagePath.
- Score visual design, navigation, ease of use, onboarding, performance feel, mobile, information density, workflow guidance, typography, payroll automation, audit readiness, integrations, and support maturity.
- Be strict: do not score a category 10 unless the product is demonstrably complete and tested.
- Keep a clear gap list for market maturity, payroll ecosystem integrations, public security positioning, training/support, and agency adoption.

Acceptance:

- Scorecard reflects tested product behavior, not aspiration.
- Remaining competitor advantages are explicit.
- Next investments are ranked by customer impact.

## Phase 10 - California Production Pilot

Goal: run the pilot end to end with realistic data.

Pilot data:

- One California public works project.
- At least 5 workers.
- At least 2 payroll weeks.
- At least 1 subcontractor.
- Multiple classifications if supported by project setup.
- Deductions, taxes, union dues or benefit deductions, employer contributions, fringe credits, overtime, and at least one correction scenario.
- Required forms, evidence uploads, generated WH-347 and CA A-1-131, CPR submission package, and reviewer signoff.

Tasks:

- Create fresh pilot data from the UI.
- Import or enter workers.
- Add wage determination/rates.
- Add payroll week 1 and week 2.
- Add deductions, contributions, fringe credits, and corrections.
- Resolve every blocker and warning through the UI.
- Generate WH-347, CA A-1-131, CPR submission materials, reports, and evidence packet.
- Review generated documents for names, project data, classifications, hours, rates, gross, deductions, net, fringe, signature, dates, and alignment.
- Record issues in `docs/PILOT_UAT.md` or a pilot findings log.

Acceptance:

- Pilot can be completed without developer intervention.
- All generated outputs match source data.
- No blocker remains after completing required corrections.
- UI remains clear enough for a non-developer contractor user.

## Phase 11 - Federal, State, And Local Expansion

Goal: expand beyond the California pilot in a controlled way without weakening compliance confidence.

Tasks:

- Build a jurisdiction coverage matrix that tracks federal, state, and local support by feature area.
- Prioritize expansion by customer demand, public works volume, available official sources, and form complexity.
- Add federal Davis-Bacon as the first national workflow after the California pilot if not already complete.
- Add additional states one at a time, with official-source validation, required forms, wage source mapping, overtime/fringe/deduction rules, apprenticeship rules, and export/review workflows.
- Add local ordinance support as overlays tied to project location and awarding agency.
- For each new jurisdiction, create seed data, test fixtures, UI walkthroughs, generated forms, and pilot acceptance cases.
- Update product copy so users can see which jurisdictions are fully supported, partially supported, or require manual review.

Acceptance:

- Coverage matrix clearly shows supported federal, state, and local workflows.
- New jurisdictions follow the same rule architecture instead of duplicating page logic.
- Every added jurisdiction has tests, pilot data, and documented limitations.
- The product can honestly present itself as built for federal, state, and local prevailing wage work, with transparent coverage status.

## Final Release Gate

Before declaring the project finished:

- Run full build, tests, and browser audit.
- Run the California production pilot.
- Review all generated forms and reports manually.
- Update readiness docs.
- Commit only intentional changes.
- Push to the correct GitHub repository.

## Stop Conditions

Stop and report instead of continuing if:

- The same test fails twice after attempted fixes.
- A legal/compliance rule is unclear and requires current statutory or agency-source verification.
- A live integration requires credentials that are not available.
- A data migration could destroy or corrupt user data.
- The requested change would require unsupported claims, unsafe access, or pretending a filing/submission occurred when it did not.

## Key Documents To Keep Current

- `PLAN.md`
- `README.md`
- `LAUNCH_READINESS_MATRIX.md`
- `UX_SUPERIORITY_EXECUTION_PLAN.md`
- `SUPERIORITY_ROADMAP_2026.md`
- `COMPETITIVE_ANALYSIS.md`
- `COMPLIANCE_METHODOLOGY.md`
- `DEMO_READINESS_QA.md`
- `docs/PILOT_UAT.md`

## Expected Final Report

When execution is complete, report:

- Phases completed.
- Files changed.
- Tests and audits run.
- Pilot data used.
- Generated documents reviewed.
- Remaining risks, if any.
- Whether the platform is production-pilot ready.
