# Requirements: v2.2 — UX Completion + Compliance Hardening

**Milestone:** v2.2
**Status:** Draft — roadmap created
**Last updated:** 2026-03-22

---

## v1 Requirements

### Category: WH-347 Submission (WH)

*Closes the submission feedback loop — contractor knows what they're submitting and that it's being generated.*

- [ ] **WH-01:** When contractor clicks "Download WH-347" and violations exist for that payroll week, system shows a preflight modal listing each violation (worker name, type, delta amount) with a "Download Anyway" confirmation — contractor can acknowledge and proceed, or cancel
- [ ] **WH-02:** WH-347 download shows "Generating..." state on the anchor/button while the PDF request is in-flight, then returns to normal after download begins — prevents double-clicks and signals the PDF is being built

### Category: Compliance Engine (COMP)

*Extends computeCompliance() with the third Davis-Bacon violation type — apprentice ratio.*

- [ ] **COMP-03:** System flags a violation per payroll week when total apprentice labor hours exceed the allowable ratio (1 apprentice hour per 3 journeyworker hours) — violation appears in the compliance panel and PayrollWeekDetailPage alongside under-wage and CWHSSA violations

### Category: UX (UX)

*Surfaces workflow completion state so contractors know exactly where they are in the process.*

- [ ] **UX-04:** Project Detail page shows a workflow progress indicator with 4 steps — Create Project, Add Workers, Enter Payroll, Download WH-347 — each step marked complete based on actual data (project exists, workers exist, payroll entries exist, at least one WH-347 downloaded)

### Category: Reports (RPT)

*Makes reports submission-ready by optimizing for browser print-to-PDF.*

- [ ] **RPT-01:** Fringe benefit summary report prints cleanly via browser Ctrl+P — table headers repeat on each page, totals row visible, no nav chrome or tab UI printed, column widths preserve on paper
- [ ] **RPT-02:** Worker pay history report prints cleanly via browser Ctrl+P — worker selector hidden on print, selected worker's full history table visible, consistent column alignment across pages

---

## Future Requirements

*Deferred from this milestone scope.*

- Hard block on WH-347 if violations exist (v2.2 chose warn+confirm, not block — escalate if DOL audit risk increases)
- Server-generated PDF for reports via pdf-lib (browser print is sufficient for v2.2)
- WH-347 generation history / audit log per week (track when WH-347 was last generated)
- State-specific prevailing wage forms (CA DIR, WA L&I) — federal WH-347 only
- Multi-user / team accounts

---

## Out of Scope

- Hard block on WH-347 submission — warn + confirm is the right UX for compliance software; contractors may have legitimate reasons to submit with known deviations
- Server-generated report PDFs — browser Ctrl+P produces equivalent output without a new dependency
- Daily apprentice ratio check — per-week is the Davis-Bacon enforcement granularity

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| WH-01 | Phase 16 | Complete |
| WH-02 | Phase 16 | Complete |
| COMP-03 | Phase 15 | Complete |
| UX-04 | Phase 15 | Complete |
| RPT-01 | Phase 15 | Complete |
| RPT-02 | Phase 15 | Complete |
