---
status: approved
phase: 36-payroll-import-react-ui
source: [36-VERIFICATION.md]
started: 2026-03-31T23:00:00Z
updated: 2026-03-31T23:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full QuickBooks Import Flow
expected: Navigate to a non-submitted payroll week, click "Import from Payroll Provider", upload a QuickBooks Time by Employee Detail CSV export. Step 2 shows "QuickBooks" badge, 14-column day grid (M ST through Su OT), worker names and classifications. Click "Review Import", Step 3 shows worker count. Click "Confirm Import" — entries appear in the payroll week table and green banner "Imported N entries from QuickBooks." appears.
result: [pending]

### 2. ADP Import Mode
expected: Upload an ADP payroll export CSV. Step 2 shows "ADP" badge, amber banner "ADP export does not include daily breakdown. Hours are shown as weekly totals placed on Monday.", table collapses to 2 columns (Total ST / Total OT).
result: [pending]

### 3. Import Button Disabled State on Submitted Week
expected: Navigate to a submitted payroll week, hover over "Import from Payroll Provider" button. Button is grayed out (disabled) and tooltip reads "This payroll week has been submitted and cannot be modified."
result: [pending]

### 4. Success Banner Auto-Dismiss
expected: Complete a successful import, observe the success banner. Green banner with provider + count appears below the HelpCallout and disappears automatically after approximately 4 seconds.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
