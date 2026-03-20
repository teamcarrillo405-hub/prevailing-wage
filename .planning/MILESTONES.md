# Milestones

## v1.0 — Foundation + Wage Engine + Payroll + Differentiators

**Shipped:** 2026-03-19
**Phases:** 1–5

Core platform: auth, projects, federal wage lookups (SAM.gov), workers/classifications, weekly payroll entry, WH-347 PDF generation, CSV export, OT scenario comparison, union allocations, GSA rate builder, job cost variance reporting.

Details: `.planning/milestones/v1.0-ROADMAP.md` (not archived — built before GSD structure)

---

## v2.0 — Contractor UX Overhaul + Compliance

**Shipped:** 2026-03-20
**Phases:** 6–9 (4 phases, 16 plans)
**Files:** 70 changed (+10,936 / -162 lines)
**Tests:** 181 passing

### Delivered

Complete contractor compliance workflow: every WH-347 conforms to the January 2025 DOL revision, compliance violations (under-wage, CWHSSA OT) are flagged before submission, and the dashboard surfaces project health at a glance. Contractors can access fringe and pay history reports, download WH-347 from any payroll week, and see inline warnings before generating legally invalid forms.

### Key Accomplishments

1. **January 2025 WH-347**: Multi-page support (workers chunked 8/page), Page X of Y notation, `certApprentices` boolean derived from real `programName` data — no more hardcoded `true`
2. **Compliance engine**: `computeCompliance()` detects under-wage and CWHSSA OT violations from stored rate snapshots; drives `certProperPayment`/`certAccuratePayroll` on Statement of Compliance
3. **Payroll Week Detail**: Per-week view with inline compliance violation badges, worker/violation table, and one-click WH-347 download anchor
4. **Dashboard compliance badges**: Each project card shows green/red/gray compliance status badge + week count, via per-card TanStack Query fetch
5. **Full UX completion**: No dead ends — nav links to all 4 sections, WH-347 button per payroll week row, amber missing-data warnings on worker cards
6. **Reports**: Fringe benefit summary and worker pay history — tabbed UI with worker selector, rate snapshots frozen at entry time

### Archive

- Roadmap: `.planning/milestones/v2.0-ROADMAP.md`
- Requirements: `.planning/milestones/v2.0-REQUIREMENTS.md`
