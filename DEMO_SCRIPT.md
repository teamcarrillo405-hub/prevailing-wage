# Prevailing Wage Demo Script

Audience: construction contractors, payroll admins, compliance managers, and owners who need a weekly prevailing wage workflow they can understand without training.

## Demo Goal

Show that PrevWage is not just a wage lookup. The demo should prove that a contractor can create a member account, onboard their business, set up a project, enter workers and payroll, catch compliance problems before filing, collect subcontractor CPRs, and export an audit-ready evidence package.

## Demo Path

1. Start on the public homepage.
   - Show HCC member account creation.
   - Point out that signup asks for the HCC membership number and does not force subscription checkout.

2. Complete onboarding.
   - Select construction work types, primary states, payroll/accounting tools, subcontractor use, apprentice use, and field proof needs.
   - Explain that these answers drive project defaults, integration prompts, and setup guidance.

3. Create a project.
   - Use a Davis-Bacon or public works construction job.
   - Confirm state/county, contract type, funding type, and wage determination setup.
   - Show the project readiness panel and onboarding recommendations.

4. Add workers and classifications.
   - Add a journeyworker and apprentice.
   - Show classification rates, fringe handling, and any state-specific fields.

5. Enter weekly payroll.
   - Add hours, deductions, and net pay.
   - Show the Week Readiness panel and Required Forms panel.
   - Trigger or explain a wage/overtime/apprenticeship warning, then correct it.

6. Generate certified payroll.
   - Download WH-347.
   - For supported states, show the state form export button.
   - Mark the week submitted after the form is delivered to the agency or GC.

7. Manage subcontractors.
   - Add a subcontractor with contact email.
   - Show CPR follow-up status and the reminder email link.
   - Show certification status and DBE/MBE/WBE participation when applicable.

8. Prove audit defense.
   - Open the Evidence Dashboard from the project page.
   - Show required vs collected evidence, audit events, GPS/photo proof, and open payroll weeks.
   - Download the CSV evidence packet or full audit ZIP.

## Seeded Walkthrough For The Current Demo

Use the seeded account when the goal is to present a polished product walkthrough rather than create data live:

- Login: `demo@prevwage.local`
- Password: `Password123!`
- Project URL: `/projects/demo-project-la-library-2026`
- Payroll URL: `/projects/demo-project-la-library-2026/payroll/demo-week-2026-04-25`
- Evidence CSV: `/api/audit/demo-project-la-library-2026/evidence-packet?format=csv`

Recommended talk track:

1. Open the dashboard and show the contractor action queue: Brightline Electrical LLC still needs CPR follow-up.
2. Open the project and show that onboarding answers preselected QuickBooks, Procore, subcontractor CPR tracking, and field evidence prompts.
3. Show the locked federal wage determination and construction type.
4. Show the subcontractor CPR follow-up card and upload-request action.
5. Show saved signature, project photo, and audit defense export links.
6. Open the payroll week and show 100/100 submit-ready status, QuickBooks reconciliation, required forms, and read-only submitted payroll rows.
7. Export the evidence packet and explain that it ties payroll, imports, sub CPR status, photos, GPS punches, and audit events into one response file.

## Launch Demo Standard

The demo is ready when these are true:

- A contractor can complete the path above without developer help.
- Every blocked action explains the exact next step.
- Payroll filing screens show which forms are required and whether they are ready.
- Subcontractor CPR gaps can be identified and followed up from the project page.
- Audit exports are accessible from the project cockpit and Evidence Dashboard.
- Onboarding answers remain editable and continue to influence project setup.

As of 2026-05-04, the seeded walkthrough meets this standard for an internal/investor demo, except live QuickBooks/Procore OAuth should be presented as configured placeholders unless real sandbox credentials are added.

## Competitive Positioning

- Compared with the FLC wage level calculator: PrevWage covers the weekly contractor workflow, not only a rate decision.
- Compared with Knowify: PrevWage leads with prevailing wage compliance, certified payroll, and audit evidence instead of general job costing.
- Compared with B2Gnow/eComply: PrevWage should feel easier for contractors because the project cockpit explains next actions, missing forms, CPR follow-up, and audit proof in plain construction-office language.
