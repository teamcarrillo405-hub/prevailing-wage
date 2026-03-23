---
phase: 21-payroll-amendment-workflow
verified: 2026-03-23T16:48:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Browser end-to-end amendment workflow"
    expected: "'Amend This Week' button visible on submitted weeks, creates new editable amendment week, navigates to it, badge shows 'Amendment 1' in header and list, original week stays read-only"
    why_human: "UI behavior, navigation flow, and visual badge rendering cannot be verified programmatically — requires a running browser session"
  - test: "WH-347 PDF payroll number format for amendment weeks"
    expected: "Payroll number field inside the generated PDF reads 'N (AMENDED M)' and filename reads 'wh347-N-amended-M.pdf'"
    why_human: "Content-Disposition header is verified by integration test, but the PDF body field content requires opening the file to confirm pdf-lib renders it correctly"
---

# Phase 21: Payroll Amendment Workflow — Verification Report

**Phase Goal:** Contractors can correct a submitted payroll week by creating a formal amendment that generates an amended WH-347 while preserving the original record

**Verified:** 2026-03-23T16:48:00Z
**Status:** human_needed (all automated checks pass; 2 items require browser/PDF confirmation)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | POST /api/payroll/weeks/amend creates a new payroll week row with amendmentNumber and originalWeekId set | VERIFIED | `amendPayrollWeek()` at line 434 in `payrollService.ts` inserts row with `originalWeekId: rootWeekId` and `amendmentNumber`; Test 1 and Test 9 both GREEN |
| 2  | Amendment entries clone baseRateSnapshot/fringeRateSnapshot from original (no live rate re-fetch) | VERIFIED | Lines 504-505 of `payrollService.ts`: `baseRateSnapshot: entry.baseRateSnapshot`, `fringeRateSnapshot: entry.fringeRateSnapshot` — no WD fetch call. Test 6 passes. |
| 3  | Multiple amendments to the same root week are numbered sequentially (1, 2, 3...) | VERIFIED | `MAX(amendmentNumber)` query at lines 450-453 with root resolution at line 447; Test 4 (returns amendmentNumber: 2) and Test 5 (root resolution) both GREEN |
| 4  | Amending an unsubmitted week returns 409 | VERIFIED | Route lines 161-164: `if (!originalWeek.submittedAt) res.status(409)`; Test 2 GREEN |
| 5  | WH-347 PDF for an amendment week shows payroll number in 'N (AMENDED M)' format | VERIFIED (automated) / NEEDS HUMAN (PDF content) | `export.ts` lines 152-154: conditional assembly confirmed. AMD-02 test checks Content-Disposition filename — PDF field content needs human check |
| 6  | User can click 'Amend This Week' on a submitted payroll week and lands on the new amendment week's detail page | NEEDS HUMAN | `handleAmendClick` at line 192 calls `POST /weeks/amend` and `navigate(...)` at line 207 confirmed in code; browser rendering needs human confirmation |
| 7  | Original submitted week remains visible and read-only after amendment is created | NEEDS HUMAN | Service creates a new row and does not alter original; read-only lock enforced by SUB-02 server-side guard (from Phase 19). Visual confirmation needs human. |
| 8  | Amendment weeks show 'Amendment N' badge on both detail page and list page | VERIFIED (code) / NEEDS HUMAN (visual) | Detail page: lines 234-237 `{week.amendmentNumber != null && <Badge>Amendment {week.amendmentNumber}</Badge>}`. List page: line 228-229 same pattern. Confirmed in code. |
| 9  | PayrollListPage distinguishes original weeks from their amendments at a glance | VERIFIED (code) / NEEDS HUMAN (visual) | `amendmentNumber: number \| null` in interface at line 21; `Badge variant="warning"` conditional at line 228. Needs browser check. |

**Automated Score:** 9/9 truths have implementation evidence. 4 truths additionally require human visual confirmation.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/services/payrollService.ts` | `amendPayrollWeek()` function + `AmendWeekInput`/`AmendWeekResult` interfaces | VERIFIED | Interfaces at lines 415-424; function at line 434; fully substantive (80+ lines of logic) |
| `src/server/routes/payroll.ts` | `POST /api/payroll/weeks/amend` route | VERIFIED | Route at lines 147-168; registered AFTER `/weeks/copy` (line 121) and BEFORE `GET /weeks/:id` wildcard (line 170) — correct Express ordering confirmed |
| `src/server/routes/export.ts` | Amended payroll number label | VERIFIED | `AMENDED` conditional at lines 152-154 and filename at lines 183-184; 2 matches for `amendmentNumber` in export.ts |
| `tests/routes/payroll.test.ts` | Amendment integration tests | VERIFIED | `describe('POST /api/payroll/weeks/amend — AMD-01 + AMD-03')` at line 604 (9 tests) and `describe('GET /api/export/wh347 — AMD-02')` at line 854 (2 tests); all 11 pass |
| `src/client/pages/PayrollWeekDetailPage.tsx` | Amend This Week button + amendment badge in header | VERIFIED | "Amend This Week" at line 399; badge at lines 234-237; `amendingRef` declared at line 101; interface extended at line 22 |
| `src/client/pages/PayrollListPage.tsx` | Amendment badge on list rows | VERIFIED | `amendmentNumber: number \| null` interface at line 21; badge render at lines 228-229 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/server/routes/payroll.ts` | `src/server/services/payrollService.ts` | `amendPayrollWeek()` call | WIRED | Import at line 19; call at line 166 inside route handler |
| `src/server/routes/export.ts` | Week data | `amendmentNumber != null && originalWeekId != null` check | WIRED | Lines 152-154 use `week.amendmentNumber` and `week.originalWeekId` directly from the week row returned by `getPayrollWeek()` |
| `src/client/pages/PayrollWeekDetailPage.tsx` | `POST /api/payroll/weeks/amend` | fetch call in `handleAmendClick` | WIRED | Line 196: `fetch('/api/payroll/weeks/amend', { method: 'POST', ... })` with response handling at lines 201-207 |
| `src/client/pages/PayrollWeekDetailPage.tsx` | `navigate` | redirect to new amendment week after creation | WIRED | Line 207: `navigate('/projects/${projectId}/payroll/${result.weekId}')` — uses `result.weekId` from API response |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AMD-01 | 21-01, 21-02 | User can amend a submitted payroll week — creates a new week row with amendment number; original week preserved and read-only | SATISFIED | `amendPayrollWeek()` creates new row; `POST /weeks/amend` returns 201; UI button calls API and navigates to new week |
| AMD-02 | 21-01 | Amended WH-347 PDF shows payroll number in "N (AMENDED M)" format | SATISFIED (automated) / HUMAN for PDF content | `export.ts` conditional label confirmed; AMD-02 tests cover Content-Disposition filename; PDF field rendering needs human eye |
| AMD-03 | 21-01, 21-02 | Amendment week entries are pre-filled from original week's worker hours for editing | SATISFIED | `amendPayrollWeek()` copies all entries including all daily hour fields (lines 490-503); entries copied from `input.originalWeekId`; `submittedAt: null` so week is editable |

All three requirement IDs declared across both PLAN files are accounted for. REQUIREMENTS.md traceability table confirms AMD-01, AMD-02, AMD-03 all mapped to Phase 21 with status Complete.

**No orphaned requirements** — the two plans declare `[AMD-01, AMD-02, AMD-03]` collectively, matching the three IDs listed in REQUIREMENTS.md for Phase 21.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/client/pages/PayrollWeekDetailPage.tsx` | 430 | `placeholder="..."` | Info | HTML input attribute in submit form — not a code stub |

No blocker or warning anti-patterns detected. The `placeholder` at line 430 is a standard HTML form input attribute, not a stub.

---

### Human Verification Required

#### 1. Full Amendment Browser Workflow

**Test:** Start the dev server (`npm run dev`). Log in, navigate to a project with a submitted payroll week. Open the submitted week detail page.

**Expected:**
- "Amend This Week" button visible in the Submission Status panel
- Clicking it creates the amendment and redirects to the new week detail page
- New week shows "Amendment 1" badge in the h1 header
- New week has the same payroll number and week-ending date as original
- Entries are pre-filled with hours from the original week
- Payroll list shows "Amendment 1" badge on the new week row
- Original week detail page remains read-only (edit controls locked)

**Why human:** Navigation flow, React state, and visual badge rendering require a running browser session to confirm.

#### 2. WH-347 PDF Field Content for Amendment Weeks

**Test:** From the amendment week detail page, download the WH-347 PDF.

**Expected:** Open the PDF and confirm the "Payroll No." field reads "N (AMENDED 1)" (e.g., "1 (AMENDED 1)"). Download filename should be `wh347-1-amended-1.pdf`.

**Why human:** Integration test verifies the Content-Disposition filename header. The actual PDF field value rendered by pdf-lib requires opening the PDF to confirm the coordinate overlay wrote the correct string.

---

### Gaps Summary

No gaps. All automated must-haves are fully implemented and wired. The 2 human verification items are confirmatory checks on already-verified code paths — they do not represent missing implementation.

---

## Commit Evidence

All 5 commits documented in SUMMARY files verified present in git log:

| Commit | Description |
|--------|-------------|
| `a768dfc` | test(21-01): failing tests for POST /api/payroll/weeks/amend |
| `cfd026c` | feat(21-01): amendPayrollWeek() service + POST /weeks/amend route |
| `a0d1ea7` | feat(21-01): amended WH-347 payroll number label + filename (AMD-02) |
| `2685441` | feat(21-02): PayrollWeekDetailPage — Amend button + amendment badge |
| `875fea7` | feat(21-02): PayrollListPage — amendment badge on list rows |

---

## Test Run Result

```
Test Files: 5 passed (5)
Tests:      123 passed (123)
Duration:   5.27s
```

All 11 amendment-specific tests GREEN (9 AMD-01/03 + 2 AMD-02). No regressions.

---

_Verified: 2026-03-23T16:48:00Z_
_Verifier: Claude (gsd-verifier)_
