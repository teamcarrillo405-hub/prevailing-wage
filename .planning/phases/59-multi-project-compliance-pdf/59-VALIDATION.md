# Phase 59 Validation Checklist
# Multi-Project Compliance Summary PDF

## Automated Checks

### 1. Unit tests pass
```bash
cd C:/Users/glcar/prevailing-wage
npx vitest run tests/services/complianceSummaryPdfGenerator.test.ts
```
Expected: 2 tests, 2 passed

Test coverage:
- [ ] "generates a non-empty Buffer" — result.length > 0
- [ ] "PDF starts with %PDF- magic bytes" — Buffer.from(result).subarray(0, 5) equals %PDF-

### 2. TypeScript compiles clean
```bash
cd C:/Users/glcar/prevailing-wage
npx tsc --noEmit
```
Expected: exit code 0, zero errors

### 3. Service file exists and exports correct symbol
```bash
grep -n "export.*generateComplianceSummaryPdf\|export.*ComplianceSummaryInput\|export.*ComplianceSummaryProjectRow" \
  src/server/services/complianceSummaryPdfGenerator.ts
```
Expected: all three named exports present

### 4. Route registered in export.ts
```bash
grep -n "compliance-summary" src/server/routes/export.ts
```
Expected: at least 2 matches (route path + import)

### 5. Dashboard download link present
```bash
grep -n "compliance-summary" src/client/pages/DashboardPage.tsx
```
Expected: 1 match (the anchor href)

---

## Runtime Checks (requires dev server: npm run dev)

### 6. Unauthenticated request returns 401
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/export/compliance-summary
```
Expected: 401

### 7. Authenticated request returns PDF
```bash
# Obtain a session cookie by logging in, then:
curl -s -b "session=<cookie>" \
  -o /tmp/compliance-summary.pdf \
  -D - \
  http://localhost:3000/api/export/compliance-summary \
  | grep -i "content-type\|content-disposition"
```
Expected:
- Content-Type: application/pdf
- Content-Disposition: attachment; filename="compliance-summary.pdf"
- /tmp/compliance-summary.pdf has length > 0

### 8. PDF magic bytes verify download is a real PDF
```bash
xxd /tmp/compliance-summary.pdf | head -1
```
Expected: first bytes are `25 50 44 46 2d` (%PDF-)

---

## Manual Visual Checks

- [ ] Dashboard renders "Download Compliance Summary" link near the top, visible without scrolling
- [ ] Clicking the link triggers a file download (not navigation)
- [ ] Downloaded PDF opens in system PDF viewer without errors
- [ ] Page 1 shows title "Compliance Summary Report"
- [ ] Page 1 shows generated date in YYYY-MM-DD format
- [ ] Page 1 shows contractor email address
- [ ] Each active project appears as a named section
- [ ] Project section shows: worker count, weeks total, submitted, pending, CPR overdue count
- [ ] Sub-CPR line shows: total, compliant, violations, pending counts
- [ ] Page numbers appear on each page ("Page X of Y")
- [ ] PDF renders correctly with zero projects (title page only, no crash)

---

## Phase Complete When

All 5 automated checks pass AND all 8 runtime checks pass (or are confirmed by manual review) AND the manual visual checklist items are confirmed.
