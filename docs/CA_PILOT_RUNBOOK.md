# California Production Pilot Runbook

Use this runbook for the first California contractor pilot. Do not mark California generally available until this run is complete and blocker/high findings are closed.

## Required Inputs

- Contractor legal name and FEIN.
- Active CA public works project name, county, jobsite address, awarding agency, contract number, DIR project ID, CSLB license, and workers compensation policy number.
- Award date and funding type.
- Contract wage determination or DIR prevailing wage source used by the contractor.
- Two payroll weeks from a real payroll system.
- At least five workers; include one apprentice when the project uses apprentices.
- Full worker addresses and last-four SSN identifiers.
- Fringe breakdown by health/welfare, pension, vacation, training, and other required buckets when fringe is credited.
- One subcontractor CPR package or upload sample.
- Reviewer email for prime, agency, or compliance reviewer.

## Pre-Pilot Setup

1. Confirm production `/api/ready` returns `ready`.
2. Confirm `/state-support` lists CA as `Production Pilot`.
3. Confirm the pilot user can register, complete onboarding, and create a CA project.
4. Confirm project settings capture:
   - CSLB license
   - Workers comp policy
   - Contractor FEIN
   - DIR project ID
   - Awarding agency
   - Contract number
5. Download the payroll import template for the contractor payroll provider.
6. Save the source payroll export and agency reference documents outside the repo in the pilot evidence folder.

## Pilot Script

1. Create the CA project from the contract documents.
2. Enter or import workers and classifications.
3. Pin the wage determination used by the contract.
4. Import payroll week 1.
5. Resolve worker matches, classification gaps, zero rates, missing gross pay, and missing net pay.
6. Enter CA daily overtime/double-time values where applicable.
7. Enter fringe breakdown values and confirm they match the frozen fringe snapshot.
8. Run submit-ready checks.
9. Run CA eCPR export preflight.
10. Use every Fix action shown by preflight and confirm it lands on the correct screen.
11. Generate:
    - CA eCPR XML
    - CA A-1-131 PDF
    - WH-347 PDF when project funding is federal or mixed
12. Compare generated totals against the source payroll register.
13. Repeat steps 4-12 for payroll week 2.
14. Send a subcontractor CPR request.
15. Upload the subcontractor CPR through the public upload link.
16. Mark the project ready for review.
17. Have the reviewer approve or reject without editing payroll.
18. Export the audit evidence package.
19. Record findings in `docs/PILOT_FINDINGS_LOG_TEMPLATE.md`.

## Acceptance Gate

California can move beyond production pilot only when:

- Both weeks generate agency-facing outputs without manual spreadsheet cleanup.
- All preflight blockers have useful Fix actions.
- CA eCPR XML contains the required contractor, project, worker, payroll, fringe, and apprentice fields.
- A-1-131 PDF totals match source payroll totals.
- WH-347 totals match source payroll totals when federal or mixed funding applies.
- Reviewer approval works for an auditor/reviewer user without edit rights.
- Subcontractor CPR upload and review are recorded.
- No blocker or high findings remain open.

## Stop Conditions

Stop the pilot and create a fix task if:

- A generated agency package has a wrong total.
- Required CA fields cannot be captured in the app.
- A preflight blocker is missing a Fix action.
- A reviewer can edit payroll.
- Full SSN is exposed in a federal WH-347 output.
- The contractor must clean data outside the app after mappings are saved.
