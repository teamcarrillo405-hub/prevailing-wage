---
status: testing
phase: 24-california-dir-a-1-131-form
source: 24-01-SUMMARY.md, 24-02-SUMMARY.md, 24-03-SUMMARY.md
started: 2026-03-25T00:00:00Z
updated: 2026-03-25T00:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server. Start the application from scratch (npm run dev or equivalent).
  Server boots without errors, migrations complete, and the app loads at localhost:4099
  without crashes or migration errors in the terminal.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Start the application from scratch (npm run dev or equivalent). Server boots without errors, migrations complete, and the app loads at localhost:4099 without crashes or migration errors in the terminal.
result: [pending]

### 2. CA Fields Appear on ProjectForm (state = CA)
expected: Open the Create Project form (or edit an existing project). Type "CA" in the State field. An amber-bordered section labelled for California should appear with two additional fields: "CSLB License Number" and "WC Policy Number". When you clear or change the state away from CA, those fields should disappear.
result: [pending]

### 3. CA Fields Hidden for Non-CA Projects
expected: Open the Create Project form with any state other than CA (e.g., "WA" or "TX"). The CSLB License and WC Policy Number fields should NOT be visible at all.
result: [pending]

### 4. DT Hour Columns Appear on Payroll Entry for CA Projects
expected: Open a CA project's payroll entry page (project with state = CA). The payroll table should show DT (double-time) hour columns alongside ST and OT columns for each worker, for each day of the week.
result: [pending]

### 5. DT Hour Columns Hidden for Non-CA Projects
expected: Open a payroll entry page for a non-CA project (state other than CA). The DT hour columns should NOT appear — only ST and OT columns as usual.
result: [pending]

### 6. DT Hours Save and Reload Correctly
expected: On a CA payroll entry form, enter a DT hour value (e.g., 2.0 hours on Monday for one worker). Save the week. Navigate away and return to the same payroll week detail — the entered DT hours should still be visible.
result: [pending]

### 7. CA Download Button Appears on PayrollWeekDetailPage
expected: Navigate to a payroll week detail page for a CA project. A "Download CA A-1-131" button should be visible alongside the existing WH-347 download button. For non-CA projects, this button should NOT appear.
result: [pending]

### 8. eCPR Disclosure Modal Appears on CA Download Click
expected: Click "Download CA A-1-131". Before the PDF downloads, a modal dialog should appear explaining the eCPR electronic filing requirement, with a link to efiling.dir.ca.gov/eCPR. There should be a "Cancel" button and a "Continue" / confirm button.
result: [pending]

### 9. A-1-131 PDF Downloads and Opens
expected: In the eCPR modal, click "Continue" (or confirm). A PDF file named a1131-{N}.pdf should download. Opening it should show the official CA DIR A-1-131 form filled with the payroll week's data (worker names, hours by day, wages). The PDF should be on legal-size paper (8.5x14).
result: [pending]

### 10. Advisory Shown When CSLB/WC Missing
expected: For a CA project that does NOT have CSLB License Number or WC Policy Number filled in, click "Download CA A-1-131". The eCPR disclosure modal should appear AND display an advisory notice that CSLB/WC information is missing — but it should still allow the download to proceed (non-blocking).
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

[none yet]
