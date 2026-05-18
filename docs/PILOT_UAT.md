# Pilot UAT Plan

Use this plan for each contractor pilot before production rollout.

For state expansion, run this plan alongside `docs/STATE_EXPANSION_READINESS.md`.

For the first California production pilot, use `docs/CA_PILOT_RUNBOOK.md` and log issues in `docs/PILOT_FINDINGS_LOG_TEMPLATE.md`.

## Participants

- Contractor payroll owner
- Project manager or compliance lead
- Agency, prime, or auditor reviewer
- PrevWage implementation lead

## Test Data

- One active public works project
- Two certified payroll weeks
- At least five workers, including one apprentice when applicable
- At least one subcontractor with a CPR upload request
- One real payroll export from QuickBooks, ADP, Gusto, Paychex, Sage 300, or Sage 100

## Workflow Script

1. Complete onboarding and create the project.
2. Add or import workers and classifications.
3. Pin the wage determination.
4. Download the provider CSV template and compare it to the real payroll export.
5. Import the real payroll export into a payroll week.
6. Resolve unmatched workers, zero rates, missing pay, and classification gaps.
7. Run submit-ready and export preflight checks.
8. Use each Fix action and confirm it lands on the correct screen.
9. Generate WH-347 and the applicable state export.
10. Send individual and bulk subcontractor CPR requests.
11. Upload a subcontractor CPR file through the public upload link.
12. Mark the project ready for review, then have the reviewer approve or reject it.
13. Export the audit evidence package.

## Acceptance Criteria

- Payroll import requires no manual data cleanup outside the app after mappings are saved.
- Export preflight identifies blockers before file generation.
- Every blocker has a useful Fix action.
- State-specific required fields are captured, preflighted, and represented in the generated agency package.
- State overtime, fringe, deduction, apprentice, and non-performance handling are validated when applicable.
- Auditor/reviewer users can review and approve/reject without editing payroll.
- Owners and members can still complete payroll and subcontractor workflows.
- Generated forms match the source payroll totals.
- The implementation lead records any manual workaround in the pilot findings log.

## Findings Log

For each issue, capture:

- Date
- Pilot company
- User role
- Browser and device
- Workflow step
- Expected result
- Actual result
- Screenshot or export file reference
- Severity: blocker, high, medium, low
- Owner and target fix release

## 2026-05-16 California Pilot Rehearsal

Pilot company: Demo Concrete QA LLC  
Project: Demo Library Renovation, Los Angeles, CA  
Run type: deterministic pilot rehearsal using `npm run demo:seed`, then authenticated export/API checks against the local app.

### Pilot Data Used

- One California public works project with federal Davis-Bacon/state prevailing wage characteristics.
- Five workers across carpenter, laborer, operating engineer, apprentice, and foreman classifications.
- Two submitted payroll weeks: 2026-04-25 and 2026-05-02.
- One subcontractor, Brightline Electrical LLC, with two compliant CPR records and certification evidence.
- Payroll source coverage includes taxes, SDI, union dues, benefit deductions, fringe breakdown, check numbers, gross pay, deductions, and net pay.
- Week 2 includes a correction scenario for Marco Chen: Saturday operating engineer time corrected to 2.00 overtime hours and 2.00 double-time hours.
- Evidence includes contractor signature, project photo, two week photos, GPS time punches, admin correction evidence, import audit rows, CPR uploads, and reviewer signoff.

### Generated Outputs Reviewed

Generated through authenticated local endpoints and stored under `output/pilot/`:

- `wh347-demo-week-2026-04-25.pdf`
- `wh347-demo-week-2026-05-02.pdf`
- `a1131-demo-week-2026-04-25.pdf`
- `a1131-demo-week-2026-05-02.pdf`
- `ecpr-xml-demo-week-2026-04-25.xml`
- `ecpr-xml-demo-week-2026-05-02.xml`
- `evidence-packet.json`
- `evidence-packet.csv`
- `pilot-summary.json`
- `audit-export.zip`

### Validation Results

- `pilot-summary.json` status: `pilot_ready`.
- Pilot blockers: 0.
- Pilot warnings: 0.
- Evidence packet manifest ready: true.
- Evidence packet missing evidence: none.
- Source reconciliation coverage: 10/10 payroll rows complete.
- Import exceptions: 2 import audit rows, 0 unmatched workers.
- Submit-ready blockers: 0.
- Subcontractor CPR open items: 0.
- eCPR XML includes DIR project ID `DIR-2026-000445` and the week 2 double-time correction for Marco Chen.

### Issues Found

| Date | Role | Workflow step | Expected result | Actual result | Severity | Resolution |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-05-16 | Implementation lead | Generate CA eCPR XML | XML export succeeds from seeded pilot project data | First export returned `400` because `dirProjectId` was missing from the seed | High | Added `dir_project_id` to the seeded California project and reran seed/export checks successfully |

### Remaining Pilot Notes

- This was a repeatable local rehearsal, not a live contractor production pilot with customer payroll exports.
- UI workflow behavior was exercised through existing app screens and export endpoints; the seed provides the full data state so future contractor UAT can focus on whether a non-developer can create the same record from the UI without help.
- Human/legal review remains required before any real agency submission.
