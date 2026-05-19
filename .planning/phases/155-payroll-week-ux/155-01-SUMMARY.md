---
phase: 155-payroll-week-ux
plan: 01
subsystem: payroll-week
tags: [ux, compliance, export-gate, banner]
requirements: [PAY-UX-01, PAY-UX-02, PAY-UX-03]
dependency_graph:
  requires: []
  provides: [readiness-banner, export-gate, override-modal]
  affects: [PayrollWeekDetailPage]
tech_stack:
  added: []
  patterns: [severity-state-machine, sticky-banner, override-confirm-modal]
key_files:
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx
decisions:
  - Used violationType field (not type) from ComplianceViolation — actual field name is violationType
  - BLOCKING_VIOLATION_TYPES limited to under-wage; deductionViolations counted separately
  - bannerSeverity error-path: hasBlockingViolations includes deductionViolations
  - Override audit trail via console.log — no POST /api/audit-log endpoint exists
  - Warning-only violations (cwhssa-ot, weekly-ot, etc.) show amber banner but do not disable export button
metrics:
  duration: 25m
  completed: 2026-05-18
  tasks: 4
  files: 1
---

# Phase 155 Plan 01: PayrollWeekDetailPage Readiness Banner + Export Gate Summary

**One-liner:** Sticky green/amber/red certification readiness banner, gated WH-347 export button, and "Download anyway" override modal with OVERRIDE text confirmation.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Read PayrollWeekDetailPage — found violations[], handleDownload, ComplianceViolation type | (analysis) |
| 2 | Sticky readiness banner — green/amber/red states based on violation severity | 54c7410 |
| 3 | Export button state machine + override modal with OVERRIDE typed confirmation | 54c7410 |
| 4 | TypeScript check — no new errors introduced by this plan | (verification) |

## What Was Built

### Readiness Banner (PAY-UX-01)
Added a sticky top banner that displays certification readiness state:
- **Green** (success): "Ready to certify" — no violations
- **Amber** (warning): "N warnings — review before certifying" — warnings (cwhssa-ot, weekly-ot, apprentice ratio, etc.)
- **Red** (error): "N violations — resolve before downloading WH-347" — under-wage or deduction cap violations

Banner only renders after compliance data loads (`complianceData` truthy).

### Export Button State Machine (PAY-UX-02)
WH-347 download button now responds to violation severity:
- **Clean** (no violations): standard secondary button, normal behavior
- **Warning only**: button enabled, tooltip notes warnings present
- **Blocking violations**: button disabled with red border + reduced opacity, tooltip explains gate

### Override Modal (PAY-UX-03)
When blocking violations exist, a "Download anyway (override)" link appears below the disabled button. Clicking opens a confirmation modal that:
- States the violation count and federal compliance warning
- Requires typing `OVERRIDE` exactly to unlock the download button
- Logs to console (audit trail) with weekId, projectId, violation count, and timestamp
- Calls `handleConfirmedDownload()` directly, bypassing the preflight modal

## Deviations from Plan

**1. [Rule 1 - Adaptation] Used `violationType` not `type` on ComplianceViolation**
- **Found during:** Task 1 analysis
- **Issue:** Plan pseudocode used `v.type` but actual interface has `v.violationType`
- **Fix:** Used correct field name throughout implementation
- **Files modified:** PayrollWeekDetailPage.tsx

**2. [Rule 2 - Clarification] BLOCKING_VIOLATION_TYPES scoped to under-wage only**
- **Found during:** Task 1 analysis
- **Issue:** Plan listed `missing-fringe` and `deduction-cap-exceeded` but these aren't violationType values — they are `deductionViolations[]` entries
- **Fix:** `BLOCKING_VIOLATION_TYPES = ['under-wage']`; deductionViolations counted separately in `blockingViolationCount` and `hasBlockingViolations`

**3. [Rule 3 - Audit trail] console.log instead of POST /api/audit-log**
- **Found during:** Task 3 implementation
- **Issue:** No POST /api/audit-log endpoint exists on the server
- **Fix:** Used console.log with structured payload as specified in plan's fallback instruction

## Known Stubs
None — all three features are fully wired to live complianceData.

## Self-Check: PASSED
- File `src/client/pages/PayrollWeekDetailPage.tsx` exists and was modified
- Commit 54c7410 exists and includes all changes
- No new TypeScript errors introduced (pre-existing errors in file are unrelated to this plan)
