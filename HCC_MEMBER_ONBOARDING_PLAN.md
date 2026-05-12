# HCC Member Onboarding Plan

**Date:** 2026-04-30

## Goal

The public flow should let a construction contractor create an account with an HCC membership number, without being asked to buy a subscription. After signup, the system should learn enough about the contractor to recommend the correct setup path for prevailing wage work.

## Entry Flow

1. Public homepage explains the HCC member product.
2. User chooses Create Member Account.
3. Signup collects:
   - company name
   - HCC membership number
   - email
   - password
   - optional invitation code
4. User is routed to onboarding before the dashboard.
5. Onboarding saves the business profile and recommends setup actions.

## Onboarding Logic

The system now captures information that can change product behavior or guidance:

| Input | Why It Matters |
|---|---|
| Contractor role | Determines whether prime/subcontractor CPR tracking should be prominent |
| Company size and weekly worker count | Helps size payroll setup and import priority |
| Primary states | Drives state form guidance and wage coverage warnings |
| Public work type | Separates Davis-Bacon, state prevailing wage, DOT, agency, and mixed work |
| Payroll provider | Determines whether to recommend QuickBooks OAuth, CSV imports, or manual entry |
| Accounting provider | Helps route QuickBooks or Sage setup |
| Project management provider | Enables Procore timesheet import recommendation |
| Subcontractor usage | Turns on CPR tracking guidance |
| Apprenticeship usage | Pushes apprenticeship program and ratio setup earlier |
| Field tracking need | Recommends GPS time punches and project photos |

## Supported Integration Paths

- QuickBooks: OAuth connection, employee import, and time record sync.
- Procore: OAuth connection and timesheet import.
- ADP, Gusto, Paychex, Sage 300 CRE, Sage 100: payroll CSV import and persistent worker mapping.
- Other or none: manual worker and payroll entry until an import path is configured.

## Next Product Work

- Validate HCC membership numbers against a real HCC member source when available.
- Add an onboarding completion card to the dashboard for users who want to revise their setup.
- Use onboarding answers to preselect project defaults, required forms, and import prompts.
- Add a QuickBooks connection prompt directly inside onboarding when OAuth credentials are configured.
- Add a seed script for demo users with completed onboarding profiles.

