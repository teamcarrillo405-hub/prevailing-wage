# Feature Research

**Domain:** Prevailing Wage Compliance SaaS — v5.0 New Features
**Researched:** 2026-04-07
**Confidence:** HIGH (TX, FL, MA, NJ verified via official sources and multiple cross-references; sub tracking patterns confirmed via federal regulation; multi-project reporting based on industry patterns)

---

## Critical Pre-Scoping Finding: Florida Has No State Prevailing Wage Law

**Confidence: HIGH** — Multiple authoritative sources confirm.

Florida repealed its state prevailing wage law in 1979. HB 705 (signed July 2024) further preempted all local prevailing wage ordinances (including those in Orlando, Miami-Dade, and City of Miami). As of 2026, only the **federal Davis-Bacon Act applies** to Florida construction projects, and only when federal funds are involved.

**Implication:** There is **no Florida state certified payroll form**. Florida projects use the **federal WH-347** — the same form already built in the app. No FL-specific PDF generator is needed.

This eliminates one of the four planned state form features. The v5.0 roadmap should be adjusted: TX, MA, NJ are real builds; FL is a project flag + WH-347 routing, not a new form.

---

## Feature 1: Texas Certified Payroll (TX)

### What Texas Requires

**Confidence: HIGH** — Confirmed via Texas Government Code Chapter 2258, TXDOT manuals, and multiple compliance guides.

Texas Government Code Chapter 2258 (the state's "Little Davis-Bacon Act") requires contractors on state-funded public works to pay prevailing wages and submit weekly certified payrolls. The required form is **WH-347 or equivalent** — Texas does not mandate a Texas-specific form. The statutory language requires "the same information as required on Form WH-347."

However, for **TXDOT projects specifically**, electronic submission through **LCPtracker** is mandatory (required for all TXDOT contracts let since August 2017). This is a special provision added to Item 7 of TXDOT contracts.

### TX-Specific Fields Beyond WH-347

The Texas/TXDOT requirement adds three fields beyond the standard WH-347:
- **Project name and location** (the WH-347 has project fields but TX contracts require specific contract number format)
- **Contract number** (TXDOT contract number, not the same as federal project number)
- **Contracting agency name** (TXDOT district or the relevant agency)

For non-TXDOT state-funded projects (cities, counties, school districts), the form is WH-347 with those same three additional data points. No unique per-worker fields differ from WH-347.

### Electronic Submission

TXDOT projects: LCPtracker portal (web-based upload, not a public API). Contractors submit directly to LCPtracker; the app generates the PDF/data and the user uploads manually.

Non-TXDOT Chapter 2258 projects: no mandated electronic portal; paper or email submission to the contracting agency.

### Table Stakes vs Differentiators

| Feature | Category | Complexity | Notes |
|---------|----------|------------|-------|
| TX project flag + state gate | Table Stakes | LOW | Same pattern as CA, WA, NY, IL |
| WH-347 reuse for TX (no new form) | Table Stakes | VERY LOW | TX uses WH-347; existing generator covers it |
| TX contract number field on projects | Table Stakes | LOW | New project field: `txContractNumber` |
| TXDOT LCPtracker submission guide | Differentiator | LOW | Modal with LCPtracker portal URL + upload checklist |

### What Makes TX Different From WH-347

TX is structurally identical to the federal WH-347. The only differences are: (1) three additional project-header fields, (2) submission goes to LCPtracker for TXDOT projects vs a federal contracting agency. No per-worker row differences.

**Build recommendation:** TX does not need a new PDF generator. Reuse `fillWh347()` and add a TX-specific project-header overlay for the contract number and agency fields. Gate on `state === "TX"`.

---

## Feature 2: Florida Certified Payroll (FL)

### What Florida Requires

**Confidence: HIGH** — Confirmed definitively.

Florida has **no state prevailing wage law and no state certified payroll form**. Only the federal Davis-Bacon Act applies in Florida, and only on federally funded projects.

### Build Recommendation

Add `"FL"` to the state enum. FL projects use the standard WH-347 (already built). No new PDF generator is needed.

A FL project flag is still useful for:
- Showing "Federal WH-347 required (Florida has no state prevailing wage law)" messaging on the project detail page
- Ensuring the existing WH-347 generator is available
- Future-proofing if FL ever enacts a state law

| Feature | Category | Complexity | Notes |
|---------|----------|------------|-------|
| FL project flag | Table Stakes | VERY LOW | Add "FL" to state enum; route to WH-347 |
| FL informational callout | Differentiator | VERY LOW | HelpCallout: "Florida uses federal WH-347 only" |

**This is a 1-2 plan feature, not a multi-phase state form build.**

---

## Feature 3: Massachusetts Weekly Payroll Report (MA)

### What Massachusetts Requires

**Confidence: HIGH** — Confirmed via Massachusetts General Law c. 149 s. 27B, DLS official form references, and multiple compliance guides.

Massachusetts DLS (Department of Labor Standards) issues a state-specific **"Weekly Certified Payroll Report and Workforce Participation Form"**. This is distinct from the federal WH-347. All contractors and subcontractors on Massachusetts public works projects (any project over $10,000) must submit this form weekly to the awarding authority.

The form is available at: `mass.gov/doc/weekly-certified-payroll-report/download`

### MA Form Fields vs WH-347

**Header fields (same as WH-347 equivalent):**
- Company name, address, phone number
- Payroll number (sequential)
- Work week ending date
- Awarding authority name
- Public works project name and location
- Contract number
- Taxpayer ID (FEIN)
- Min. Wage Rate Sheet number (references the DLS wage schedule)
- General/prime contractor name
- Subcontractor name (separate field)
- Employer signature and title

**Per-worker row fields — MA-specific differences from WH-347:**

| Column | MA Form | WH-347 Equivalent | Notes |
|--------|---------|-------------------|-------|
| Employee name | Same | Same | |
| Address | Same | Same | |
| Occupational classification | Same | Same | |
| Hours Mon–Sat | Same | Same (Mon–Sun on WH-347) | MA uses Mon–Sat columns |
| All other hours | MA-specific | Not on WH-347 | Hours worked outside this project in same week |
| Total project hours | Same | Same | |
| Hourly base wage (B) | Same | Rate of pay | |
| Supplemental unemployment (E) | MA-specific | Not on WH-347 | Fringe sub-column for supplemental unemployment |
| Total hourly prev. wage (F) | MA-specific | Not on WH-347 | Base + all fringe additions |
| Project gross wages (G) | MA-specific | Combined with total on WH-347 | Gross for this project only |
| Total gross wages (H) | MA-specific | Not on WH-347 | Total across all jobs this week |
| Check number | MA-specific | Not on WH-347 | Paycheck number |
| Deductions (itemized) | Similar | Similar | |
| Net wages | Same | Same | |

**Workforce Participation fields — MA-specific, absent from WH-347:**
- For each worker row: Woman (Y/N), Minority (Y/N), Non-Minority designation
- Massachusetts statutory goals: 15.3% minority, 6.9% women workforce participation
- These are tracked aggregate for the project but recorded per-worker on the form

**OSHA 10 field — MA-specific, absent from WH-347:**
- Checkbox per worker: "Employee is OSHA 10 Certified"
- Required the first time a worker appears on a certified payroll for a project
- Documentation of OSHA 10 completion must accompany the first CPR listing the worker
- MA requires all workers on projects over $10,000 to have OSHA 10 certification

**Apprentice field:**
- Whether the apprentice is registered with Massachusetts DLS Division of Apprentice Standards
- Copy of apprentice ID card required with first payroll listing

### Statement of Compliance

Separate from the payroll form — MA requires a **"Weekly Statement of Compliance"** (a companion document, also on `mass.gov`). Must be signed by the employer under pains and penalties of perjury.

### Submission Process

Weekly, to the awarding authority (the public agency running the project), by first-class mail or email. No statewide electronic portal exists. Submitted to the agency, not a central state system.

Retention: 3 years minimum (aligns with federal; MA law c. 149 s. 27B).

### Table Stakes vs Differentiators

| Feature | Category | Complexity | Notes |
|---------|----------|------------|-------|
| MA project flag + state gate | Table Stakes | LOW | Same pattern as existing states |
| MA weekly payroll PDF generator | Table Stakes | HIGH | New form layout, multiple MA-specific columns |
| Workforce participation fields per worker | Table Stakes | MEDIUM | New `isWoman`, `isMinority` boolean columns on `workers` |
| OSHA 10 certified field per worker | Table Stakes | LOW | New boolean column on `workers`; shown first week only |
| "All other hours" input per week | Table Stakes | MEDIUM | New `nonProjectHours` on `payroll_entries` for MA |
| Supplemental unemployment fringe column | Table Stakes | MEDIUM | MA fringe disaggregation: base + supp-unemploy + total |
| Project gross vs total gross wages | Table Stakes | MEDIUM | Need to distinguish project-only pay from worker's total week |
| Check number field | Table Stakes | LOW | Optional text field on payroll entry |
| MA Statement of Compliance companion PDF | Table Stakes | MEDIUM | Second PDF: certification text with signature block |
| MA submission guide modal | Differentiator | LOW | Checklist: submit to awarding authority by mail/email, retain 3 years |

### What Makes MA Different From WH-347

MA has the most differences of the four target states:
1. Workforce participation tracking (minority/women) per worker — regulatory requirement unique to MA
2. OSHA 10 certification checkbox — MA-specific; must be documented on first payroll listing
3. Two gross wage columns (project-only vs total week) — requires workers report all-employer hours
4. "All other hours" column — tracks time outside this project
5. Supplemental unemployment as an explicit fringe sub-column
6. Check number on the form

**Build recommendation:** MA requires a new `fillMaWeeklyPayroll()` PDF generator using a coordinate overlay on the official MA form. Complexity is HIGH. New database columns needed on `workers` (OSHA 10, minority, woman flags) and `payroll_entries` (all-other-hours, check-number).

---

## Feature 4: New Jersey Certified Payroll (NJ)

### What New Jersey Requires

**Confidence: HIGH** — Confirmed via NJ DOL official form MW-562 (rev. 6/2023, updated 2/2025), NJ Wage Hub documentation, and multiple compliance sources.

New Jersey Department of Labor and Workforce Development issues **Form MW-562 "Payroll Certification for Public Works Projects"**. Required under the New Jersey Prevailing Wage Act (N.J.S.A. 34:11-56.25 et seq.). Any contractor or subcontractor on an NJ public works project must file MW-562 with the public body (the awarding agency).

As of August 2024, NJ has also established **NJ Wage Hub** (njwages.nj.gov) as the statewide portal for electronic submission.

### NJ MW-562 Fields vs WH-347

**Header fields — NJ-specific additions:**
- **Contractor Registration Number** — mandatory; contractors must be registered with NJDOL under the Public Works Contractor Registration Act (34:11-56.48) before working on public works
- **Date Wages Due & Paid** — explicit field (WH-347 has payroll period but not this exact framing)
- Public works project name and location
- Contracting public body name
- Week ending date
- Payroll number
- Contractor/subcontractor name and address

**Per-worker row fields — NJ-specific differences from WH-347:**

| Column | NJ MW-562 | WH-347 Equivalent | Notes |
|--------|-----------|-------------------|-------|
| Employee name | Same | Same | |
| Last 4 SSN | Same | Same | |
| Job title / craft | Same | Classification | Includes journeyman/foreman distinction |
| Sex | M/F/N (Non-Binary) | Not on WH-347 | MW-562 includes non-binary option |
| Race | W/B/A/N/I/M codes | Not on WH-347 | White/Black/Asian/Native/Pacific Islander/Multiracial |
| Ethnicity | H/N (Hispanic/Non-Hispanic) | Not on WH-347 | EEO-style demographic field |
| Daily hours Mon–Sat (ST) | Per-day straight-time | Per-day (Mon–Sun on WH-347) | MW-562 uses Mon–Sat |
| Daily hours Mon–Sat (OT) | Per-day overtime | Per-day | |
| Total ST hours | Same | Same | |
| Total OT hours | Same | Same | |
| Rate of pay (ST) | Same | Same | |
| Rate of pay (OT) | Same | Same | |
| Gross amount earned (this project) | Same | Same | |
| Total deductions | Same | Same | |
| Net wages paid for week | Same | Same | |

**Certification section (NJ-specific):**
The MW-562 has a separate certification page with:
- Contractor's statement under oath that payroll is correct and complete
- Fringe benefit certification (same intent as WH-347 page 2)
- Reference to NJ Prevailing Wage Act compliance

### Submission Process

**NJ Wage Hub** (njwages.nj.gov): As of August 2024, this is the established statewide portal for CPR submission. Features direct integration with ADP, Paychex, and QuickBooks. Submission deadline: within 10 days of the payment of wages.

No public machine-to-machine API has been found — Wage Hub appears to be a web portal with direct payroll software integrations (not REST APIs). The app should generate MW-562 PDF + guide users to upload to Wage Hub.

### Table Stakes vs Differentiators

| Feature | Category | Complexity | Notes |
|---------|----------|------------|-------|
| NJ project flag + state gate | Table Stakes | LOW | Same pattern as existing states |
| NJ MW-562 PDF generator | Table Stakes | HIGH | New form layout with demographic columns |
| Contractor Registration Number field on projects | Table Stakes | LOW | New `njContractorRegNumber` text column on `projects` |
| Sex field per worker (M/F/N) | Table Stakes | LOW | Extend existing gender field or add `sex` column |
| Race field per worker (6 codes) | Table Stakes | MEDIUM | New `race` column on `workers` (similar to IL) |
| Ethnicity field per worker (H/N) | Table Stakes | LOW | New `ethnicity` column on `workers` (similar to IL) |
| NJ Wage Hub submission guide modal | Differentiator | LOW | Checklist: portal URL, 10-day deadline, "Mark as Submitted" |

### What Makes NJ Different From WH-347

NJ has three meaningful additions:
1. **Contractor Registration Number** — contractors must be registered with NJDOL; this is a project-level field
2. **Demographic data per worker** (sex, race, ethnicity) — similar to IL but with NJ's specific code set; required by NJ DOL
3. **Non-binary sex option** — MW-562 uses M/F/N where WH-347 doesn't capture sex at all

**Build recommendation:** NJ requires a new `fillNjMw562()` PDF generator. The demographic fields overlap with IL's existing `race`/`ethnicity`/`gender` columns (shipped in v4.0). Reuse those columns where possible. The key new project-level field is `njContractorRegNumber`.

**Cross-state field reuse opportunity:** IL already ships `race`, `ethnicity`, `gender`, `skillLevel` on the `workers` table. NJ uses the same fields with slightly different code values. Reuse the columns; add NJ-gated UI display.

---

## Feature 5: Subcontractor CPR Tracking

### Federal Regulatory Requirement for GC Sub Oversight

**Confidence: HIGH** — Confirmed via 29 CFR Part 5 and DOL Fact Sheet #66C.

Under Davis-Bacon regulations (29 CFR 5.5(a)(6) and 2023 final rule update):
- Prime contractors are **strictly liable** for subcontractor violations — even without knowledge of them
- Primes must ensure all subcontractors submit weekly CPRs
- The contracting agency's contracting officer monitors via prime contractor, but prime bears the compliance burden
- Flow-down clauses in subcontracts must require subs to submit CPRs and maintain records
- Prime contractors must insert Davis-Bacon clauses (29 CFR 5.5(a)(1)–(11)) into every subcontract

**Regulatory consequence:** Prime failure to collect sub CPRs creates back-wage liability and debarment risk. GCs need a tracking tool, not just their own payroll compliance.

### What GCs Track for Sub CPR Compliance

Based on regulatory requirements and industry patterns (LCPtracker, b2gnow, Caltrans requirements):

**Per-subcontractor, per-project:**
- Sub company name
- Sub contractor license number (state license; required in CA, WA, NJ, IL)
- Sub type (lower-tier sub vs direct sub)
- Trade/craft (for context)
- Contract amount (for threshold tracking)
- Davis-Bacon clauses flowed down (Y/N)
- Wage determination provided to sub (Y/N)

**Per-subcontractor, per payroll week:**
- Week ending date
- CPR received (Y/N)
- Date CPR received
- CPR compliant (Y/N / Needs Review)
- Notes / deficiency description (if non-compliant)

**Critical compliance signals:**
- Weeks where CPR not received (overdue flag)
- Weeks where CPR received but not reviewed
- Compliance rate per sub (weeks compliant / weeks active)

### What the Compliance Industry Considers Table Stakes

| Feature | Category | Complexity | Notes |
|---------|----------|------------|-------|
| Add subcontractors to a project | Table Stakes | LOW | New `subcontractors` table: name, license, trade |
| Per-week CPR receipt tracking | Table Stakes | MEDIUM | New `subcontractor_cpr_weeks` table |
| Overdue flag (week passed, CPR not received) | Table Stakes | LOW | Computed from week_ending vs received_date |
| Compliant/Non-Compliant/Pending status per week | Table Stakes | LOW | Enum column on cpr_weeks |
| Sub CPR summary view on project detail | Table Stakes | MEDIUM | Table: sub name, week, received, compliant |
| "Mark CPR Received" action with date | Table Stakes | LOW | Modal or inline date picker |
| Notes/deficiency field per week | Table Stakes | LOW | Text column for audit notes |
| Sub CPR PDF inclusion (store file) | Differentiator | HIGH | File upload/storage: out of scope for v5.0 |
| Automated overdue email alerts | Differentiator | MEDIUM | Extend existing notification system |
| Sub CPR history export (CSV) | Differentiator | LOW | Extend existing CSV export pattern |

### Data Model

Two new tables needed:
- `subcontractors`: `(id, projectId, companyName, licenseNumber, trade, contractAmount, createdAt)`
- `subcontractor_cpr_weeks`: `(id, subcontractorId, weekEndingDate, cprReceivedDate, isCompliant, deficiencyNotes, createdAt, updatedAt)`

### Federal vs State Requirements for GC Records

Federal (29 CFR 5): GC must ensure subs submit CPRs to the contracting officer. GC is not explicitly required to maintain a database of sub CPRs — that obligation runs to the sub directly. However, prime strict liability makes record-keeping effectively mandatory.

State variations:
- CA (Labor Code §1776): Prime must maintain all sub payroll records and make available upon request. CA has the strongest GC retention requirement.
- NY (Article 8): GC certifies sub compliance in MPWR portal submission.
- IL (820 ILCS 130): Similar federal-style flow-down; GC responsible for sub violations.

**Build recommendation:** Model this as "GC compliance tracker" not "sub payroll entry." The GC records receipt/compliance status; they do not re-enter sub payroll data. This keeps scope bounded and avoids the complexity of a full sub payroll entry flow.

---

## Feature 6: Multi-Project Compliance PDF Report

### What GCs Need in a Multi-Project Report

**Confidence: MEDIUM** — Based on industry patterns from LCPtracker, b2gnow, DOL guidance, and eMars; no single authoritative standard exists for this report format.

A multi-project compliance summary answers the question: "Which of my active projects are at risk, and am I current on submissions?" For a GC managing multiple federally/state-funded projects simultaneously, this is the single most useful reporting artifact during an audit or internal review.

### Report Data Requirements

**Project-level summary (one row per project):**
- Project name and contract number
- State + contracting agency
- Project status (Active / Archived)
- Total payroll weeks on record
- Weeks with CPR submitted (count and %)
- Weeks with violations (under-wage, CWHSSA OT, apprentice ratio)
- Most recent payroll week date
- Current compliance status badge (Compliant / Has Violations / Weeks Overdue)
- Active subcontractor count
- Sub CPR weeks overdue (if sub tracking enabled)

**Cross-project summary totals:**
- Total workers across all projects (deduplicated by name+SSN)
- Total active projects
- Total projects with open violations
- Total payroll weeks submitted this year

### Table Stakes vs Differentiators

| Feature | Category | Complexity | Notes |
|---------|----------|------------|-------|
| Multi-project compliance PDF | Table Stakes | MEDIUM | One-click from dashboard; snapshot of all active projects |
| Project-level compliance status per row | Table Stakes | LOW | Reuse existing compliance query per project |
| Week count (submitted vs total) | Table Stakes | LOW | Aggregate query; already tracked |
| Violation count per project | Table Stakes | LOW | Existing compliance engine produces this |
| Sub CPR overdue count per project | Table Stakes | LOW | Derived from sub tracking if enabled |
| Date-stamped snapshot (audit artifact) | Table Stakes | LOW | Report header with generation date, generating user |
| Filter: active-only vs include archived | Differentiator | LOW | Report parameter on generation modal |
| Export as PDF via pdf-lib | Table Stakes | MEDIUM | New `generateComplianceSummary()` function in pdf-lib |
| Email delivery of report | Differentiator | LOW | Extend nodemailer; send to project owner |
| Historical report archive | Anti-Feature | HIGH | Storage complexity not justified; generate on demand |

### Report Format

Single-page landscape PDF where possible; paginate if more than ~15 projects. Use same HCC brand tokens (dark header bar, gold accents, Oswald/Inter typography). Should be "hand to an auditor" quality — not a data dump.

Sections:
1. Cover / header: contractor name, report generated date, user, date range
2. Active projects summary table (one row per project)
3. Violation detail section (projects with violations: list of specific violations)
4. Subcontractor CPR gap section (weeks overdue per sub per project)
5. Certification note (this report is for compliance monitoring only; not an official submission)

---

## Feature Summary Table

| Feature | Build? | Complexity | Depends On |
|---------|--------|------------|-----------|
| TX state flag + WH-347 reuse | YES | LOW | Existing WH-347 generator |
| TX project header fields | YES | LOW | `projects` table migration |
| TX LCPtracker submission guide | YES | LOW | Modal pattern from existing states |
| FL state flag + WH-347 routing | YES | VERY LOW | Existing WH-347 generator |
| MA Weekly Payroll PDF generator | YES | HIGH | New `workers` columns (OSHA10, minority, woman), new `payroll_entries` column (allOtherHours) |
| MA workforce participation fields | YES | MEDIUM | MA-gated worker profile section |
| MA OSHA 10 field | YES | LOW | Boolean on `workers` table |
| MA Statement of Compliance PDF | YES | MEDIUM | Companion to MA payroll PDF |
| NJ MW-562 PDF generator | YES | HIGH | Reuse `race`/`ethnicity` from IL (already shipped v4.0) |
| NJ Contractor Registration Number | YES | LOW | New project field |
| NJ Wage Hub submission guide | YES | LOW | Modal pattern |
| Sub company add/manage | YES | MEDIUM | New `subcontractors` table |
| Sub CPR per-week tracking | YES | MEDIUM | New `subcontractor_cpr_weeks` table |
| Sub overdue flag | YES | LOW | Computed field |
| Sub CPR summary UI | YES | MEDIUM | Project detail page section |
| Multi-project compliance PDF | YES | MEDIUM | Existing compliance queries |
| Audit log CSV export | YES | LOW | Existing `audit_logs` table (v4.0) |
| Enhanced fringe report (fund type/union) | YES | MEDIUM | Existing fringe report + fringe disaggregation |

---

## Anti-Features for v5.0

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| FL state-specific certified payroll form | No state law exists; nothing to build | Add FL flag, route to WH-347, show info callout |
| Sub payroll data entry (full re-entry of sub CPRs) | Scope explosion; subs file their own CPRs | Track receipt/compliance status only; GC does not re-enter sub payroll |
| PDF upload/storage for sub CPRs | File storage infrastructure (S3/CDN) adds major complexity | Track metadata only (received Y/N, date, compliant Y/N, notes) |
| NJ Wage Hub direct API submission | No public API found; Wage Hub is a web portal | Generate PDF + guide user to upload manually |
| Historical compliance report archive | Storage overhead; rarely needed | Generate on demand; user saves locally |
| Multi-user role expansion (admin/viewer) | Deferred in v3.0; still out of scope | Flat owner/member model remains |

---

## Feature Dependencies

```
[TX form]
  └──reuses──> [Existing fillWh347() generator]
  └──requires──> [TX project flag on projects form]
  └──requires──> [txContractNumber field on projects table]

[FL form]
  └──reuses──> [Existing WH-347] (no new form needed)
  └──requires──> [FL project flag on projects form]

[MA form]
  └──requires──> [MA project flag]
  └──requires──> [New workers columns: isOsha10Certified, isMinority, isWoman]
  └──requires──> [New payroll_entries column: allOtherHours]
  └──requires──> [New fillMaWeeklyPayroll() pdf-lib function]
  └──requires──> [Companion fillMaStatementOfCompliance() pdf-lib function]

[NJ form]
  └──requires──> [NJ project flag]
  └──requires──> [New project field: njContractorRegNumber]
  └──reuses──> [workers.race, workers.ethnicity, workers.gender from IL (v4.0)]
  └──requires──> [New fillNjMw562() pdf-lib function]

[Sub CPR tracking]
  └──requires──> [New subcontractors table]
  └──requires──> [New subcontractor_cpr_weeks table]
  └──requires──> [Project detail page: Subcontractors section]
  └──enhances──> [Multi-project compliance report] (adds sub overdue counts)

[Multi-project compliance PDF]
  └──reuses──> [Existing compliance query per project]
  └──reuses──> [Existing pdf-lib infrastructure]
  └──enhances──> [Sub CPR tracking data] if sub tracking is built first
  └──requires──> [New generateComplianceSummary() function]

[Audit log CSV export]
  └──reuses──> [Existing audit_logs table (v4.0)]
  └──requires──> [GET /api/audit/:projectId/export endpoint]
  └──requires──> [Download button on ProjectActivityPage]
```

---

## Phase Ordering Rationale

1. **FL first** (½ phase): Zero-risk state flag; confirms pattern before heavier work
2. **TX second** (1-2 phases): WH-347 reuse makes this low-risk; validates TX state gate pattern
3. **NJ third** (2-3 phases): New PDF form but leverages IL demographic columns already built
4. **MA fourth** (3-4 phases): Most complex state form; most new DB columns; do after simpler states
5. **Sub tracking** (2-3 phases): Independent of state forms; can be built in parallel with MA
6. **Multi-project report** (1-2 phases): Best built after sub tracking so it can include sub overdue data
7. **Audit log CSV export** (½ phase): Lowest-risk; purely additive to existing audit_logs infrastructure
8. **Enhanced fringe report** (1-2 phases): Independent; can slot before or after sub tracking

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| TX form requirements | HIGH | Multiple sources confirm WH-347 equivalent + LCPtracker for TXDOT |
| FL no state form | HIGH | Confirmed: FL repealed PW law 1979; HB 705 (July 2024) preempted local ordinances |
| MA form fields | HIGH | Official DLS form downloaded and analyzed; OSHA 10, minority/women fields confirmed by multiple sources |
| NJ MW-562 fields | HIGH | Official form confirmed; demographic columns (race/sex/ethnicity) confirmed via official NJDOL source |
| NJ Wage Hub portal | MEDIUM | Portal existence and August 2024 launch confirmed; no API documentation found (assumes manual upload pattern) |
| Sub tracking regulatory basis | HIGH | 29 CFR 5 and DOL Fact Sheet #66C confirm prime strict liability; data model derived from industry patterns |
| Multi-project report format | MEDIUM | No official standard; based on eMars/LCPtracker industry patterns and GC audit needs |
| MA OT threshold | MEDIUM | MA follows federal 40-hour/week threshold (confirmed); daily OT only for specific trades (not universal like NY) |

---

## Sources

- [Texas Government Code Chapter 2258](https://statutes.capitol.texas.gov/Docs/GV/htm/GV.2258.htm) — state prevailing wage statute, HIGH confidence
- [TXDOT Statements and Payrolls Manual](https://www.txdot.gov/manuals/tpd/lgp/construction/contract_administration_ch-i1006476/statements_and_payrolls-i1007282.html) — TXDOT LCPtracker requirement
- [TXDOT LCPtracker FAQ](https://www.txdot.gov/business/resources/highway/construction-reports/eprs/lcptracker-faq.html) — electronic submission system
- [Texas Prevailing Wage — CCMI](https://www.ccmilcp.com/texas.html) — form requirement confirmation
- [Florida Prevailing Wage — Workyard 2025](https://www.workyard.com/us-labor-laws/prevailing-wage-florida) — no state law confirmation
- [Florida Prevailing Wage — Payroll4Construction](https://www.payroll4construction.com/fl-prevailing-wage/) — HB 705 preemption details
- [Florida Prevailing Wage — Points North](https://www.points-north.com/state-by-state-certified-payroll-reporting/florida) — federal-only requirement confirmation
- [Massachusetts Weekly Certified Payroll Report (official form)](https://www.mass.gov/doc/weekly-certified-payroll-report/download) — official DLS form
- [Massachusetts Prevailing Wage Laws Guide (DLS)](https://www.mass.gov/doc/massachusetts-prevailing-wage-laws-an-important-guide-for-public-construction-contractors/download) — official guide, HIGH confidence
- [Massachusetts Prevailing Wage — Lumberfi Guide](https://www.lumberfi.com/blog/understanding-massachusetts-certified-payroll-requirements-for-public-works-contractors-a-step-by-step-guide) — OSHA 10 and workforce participation details
- [Massachusetts Prevailing Wage — Workyard 2025](https://www.workyard.com/us-labor-laws/prevailing-wage-massachusetts) — form field details
- [NJ MW-562 Payroll Certification for Public Works Projects (official, rev 6/2023)](https://www.nj.gov/labor/wageandhour/assets/PDFs/wagehub/MW-562%20(6-23)%20PayrollCert-PublicWorks.pdf) — official NJ form
- [NJ MW-562 (rev 2/2025)](https://www.nj.gov/labor/wageandhour/assets/PDFs/wagehub/MW-562%20(12_16B)Payroll%20Cert-Public%20Works%20test%2012%2016B%20(2).pdf) — most current version
- [NJ Wage Hub Contractor User Guide](https://njwages.nj.gov/assets/NJWH_Contractor_User_Guide.pdf) — portal submission documentation
- [NJ Prevailing Wage — Points North / New Jersey](https://www.points-north.com/state-by-state-certified-payroll-reporting/new-jersey) — Wage Hub portal timeline, 10-day deadline
- [DOL Fact Sheet #66C: Davis-Bacon and Related Acts](https://www.dol.gov/agencies/whd/fact-sheets/66C-DBRA-labor-standards) — prime contractor subcontractor responsibility, HIGH confidence
- [29 CFR Part 5 Subpart A](https://www.ecfr.gov/current/title-29/subtitle-A/part-5/subpart-A) — flow-down requirements and prime liability
- [Davis-Bacon Act Regulation Updates — Schwabe](https://www.schwabe.com/publication/davis-bacon-act-regulation-updates-subcontractor-flow-down-requirements/) — 2023 final rule flow-down updates
- [Caltrans Labor Compliance Manual Chapter 13](https://dot.ca.gov/programs/construction/labor-compliance/labor-compliance-manual/chapter-13) — GC sub CPR tracking data points (CA model)
- [Prevailing Wage Laws 2025 — eMars](https://emarsinc.com/blog/prevailing-wage-laws-2025-complete-guide-for-general-contractors) — multi-project GC oversight context

---

*Feature research for: Prevailing Wage Compliance SaaS — v5.0 State Forms (TX/FL/MA/NJ), Subcontractor Tracking, Reporting*
*Researched: 2026-04-07*
