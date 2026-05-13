# Pilot Findings Log Template

Copy this table for each contractor pilot. Keep source payroll files and screenshots outside the repo unless they are fully anonymized.

| ID | Date | State | Pilot Company | User Role | Browser/Device | Workflow Step | Expected Result | Actual Result | Evidence Reference | Severity | Owner | Target Release | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PILOT-001 | YYYY-MM-DD | CA |  | Payroll owner |  | Import payroll week 1 |  |  |  | blocker/high/medium/low |  |  | open |

## Severity Rules

- `blocker`: prevents payroll package generation, submission readiness, access control, or correct totals.
- `high`: requires manual spreadsheet cleanup, creates confusing certification risk, or blocks normal reviewer flow.
- `medium`: slows the workflow but has an in-app workaround.
- `low`: copy, layout, or minor usability issue.

## Closeout Checklist

- Every blocker and high finding has a linked fix commit or accepted business decision.
- Export files were regenerated after fixes.
- Payroll totals were rechecked against source records.
- Reviewer approval/rejection was retested.
- Pilot lead recorded final launch decision in `docs/STATE_EXPANSION_READINESS.md`.
