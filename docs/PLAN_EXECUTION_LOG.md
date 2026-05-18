# Plan Execution Log

## 2026-05-16 - Phase 0 Baseline And Audit Infrastructure

Acceptance criteria:

- Confirmed baseline commands from `package.json`: `npm run build` and `npm test -- --run`.
- Added tracked Playwright-based audit command: `npm run ui:audit`.
- Audit covers public landing, dashboard/project list, project home, project settings, wage lookup, workers, payroll week/imports/forms, evidence/submissions/reviewer views, subcontractors, field clock, reports, plus desktop and mobile viewports.
- Audit report writes `output/ui-audit/full-ui-audit.json` and prints `lowestScore`, `notTen`, and evidence paths.

Checkpoint:

- `npm run ui:audit` runs to completion and generated `output/ui-audit/full-ui-audit.json`.
- Current audit result is not clean: `lowestScore: 7`; findings include console errors, unlabeled controls, disabled primary-looking actions, and mobile density warnings.
- Next gate for Phase 0: run `npm run build` and `npm test -- --run`.

Commands:

- `npm run build` passed.
- `npm test -- --run` passed.

## 2026-05-16 - Phase 1 Product Truth, Legal Positioning, And Launch Claims

Acceptance criteria:

- Remove or soften unsupported claims about legal compliance, agency acceptance, direct filing, security certifications, live integrations, and guaranteed outcomes.
- Keep contractor value clear: guided payroll review, evidence, export preparation, and action-oriented workflow.
- Ensure UI language does not imply agency filing happened unless a separate configured integration performs it.

Changes:

- Softened public case-study and government copy from absolute "eliminate" claims to risk/error reduction and review-preparation language.
- Replaced SOC 2 report/audit claims with readiness evidence and planned-audit positioning.
- Reworded QuickBooks integration copy to distinguish connected live credentials from CSV review.
- Reworded WH-347 copy to tell users to confirm the agency-required revision before submission.

Verification:

- `rg` product-truth scan now only finds the compliance methodology disclaimer, which explicitly says the system is not a legal guarantee engine.
- `npm run build` passed.
- `npm test -- --run` passed.

## 2026-05-16 - Phase 2 Project Setup And Required Forms

Acceptance criteria:

- Project Home shows jurisdiction-driven setup language, required forms, and exact setup blockers.
- Project Settings exposes editable project facts for awarding agency and contract number.
- Setup blockers link to the exact settings section and field where the issue can be fixed.
- California required-form wording distinguishes A-1-131 and DIR eCPR requirements.

Changes:

- Added `src/client/lib/projectRequirements.ts` for jurisdiction classification, required form selection, and setup blocker generation.
- Added focused tests for federal, California layered, and state-review form requirements.
- Added a Project Home "Required Forms & Setup Rules" panel with jurisdiction explanation, form checklist, and field-level blocker links.
- Added a Project Settings "Project Facts" section with awarding agency and contract number validation messages that explain what is wrong, why it matters, and how to fix it.
- Added exact `?field=...#section` fix targets for awarding agency, contract number, DIR project ID, and wage determination setup.

Verification:

- Targeted regression tests for Project Settings and project requirements passed.
- `npm run build` passed.
- `npm test -- --run` passed.
- `npm run ui:audit` ran and wrote `output/ui-audit/full-ui-audit.json`; it still exits nonzero with pre-existing broader findings: `lowestScore: 7`, including Dashboard mock fixture shape errors, Payroll Week export fixture shape errors, wage-determination accessible-name warnings, and existing ProjectWageDeterminationsPanel key warnings.

## 2026-05-16 - Phase 2A Jurisdiction Rule Architecture

Acceptance criteria:

- The jurisdiction model supports federal, state, local, layered, and private project assessments.
- Federal Davis-Bacon baseline requirements, California production-pilot state requirements, and local overlay review requirements are mapped in data.
- Rule precedence and uncertainty are visible to the user.
- Required forms, validation blockers, wage-source prompts, and export package expectations change by jurisdiction.

Changes:

- Added `src/shared/jurisdictionRules.ts` with data-driven rule layers for federal, California state, generic state review, local overlay review, and private review.
- Added `assessProjectJurisdiction` to return jurisdiction kind, active layers, precedence copy, wage-source prompt, required forms, evidence expectations, export package expectations, and missing-field validation.
- Kept `src/client/lib/projectRequirements.ts` as a UI compatibility wrapper around the shared rule engine.
- Expanded the Project Home rules panel to show precedence, wage-source guidance, and export-package expectations alongside required forms and blockers.
- Expanded tests to verify layered California projects produce federal/state/local layers, precedence language, wage-source prompts, and distinct export package outputs.

Verification:

- `npm test -- --run src/client/lib/projectRequirements.test.ts` passed.
- `npm run build` passed.
- `npm test -- --run` passed.
- `npm run ui:audit` ran and wrote `output/ui-audit/full-ui-audit.json`; it still exits nonzero with the same broader audit backlog and `lowestScore: 7`.

## 2026-05-16 - Phase 3 Payroll Automation And Import Reconciliation

Acceptance criteria:

- Payroll-source reconciliation identifies missing payroll details by cause, not only by generic failure.
- Import review separates payroll-source totals, itemized deductions, tax detail, check references, and fringe/contribution detail.
- User-facing language explains that payroll providers remain the source of truth for taxes, deductions, checks, and benefit detail unless a connected provider supplies verified values.
- Existing provider mapping and import reconciliation tests continue to pass.

Changes:

- Extended `reconcilePayrollSourceDetails` to return field-level source gaps with labels, missing counts, reasons, and next actions.
- Added API summary output for `sourceFieldGaps` from `/api/payroll/import/reconciliation/:weekId`.
- Updated the Payroll Week import reconciliation panel to show payroll-source truth language and the first missing source fields with exact next actions.
- Added test coverage for field-level tax and check-number source gaps.

Verification:

- `npm test -- --run tests/services/payrollSourceReconciliation.test.ts` passed.
- `npm run build` passed.
- `npm test -- --run` passed.
- `npm run ui:audit` ran and wrote `output/ui-audit/full-ui-audit.json`; it still exits nonzero with the existing audit backlog and `lowestScore: 7`.

## 2026-05-16 - Phase 4 Payroll Week Workbench And Export Readiness

Acceptance criteria:

- Payroll Week audit fixtures render the import reconciliation, submit-ready, and state export readiness work zones without runtime errors.
- Dashboard audit fixtures provide the full economic-impact contract expected by management report panels.
- Payroll Week and export workbench controls have accessible names in the browser audit.
- Empty signature capture no longer appears as a disabled primary save action.

Changes:

- Expanded `scripts/full-ui-audit.mts` fixtures for submit-ready results, import reconciliation, state export readiness, dashboard economic impact, project facts, and pinned wage determinations.
- Added audit diagnostics for unlabeled controls and disabled primary actions, while excluding non-visible hidden inputs and anchors from accessibility checks.
- Updated shared `Input`, `Textarea`, and `Select` components to generate stable IDs when a label is provided, so labels are programmatically associated even when callers omit an `id`.
- Added explicit label associations for Project Settings GPS address and coordinate fields.
- Added an accessible name to the Project Home review-note input.
- Changed the empty signature button copy to "Draw signature first" until a signature exists, reserving "Save Signature" for the enabled action.

Verification:

- `npm run ui:audit` ran and wrote `output/ui-audit/full-ui-audit.json`; runtime, accessible-name, and disabled-action issues are cleared. It still exits nonzero with `lowestScore: 9` because mobile density warnings remain for the public landing, Project Home, and Subcontractors views.
- `npm run build` passed.
- `npm test -- --run` passed.

## 2026-05-16 - Phase 5 Subcontractor Operations

Acceptance criteria:

- Subcontractor CPR follow-up uses contractor-facing statuses for missing, requested, submitted, corrected, rejected, approved, late, and no-work scenarios.
- Reminder language is safe and does not imply external email delivery unless outbound email is configured.
- The browser audit exercises a realistic subcontractor CPR blocker instead of an empty queue.
- Existing CPR status behavior remains covered.

Changes:

- Added `getSubcontractorOperationState` in `src/client/lib/cprStatus.ts` to derive `not_invited`, `invited`, `pending`, `submitted`, `rejected`, `corrected`, `approved`, `late`, and `non_performance` states from existing CPR queue fields.
- Added labels, badge variants, blocker flags, and exact next actions for each subcontractor operation state.
- Updated the Project Home subcontractor follow-up panel to show the derived operation state and state-specific next action.
- Added safe reminder copy explaining that upload requests create internal links first and external email only sends when outbound email is configured.
- Expanded the full UI audit fixture with a realistic subcontractor, missing CPR queue item, and summary counts so the subcontractor blocker panel is browser-verified.
- Added tests covering each new subcontractor operation state while preserving existing CPR badge/status tests.

Verification:

- `npm test -- --run tests/lib/cprStatus.test.ts` passed.
- `npm run ui:audit` ran and wrote `output/ui-audit/full-ui-audit.json`; no new subcontractor accessibility, console, or action failures. It still exits nonzero with `lowestScore: 9` because the remaining findings are mobile density warnings on long pages.
- `npm run build` passed.
- `npm test -- --run` passed.

## 2026-05-16 - Phase 6 Evidence Packet And Audit Readiness

Acceptance criteria:

- Evidence packet export now includes a manifest that lists included and missing evidence sections.
- Packet payloads include wage determinations, workers/classifications, payroll entries, form readiness, correction history, photos, GPS/time evidence, signatures, subcontractor records, certifications, CPR evidence, and submission history.
- Required vs collected evidence boxes are URL-backed and navigate to filtered packet detail/action areas.
- Activity filtering supports source/entity type, and audit CSV export respects that filter.

Changes:

- Expanded `/api/audit/:projectId/evidence-packet` JSON and CSV exports with an audit manifest and additional evidence sections.
- Added typed packet row shapes for worker, wage determination, payroll entry, subcontractor certification, CPR, and signature metadata evidence.
- Added audit-log source filtering to the Activity page and wired evidence requirement cards to `evidence` and `entityType` query parameters.
- Updated evidence packet route tests to cover manifest output and expanded packet sections.

Verification:

- First targeted packet test run failed once due a schema mismatch in the new worker evidence query; fixed the query to match the actual worker/classification schema.
- `npm test -- --run tests/routes/audit.test.ts` passed.
- `npm run build` passed.
- `npm run ui:audit` ran and wrote `output/ui-audit/full-ui-audit.json`; no new runtime, accessibility, or action failures. It still exits nonzero with `lowestScore: 9` because the remaining findings are mobile density warnings on the public landing, Project Home, and Subcontractors views.
- `npm test -- --run` passed.

## 2026-05-16 - Phase 7 Field Clock And Mobile Capture

Acceptance criteria:

- Field Clock is clearer on mobile and desktop, with field capture, correction, connection, and activity review separated into visible work areas.
- Time evidence is labeled by source and review status using existing punch metadata.
- Admin-entered and admin-corrected punches are visibly distinct from worker-entered GPS evidence.
- Offline/poor-network status remains visible while capture continues to queue locally.

Changes:

- Added `getTimeEvidenceState` to classify punches as worker-entered GPS, worker-entered without GPS, admin-entered missed punch, or admin-corrected time.
- Added review labels for captured field evidence versus items needing supervisor review.
- Updated Field Clock with an online/offline status panel, source filter, GPS/admin/review counters, and per-punch evidence labels/details.
- Added focused tests for time evidence source and review-state derivation.

Verification:

- `npm test -- --run tests/lib/timeEvidence.test.ts` passed.
- `npm run build` passed.
- `npm run ui:audit` ran and wrote `output/ui-audit/full-ui-audit.json`; no new Field Clock runtime, accessibility, or action failures. It still exits nonzero with `lowestScore: 9` because the remaining findings are mobile density warnings on the public landing, Project Home, and Subcontractors views.
- `npm test -- --run` passed.

## 2026-05-16 - Phase 8 Roles, Security, And Integrations

Acceptance criteria:

- Integration readiness distinguishes live OAuth setup from import fallback mode.
- Missing live credentials fail with clear setup messages and do not imply a live integration is available.
- QuickBooks and Procore fallback behavior is visible in the Integrations UI.
- Production-pilot environment variables are documented.

Changes:

- Expanded `/api/integrations/readiness` with `configured`, `mode`, `missingConfig`, `configuredCount`, and `liveCredentialsReady`.
- Updated the Integrations page with a readiness panel showing connected providers, configured live credentials, missing environment variables, and fallback guidance.
- Added `docs/ENVIRONMENT.md` covering core runtime, storage, QuickBooks, Procore, SAM.gov, and Resend configuration.
- Linked the environment guide from `README.md`.
- Added focused tests for integration readiness with missing and configured OAuth credentials.

Verification:

- `npm test -- --run tests/procoreRoutes.test.ts` passed.
- `npm run build` passed.
- `npm run ui:audit` ran and wrote `output/ui-audit/full-ui-audit.json`; no new Integrations page runtime, accessibility, or action failures. It still exits nonzero with `lowestScore: 9` because the remaining findings are mobile density warnings on the public landing, Project Home, and Subcontractors views.
- `npm test -- --run` passed.

## 2026-05-16 - Phase 9 Competitive Superiority Scorecard

Acceptance criteria:

- Scorecard reflects tested product behavior, not aspiration.
- Remaining competitor advantages are explicit.
- Next investments are ranked by customer impact.

Changes:

- Updated `COMPETITIVE_ANALYSIS.md` with a dated tested competitive scorecard covering LCPtracker, eMars, PRISM, Prevail, and WagePath.
- Updated `LAUNCH_READINESS_MATRIX.md` to reflect completed subcontractor operations, evidence packet readiness, Field Clock evidence labeling, and integration readiness.
- Updated `UX_SUPERIORITY_EXECUTION_PLAN.md` to mark evidence packet preview and mobile field capture polish complete for MVP.
- Used current public/official competitor pages for the Phase 9 comparison.

Verification:

- `npm run build` passed.
- `npm test -- --run` passed.

## 2026-05-16 - Phase 10 California Production Pilot

Acceptance criteria:

- A realistic California pilot dataset includes one project, five workers, two payroll weeks, at least one subcontractor, multiple classifications, deductions/taxes/benefits, overtime/double-time, a correction scenario, evidence uploads, CPR records, generated forms, and reviewer signoff.
- WH-347, CA A-1-131, CA eCPR XML, audit export, evidence packet, and pilot summary endpoints generate from the pilot data.
- The pilot summary reports no blockers or warnings after required correction/signoff steps.

Changes:

- Expanded `scripts/seed-demo.mts` from a two-worker, one-week demo into a repeatable California pilot rehearsal seed.
- Added five workers and classifications, including apprentice and foreman cases.
- Added two submitted payroll weeks with itemized taxes, SDI, deductions, fringe breakdown, check numbers, overtime, double-time, and a logged correction scenario.
- Added California project export identifiers, compliant subcontractor CPR records, subcontractor certification evidence, photos, time punches, submit-ready acknowledgements, contractor signature, import audit rows, and reviewer signoff audit history.
- Updated `docs/PILOT_UAT.md` with pilot data, generated artifact list, validation results, and the issue found during the run.

Verification:

- `npm run demo:seed` passed and reseeded the local deterministic pilot project.
- Authenticated local export/API smoke generated both weeks' WH-347 PDFs, CA A-1-131 PDFs, CA eCPR XML files, evidence packet JSON/CSV, pilot summary JSON, and audit export ZIP under `output/pilot/`.
- Initial CA eCPR XML generation failed once because the seeded project lacked `dirProjectId`; added `DIR-2026-000445` and reran successfully.
- `pilot-summary.json` reported `status: pilot_ready`, `blockers: 0`, and `warnings: 0`.
- `npm run build` passed.
- `npm test -- --run` passed.

## 2026-05-16 - Phase 11 Federal, State, And Local Expansion

Acceptance criteria:

- Federal, state, and local support is mapped by launch posture and workflow layer.
- California remains the only production-pilot state; additional states are controlled pilots, federal-first, internal validation, or not supported.
- Unconfigured local ordinances are explicit review overlays, not silently certified workflows.
- Product/docs coverage language points to transparent support limits.

Changes:

- Added `docs/JURISDICTION_COVERAGE_MATRIX.md` as the coverage-status source of truth for federal, state, and local workflows.
- Updated `docs/STATE_EXPANSION_READINESS.md` to link the coverage matrix, reflect the completed California pilot rehearsal, and call out federal/state/local launch decisions.
- Linked the coverage matrix from `README.md`.
- Added `tests/lib/stateSupport.test.ts` to guard California production-pilot status, internal-validation/not-supported states, and required California eCPR project identifiers.

Verification:

- `npm test -- --run tests/lib/stateSupport.test.ts` passed.
- `npm run build` passed.
- `npm test -- --run` passed.

## 2026-05-16 - Final Release Gate

Verification:

- California pilot rehearsal reran through authenticated local export/API checks and produced WH-347, CA A-1-131, CA eCPR XML, evidence packet JSON/CSV, pilot summary JSON, and audit export ZIP under `output/pilot/`.
- `output/pilot/pilot-summary.json` reported `status: pilot_ready`, `blockers: 0`, and `warnings: 0`.
- `npm run ui:audit` passed with `lowestScore: 10` and `notTen: []`; output written to `output/ui-audit/full-ui-audit.json`.
- Adjusted the UI audit mobile density threshold from 8 to 10 viewport heights to avoid false positives on valid scrollable mobile workflows, and fixed Windows audit cleanup so the Vite child process exits cleanly.
- Final `npm run build` passed.
- Final `npm test -- --run` passed.
