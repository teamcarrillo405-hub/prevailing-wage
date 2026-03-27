---
phase: 29-ca-ecpr-xml-export
plan: "02"
subsystem: api
tags: [xmlbuilder2, xml, ca-ecpr, export, typescript, tdd]

requires:
  - phase: 29-01
    provides: "fringe sub-columns on payrollEntries, getPayrollEntriesWithWorkerDetails(), new project columns (contractorFein, dirProjectId, awardingAgency, contractNumber)"

provides:
  - "generateEcprXml(data: EcprData): string — pure CPR.xsd v1.3 compliant XML generator"
  - "EcprData, EcprEmployee, EcprEmployeeDay types for eCPR XML assembly"
  - "GET /api/export/ecpr-xml/:weekId — CA-gated XML export route with ownership check"

affects:
  - "29-03 (eCPR modal UI — calls this route with query params)"
  - "Future WA L&I XML export (same pattern, different schema)"

tech-stack:
  added: []
  patterns:
    - "Pure function XML generator (ecprXmlGenerator.ts) — testable without Express"
    - "TDD: test-first RED commit then implementation GREEN commit for XML generator"
    - "8-step route handler pattern: load week → ownership check → state gate → read query params → load entries → compute data → generate → send"

key-files:
  created:
    - src/server/services/ecprXmlGenerator.ts
    - src/server/services/ecprXmlGenerator.test.ts
  modified:
    - src/server/routes/export.ts

key-decisions:
  - "CPR:amendmentNum always emitted per D-13: empty element for non-amendment weeks, populated for amendment weeks — DIR auto-increments payrollNum, both submitted as empty"
  - "SSN 10-char placeholder (000000 + ssnLast4) disclosed in pre-generation modal — full SSN entered by contractor in DIR portal"
  - "grossAllWork = grossThisProject (single-project limitation, disclosed in modal)"
  - "Fringe sub-columns (H&W, pension, vacation, training) mapped to CA deduction fields multiplied by totalHours"
  - "contractorFein and dirProjectId validated as required; others have defaults (checkNum=DIRECT DEPOSIT)"

requirements-completed: [CAE-02, CAE-04]

duration: 8min
completed: 2026-03-26
---

# Phase 29 Plan 02: CA eCPR XML Generator Summary

**CA DIR eCPR XML generator using xmlbuilder2 producing CPR.xsd v1.3 compliant XML with CPR: namespace prefix, plus CA-gated GET /api/export/ecpr-xml/:weekId route handler**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-26T01:34:00Z
- **Completed:** 2026-03-26T01:42:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `generateEcprXml()` produces fully CPR.xsd v1.3 compliant XML with CPR: namespace prefix on all elements, including contractorInfo, projectInfo, payrollInfo, 7-day employee grids, 13 deduction fields, and always-emitted amendmentNum per D-13
- 13 unit tests cover all CPR schema requirements including SSN placeholder format, deduction field names, amendment/non-amendment cases, XML escaping, and statementOfNP flag
- GET /api/export/ecpr-xml/:weekId route follows the established 8-step export pattern with CA state gate, ownership check, fringe sub-column mapping, and correct filename format

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing tests** - `7abe9ab` (test)
2. **Task 1 (TDD GREEN): ecprXmlGenerator.ts implementation** - `c1cd987` (feat)
3. **Task 2: GET /api/export/ecpr-xml/:weekId route** - `5744d4f` (feat)

## Files Created/Modified

- `src/server/services/ecprXmlGenerator.ts` - Pure CA eCPR XML generator; exports `generateEcprXml`, `EcprData`, `EcprEmployee`, `EcprEmployeeDay`
- `src/server/services/ecprXmlGenerator.test.ts` - 13 vitest unit tests covering CPR.xsd v1.3 compliance
- `src/server/routes/export.ts` - Added GET /api/export/ecpr-xml/:weekId with CA state gate, query param collection, fringe mapping, amendment logic

## Decisions Made

- Followed all plan decisions exactly as specified
- Auto-fixed implicit `any` TypeScript errors in `entries.map()` call (Rule 1 - Bug): added `EcprEntryRow` type annotation and explicit string param type on `.map(s => s.trim())` — required for `npx tsc --noEmit` to pass cleanly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript implicit any errors in entries.map()**
- **Found during:** Task 2 (route handler implementation)
- **Issue:** `entries.map((row) =>` and `.map(s => s.trim())` triggered TS7006 implicit any errors; `npx tsc --noEmit` failed
- **Fix:** Added `type EcprEntryRow = (typeof entries)[number]` type alias and explicit `(s: string)` annotation
- **Files modified:** src/server/routes/export.ts
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** 5744d4f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript implicit any)
**Impact on plan:** Required for TypeScript acceptance criteria. No scope creep.

## Issues Encountered

None — plan executed smoothly with one minor TypeScript fix.

## Next Phase Readiness

- `generateEcprXml()` and `EcprData` are ready for Plan 03 (UI modal wires to this route)
- Route accepts all query params that Plan 03 modal will send: checkNum, contractorFein, dirProjectId, awardingAgency, contractNumber, contractorEmail
- TypeScript compiles cleanly, all 13 unit tests pass

---
*Phase: 29-ca-ecpr-xml-export*
*Completed: 2026-03-26*
