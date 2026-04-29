---
phase: 56-subcontractor-ui-panel
verified: 2026-04-13T02:51:00Z
status: human_needed
score: 12/13 must-haves verified
human_verification:
  - test: "Visual end-to-end confirmation of SubcontractorsPanel in browser"
    expected: |
      - Subcontractors section visible on ProjectDetailPage below Notifications
      - Add/edit/remove sub flows work
      - Expand chevron rotates; CPR week table opens for correct sub
      - All four badge states appear with correct color: Received+Compliant (green),
        Received+Non-Compliant (red), Overdue (amber), Not Received (gray)
      - Mark Received, Mark Compliant, Mark Non-Compliant actions update badge live
      - WorkflowProgress steps do not change when subs are added/removed
    why_human: "Rendering, color correctness, interactive state transitions, and chevron rotation cannot be verified programmatically without a running browser."
---

# Phase 56: Subcontractor UI Panel Verification Report

**Phase Goal:** Subcontractor management panel live on ProjectDetailPage — CRUD controls, expandable CPR week table with status badges, overdue detection, subs never mixed into GC counts.
**Requirement:** SUB-05
**Verified:** 2026-04-13T02:51:00Z
**Status:** human_needed (all automated checks passed; one visual browser check remains)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ProjectDetailPage has a Subcontractors section listing all subs for the project | VERIFIED | `<SubcontractorsPanel projectId={project.id} />` rendered at line 894; queries `['subcontractors', projectId]` from `/api/projects/:id/subcontractors` |
| 2 | Each sub row shows name, license number, and contact info with Edit and Remove controls | VERIFIED | Lines 549–601: name (bold), licenseNumber (muted), contactName, contactEmail rendered; Edit/Remove buttons present |
| 3 | Expanding a sub row shows its CPR week table with status badges | VERIFIED | Lines 606–608: `{expandedSubId === sub.id && <CprWeekTable projectId={projectId} subId={sub.id} />}` — lazy render on expand |
| 4 | Status badge is Received — Compliant (green) when receivedDate is set and isCompliant === 1 | VERIFIED | Line 195–196 + cprStatus.ts line 34 + tests pass: `getCprStatus` returns 'received-compliant'; STATUS_BADGE maps to variant 'compliant' |
| 5 | Status badge is Received — Non-Compliant (red) when receivedDate is set and isCompliant !== 1 | VERIFIED | cprStatus.ts strict `=== 1` check; 0 and null both produce 'received-non-compliant' → variant 'violation'; 3 tests confirm |
| 6 | Status badge is Overdue (amber) when receivedDate is null and weekEndingDate is more than 7 days ago | VERIFIED | cprStatus.ts `daysAgo > 7` → 'overdue' → STATUS_BADGE variant 'warning'; boundary test confirms 8 days = overdue |
| 7 | Status badge is Not Received (gray) when receivedDate is null and weekEndingDate is within 7 days | VERIFIED | cprStatus.ts `daysAgo <= 7` → 'not-received' → STATUS_BADGE variant 'neutral'; boundary test confirms 7 days = not-received |
| 8 | User can add a sub via an inline form (name required, optional fields) | VERIFIED | Lines 396–465: inline form with name (required guard line 346), licenseNumber, contactName, contactEmail, address; POST mutation wired to `/api/projects/:id/subcontractors` |
| 9 | User can edit a sub via an inline form and save changes | VERIFIED | Lines 478–542: `editingSubId === sub.id` shows inline edit form prefilled via `startEdit()` (lines 369–378); PATCH mutation wired correctly |
| 10 | User can remove a sub with an inline confirmation prompt | VERIFIED | Lines 561–577: `deletingSubId === sub.id` shows "Confirm remove?" with Confirm/Cancel; DELETE mutation wired; collapsed row cleanup on success (line 341) |
| 11 | User can add a CPR week record for a sub with weekEndingDate, receivedDate, isCompliant, notes | VERIFIED | Lines 244–296: inline form with date, receivedDate, isCompliant select (3 options), notes; POST mutation with 409 duplicate guard (lines 140–144) |
| 12 | User can mark an existing CPR week as received or update compliance status | VERIFIED | Lines 207–233: "Mark Received" (PATCH receivedDate=today), "Mark Compliant" (PATCH isCompliant=1), "Mark Non-Compliant" (PATCH isCompliant=0) — all wired to updateCprWeekMutation |
| 13 | Subcontractor data is never mixed into GC worker counts, compliance rollups, or WorkflowProgress | VERIFIED (automated) / NEEDS HUMAN (visual confirm) | WorkflowProgress steps (lines 700–705) use only `workers.length` and `weeks.length` — no subcontractor data referenced. SubcontractorsPanel is isolated component with no data passed up. Visual confirmation of step count not changing when subs added needed. |

**Score:** 12/13 truths fully verified automated; 1 truth needs visual browser confirmation

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/client/lib/cprStatus.ts` | getCprStatus pure function + STATUS_BADGE map + Subcontractor/CprWeek types | VERIFIED | 43 lines; exports getCprStatus, STATUS_BADGE, Subcontractor, CprWeek, CprStatus; strict `=== 1` isCompliant check; `T00:00:00` local-time parse |
| `src/client/pages/ProjectDetailPage.tsx` | SubcontractorsPanel inline component + full CRUD surface + expandable CPR week table | VERIFIED | 939 lines; SubcontractorsPanel defined at line 301; CprWeekTable nested at line 121; both rendered and wired to live API |
| `tests/lib/cprStatus.test.ts` | Unit tests for badge logic, overdue boundary, three-state isCompliant | VERIFIED | 14 tests covering all 4 status values, 7-day boundary, isCompliant strict equality, STATUS_BADGE label/variant mappings — all 14 PASS |
| `src/client/components/ui/Badge.tsx` | BadgeVariant exported (deviation fix) | VERIFIED | Line 4: `export type BadgeVariant = ...` — required for cprStatus.ts import type |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| SubcontractorsPanel | /api/projects/:id/subcontractors | useQuery(['subcontractors', projectId]) | WIRED | Line 312: queryKey `['subcontractors', projectId]`; queryFn hits `/projects/${projectId}/subcontractors` |
| CprWeekTable (inline) | /api/projects/:id/subcontractors/:subId/cpr-weeks | useQuery(['cpr-weeks', id, subId]) enabled only when subId present | WIRED | Line 127: queryKey `['cpr-weeks', projectId, subId]`; enabled: `!!subId`; queryFn hits correct URL |
| getCprStatus | Badge variant | STATUS_BADGE lookup | WIRED | Lines 195–201: `const status = getCprStatus(week)` then `const badge = STATUS_BADGE[status]` then `<Badge variant={badge.variant}>` |
| addSubMutation | POST /api/projects/:id/subcontractors | api.post | WIRED | Line 319; onSuccess invalidates `['subcontractors', projectId]` |
| editSubMutation | PATCH /api/projects/:id/subcontractors/:subId | api.patch | WIRED | Line 329; onSuccess invalidates `['subcontractors', projectId]` |
| deleteSubMutation | DELETE /api/projects/:id/subcontractors/:subId | api.delete | WIRED | Line 337; onSuccess closes expanded row if deleted sub was expanded |
| addCprWeekMutation | POST /api/projects/:id/subcontractors/:subId/cpr-weeks | api.post | WIRED | Line 134; 409 error handling at lines 140–144 |
| updateCprWeekMutation | PATCH /api/projects/:id/subcontractors/:subId/cpr-weeks/:weekId | api.patch | WIRED | Lines 149–153; Mark Received/Compliant/Non-Compliant all use correct body shapes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| SubcontractorsPanel | `subs` (line 380) | `subsData?.data?.subcontractors ?? []` from useQuery → GET /api/projects/:id/subcontractors | Yes — Phase 55 route queries `subcontractors` table via Drizzle | FLOWING |
| CprWeekTable | `weeks` (line 156) | `cprData?.data?.cprWeeks ?? []` from useQuery → GET /api/projects/:id/subcontractors/:subId/cpr-weeks | Yes — Phase 55 route queries `subcontractor_cpr_weeks` table via Drizzle | FLOWING |
| WorkflowProgress | `workers`, `weeks` | Separate queries for GC workers and payroll weeks only | Sub data not included — confirmed at lines 697–705 | ISOLATED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| getCprStatus unit tests (14 cases) | `npx vitest run tests/lib/cprStatus.test.ts` | 14 passed, 0 failed, 360ms | PASS |
| TypeScript compiles with no new errors from phase 56 | `npx tsc --noEmit` | 2 pre-existing errors in audit.ts (Phase 38) and projects.ts (Phase 51) — neither file touched by Phase 56 | PASS (pre-existing errors not attributable to this phase) |
| Server routes mounted and accessible | `grep subcontractorsRouter src/server/index.ts` | Router imported and mounted at `/api/projects` (line 59) | PASS |
| All 7 API routes present in subcontractors.ts | `grep "router\.(get\|post\|patch\|delete)"` | GET, POST, PATCH, DELETE for subs + GET, POST, PATCH for cpr-weeks — all 7 confirmed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SUB-05 | 56-01-PLAN.md | Subcontractors panel on ProjectDetailPage: list all subs; add/edit/remove; expandable per-sub CPR week table with status badges (Received+Compliant/Received+Non-Compliant/Not Received/Overdue); Overdue when weekEndingDate > 7 days ago and CPR not received | SATISFIED (automated) + NEEDS HUMAN (visual) | All code paths implemented and verified; browser confirmation of badge rendering pending |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TODO/FIXME, no placeholder returns, no hardcoded empty data passed to rendering | — | — |

**Scan notes:** No stub patterns found. All state variables that render dynamic data are populated via TanStack Query from live API endpoints. The empty defaults (`subs = subsData?.data?.subcontractors ?? []`) are query fallbacks, not hardcoded stubs — they get overwritten by the fetch response.

### Human Verification Required

#### 1. Full SubcontractorsPanel browser walkthrough

**Test:** Start the dev server (`npm run dev`, port 4099). Log in and open any active project. Scroll below the Notifications button.

**Expected:**
1. "Subcontractors" section heading visible with "Add Subcontractor" button on right
2. Click "Add Subcontractor" — inline form appears with Name (required asterisk), License Number, Contact Name, Contact Email, Address
3. Add a test sub "Test Sub Co" license "LIC-001" — row appears in list with name bold, license muted
4. Click chevron — rotates 90 degrees, CPR week table opens beneath that row
5. Add CPR week with week ending 10 days ago, no receivedDate — badge shows "Overdue" in amber color
6. Add CPR week with today's date, no receivedDate — badge shows "Not Received" in gray
7. Click "Mark Received" on the Overdue row — badge changes to "Received — Non-Compliant" in red
8. Click "Mark Compliant" — badge changes to "Received — Compliant" in green
9. Click "Mark Non-Compliant" — badge reverts to red
10. Click Edit on the sub — form prefills with existing values; save updates the row without page reload
11. Click Remove — "Confirm remove?" inline prompt appears; Confirm removes the sub row; expanded CPR table closes
12. Observe WorkflowProgress steps at top of page (Create Project, Add Workers, Enter Payroll, Download WH-347) — steps do NOT change at any point during add/edit/remove sub operations

**Why human:** Badge color rendering, chevron rotation animation, interactive state transitions after mutations, and WorkflowProgress step count stability all require a running browser to confirm.

### Gaps Summary

No gaps found. All 13 must-have truths are met at the code level. The single `human_needed` item is a visual browser walkthrough to confirm badge colors, animations, and that WorkflowProgress is visually unchanged — not a code gap. All automated signals (14 unit tests green, TypeScript clean for phase 56 files, all 7 API routes wired, all mutations wired with correct invalidation keys) confirm the implementation is complete and correctly connected.

---

_Verified: 2026-04-13T02:51:00Z_
_Verifier: Claude (gsd-verifier)_
