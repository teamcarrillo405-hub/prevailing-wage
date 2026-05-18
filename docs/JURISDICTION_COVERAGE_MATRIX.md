# Jurisdiction Coverage Matrix

Last updated: 2026-05-16

Use this matrix before presenting PrevWage as supporting a jurisdiction, form, or workflow. Coverage means the product can capture the required data, preflight missing fields, generate the applicable package from source payroll, preserve audit evidence, and state its limitations clearly.

## Coverage Status Definitions

| Status | Meaning | Customer posture |
| --- | --- | --- |
| Production pilot | Full workflow is implemented and has a current pilot rehearsal or real pilot evidence. | Use with named pilot contractors and human review. |
| Controlled pilot | Route, form/export, core fields, and tests exist, but agency/channel validation or real contractor UAT is still pending. | Use only with selected contractors and implementation support. |
| Federal-first | Federal Davis-Bacon/WH-347 workflow is the supported path; state/local specifics are reviewed project by project. | Sell only when the project facts fit the federal workflow. |
| Internal validation | Generator or route exists, but UI, preflight, source review, or pilot evidence is incomplete. | Do not sell as supported. |
| Not supported | No validated state/local package. | Use federal WH-347 only if federal coverage applies. |

## Federal, State, And Local Matrix

| Layer | Current support | Evidence in product | Pilot gate before expansion | Limitations |
| --- | --- | --- | --- | --- |
| Federal Davis-Bacon | Strong baseline | WH-347 PDF, statement of compliance, wage determination pinning, worker/classification records, fringe/deduction/net/gross traceability, evidence packet | Run a five-worker/two-week federal fixture and visual form review for each major workflow change | Agency portal filing is not automated; contractor remains final certifier |
| California state | Production pilot rehearsal complete | CA A-1-131 PDF, CA eCPR XML, DIR project fields, daily OT/DT, SDI/tax/deduction/fringe breakdown, subcontractor CPR, evidence packet, pilot summary | Real contractor UAT using `docs/CA_PILOT_RUNBOOK.md` with findings logged | Local agency overlays still require human review unless explicitly configured |
| Washington state | Controlled pilot | F700 PDF, WA CPR XML, L&I/PWIA fields, trade-code handling | Validate generated package against current L&I portal expectations with two real payroll weeks | Do not broadly sell until portal/package validation is dated |
| New York state | Controlled pilot | PW-12 PDF, MPWR XML, PRC/contractor registration fields | Confirm current electronic CPR requirements and run contractor UAT | Electronic submission requirements may change; verify before each pilot |
| Illinois state | Controlled pilot | IDOL PDF, non-prevailing-hour capture, WH-347 when applicable | Validate mixed public/private hour scenarios with pilot payroll | State package needs agency review before broad use |
| Massachusetts state | Controlled pilot | MA DLS payroll PDF and MA project fields | Validate DLS package with real project metadata | Project field requirements need current DLS source review |
| New Jersey state | Controlled pilot | MW-562 PDF, deduction fields, worker metadata | Validate deduction and demographic fields with pilot payroll | Use implementation support until UAT is complete |
| Texas | Federal-first | WH-347 and TX CPR route where applicable | Confirm target projects have TxDOT or local reporting requirements before enabling state package | Position federal Davis-Bacon first unless project-specific state/local reporting is confirmed |
| Minnesota | Internal validation | MN DLI generator/route exists | Add route/UI/preflight tests and pilot data | Not customer-facing |
| Virginia | Internal validation | VA DOLI generator/route exists | Add route/UI/preflight tests and pilot data | Not customer-facing |
| Local ordinances | Review overlay | Jurisdiction assessment flags local review for city, county, school district, transit, housing, port, airport, and authority overlays | Add the local ordinance source, required fields, wage source, forms, evidence rules, and pilot fixture before enabling | No local rule is silently assumed; unconfigured local requirements stay review-only |

## Expansion Playbook

1. Record the official source URL, form/schema version, and review date.
2. Add or confirm project, contractor, worker, classification, payroll, fringe, deduction, apprentice, and evidence fields.
3. Add preflight checks with exact fix targets for every required field.
4. Generate federal and state/local packages from a five-worker, two-week fixture.
5. Compare generated totals to source payroll for regular, overtime, double-time, gross, deductions, net, fringe, and employer contribution values.
6. Run reviewer/auditor read-only flow and subcontractor CPR flow.
7. Update `src/shared/stateSupport.ts`, `docs/STATE_EXPANSION_READINESS.md`, and this matrix together.
8. Log pilot findings and do not move the jurisdiction to customer-ready status until blocker/high findings are closed.

## Current Launch Decision

PrevWage can honestly present itself as a federal, state, and local prevailing wage command center when the coverage language remains explicit: federal baseline support is strong, California is the production pilot, selected states are controlled pilots, and unconfigured local overlays require review instead of automatic certification.
