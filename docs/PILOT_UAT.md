# Pilot UAT Plan

Use this plan for each contractor pilot before production rollout.

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
