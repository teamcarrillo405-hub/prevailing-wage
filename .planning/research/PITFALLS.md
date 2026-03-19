# Pitfalls Research

**Domain:** Prevailing wage compliance — adding compliance checks and reporting to an existing Davis-Bacon payroll system
**Researched:** 2026-03-19
**Confidence:** HIGH (DOL official sources + direct code audit of existing system)

---

## Critical Pitfalls

### Pitfall 1: Apprentice Ratio Checked Weekly Instead of Daily

**What goes wrong:**
The compliance engine aggregates weekly payroll totals and computes apprentice-to-journeyworker ratio from the week's totals. A week where Monday had a valid ratio but Tuesday had one journeyworker leave early passes the weekly check — but is a violation for Tuesday. Back wages accrue at the full journeyworker rate for every excess apprentice-hour on the violation day.

**Why it happens:**
The existing `payrollEntries` table stores daily ST/OT hours per column, making it tempting to aggregate first and then check. The existing `checkApprenticeRatio()` in `calculations.ts` accepts `journeyworkerCount` and `apprenticeCount` as scalar inputs — it was not designed with a daily loop in mind. Developers wire it at the week level because that is the natural unit of `payrollWeeks`.

**How to avoid:**
For each payroll week, reconstruct per-day presence counts from the daily hour columns (`monSt + monOt > 0` = present that day). Run `checkApprenticeRatio()` once per trade per day, not once per trade per week. A worker with any non-zero hours on a given day counts as "present" for that day's ratio check. Store daily ratio results, not just a single weekly pass/fail flag. The DOL rule: "Compliance with the applicable ratio is determined on a daily, not weekly, basis."

**Warning signs:**
Ratio check passes for a week where any single day had different headcounts. A worker has zero ST and zero OT on a day but the ratio check still counts them as present.

**Phase to address:**
Compliance engine phase (first compliance phase). This constraint must be baked into the ratio check design from the start — retrofitting a daily loop onto a weekly aggregation is expensive.

---

### Pitfall 2: Unregistered Apprentice Treated as Apprentice at Reduced Rate

**What goes wrong:**
`workerClassifications.laborType` can be set to `'apprentice'` with an `apprenticePercent`, but there is no field enforcing whether the worker is enrolled in a DOL-registered or state-recognized apprenticeship program. A contractor marks a helper "apprentice" at 60% rate. The system accepts it. The compliance check does not flag it. On audit, every hour worked at the reduced rate becomes a back-wage liability at the full journeyworker rate.

**Why it happens:**
The schema captures `laborType` and `apprenticePercent` but has no `programRegistered` boolean or registration ID field. The compliance flag for "under-wage" compares `baseRateSnapshot` against the WD rate, but `baseRateSnapshot` was set correctly for the reduced rate — the system has no way to know the registration was invalid.

**How to avoid:**
Add a `programName` or `registeredProgram` field (nullable) to `workerClassifications`. During compliance checking, flag any worker classified as `laborType = 'apprentice'` where `programName IS NULL` as a "registration not confirmed" warning — distinct from an under-wage error, but surfaced clearly before WH-347 is generated. This is a data validation flag, not a calculation error. The DOL rule: unregistered apprentices must be paid the full journeyworker prevailing wage rate for the work actually performed.

**Warning signs:**
Multiple workers with `laborType = 'apprentice'` and `programName = null`. Under-wage flag does not trigger because snapshot was set to the reduced rate, not the journeyworker rate.

**Phase to address:**
Compliance engine phase. Schema addition is add-only (no existing table changes). The flag is a new compliance check, not a recalculation.

---

### Pitfall 3: CWHSSA OT Fringe Multiplied at 1.5x Instead of 1.0x for OT Hours

**What goes wrong:**
The developer implementing the compliance check reads "overtime hours must be paid at 1.5x" and applies the 1.5x multiplier to both base rate and fringe rate. The actual CWHSSA rule: the premium (the extra half-time) applies only to the **base rate**. Fringe benefits are paid at straight time (1.0x) for all hours worked, including OT hours. Applying 1.5x to fringe overstates the required pay and corrupts comparisons.

**Why it happens:**
The existing `calculateCwhssaOt()` in `calculations.ts` already implements this correctly: `overtimePremium = overtimeHours * 0.5 * baseRate` (half-time only, no fringe multiplier) and `totalFringePay = totalHoursWorked * fringeRate` (all hours at 1.0x). The pitfall occurs when new compliance check code independently recalculates expected pay rather than reusing this function — producing a divergent formula.

**How to avoid:**
The compliance engine must reuse `calculateCwhssaOt()` as the single source of truth for what the worker should have been paid. Do not implement OT pay math inline in a new compliance service. The check is: computed expected gross (via `calculateCwhssaOt`) vs. `grossWages` stored in `payrollEntries`. If `grossWages` is null (not yet computed), recompute from hours and snapshots.

**Warning signs:**
OT compliance check and the existing OT scenario tool produce different dollar figures for the same inputs. Fringe appears in the OT premium calculation.

**Phase to address:**
Compliance engine phase. Document explicitly that all OT math routes through `calculateCwhssaOt()` — not a new formula.

---

### Pitfall 4: Multi-Classification Worker's OT Calculated Per Classification Instead of Per Week

**What goes wrong:**
A worker performs carpentry (8 hrs/day) and then operates equipment (2 hrs/day). The system creates two `payrollEntries` rows — one per `classificationId`. The compliance engine checks each classification's hours independently: 40 ST hours of carpentry, 10 ST hours of equipment work — no OT in either row. Actual total hours worked: 50. The worker is owed CWHSSA OT on the 10 hours over 40, computed at the **higher** of the two base rates.

**Why it happens:**
`payrollEntries` has a unique constraint on `(payrollWeekId, workerId, classificationId)`, which naturally produces multiple rows per worker per week when they work multiple classifications. Any per-row compliance check misses cross-classification aggregation. The DOL rule: CWHSSA OT applies to total hours worked in a week across all classifications — and the premium rate is based on the highest base rate worked during the week.

**How to avoid:**
The compliance engine must first group `payrollEntries` by `workerId` within a `payrollWeekId` to compute total hours across all classifications. If total hours > 40, compute OT premium using the highest `baseRateSnapshot` among that worker's entries for the week. Compare total expected gross (ST pay at each classification rate + OT premium at highest rate) against the sum of `grossWages` across all classification rows.

**Warning signs:**
A worker with two classification rows shows 40 ST hours in each row — no OT flag — but total hours are 80. Flag absent despite clearly >40 hours.

**Phase to address:**
Compliance engine phase. The aggregation logic must be built into the compliance query design, not bolted on later.

---

### Pitfall 5: Under-Wage Flag Compares Snapshot Against Live WD Rate

**What goes wrong:**
The compliance engine fetches the current `wageClassifications.baseRate` from the database and compares it to `payrollEntries.baseRateSnapshot`. If the wage determination was updated since the payroll entry was created, the check incorrectly flags old entries as violations.

**Why it happens:**
The project correctly records rate snapshots at entry time (per the `Key Decisions` in PROJECT.md). But a new compliance developer reads the schema, sees both `baseRateSnapshot` on `payrollEntries` and `baseRate` on `wageClassifications`, and assumes the live WD rate is the correct comparator — not the locked snapshot.

**How to avoid:**
The under-wage compliance check must compare `baseRateSnapshot` (what was paid) against the WD rate that was applicable **at the time of that payroll entry**, not the current WD rate. The snapshot IS the locked applicable rate. The correct under-wage flag logic: `grossWages < expectedGrossFromSnapshot`. If the snapshot itself was set incorrectly at entry time, that is a data entry error — surface it as "rate snapshot appears low" with a secondary check against current WD rate, but do not use current WD rate as the primary compliance target.

**Warning signs:**
After any wage determination update, dozens of old payroll entries suddenly show under-wage flags that weren't there before.

**Phase to address:**
Compliance engine phase. Document the snapshot contract in code comments on the compliance service so future developers do not regress it.

---

### Pitfall 6: WH-347 PDF Crashes or Silently Truncates When Workers > 8

**What goes wrong:**
`fillWh347()` in `wh347Generator.ts` renders exactly 8 worker rows using `Math.min(data.workers.length, 8)`. Any project week with more than 8 workers silently drops workers 9+. The PDF generates without error, the user downloads it, and the submission is incomplete.

**Why it happens:**
The WH-347 form page has exactly 8 worker grid rows. The generator correctly limits to 8 but provides no feedback to the caller that truncation occurred. The UI route that will call `fillWh347()` does not know it needs to paginate — it sends all workers in one payload.

**How to avoid:**
The WH-347 generation endpoint must detect when a payroll week has more than 8 workers and generate multiple PDF documents (one per 8-worker page set), each sharing the same Page 2 Statement of Compliance header. Alternatively, generate a multi-page document where pages 1, 3, 5 (odd) are worker grid pages and pages 2, 4, 6 (even) are Statement of Compliance pages, or use the convention confirmed by the DOL: "if more than 8 rows are needed, use additional forms" numbered as Page X of Y. The UI must display the worker count and warn when pagination will occur.

**Warning signs:**
Project has 10 workers. WH-347 PDF generates without error and user sees 8 workers. Workers 9 and 10 are absent from submission. No error shown.

**Phase to address:**
WH-347 UI hookup phase. The pagination design must be decided before connecting the UI to the existing generator — not as an afterthought.

---

### Pitfall 7: Statement of Compliance Checkboxes Auto-Checked Without Actual Compliance Verification

**What goes wrong:**
The `Wh347Compliance` interface requires boolean flags (`certProperPayment`, `certApprentices`, etc.). The UI or API simply defaults all flags to `true` so the PDF generates cleanly. The contractor signs a form certifying compliance that has not been verified. This is the statutory certification — filing a false Statement of Compliance is a federal crime (29 CFR 5.5(a)(3)(ii)).

**Why it happens:**
The generator has no knowledge of compliance state — it just renders whatever booleans it receives. The API endpoint must supply real compliance results, but the path of least resistance is to always pass `true` to get the PDF to generate.

**How to avoid:**
The compliance checks (under-wage, OT errors, apprentice ratio, missing worker data) must run and produce a result before the WH-347 endpoint will generate the PDF. If any compliance violation exists, the PDF can still be generated but the Statement of Compliance checkboxes for the violated categories must be `false` (unchecked), and the UI must display a warning. Never default compliance booleans to `true`. The `certApprentices` flag must only be `true` if the system has verified both ratio compliance and registered program status for every apprentice in that week.

**Warning signs:**
WH-347 generates successfully for a payroll week that has unflagged workers with missing addresses — a known disqualifier for the `certAccuratePayroll` attestation.

**Phase to address:**
WH-347 UI hookup phase and compliance engine phase (they must be built together, not independently).

---

### Pitfall 8: Fringe Benefit Report Averages Fringe Across Weeks

**What goes wrong:**
The fringe benefit summary report computes total fringe paid as `sum(fringeRateSnapshot * totalHours)` aggregated across all weeks and divides by total hours to get an "average fringe rate." This is a reporting display shortcut that obscures weeks where fringe was underpaid relative to the WD fringe rate.

**Why it happens:**
Fringe aggregation looks natural at the project level. The developer computes project totals and derives a per-hour average for the summary row.

**How to avoid:**
The fringe report must display fringe obligations and fringe paid at the **week level per worker** — not as a project aggregate. The compliance-critical view is: for week N, worker W earned X hours; the WD required fringe rate is Y; fringe paid was `fringeRateSnapshot * X`. If fringe paid < Y * X, flag the shortfall. Aggregating first hides per-week deficiencies. The DOL rule: do not average fringe across weeks or projects.

**Warning signs:**
Report shows project-level fringe rate of $4.50/hr. Worker was paid $3.00 fringe for three weeks and $7.50 for one week. Average is $4.50. Per-week deficiencies are invisible.

**Phase to address:**
Fringe benefit report phase.

---

### Pitfall 9: Missing Worker Data Flags Checked at PDF Generation, Not Proactively

**What goes wrong:**
`workers.address` and `workers.ssnLast4` are nullable in the schema. The WH-347 requires both. Validation only runs when the contractor clicks "Generate WH-347" — at which point they may be in deadline-day submission mode. The validation error blocks generation, and the contractor cannot retroactively collect the missing data quickly.

**Why it happens:**
Front-end forms allow creating workers without address/SSN (nullable by design for in-progress projects). Compliance validation is treated as a PDF pre-flight check rather than an ongoing workflow state.

**How to avoid:**
The dashboard compliance status should surface "workers missing required data" as a project-level warning visible before any payroll week is submitted. The workers list page should visually mark incomplete workers. The WH-347 generation route may still block on missing data, but the user should have been warned at every prior touchpoint so they can fix it in advance.

**Warning signs:**
Contractor completes full payroll entry and clicks WH-347 generation — blocked with "worker address missing" error with no clear path back to fix it.

**Phase to address:**
Dashboard compliance status phase (earliest) and WH-347 UI hookup phase (enforcement point).

---

### Pitfall 10: Compliance Engine Joins Live Worker Records Instead of Payroll-Time Snapshots

**What goes wrong:**
The compliance engine queries `workers.name`, `workerClassifications.tradeCode`, and `workerClassifications.laborType` at the time the compliance check runs. If a worker's classification was changed after payroll was entered (e.g., reclassified from apprentice to journeyworker), the compliance check now evaluates old payroll entries against new classification data. An old payroll week appears compliant because the now-journeyworker status looks fine.

**Why it happens:**
`payrollEntries` stores `classificationId` as a foreign key but does not snapshot the `laborType` or `apprenticePercent` at entry time. The compliance engine must join to `workerClassifications` to know if a worker was an apprentice in that week — but the classification record is mutable.

**How to avoid:**
The compliance engine should read `laborType` and `apprenticePercent` from the `workerClassifications` row referenced by `payrollEntries.classificationId`, but also acknowledge that this record could have changed. For audit-quality compliance, add `laborTypeSnapshot` and `apprenticePercentSnapshot` columns to `payrollEntries` (add-only, no existing data migration) so that the compliance check at any future date reflects what was true at the time of payroll entry. Until then, document the known limitation: classification changes retroactively affect historical compliance checks.

**Warning signs:**
After reclassifying a worker, all prior payroll weeks for that worker flip compliance status without any data change to the payroll entries themselves.

**Phase to address:**
Compliance engine phase (schema addition) or flagged as a known limitation if the phase budget does not support the schema addition.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Weekly apprentice ratio check instead of daily | Simpler query, faster to build | Silent violations every time journeyworkers fluctuate within a week; back-wage liability on audit | Never — daily is the regulatory standard |
| Auto-check all Statement of Compliance booleans | PDF generates without requiring compliance results | False certification; potential federal liability for contractor; system appears to verify what it does not | Never |
| Compare snapshot to current WD rate for under-wage | One query instead of two | False positives after every WD update; alert fatigue; contractors stop trusting the tool | Never |
| Fringe report as project aggregate | Single aggregation query | Per-week deficiencies invisible; cannot identify which weeks to correct | Only for project overview rows — must also show week-level detail |
| Single WH-347 page capped at 8 workers | Simpler PDF logic | Submissions silently incomplete for any project with >8 workers in a week | MVP only if there is a hard error + warning blocking submission |
| Skip `laborTypeSnapshot` on payroll entries | No schema migration needed | Historical compliance checks affected by future classification changes | Acceptable for v2 if documented as known limitation; add in v3 |

---

## Integration Gotchas

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| Reading `grossWages` for compliance comparison | Assuming `grossWages` is always populated — it is nullable in schema | Always recompute expected gross from hours * snapshot rate; use `grossWages` as a cross-check, not the primary value |
| Joining `payrollEntries` to `workers` for compliance | Selecting `workers.name` and assuming one worker = one entry per week | Group by `workerId` first; a worker may have multiple entries per week (one per classification) |
| Fetching `otThresholds` for compliance | Using default 40-hr threshold if no row exists — correct for CWHSSA, but CBA/state configs exist | Always call `getOrDefaultThreshold()` — do not hardcode 40 in compliance service code |
| `apprenticePercent` on `workerClassifications` | Treating null as 0% (pay nothing) instead of flagging as invalid data | Null `apprenticePercent` on an apprentice classification is a data integrity warning — do not silently compute 0 |
| `wdIdentifier` on projects | Assuming all projects have a locked WD | `wdIdentifier` is nullable; compliance engine must handle projects without a WD gracefully (skip WD-rate checks, surface "no WD locked" warning) |
| Reading existing `payrollEntries` for reports | Fetching all entries then filtering in JS | Use Drizzle queries with project/week filter at DB level; a project could have years of weekly entries |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Running compliance check per-request on dashboard load | Dashboard takes 3–5 seconds to load when project has 52+ weeks | Pre-compute compliance status when payroll week is saved (write-time computation), cache result in a `complianceStatus` column or table | At ~20+ payroll weeks with 5+ workers each |
| Generating all WH-347 PDFs for all weeks when user visits dashboard | Out-of-memory spike; PDF generation is synchronous in pdf-lib | Only generate PDF on explicit user action (button click); never eagerly generate | Any project with >2 payroll weeks |
| N+1 queries in compliance engine (one DB query per worker per week) | Slow compliance check; SQLite handles it but response latency grows visibly | Batch-fetch all entries for a week in one query, then compute in memory | At 10+ workers per week |
| Loading `rawDocument` (full WD text) in compliance queries | Slow joins; `rawDocument` can be hundreds of KB per WD | Never join `wageDeterminations.rawDocument` in compliance or report queries; only select the rate fields from `wageClassifications` | Every compliance query |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Compliance check endpoint without project ownership assertion | Any authenticated user can run compliance checks against any project's payroll data | Reuse `assertProjectOwner()` pattern from existing payroll routes on all new compliance and report endpoints |
| WH-347 PDF endpoint without ownership check | Sensitive worker data (SSN last 4, address, wages) exposed to wrong user | Same pattern — verify project ownership before generating any PDF |
| Returning raw SSN data in compliance API responses | SSN last 4 visible in JSON responses beyond what PDF rendering requires | Never include `ssnLast4` in compliance check API responses; only include it in the PDF generation payload that goes directly to the PDF buffer |
| Logging compliance results with worker PII | Compliance logs contain wage amounts, SSN fragments | Sanitize server logs — log worker IDs, not names/SSN; log violation type, not full wage data |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Compliance check result shown only as red/green for the whole week | Contractor cannot identify which worker has the violation without re-reading all entries | Show per-worker compliance rows in the payroll week view; each worker row gets its own status indicator |
| WH-347 button visible even when compliance violations exist | Contractor generates and submits a form with known violations; gets it rejected or audited | Show WH-347 button as disabled with tooltip "Resolve X compliance flags before generating" — or allow generation with a confirmation warning listing violations |
| Fringe benefit report shows hourly rates only, not week totals | Contractor cannot verify total fringe obligation for a submission period without manual math | Show both hourly rate and computed weekly fringe amount (rate * total hours) per worker per week |
| Worker pay history report sorted by entry creation date | Recent corrections appear at the bottom; contractor cannot see latest week at a glance | Default sort: descending by `weekEndingDate`; secondary sort by worker name |
| Dashboard compliance status shows aggregate "2 violations" with no drill-down | Contractor cannot act on the number without navigating to each project and scanning each week | Dashboard card links directly to the first week with a violation; violation count is a clickable link |
| Statement of Compliance checkboxes shown as pre-filled | Contractor assumes these are automatic; does not review what each certification means | Display checkbox labels as read-only confirmation text when all pass; only show interactive checkboxes for items that cannot be auto-verified (e.g., certifying that work was actually performed) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Apprentice ratio compliance:** Only passes for the week total — verify that daily counts per trade are computed from individual day columns, not week aggregates
- [ ] **WH-347 generation with >8 workers:** Generates without error but silently truncates — verify worker count is surfaced and pagination is implemented or blocked
- [ ] **Statement of Compliance booleans:** Defaults to all `true` — verify that compliance flags drive the boolean values, not the other way around
- [ ] **Under-wage flag:** Compares snapshot to current WD rate — verify it compares snapshot to snapshot-derived expected pay
- [ ] **Multi-classification OT:** No flag on a worker with two 40-hour classification rows — verify total hours across all classifications are aggregated per worker per week
- [ ] **Fringe report per week:** Shows project average — verify week-level per-worker breakdown exists, not just project totals
- [ ] **Dashboard compliance status:** Shows static data — verify it reflects current payroll state, not a stale snapshot
- [ ] **Missing worker data warnings:** Only shown at PDF generation — verify warnings surface at dashboard and worker list before submission day
- [ ] **WH-347 route ownership check:** New endpoint added without copying `assertProjectOwner()` — verify all new routes have the ownership assertion

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Apprentice ratio checked weekly instead of daily | HIGH | Refactor compliance query to reconstruct daily presence from column data; re-run compliance for all affected weeks; notify users of recalculated results |
| Statement of Compliance auto-checked | HIGH | Requires immediate fix + communication to any users who generated forms; document in audit trail |
| Under-wage flag comparing wrong rate | MEDIUM | Change comparator in compliance service; re-run all under-wage checks; false positives disappear, real violations may surface |
| WH-347 truncating at 8 workers | MEDIUM | Add pagination; users with >8 workers must regenerate; prior submissions may be incomplete |
| Fringe report averaging across weeks | LOW | Refactor query to group by week; no data change required |
| Missing data flag only at PDF generation | LOW | Add same flag logic to dashboard query; existing data unchanged |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Apprentice ratio checked weekly instead of daily | Compliance engine (first compliance phase) | Test: worker with journeyworker absent Tuesday still triggers ratio flag for Tuesday only |
| Unregistered apprentice reduced rate | Compliance engine (schema + flag) | Test: apprentice with null programName shows warning flag, not under-wage error |
| CWHSSA OT fringe multiplied at 1.5x | Compliance engine | Test: `calculateCwhssaOt()` is the only OT formula in compliance service; no inline math |
| Multi-classification OT missed | Compliance engine | Test: worker with 2 classification rows totaling 50 hrs triggers OT flag |
| Under-wage flag uses live WD rate | Compliance engine | Test: updating WD rate does not flip old payroll entries to violation status |
| WH-347 truncates at >8 workers | WH-347 UI hookup phase | Test: payroll week with 10 workers generates 2-page or blocks with clear warning |
| Statement of Compliance auto-checked | WH-347 UI hookup phase (must integrate with compliance results) | Test: week with under-wage flag produces WH-347 with `certProperPayment = false` |
| Fringe report averages across weeks | Fringe benefit report phase | Test: worker paid $3 fringe for 3 weeks and $7.50 for 1 week shows 3 weeks flagged |
| Missing worker data proactive warning | Dashboard phase (early) | Test: worker with null address shows warning on dashboard and workers list |
| Compliance engine joins live classification data | Compliance engine | Test: changing classification after payroll entry does not change historical compliance result |

---

## Sources

- [DOL Davis-Bacon Compliance Principles](https://www.dol.gov/agencies/whd/government-contracts/prevailing-wage-resource-book/db-compliance-principles) — daily ratio enforcement, fringe annualization, multi-classification OT rule
- [DOL CWHSSA and FLSA Overtime on Government Contracts](https://www.dol.gov/sites/dolgov/files/WHD/prevailing-wage-presentations/dbra-seminars/CWHSSA-and-FLSA-Overtime-and-Government-Contracts.pdf) — CWHSSA fringe exclusion from OT premium
- [Points North — Apprenticeship Ratios and Prevailing Wage](https://www.points-north.com/trends-and-insights/apprenticeship-ratios-prevailing-wage-requirements) — per-trade ratio calculation, mid-shift ratio violation, weekly-average error pattern
- [LumberFi — New WH-347 Form 2025](https://www.lumberfi.com/blog/the-new-wh-347-form-what-construction-companies-need-to-know-about-2025-certified-payroll-changes) — 2025 fringe benefit reporting expansion, apprentice tracking fields
- [SMACNA — Best Practices for Apprentices on Davis-Bacon Projects](https://www.smacna.org/news/smacnews/issue-archive/issue/articles/smacnews-july-august-2023/best-practices-for-using--apprentices--on-davis-bacon-projects) — unregistered apprentice rate rule
- [DOL Fringe Benefit Annualization — via LCPtracker](https://lcptracker.com/uncategorized/prevailing-wages-and-fringes-under-davis-bacon/) — annualization formula using all hours worked
- [Construction Business Forms — WH-347 Instructions](https://www.construction-business-forms.com/instructions-wh-347-348.html) — 8-worker row limit, Page X of Y pagination requirement
- Direct code audit: `src/server/services/calculations.ts`, `wh347Generator.ts`, `otCalculator.ts`, `payrollService.ts`, `db/schema.ts` (2026-03-19)

---
*Pitfalls research for: Davis-Bacon prevailing wage compliance — compliance checks and reporting milestone*
*Researched: 2026-03-19*
