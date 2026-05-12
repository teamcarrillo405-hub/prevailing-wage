# Construction Contractor Launch Readiness Matrix

**Date:** 2026-05-04  
**Audience:** Construction contractors, subcontractors, payroll staff, project managers, owners, field supervisors, and auditors working on Davis-Bacon, state prevailing wage, and public works projects.

## Launch Standard

This product is launch-ready when a construction contractor can answer these questions without calling support:

1. What prevailing wage rules apply to this project?
2. Who worked, where, when, under what classification, and at what rate?
3. Did we pay correctly, including overtime, fringe, deductions, and apprenticeship rules?
4. What certified payroll or state forms do we submit this week?
5. What evidence do we have if an agency, prime, or owner asks for proof?
6. What is missing, who owns it, and what should happen next?

The product should compete on simplicity and confidence: Knowify is contractor-friendly and job-cost focused, B2Gnow/eComply is deep agency/compliance infrastructure, and FLC is not a construction certified payroll competitor because it is immigration wage-level oriented. Our launch wedge should be: **construction-specific certified payroll plus audit-ready evidence, with clearer guidance than enterprise compliance suites.**

## Demo Boundary

Initial launch/demo readiness is for construction contractors managing known public works projects. The product should stay focused on project setup, wage determination, worker/classification setup, payroll entry/import, compliance checks, certified payroll exports, subcontractor CPR tracking, field evidence, and audit packets.

## Primary User Outcomes

| User | Launch Outcome | Product Must Do | Status | Gap |
|---|---|---|---|---|
| Contractor owner | Know if every active public job is compliant | Dashboard shows projects, compliance status, missing payrolls, evidence gaps, and next actions | Strong | Next-action queue now prioritizes violations, overdue payroll, setup gaps, and sub CPR follow-up |
| Payroll clerk | Enter/import weekly payroll correctly | Worker/classification setup, daily ST/OT/DT, fringe/deduction capture, copy previous week, import mapping | Strong | Weekly page now has a readiness card; remaining polish is state-specific submit wording |
| Project manager | See project readiness fast | Project page shows workflow progress, workers, payroll weeks, forms, audit/evidence | Strong | Project readiness panel now points to workers, payroll, violations, and evidence |
| Field supervisor | Capture jobsite proof | GPS time punches, project/week photos, field evidence counts | Partial | Evidence is measured by week; mobile field capture still needs dedicated QA/polish |
| Subcontractor | Submit CPRs without confusion | Token upload portal and subcontractor CPR tracking | Partial | Need subcontractor launch flow review and status messaging |
| Auditor/agency/prime | Review proof quickly | Audit trail, CSV, evidence packet JSON/CSV, immutable records | Strong | By-week completeness exists; packet preview filters remain future polish |
| API/integration user | Pull project/compliance data safely | Scoped API keys, per-key rate limits, OpenAPI, violation breakdowns | Strong | Evidence packet is app-session only; public API evidence endpoints can be future enhancement |

## Contractor Workflow Matrix

| Workflow | Contractor Job To Be Done | Current Capability | Launch Requirement | Status |
|---|---|---|---|---|
| Create project | Set up a public works job in minutes | Project form with state/county/contract/funding/wage fields | Clear setup path, required fields explained in contractor language | Partial |
| Assign wage determination | Avoid paying wrong rates | Wage lookup/sync and project wage fields exist | User can identify source, effective date, classification, fringe, and construction type | Partial |
| Add workers | Keep worker records and SSN data secure | Worker records, encrypted sensitive fields, classifications | Worker setup must make classification/rate mistakes hard | Partial |
| Add classifications | Match work performed to wage schedule | Worker classification records exist | Trade/classification selection should be searchable and explain rate/fringe source | Partial |
| Enter payroll | Build certified payroll week | Payroll week and entry UI, wizard review, ST/OT/DT fields | Weekly entry should show pay math, violations, and submission readiness before user leaves page | Strong |
| Import payroll | Reduce duplicate data entry | Provider import and persistent mapping | Import preview should clearly show mapped/unmapped workers, rate/classification risks, and corrections | Strong |
| Calculate compliance | Catch underpayment before submission | Wage, OT, deduction, apprenticeship, violation breakdown logic | Every violation must explain cause, fix, and estimated dollar impact where possible | Strong |
| Submit certified payroll | Produce agency-ready documents | WH-347 and multiple state exports/submission tracking | "Submit this week" flow should list exact export needed by project state/agency | Partial |
| Track subcontractors | Keep prime/sub compliance organized | Sub CPR tracking and public upload portal | Prime view must show missing/late sub payrolls by week | Partial |
| Capture evidence | Prove jobsite/payroll facts | Photos, GPS punches, audit trail, evidence dashboard | Evidence must be measured by week and tied to payroll submissions | Strong |
| Export audit packet | Respond to agency/prime quickly | JSON/CSV evidence packet exists | Packet should have UI preview, filters, and by-week completeness | Strong |
| Monitor across company | Know what needs attention today | Dashboards/reports exist | Owner dashboard should rank overdue payrolls, active violations, evidence gaps, and upcoming deadlines | Strong |

## Competitive Differentiation Matrix

| Area | Launch Bar | Our Current Position | Competitor Pressure | Next Work |
|---|---|---|---|---|
| Ease of navigation | Contractor sees "Projects -> Workers -> Payroll -> Submit -> Evidence" immediately | Dashboard and project pages now expose next actions, but primary navigation still has many paths | Knowify markets contractor-friendly workflows | Manual UX pass on first-time and weekly contractor flows |
| Compliance logic | Product catches wage, OT, fringe, deduction, and apprenticeship problems before submission | Strong with shared rules, violation breakdowns, and fix guidance | B2Gnow/eComply has mature labor compliance depth | Add more dollar-impact guidance where calculable |
| Certified payroll forms | Contractor can generate the required federal/state output | Strong multi-state form/export foundation | B2Gnow/eComply and payroll vendors compete here | Add project-specific "required forms" checklist |
| Evidence readiness | Contractor knows what proof is missing before an audit | Evidence dashboard, by-week completeness, and packet exports now exist | Enterprise tools emphasize audit trails and reports | Add richer packet preview if customer discovery asks for it |
| Field workflow | Supervisor can capture time/photos from phone | GPS/photos exist, field UX still needs polish | Knowify and others emphasize jobsite time tracking | Make field capture a mobile-first flow |
| Public API/integrations | Contractor can connect data to other systems | Strong `/v1` read API, OpenAPI, webhooks | Enterprise platforms integrate broadly | Add public evidence summary endpoint later if customers ask |
| Subcontractor management | Prime can chase missing sub CPRs | Portal, tracking, and project CPR queue exist | B2Gnow/eComply is strong with vendor compliance | Add reminder/resend actions |
| Confidence/reporting | Owner gets a clear pass/fail view | Reports, action queue, evidence packets, and readiness panels exist | B2Gnow/eComply has broad reporting | Run manual role-based QA |

## Launch Must-Haves

These are the items that should be true before positioning the product as the easiest construction contractor platform.

| Priority | Item | Why It Matters For Contractors | Current Status | Owner |
|---|---|---|---|---|
| P0 | Primary contractor navigation path | Contractors should not hunt for the next step | Partial | Frontend |
| P0 | Project-level next-action panel | Every project should say what to do next | Done | Frontend |
| P0 | Weekly payroll readiness checklist | Payroll staff need a go/no-go before submission | Done | Frontend/API |
| P0 | Violation fix guidance | A violation without a fix path creates support burden | Done | Compliance/UI |
| P0 | Required forms by project state/type | Contractors need to know exactly what to submit | Partial | Compliance/UI |
| P0 | Evidence completeness by week | Audits happen by payroll period, not just project aggregate | Done | Audit/UI |
| P0 | Subcontractor missing CPR queue | Primes need an operational list, not buried records | Done | Subcontractor/UI |
| P1 | Launch QA scripts for every role | Automated tests do not replace contractor workflow QA | Drafted | QA/Product |
| P1 | Updated competitor scorecard | Sales/roadmap should reflect current product, not baseline | Partial | Product |
| P1 | Mobile field capture polish | Field supervisors need fast proof capture | Partial | Frontend |
| P1 | Empty/loading/error polish on core pages | Trust depends on clean UX under real conditions | Partial | Frontend |
| P1 | Import correction workflow | Payroll imports must be safe and understandable | Partial | Payroll/UI |

## P0 Implementation Backlog

1. **Contractor Home Dashboard**
   - Show active projects grouped by `Needs payroll`, `Needs correction`, `Ready to submit`, `Clean`.
   - Show top action per project.
   - Show overdue certified payroll weeks and subcontractor CPR gaps.

2. **Project Next Action Panel**
   - Add a prominent panel on project detail:
     - Set wage determination
     - Add workers/classifications
     - Create payroll week
     - Resolve violations
     - Submit/export forms
     - Complete evidence packet

3. **Weekly Certified Payroll Readiness**
   - On payroll week detail, show:
     - Workers entered
     - Rates/classifications present
     - Gross/net/deductions present
     - Compliance result
     - Required export/forms
     - Evidence collected
     - Submission status

4. **Violation Fix Guidance**
   - For each violation, show:
     - What failed
     - Why it failed
     - How to fix it
     - Estimated wage adjustment if calculable

5. **Evidence Completeness By Week**
   - Extend evidence summary from project aggregate to weekly rows:
     - Payroll submitted
     - Photos collected
     - GPS punches collected
     - Audit events present
     - Packet status

6. **Subcontractor CPR Operations Queue**
   - Show missing, late, rejected, and accepted CPRs.
   - Add reminder/resend actions.
   - Make this visible to primes from the project dashboard.

## Launch QA Checklist

| Flow | Manual QA Script |
|---|---|
| New contractor onboarding | Create account, create first project, add worker, create payroll week, resolve one violation, export WH-347 |
| Payroll clerk weekly flow | Copy previous week, edit hours, run compliance, submit week, export packet |
| State project flow | Create CA/WA/NY/IL/MA/NJ/MN/VA/TX project and confirm correct export/status language |
| Import flow | Import mapped/unmapped workers, correct mapping, verify gross wages and violations |
| Evidence flow | Add photo/GPS/audit activity, confirm dashboard and packet export reflect it |
| Subcontractor flow | Generate upload token, upload CPR, prime reviews status |
| Auditor flow | Auditor role opens project, views audit/evidence, exports CSV/packet, cannot edit payroll |
| Security flow | Non-member cannot access audit, evidence packet, payroll, workers, or photos |
| API flow | Create two API keys, verify scope enforcement, per-key rate isolation, OpenAPI examples |

## Launch Decision

**Current readiness:** Ready for internal demo and investor walkthrough with the seeded contractor account. Not ready to call production launch complete until live third-party credentials, production hosting configuration, and a human contractor/payroll validation pass are finished.  
**Engineering foundation:** Strong. Production build passes, the demo seed runs, targeted role/audit/wage/import/integration/subcontractor tests pass, and the main browser demo path is clean after login.  
**Main remaining gap:** External validation and live-service setup, not core engineering logic: confirm real QuickBooks/Procore/SAM/Resend credentials, then run contractor workflow QA with a non-technical payroll user.

**Recommended next build sequence:**

1. Mobile-width QA for dashboard, project, payroll, field photo, and subcontractor CPR screens.
2. Live sandbox test for QuickBooks and Procore OAuth/imports once credentials are available.
3. Production environment setup: real `JWT_SECRET`, `ENCRYPTION_KEY_V1`, `SAMGOV_API_KEY`, `RESEND_API_KEY`, domain/CORS/APP_URL, and hosting storage paths.
4. Human contractor/payroll test using the demo script.
5. State-specific required-form wording pass after the first external tester feedback.

## Sources Checked

- B2Gnow/eComply labor compliance pages and contractor support articles: certified payroll reporting, contractor dashboard, reports, agency-scale prevailing wage/labor compliance.
- Knowify prevailing wage pages and training materials: contractor-focused labor tracking, job costing, WH-347 certified payroll reporting.
- FLC Prevailing Wage Level Calculator pages: immigration prevailing wage levels for H-1B/PERM/H-2B, not construction certified payroll.
