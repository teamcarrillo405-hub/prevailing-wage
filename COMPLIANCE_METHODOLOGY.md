# Prevailing Wage Compliance Methodology

Version: `2026.05-prevailing-wage-v1`

This system is an automated compliance review and certified payroll preparation tool. It is not a legal guarantee engine. Final certified payroll submission still requires human review and an authorized signature.

## Automated Checks

- Federal DBRA/CWHSSA wage math compares actual gross wages to the base plus fringe snapshot for the classification paid.
- Fringe benefit credit is applied to all hours at straight-time value and is not multiplied for overtime.
- Weekly CWHSSA overtime is flagged when total weekly hours exceed 40 but overtime hours are missing.
- Multi-classification workweeks over 40 hours are flagged for documented rate-in-effect or weighted-average overtime review.
- California daily overtime and double-time checks run for California projects.
- Apprentice payroll rows require a registered apprenticeship program name.
- Configured apprentice ratio checks run by week and by trade where project requirements are provided.
- Non-tax deductions over the review threshold are flagged for supporting documentation.

## Human Review Required

- Confirm the selected labor classification matches work actually performed.
- Confirm the wage determination, modification, county, construction type, scope notes, and predetermined increases.
- Confirm fringe credits are bona fide and supported by plan records.
- Confirm apprentice registration, level, program ratio, and fringe rules.
- Confirm deduction authorization and jurisdiction-specific deduction rules.
- Confirm agency portal requirements, signer authority, and final certified payroll package before filing.

## Repeatable Update Process

1. Review current DOL WH-347, DBRA/CWHSSA, and state labor agency guidance.
2. Update `src/server/services/complianceRules.ts` profiles and rule text.
3. Update automated checks in `src/server/services/complianceService.ts`.
4. Update submit-ready and export behavior so the UI does not overstate legal certification.
5. Add or update realistic payroll tests for straight time, overtime, multi-classification, apprentice, deduction, and fringe scenarios.
6. Export a WH-347/evidence packet and compare the fields against agency instructions.
7. Run `npm run build` and the full test suite.
8. Commit methodology, rule, UI, export, and test changes as separate logical commits where possible.
