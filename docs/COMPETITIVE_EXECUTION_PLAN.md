# Competitive Execution Plan

Use this plan when testing PrevWage against mature certified payroll platforms. The in-app tracker lives at `/competitive-readiness`.

## Position

PrevWage should not claim overall market superiority until a real contractor pilot proves the workflow end to end. The current strongest claim is contractor-first California and federal certified payroll execution with audit evidence, guided preflight checks, subcontractor CPR flow, and security controls.

## Execution Gates

1. California production pilot completes with two real payroll weeks.
2. QuickBooks, ADP, Gusto, Paychex, Sage 300 CRE, and Sage 100 imports are each tested against source exports.
3. Payroll source-of-truth automation is tested with hours, gross pay, deductions, net pay, and fringe values from a real payroll register.
4. Prime, subcontractor, and reviewer workflows complete without reviewer payroll edit access.
5. First-week training guide is tested by a new user without live help.
6. Security evidence package includes MFA, SSO, access review, backup/restore, audit export, and incident process records.
7. Pilot proof package includes generated files, findings log, reconciled totals, time-savings summary, and customer-approved quote or testimonial.

## Payroll Source Of Truth Gap

Manual payroll entry is acceptable for the California pilot, but it is not the target competitive workflow. The contractor's payroll system remains the source of truth for gross pay, deductions, net pay, tax withholding, and fringe detail.

Better option: support mapped payroll register imports that bring in hours, classifications, rates, gross pay, deductions, net pay, and fringe details without retyping.

Best option: support repeatable provider mappings or direct payroll integrations so contractors review exceptions instead of rebuilding payroll data inside PrevWage.

Keep this as an open competitive gap until a real project week is reconciled from source payroll export to certified payroll output with no duplicate manual entry for core payroll totals.

## Test Rule

Do not mark an item proven from code alone. Mark it proven only when there is a workflow result, test output, pilot artifact, or customer-approved evidence reference.

## Current Bottom Line

The product is ahead of lightweight tools in methodology, preflight guidance, and audit posture. It remains behind incumbents in adoption, training/support packaging, agency trust, and public proof until the pilot evidence package is complete.
