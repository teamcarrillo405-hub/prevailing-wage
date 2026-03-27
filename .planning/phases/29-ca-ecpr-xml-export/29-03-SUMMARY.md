---
phase: 29-ca-ecpr-xml-export
plan: 03
subsystem: ui
tags: [react, typescript, tailwindcss, modal, xml-export, ca-ecpr]

requires:
  - phase: 29-02
    provides: GET /api/export/ecpr-xml/:weekId endpoint
  - phase: 29-01
    provides: DB columns contractorFein, dirProjectId, awardingAgency, contractNumber on projects table
provides:
  - "Download CA eCPR XML button on PayrollWeekDetailPage (CA-gated)"
  - "2-step pre-generation modal: Step 1 collects FEIN/dirProjectId/awardingAgency/contractNumber/checkNum, Step 2 post-download portal upload checklist"
  - "Modal persists FEIN/dirProjectId/awardingAgency/contractNumber to project record via PATCH"
  - "SSN disclosure notice in Step 1"
  - "6-step portal upload checklist in Step 2 with efiling.dir.ca.gov and publicworks@dir.ca.gov links"
affects: [30-wa-pwia-submission-assist]

tech-stack:
  added: []
  patterns:
    - "2-step in-place modal transition: download triggers setEcprStep(2) without closing modal"
    - "ecprGeneratingRef useRef for synchronous double-click guard (same pattern as generatingRef, caGeneratingRef, waGeneratingRef)"
    - "useEffect pre-fill: load project record fields into modal state on projectData load"

key-files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx

key-decisions:
  - "CA eCPR XML button added alongside (not replacing) the existing CA A-1-131 button — both are CA-gated separately"
  - "ecprCheckNum defaults to DIRECT DEPOSIT per D-10; not persisted to project record (ephemeral per export)"
  - "SSN disclosure uses amber color scheme to match existing CA warning patterns"
  - "Modal uses document.createElement approach for download (not hiddenAnchorRef) to handle Content-Disposition filename"

patterns-established:
  - "Two-step modal: Step 1 configure + Step 2 checklist — transition driven by setEcprStep(2) after successful download"
  - "Pre-fill from project via useEffect on projectData dependency"

requirements-completed: [CAE-02, CAE-03]

duration: 8min
completed: 2026-03-27
---

# Phase 29 Plan 03: CA eCPR XML Export UI Summary

**CA eCPR XML download button and 2-step modal added to PayrollWeekDetailPage — Step 1 collects/persists contractor fields with SSN disclosure, Step 2 shows 6-step DIR portal upload checklist**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-27T08:31:57Z
- **Completed:** 2026-03-27T08:39:00Z
- **Tasks:** 1 (Task 2 is human-verify checkpoint — awaiting user)
- **Files modified:** 1

## Accomplishments
- Added "Download CA eCPR XML" button inside `{isCA && weekId &&}` conditional block, visible only on CA projects
- Added 2-step modal: Step 1 collects FEIN, DIR Project ID, Awarding Agency, Contract Number, Check/Direct Deposit Number; Step 2 shows portal upload checklist
- `handleEcprXmlDownload` persists project fields via `api.patch`, fetches XML with query params, downloads blob, transitions modal to Step 2
- SSN disclosure notice prominently shown in Step 1 (amber box)
- Generate button disabled until FEIN and DIR Project ID are filled
- Existing CA A-1-131 disclosure modal (`showCaDisclosure`) preserved unchanged
- Extended `ProjectData` interface with `contractorFein`, `dirProjectId`, `awardingAgency`, `contractNumber` fields

## Task Commits

1. **Task 1: CA eCPR XML button + 2-step pre-generation modal** - `1007142` (feat)

## Files Created/Modified
- `src/client/pages/PayrollWeekDetailPage.tsx` - Added CA eCPR XML button + 2-step modal + download handler + useEffect pre-fill + ProjectData interface extension

## Decisions Made
- Used `document.createElement('a')` for the XML download (not the shared `hiddenAnchorRef`) because the Content-Disposition filename header needs to be read from the response — this is consistent with what the plan specified
- `ecprCheckNum` defaults to `DIRECT DEPOSIT` per D-10; reset is not needed since the modal opens fresh each session (state persists in React component lifetime but is fine for UX)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript build passed cleanly with no errors.

## Known Stubs

None — all fields wire directly to the `/api/export/ecpr-xml/:weekId` endpoint (built in Plan 29-02) and the `/api/projects/:id` PATCH endpoint (built in Plan 29-01).

## Next Phase Readiness
- Task 2 (human-verify checkpoint) is pending user verification of the complete CA eCPR XML export flow
- User should verify: CA project shows eCPR XML button, WA/federal projects do not, Step 1 modal opens with 5 fields + SSN notice, download works, Step 2 checklist appears, downloaded XML has correct CPR: namespace

---
*Phase: 29-ca-ecpr-xml-export*
*Completed: 2026-03-27*
