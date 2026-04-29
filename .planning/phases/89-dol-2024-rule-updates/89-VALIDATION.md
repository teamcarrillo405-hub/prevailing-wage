# Phase 89 Validation — DOL 2024 Rule Updates

**Requirement:** COMP-08
**Plans:** 89-01, 89-02, 89-03 (all Wave 1 — fully parallel)

---

## Automated Checks

Run all three after executing the plans:

```bash
# 1. TypeScript — no new errors introduced
cd /c/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | grep -E "error TS" | wc -l
# Expected: 0 (or same count as before phase — known pre-existing errors in workers.ts are allowed)

# 2. WH347_FORM_REVISION constant exported and used
grep -n "WH347_FORM_REVISION\|Rev. Jan. 2025\|setTitle" src/server/services/wh347Generator.ts
# Expected: 3+ matches (constant declaration, setText call, setTitle call)

# 3. Deduction ratio check in compliance engine
grep -n "deduction-ratio\|DEDUCTION_RATIO_CAP\|deductionViolations" src/server/services/complianceService.ts
# Expected: 5+ matches

# 4. Deduction warning in PayrollWeekDetailPage
grep -n "deductionViolations\|30% Deduction Cap\|29 CFR Part 3" src/client/pages/PayrollWeekDetailPage.tsx
# Expected: 3+ matches

# 5. Civil penalty display in ProjectDetailPage
grep -n "CIVIL_PENALTY_PER_VIOLATION\|Civil Penalty Exposure\|13_508" src/client/pages/ProjectDetailPage.tsx
# Expected: 3+ matches

# 6. Run test suite (including new wh347Generator test)
cd /c/Users/glcar/prevailing-wage && npm test 2>&1 | tail -15
# Expected: all tests pass, no regressions
```

---

## Plan-by-Plan Acceptance

### 89-01: WH-347 Form Revision Metadata

| Check | Expected |
|-------|----------|
| `WH347_FORM_REVISION` exported | `'Rev. Jan. 2025'` |
| `pdfDoc.setTitle(...)` in fillSingleSet | Before `form.flatten()` |
| `setText(form, 'header_formRevision', ...)` | Before `form.flatten()` |
| Test: `pdfDoc.getTitle()` | `'WH-347 Certified Payroll — Rev. Jan. 2025'` |
| Existing fillWh347 behavior | Unchanged — same widget names, same chunking logic |

### 89-02: 30% Deduction Rule Check

| Check | Expected |
|-------|----------|
| `DeductionViolation` interface exported | Present with `deductionPct` field |
| `deductionViolations` on ComplianceResult | Yes |
| `hasViolations` includes deductionViolations | No — intentionally excluded |
| Amber warning in PayrollWeekDetailPage | Appears when `deductionViolations.length > 0` |
| Warning class | `bg-amber-50 border-amber-200 text-amber-800` |
| Normal payroll (deductions < 30%) | Warning does not appear |

### 89-03: Civil Penalty Display

| Check | Expected |
|-------|----------|
| `CIVIL_PENALTY_PER_VIOLATION` constant | `13_508` |
| Card renders on violations | `violationCount > 0 && project.status === 'active'` |
| Card hidden on clean project | Correctly absent |
| Card hidden on archived project | Correctly absent |
| Max exposure formula | `violationCount * 13508` |
| Regulatory citation | "29 CFR Part 5.14, 2024" in UI copy |

---

## Regression Guard

These behaviors must be unchanged after the phase:

- WH-347 PDF generation for 8-worker and multi-page payrolls
- Existing compliance violations (under-wage, cwhssa-ot, apprentice-ratio) still fire and appear in PayrollWeekDetailPage
- ProjectDetailPage archive/restore, notification panel, subcontractors panel, wage determinations panel — all unaffected
- No new DB migration required — this phase is schema-free

---

## Regulatory Reference

| Feature | Regulation | Amount/Threshold |
|---------|-----------|-----------------|
| WH-347 Jan 2025 revision | Davis-Bacon Act / 29 CFR Part 3 | Form rev date |
| 30% deduction cap | 29 CFR Part 3, Section 3.5 | 30% of gross wages |
| Civil penalty max | 29 CFR Part 5.14 (2024 inflation adj.) | $13,508 per violation |
