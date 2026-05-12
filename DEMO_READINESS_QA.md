# Demo Readiness QA

**Date:** 2026-05-04

## Demo Boundary

For the initial demo and launch testing phase, this prevailing wage product should focus on construction contractors who already have a public works project and need to set it up, assign wages, enter/import payroll, validate compliance, manage subcontractor CPRs, capture evidence, and export audit-ready documents.

## Role-Based QA Result

The role-based QA swarm reviewed the product through the primary construction contractor personas:

| Role | Demo Promise | QA Result |
|---|---|---|
| Contractor owner / project manager | See what each public job needs next | Action queues, project readiness, wage determination checks, evidence readiness, and sub CPR queues are now visible enough for demo use |
| Payroll clerk | Enter/import payroll and know when certified payroll is ready | Import math now uses server payroll calculation; WH-347/state exports and submitted status are gated by readiness |
| Field supervisor | Capture supporting field proof from phone | GPS/photo capture exists; for demo, run this online only and present field evidence as advisory proof rather than a hard payroll blocker |
| Subcontractor | Upload CPRs without an account | Token upload remains the demo path; prime users can now download uploaded CPR PDFs from the project page |
| Auditor / agency / prime reviewer | Review records without changing project data | Auditor write access is blocked across project, worker, payroll-adjacent, evidence, signature, and subcontractor write routes |

## Fixes Completed From QA

- Tightened auditor permissions with a shared project write-access helper.
- Fixed payroll imports so committed rows calculate gross wages and net pay through the payroll service.
- Blocked payroll report/export and "Mark as Submitted" actions until the week has complete rows and no blocking violations.
- Prevented editing hours after a week is submitted.
- Fixed amendment payroll clones so amended WH-347 exports retain original pay values and amended filenames.
- Reworked evidence readiness so photos/GPS are advisory proof for Phase 1, not hard blockers.
- Cleaned Evidence Dashboard contrast and readability.
- Improved owner onboarding status so it reflects real action queue state instead of hardcoded false values.
- Added wage determination setup as a project readiness action.
- Added authenticated CPR PDF download from subcontractor tracking.
- Corrected mobile bottom navigation labels for construction workflows.

## Demo-Ready Scope

Use this demo flow:

1. Create a construction project.
2. Select or confirm wage determination/source.
3. Add workers and classifications.
4. Create a payroll week.
5. Enter or import payroll.
6. Review readiness and violations.
7. Export WH-347 or relevant state form.
8. Track subcontractor CPR status and download uploaded CPR proof.
9. Capture optional field evidence.
10. Export evidence/audit packet.

## Still Not Demo Scope

- Offline field capture replay.
- Native mobile app.
- Fully automated agency submission for every jurisdiction.
- SOC 2 or formal security certification.
- Separate "Payroll Clerk" role; demo this as member access.

## Demo Gate

This system is ready for internal demo preparation when:

- The targeted QA suite passes. **Passed 2026-05-04:** 236 targeted route/service tests for audit, role/team permissions, wage lookup/cache/parser, integrations, imports, Procore, subcontractors, and project wage determinations.
- Production build passes. **Passed 2026-05-04.**
- A seeded demo account has one clean project, subcontractor CPR workflow, payroll import reconciliation, saved signature, field photos/GPS proof, and one evidence packet. **Passed 2026-05-04.**
- A human completes one end-to-end browser pass on desktop and mobile width before presenting to outside testers. **Desktop contractor pass completed 2026-05-04; mobile-width pass still recommended before outside testing.**

## Current Demo Account

- URL: `http://localhost:4200`
- Login: `demo@prevwage.local`
- Password: `Password123!`
- Project: `Demo Library Renovation`
- Payroll week: `2026-04-25`

## 2026-05-04 Browser QA Result

- Dashboard renders contractor business profile, editable onboarding link, 5/7 getting-started progress, action queue, compliance overview, project card, and Copilot entry.
- Project page renders workflow completion, project readiness, onboarding-driven integration prompts, audit defense exports, subcontractor CPR follow-up, locked wage determination, saved contractor signature, and site photo.
- Payroll week page renders submit-ready score, QuickBooks reconciliation, WH-347/CA export buttons, read-only submitted entries, readiness checklist, required forms, and week photo evidence.
- Authenticated CSV evidence packet exports payroll submissions, submit-ready review, import record, subcontractor CPR status, photos, GPS punches, and audit events.
- Browser console has no project/payroll runtime errors after login.

## Remaining Before External Demo

- Add real sandbox credentials only if showing live QuickBooks/Procore/OAuth instead of seeded reconciliation.
- Run one mobile-width browser pass for field/photo/subcontractor screens.
- Use a human payroll/construction reviewer to confirm wording is clear to non-technical contractor staff.
