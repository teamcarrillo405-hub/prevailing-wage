# Deployment QA Checklist

Run this checklist before every production deployment and after any data-model, export, payroll, or authentication change.

## Build Gate

- Run `npm run build`.
- Run `npm test`.
- Run targeted route tests for changed server workflows.
- Confirm the working tree only contains intended changes.

## Smoke Test

- Start the production build or deployed environment.
- Run `QA_BASE_URL=https://your-domain.example npm run qa:deployment`.
- Confirm `/`, `/api/health`, `/api/ready`, `/methodology`, `/security`, and `/api-docs` return expected responses.
- Treat `/api/ready` returning `503 not_ready` as a release blocker in production unless the only missing checks are optional drains such as Sentry, Logtail, or email.

## Workflow Checks

- Create or open a sample project and verify the sample badge appears.
- Confirm payroll import templates download for QuickBooks, ADP, Gusto, Paychex, Sage 300, and Sage 100.
- Import a sample CSV, resolve unmatched workers, and verify import reconciliation updates.
- Run submit-ready checks and confirm blocker rows link to the fix location.
- Open export preflight and verify each blocker has a visible Fix action.
- Verify state export readiness shows the current state, supported exports, missing fields, and project settings link.
- Send a subcontractor CPR request individually and with the bulk request action.
- Use review mode to mark a project ready, approved, and rejected.

## Trust And Security

- Confirm `/security` shows encryption, access controls, infrastructure, trust center controls, SOC 2 status, responsible disclosure, and retention.
- Confirm auditor users can review project data without write actions.
- Confirm owner/member users retain expected write access.

## Deployment Notes

- Record the app version or git tag deployed.
- Record any migrations applied.
- Record who completed QA and the date.
