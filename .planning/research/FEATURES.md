# Feature Research

**Domain:** Prevailing wage compliance management — contractor-facing certified payroll submission tooling
**Researched:** 2026-03-19
**Confidence:** HIGH (regulatory requirements grounded in 29 CFR Part 5, DOL official sources, WH-347 form instructions; competitor features from LCPtracker, B2GNow, eCPR sources)

---

## Regulatory Foundation

This research is grounded in:
- **Davis-Bacon Act** and **Copeland Act** (29 CFR Part 3, Part 5)
- **Contract Work Hours and Safety Standards Act (CWHSSA)** — governs OT on federal contracts
- **WH-347 form** (revised January 2025, OMB No. 1235-0008, valid through 01/31/2028)
- **29 CFR 5.5(a)(3)(ii)** — weekly certified payroll submission requirements
- DOL WHD enforcement patterns from published investigations

### Critical 2025 WH-347 Change

The WH-348 (separate Statement of Compliance) **no longer exists as a standalone form**. It has been consolidated onto the WH-347. This affects the existing "Statement of Compliance form generation" requirement — it is now part of WH-347 generation, not a separate document. The existing pdf-lib overlay must be updated to reflect the January 2025 revision.

---

## Feature Landscape

### Table Stakes — What a GC Must Have to Submit a Compliant WH-347 Package

Features that must exist for a contractor to achieve regulatory compliance. Missing any of these means the contractor cannot legally submit or risks DOL violation.

| Feature | Why Required | Regulatory Basis | Complexity | Dependency on Existing Features |
|---------|--------------|-----------------|------------|----------------------------------|
| **Under-wage flag** — alert when worker's hourly rate falls below applicable WD rate | Most common DOL violation; workers must be paid "not less than" the prevailing rate | 29 CFR 5.5(a)(1); WH-347 certification language | LOW | Requires rate snapshots on payroll entries (already done), WD data (already fetched) |
| **CWHSSA OT error flag** — alert when OT hours exist but are paid at straight time or below prevailing rate | CWHSSA requires 1.5x for hours > 40/week on federal contracts; $10/day/violation in liquidated damages | CWHSSA; 29 CFR 5.8 | LOW | Requires hours-by-day entry (already done) |
| **Missing SSN/address flag** — block or warn before WH-347 generation if worker data is incomplete | WH-347 requires last 4 SSN and worker address; submission is invalid without them | WH-347 form instructions; 29 CFR 5.5(a)(3) | LOW | Requires worker records (already done) |
| **Journeyworker / Registered Apprentice classification field** | 2025 WH-347 added mandatory J/RA checkbox per worker row; previously implicit | WH-347 Rev. Jan 2025 — new required field | LOW | Requires worker classification model update |
| **Apprentice ratio compliance check** — flag when apprentices exceed the permitted ratio per trade per day | Apprentices in excess of ratio must be paid journeyworker rate; ratio is applied daily | 29 CFR 5.2; 29 CFR 5.5(a)(4) | MEDIUM | Requires J/RA classification field above; requires daily hours breakdown |
| **WH-347 accessible from payroll week view** — one-click PDF generation | GC workflow: enter payroll → generate form → submit; any friction causes version errors | Workflow completeness | LOW | Requires existing fillWh347() function; needs route from payroll week UI |
| **Statement of Compliance integrated into WH-347 PDF** | WH-348 is now part of WH-347 (Jan 2025 revision); separate form is outdated | WH-347 Rev. Jan 2025 | MEDIUM | Requires pdf-lib overlay update to 2025 form; certification checkboxes 1, 2, 3, 6 always required |
| **Fringe benefit summary report** — per worker per project, showing hours × hourly fringe credit | 2025 WH-347 requires itemized fringe breakdown (total credit, cash-in-lieu); auditors review this | WH-347 Rev. Jan 2025 fringe columns; 29 CFR 5.26 | MEDIUM | Requires fringe rate data stored per classification (check existing union/GSA rate model) |
| **Worker pay history report** — all payroll weeks for a worker on a project | DOL investigators cross-reference payroll records across weeks; 3-year retention required | 29 CFR 3.4(b); 29 CFR 5.5(a)(3)(ii)(G) | LOW | Requires querying across payroll_entries by worker + project |
| **Dashboard — project compliance status** | Contractors with multiple projects need to see which ones have open violations before submission; enterprise tools (LCPtracker) lead with this | Workflow completeness; mirrors LCPtracker/B2GNow pattern | MEDIUM | Requires compliance flag data to exist before dashboard can surface it |
| **No-work-week certification** | If no work was performed in a week, federal agencies still require a "no work" certified payroll submission; omitting this is a common audit finding | 29 CFR 5.5(a)(3)(ii)(A); eBacon guidance | LOW | Standalone feature; UI needs a "no work this week" toggle on payroll entry |

### Differentiators — Features That Reduce Contractor Risk Beyond Minimum Compliance

Features that go beyond the regulatory floor. Valuable but not blocking submission.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Classification mismatch warning** — flag when worker is doing sheet metal work but classified as laborer | Most frequent DOL investigation trigger (per DOL enforcement releases); proactive catch vs reactive penalty | HIGH | Requires text/trade mapping; scope risk — defer unless job descriptions are captured |
| **Payroll week completeness indicator** — show which workers have entered hours vs not for a given week | Prevents missing-worker submissions; LCPtracker shows this in their contractor dashboard | LOW | Query workers on project vs workers with payroll_entries in that week |
| **Fringe benefit cash-in-lieu calculation** — compute cash equivalent when no bona fide plan exists | 2025 WH-347 added explicit cash-in-lieu column; many contractors don't know they need this | MEDIUM | Requires fringe rate model to distinguish funded vs unfunded fringe |
| **Submission checklist per week** — show required steps before WH-347 can be submitted (hours complete, flags cleared, signed) | Mirrors LCPtracker workflow; prevents partial submissions | LOW | Depends on compliance flags being implemented first |
| **Wage determination expiration alert** — warn when cached WD is approaching 30-day refresh | Contractors who use stale WDs may underpay after a rate increase | LOW | Requires reading WD cache timestamps (already stored in wdolSync.ts logic) |
| **Multi-week compliance summary** — show trend of violations across all payroll weeks on a project | DOL investigators review first 4-5 weeks in detail; contractor needs visibility into this window | MEDIUM | Aggregation query across compliance_flags table |

### Anti-Features — Commonly Requested, Often Problematic

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Auto-submit to agency portal** | Contractors want one-click submission | Each agency has different submission portals (LCPtracker, B2GNow, agency email); no standard API; auto-submit creates liability if form has errors | Generate PDF + provide download; contractor submits manually with eyes on the document |
| **Payroll integration (QuickBooks/ADP)** | Reduces double entry | Creates reconciliation complexity; prevailing wage needs rate-locked snapshots that payroll systems don't preserve; already marked out of scope | Manual entry is the compliance audit trail — document this explicitly in UI as intentional |
| **Real-time DOL rate sync** | Contractors want always-current rates | WDs are published on a schedule; real-time sync creates rate instability mid-payroll-week; rate snapshots at entry time are the correct compliance pattern | 30-day cache + monthly sync (already implemented); alert on stale WD |
| **State-specific forms (CA DIR, WA L&I)** | Multi-state contractors need these | State form formats vary significantly; federal WH-347 is the universal baseline; out of scope for v2 | Clearly document federal-only scope; add state forms as a named future milestone |

---

## Feature Dependencies

```
[Under-wage flag]
    └──requires──> [Rate snapshots on payroll entries] (already built)
    └──requires──> [WD rate data in DB] (already built)

[CWHSSA OT flag]
    └──requires──> [Daily ST/OT hours entry] (already built)
    └──requires──> [Worker's prevailing rate for classification] (already built)

[Apprentice ratio check]
    └──requires──> [J/RA classification field on worker] (NEW — must build first)
    └──requires──> [Daily hours by classification] (already built)
    └──requires──> [Registered apprentice program info] (NEW — minimal: boolean + program name)

[Fringe benefit summary report]
    └──requires──> [Fringe hourly credit stored per classification] (check existing union/GSA model)
    └──requires──> [Hours entries per week per worker] (already built)

[Dashboard — project compliance status]
    └──requires──> [Compliance flags computed] (NEW — all three flags above)
    └──requires──> [Project list] (already built)

[WH-347 from payroll week view]
    └──requires──> [fillWh347() PDF function] (already built)
    └──requires──> [Route/link from payroll week UI] (NEW — UI only)

[Statement of Compliance in WH-347]
    └──requires──> [2025 WH-347 form update] (NEW — pdf-lib overlay update required)
    └──requires──> [J/RA classification field] (NEW — feeds new WH-347 checkbox)

[No-work-week certification]
    └──requires──> [Payroll week model] (already built — add boolean flag)

[Worker pay history report]
    └──requires──> [Payroll entries across weeks] (already built)
    └──requires──> [Worker + project linkage] (already built)
```

### Dependency Notes

- **J/RA classification field is a blocker for two features:** WH-347 2025 compliance (mandatory checkbox) and apprentice ratio check. Build this in the first phase of v2.
- **Compliance flags must exist before dashboard:** Dashboard is a read of computed flags; it has no logic of its own. Build flags first, dashboard second.
- **WH-347 PDF overlay must be updated to 2025 form:** The current overlay targets the pre-2025 form. The WH-348 no longer exists separately — Statement of Compliance is now on the back of WH-347 page 1 (consolidated). This is a correctness issue, not just a feature add.
- **Fringe benefit summary requires verifying the existing rate model:** Union trade configs and GSA rate builder store fringe rates. Verify those are accessible as hourly credit per worker-week before building the report.

---

## MVP Definition for v2.0 Milestone

### Launch With (v2.0)

Minimum viable for a contractor to submit a compliant 2025 WH-347 package with no open regulatory gaps.

- [ ] **J/RA classification field on worker** — blocks 2025 WH-347 compliance and apprentice ratio check
- [ ] **WH-347 PDF updated to January 2025 form** — current overlay is on the pre-2025 form; Statement of Compliance now consolidated
- [ ] **WH-347 accessible from payroll week view** — one UI route addition; removes the workflow dead end
- [ ] **Under-wage compliance flag** — most common DOL violation; highest audit risk
- [ ] **CWHSSA OT error flag** — $10/day/violation; liquidated damages risk
- [ ] **Missing SSN/address flag before WH-347 generation** — submission is invalid without these fields
- [ ] **Apprentice ratio compliance check** — apprentices in excess of ratio must be paid journeyworker rate
- [ ] **Dashboard with project compliance status** — surface all open flags across projects; contractor orientation point
- [ ] **Fringe benefit summary report** — per worker per project; DOL auditors request this
- [ ] **Worker pay history report** — cross-week view; standard audit document

### Add After Validation (v2.x)

- [ ] **No-work-week certification** — add when contractors report audit findings about missing no-work submissions
- [ ] **Payroll week completeness indicator** — add when usage shows contractors submitting with missing workers
- [ ] **Wage determination expiration alert** — add when contractors report rate staleness issues
- [ ] **Submission checklist per payroll week** — add when workflow confusion is observed post-v2 launch

### Future Consideration (v3+)

- [ ] **State-specific forms** — CA DIR, WA L&I; significant scope; warranting its own milestone
- [ ] **Multi-user / subcontractor management** — GC managing subs' certified payrolls; LCPtracker's core use case at enterprise scale
- [ ] **Classification mismatch warning** — requires capturing actual job duties, not just trade codes; scope risk in v2
- [ ] **Fringe benefit cash-in-lieu calculator** — valuable but requires funded vs unfunded fringe model update

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| J/RA classification field on worker | HIGH | LOW | P1 |
| WH-347 updated to 2025 form | HIGH | MEDIUM | P1 |
| WH-347 one-click from payroll week | HIGH | LOW | P1 |
| Under-wage flag | HIGH | LOW | P1 |
| CWHSSA OT error flag | HIGH | LOW | P1 |
| Missing SSN/address flag | HIGH | LOW | P1 |
| Apprentice ratio check | HIGH | MEDIUM | P1 |
| Dashboard — project compliance status | HIGH | MEDIUM | P1 |
| Fringe benefit summary report | HIGH | MEDIUM | P1 |
| Worker pay history report | MEDIUM | LOW | P1 |
| No-work-week certification | MEDIUM | LOW | P2 |
| Payroll week completeness indicator | MEDIUM | LOW | P2 |
| WD expiration alert | LOW | LOW | P2 |
| Submission checklist per week | MEDIUM | LOW | P2 |
| State-specific forms | HIGH | HIGH | P3 |
| Classification mismatch warning | HIGH | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | LCPtracker Pro | B2GNow/eComply | Our Approach |
|---------|---------------|----------------|--------------|
| Compliance validation checks | 80+ automated checks, real-time alerts | Flags CPR vs on-site discrepancies | Start with the 4 DOL-critical flags; expand iteratively |
| Dashboard | Project-level compliance status, apprentice hiring goals, workforce reporting | Real-time insights, participation targets | Project compliance status with open flag count; simpler scope |
| Certified payroll generation | Electronic WH-347, supports 20+ payroll integrations | Electronic CPR submission | pdf-lib coordinate overlay already built; update to 2025 form |
| Fringe benefit reporting | Detailed fringe tracking with plan numbers | Rate monitoring including pre-increases | Hourly credit summary per worker per week |
| Apprentice ratio tracking | Yes — ratio compliance per trade | Yes | Daily ratio check per classification |
| Statement of Compliance | Integrated into WH-347 workflow | Part of CPR submission | Consolidated onto WH-347 PDF (2025 form); not separate |
| Worker pay history | Yes — cross-week workforce reporting | Yes | Tabular report filtering by worker across all payroll weeks |
| No-work week | Yes — required submission type | Yes | P2; flag + generate WH-347 with "no work" certified |

---

## DOL Compliance Requirements Summary

### What a GC Must Have for a Compliant WH-347 Package

1. **Weekly submission** — WH-347 for every week work is performed (and for no-work weeks on some contracts)
2. **Worker data** — name, last 4 SSN, address, trade classification, J/RA status
3. **Hours** — daily ST and OT hours; total hours for week
4. **Wage rates** — rate paid vs prevailing rate; both must appear
5. **Fringe benefits** — total credit per hour, cash-in-lieu if no bona fide plan
6. **Deductions** — taxes, FICA, any permissible deductions from gross
7. **Statement of Compliance** — six certification checkboxes; boxes 1, 2, 3, 6 always required; signatory name, title, phone, email (new in 2025 form)
8. **Payroll number** — sequential number per project per week

### What DOL Auditors Look For First

Per published DOL investigation patterns and agency guidance:

1. **Weeks 1-4 of every project** — auditors review first four to five weeks in detail for every contractor
2. **Worker misclassification** — most frequently cited violation; worker performing higher-skill work at lower-classification rate
3. **OT underpayment** — CWHSSA violations; straight-time payment for overtime hours
4. **Fringe benefit gaps** — fringe credit not reaching required level; no documentation of plans
5. **Missing payrolls** — gaps in weekly submission sequence
6. **Apprentice ratio violations** — apprentices beyond permitted ratio paid at lower rate than required

### Retention Requirement

Records must be preserved for **3 years** after project completion (29 CFR 3.4(b); 29 CFR 5.5(a)(3)(ii)(G)).

---

## Sources

- [DOL WH-347 Form Instructions and Current Form (Rev. Jan 2025)](https://www.dol.gov/agencies/whd/forms/wh347)
- [eCFR 29 CFR Part 5 — Davis-Bacon Labor Standards Provisions](https://www.ecfr.gov/current/title-29/subtitle-A/part-5)
- [LCPtracker Pro — compliance validation features](https://lcptracker.com/solutions/lcptracker)
- [LCPtracker — FAQ on revised WH-347](https://lcptracker.com/blog-post/faq-how-to-complete-the-revised-wh-347-form/)
- [B2GNow Prevailing Wage Labor Compliance Software](https://b2gnow.com/solutions/prevailing-wage-labor-compliance/)
- [Points North — WH-347 Updates 2025](https://www.points-north.com/trends-and-insights/wh-347-updates-2025)
- [Points North — Most Common Prevailing Wage Compliance Errors](https://www.points-north.com/trends-and-insights/prevailing-wage-investigations-the-most-common-contractor-errors)
- [LumberFi — New WH-347 Form 2025 Guide](https://www.lumberfi.com/blog/the-new-wh-347-form-what-construction-companies-need-to-know-about-2025-certified-payroll-changes)
- [eBacon — Davis-Bacon Certified Payroll Requirements](https://www.ebacon.com/prevailing-wage-info/davis-bacon-certified-payroll-requirements/)
- [DOL CWHSSA/Prevailing Wage Resource Book](https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/Tab20.pdf)
- [DOL Desk Guide to Davis-Bacon Act](https://www.energy.gov/gc/articles/desk-guide-davis-bacon-act)

---

*Feature research for: Prevailing wage contractor compliance tooling — v2.0 milestone*
*Researched: 2026-03-19*
