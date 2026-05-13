# State Expansion Readiness Plan

Use this plan before enabling a state for customer-facing sales, onboarding, or production payroll use.

## Bottom Line

PrevWage is ready for controlled multi-state pilots, not a blanket 50-state launch.

California remains the primary production proving ground. Additional states should move through a gated pilot path only after export output, required fields, rates, overtime logic, apprenticeship handling, and agency submission expectations are validated against current state requirements.

## Expansion Order

| Priority | State | Current Posture | Launch Decision |
| --- | --- | --- | --- |
| 1 | CA | Strongest support: eCPR readiness, A-1-131, fringe breakdown, daily OT/DT, project fields, tests | Production pilot |
| 2 | WA | F700, CPR XML, L&I fields, trade codes, tests | Controlled pilot |
| 3 | NY | PW-12, MPWR XML, tests | Controlled pilot after latest electronic CPR requirements are confirmed |
| 4 | IL | IDOL/PDF support, non-prevailing hours, tests | Controlled pilot |
| 5 | MA | CPR PDF and MA-specific fields, tests | Controlled pilot |
| 6 | NJ | MW-562 export and deduction fields, tests | Controlled pilot |
| 7 | TX | Strong federal/Davis-Bacon use case and WD coverage; limited state-specific burden | Federal-first pilot |
| 8 | MN | Generator exists, but route and workflow readiness need confirmation | Internal validation only |
| 9 | VA | Generator exists, but route and workflow readiness need confirmation | Internal validation only |

## State-Ready Definition

A state is customer-ready only when all items below are complete.

- Current official source reviewed and dated.
- Supported project types documented.
- Required contractor, project, worker, payroll, fringe, deduction, and apprentice fields mapped.
- State export or submission package generated from real pilot payroll data.
- Export preflight blocks missing required fields before generation.
- Every blocker has a Fix action.
- Generated totals match source payroll totals.
- State overtime and double-time rules are documented and covered by tests where applicable.
- Apprentice ratio, apprentice rate, and program-field requirements are documented.
- Subcontractor CPR workflow works for prime/sub review.
- Auditor/reviewer role can approve or reject without edit rights.
- Pilot UAT completed with a real contractor and findings logged.
- Legal or compliance reviewer signs off that the app is advisory and the contractor remains final certifier.

## Launch Gates

Do not launch a state if any of these are true.

- We cannot identify the current official form, schema, or submission process.
- The state requires electronic submission and our output has not been validated against that channel.
- Required fields are not captured or preflighted.
- Payroll math differs from agency examples or pilot payroll totals.
- Overtime, fringe, apprentice, or deductions rules are unknown.
- The pilot required spreadsheet cleanup outside the app after mappings were saved.
- Production `/api/ready` is not passing for required checks.

## Pilot Workflow

Run `docs/PILOT_UAT.md` for each state pilot with a real contractor, not only sample data.

Minimum pilot evidence:

- One active project in the target state.
- Two certified payroll weeks.
- Five or more workers.
- One apprentice when the state/project requires apprentice tracking.
- One subcontractor CPR upload.
- One real payroll import from a supported provider.
- One generated federal WH-347 package when federally funded.
- One generated state package when state reporting applies.
- Screenshots or files for every agency-facing output.
- Findings log with blocker/high/medium/low severity.

## Federal Baseline

Every state expansion should preserve the federal baseline:

- Weekly certified payroll package.
- Statement of Compliance.
- Worker identifying number limited to the allowed identifier, not full SSN on WH-347.
- Wage determination pinned to the project.
- Classification, hours, rate, fringe, gross, deductions, and net pay traceable to source payroll.
- Final certification performed by the contractor or authorized signer.

## State Validation Checklist

For each state, create a validation note with:

- Official source URL and review date.
- Form or schema name and version.
- Submission method: PDF, XML, portal upload, manual portal entry, or API.
- Required project fields.
- Required contractor fields.
- Required worker fields.
- Required payroll entry fields.
- Required fringe or benefit breakdown.
- Required deduction fields.
- Overtime and double-time rules.
- Apprentice requirements.
- Non-performance week handling.
- Public redaction or privacy requirements.
- Known exemptions.
- Test file or route coverage.
- Pilot status and decision.

## Recommended Next Work

1. Complete CA production pilot and fix any field findings.
2. Run WA and NY pilots next because they have meaningful agency-specific workflows.
3. Run IL, MA, and NJ pilots after WA/NY.
4. Keep TX positioned as a federal Davis-Bacon market first unless a project has local/state-specific reporting requirements.
5. Keep MN and VA in internal validation until route, UI, preflight, and pilot evidence are complete.
6. Keep the product-visible `/state-support` page aligned with this file before every state expansion release.

## Pilot Execution Queue

| Order | State | Pilot Objective | Evidence Required |
| --- | --- | --- | --- |
| 1 | CA | Validate the production pilot workflow end to end using `docs/CA_PILOT_RUNBOOK.md`. | Two payroll weeks, CA eCPR XML, A-1-131 PDF, WH-347 when federal/mixed, reviewer approval, findings log. |
| 2 | WA | Validate F700 and PWIA CPR XML package. | Two payroll weeks, F700 PDF, WA CPR XML, PWIA intent fields, L&I portal upload notes. |
| 3 | NY | Validate PW-12 and MPWR XML against current electronic CPR requirements. | Two payroll weeks, PW-12 PDF, MPWR XML, current source review date, submission notes. |
| 4 | IL | Validate mixed public/private hour handling and IDOL package. | Two payroll weeks, IL certified transcript, non-prevailing-hour scenario, findings log. |
| 5 | MA | Validate DLS project fields and generated CPR package. | Two payroll weeks, MA DLS PDF, project field review, findings log. |
| 6 | NJ | Validate MW-562 fields, deductions, and worker metadata. | Two payroll weeks, NJ MW-562 PDF, deduction review, findings log. |
| 7 | TX | Validate federal-first workflow and TxDOT package where applicable. | WH-347 package, TX CPR PDF when applicable, WD lock, findings log. |
| 8 | MN | Internal validation only. | Route/UI test, MN DLI PDF, project field edit flow, source review. |
| 9 | VA | Internal validation only. | Route/UI test, VA DOLI PDF, project field edit flow, source review. |
