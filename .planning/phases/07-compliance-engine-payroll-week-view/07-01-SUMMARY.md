---
phase: 07
plan: 01
subsystem: compliance-engine
tags: [tdd, test-stubs, compliance, red-phase]
dependency_graph:
  requires: []
  provides: [failing-test-stubs-COMP-01, failing-test-stubs-COMP-02, failing-test-stubs-WH347-03]
  affects: [07-02-compliance-engine-implementation]
tech_stack:
  added: []
  patterns: [TDD-red-phase, supertest-integration-tests, vitest]
key_files:
  created:
    - tests/services/complianceService.test.ts
    - tests/routes/compliance.test.ts
  modified: []
decisions:
  - "Test stubs import from complianceService.ts which does not exist — import error is the intentional RED state for Task 1"
  - "compliance.test.ts route stubs fail on assertion (404 from unregistered route) rather than import error — both are valid RED states"
  - "CWHSSA fringe rule encoded explicitly in Stub 5: fringe is NOT multiplied for OT hours (44*base + 4*0.5*base + 44*fringe = 1820)"
metrics:
  duration: 2m
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 7 Plan 01: Compliance Engine Test Stubs (TDD Red Phase) Summary

TDD RED phase — 10 failing test stubs for the compliance engine (COMP-01, COMP-02) and compliance route (WH347-03), with no .todo() stubs, all real assertions.

## What Was Built

Two test files created as Wave 0 TDD stubs before any implementation exists:

**tests/services/complianceService.test.ts** (6 stubs):
- COMP-01: under-wage entry produces 1 violation with violationType 'under-wage'
- COMP-01: null grossWages produces no violation (no false positives)
- COMP-01: correct grossWages produces zero violations and hasViolations=false
- COMP-02: OT entry with incorrect grossWages produces 1 'cwhssa-ot' violation
- COMP-02: CWHSSA fringe NOT multiplied for OT — verifies expected=1820, actual=1760, delta=-60
- certProperPayment=false when an under-wage violation exists

**tests/routes/compliance.test.ts** (4 stubs):
- GET /api/compliance/:weekId returns 200 with full ComplianceResult shape
- Returns 403 when week belongs to a different user
- Returns 404 when weekId does not exist
- 200 response violations array is an array (not null or undefined)

## Verification Results

- Both stub files FAIL (import error on complianceService.ts for service stubs; assertion failures on unregistered route for route stubs)
- 16 pre-existing test files remain GREEN (161 tests passing)
- Full suite: 2 failed | 16 passed | 7 skipped

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. CWHSSA fringe NOT multiplied for OT: encoded as the authoritative formula in Stub 5. Expected = totalHours * baseRate + otHours * 0.5 * baseRate + totalHours * fringeRate. This is the only correct interpretation per CWHSSA.
2. Task 1 stubs fail via import error (module not found). Task 2 stubs fail via assertion errors (404 from unregistered route). Both are valid RED states per plan spec.

## Self-Check

- tests/services/complianceService.test.ts: FOUND
- tests/routes/compliance.test.ts: FOUND
- Commit c23f48d (Task 1): FOUND
- Commit 0f65ee4 (Task 2): FOUND
