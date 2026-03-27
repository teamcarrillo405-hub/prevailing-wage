---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: State Portal Integration
status: Ready to execute
stopped_at: Completed 29-01-PLAN.md
last_updated: "2026-03-27T08:28:40.808Z"
progress:
  total_phases: 14
  completed_phases: 12
  total_plans: 27
  completed_plans: 25
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — with compliance feedback, no missing steps.
**Current focus:** Phase 29 — CA eCPR XML Export

## Current Position

Phase: 29 (CA eCPR XML Export) — EXECUTING
Plan: 2 of 3

## Performance Metrics

**Velocity (v2.4):**

- Total plans completed: 14
- Total phases: 6
- Shipped: 2026-03-27

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 23 | 2/2 | Complete |
| 24 | 2/3 | In Progress |
| 25 | 2/2 | Complete |
| 26 | 2/2 | Complete |
| 27 | 2/2 | Complete |
| 28 | 2/2 | Complete |
| Phase 29-ca-ecpr-xml-export P01 | 272 | 2 tasks | 9 files |

## Accumulated Context

### Decisions

Key decisions affecting v2.5 work:

- [Research]: xmlbuilder2@4.0.3 is the single new dependency for both CA and WA XML — install first action in Phase 29
- [Research]: CAE-01 (fringe disaggregation DB columns) must ship in same plan as CAE-02 (XML generator depends on those columns)
- [Research]: No full SSN storage — use 000000XXX placeholder in CA XML with prominent modal disclosure; contractor enters SSN directly in portal
- [Research]: DIR Project ID is NOT the app's internal project.id — must be collected via pre-generation modal labeled explicitly "CA DIR Project ID (from DIR portal)"
- [Phase 29 discuss]: CA fringe entry — 4 per-hour fields (H&W, pension, vacation, training) in payroll entry form for CA projects; fringeRateSnapshot = auto-sum; non-CA unchanged
- [Phase 29 discuss]: CA eCPR modal fields persist to project record (contractorFein, dirProjectId, awardingAgency, contractNumber); checkNum is ephemeral per export with DIRECT DEPOSIT default
- [Phase 29 discuss]: Post-download checklist is step 2 of the pre-generation modal (in-place transition after download)
- [Research]: WA PWIA has no file upload for Intent/Affidavit — WAL-04 is a UI summary panel only, not a file download
- [Research]: getPayrollEntriesWithWorkerDetails() extended join is a shared prerequisite — build once in Phase 29, reuse in Phase 30
- [Phase 25]: waTradeCode stored per classification in 0013 migration — Phase 30 reads this column for WA trade code gate
- [Phase 29-ca-ecpr-xml-export]: fringe sub-columns nullable REAL: null=non-CA, 0=explicitly zero; getPayrollEntriesWithWorkerDetails new export alongside getPayrollEntries; UpsertEntrySchema extended to prevent Zod strip silently dropping fringe fields

### Pending Todos

None.

### Blockers/Concerns

- [Phase 24]: 24-03-PLAN.md not yet executed (A-1-131 PDF generator + export route). This is v2.4 work. Confirm whether to complete before starting v2.5 or treat as parallel track.

## Session Continuity

Last session: 2026-03-27T08:28:40.805Z
Stopped at: Completed 29-01-PLAN.md
Resume file: None
