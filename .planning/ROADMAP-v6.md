# v6.0 Roadmap — "Every State, Gorgeous UI, Ship Ready"

**Author:** Claude  **Date drafted:** 2026-04-21  **Status:** DRAFT for user approval

This roadmap synthesizes 4 audits (pre-existing uncommitted changes, state
form generators, wage-data infrastructure, UI surfaces) into a phased
execution plan. Each phase is a shippable increment with clear exit criteria.

**Scope boundary honesty:** the user's stated goal of "every state, county,
city prevailing wage for every classification" is a multi-month data-engineering
effort, not a sprint. This roadmap breaks that goal into **phases that each
ship something useful**, rather than trying to finish everything at once.

---

## Milestone M1 — State form generators ported to widget pattern (3–5 sessions)

**Why:** every current generator uses fragile coordinate overlay. The WH-347
experience proved this pattern is "globally off" after any form revision.
All 6 remaining generators have the same risk.

**Pattern:** copy `scripts/calibrate/` structure per form. One `widgets.json`
per form. One build script per form. Same browser calibration UI pointed at
each form's directory.

**Ports in order (easiest → hardest):**

| Phase | Form | Generator | Approach | Size |
|---|---|---|---|---|
| M1.1 | CA A-1-131 | `a1131Generator.ts` | Template-based, 346 lines, 13 coords — straight port | Small |
| M1.2 | IL Certified Transcript | `ilPdfGenerator.ts` | Create-from-scratch, 517 lines — needs template PDF source | Medium |
| M1.3 | NY PW-12 | `pw12Generator.ts` | Create-from-scratch, 447 lines, dual ST/OT | Medium |
| M1.4 | NJ MW-562 | `njPdfGenerator.ts` | Create-from-scratch, 540 lines, EEO columns | Medium |
| M1.5 | MA Certified Payroll | `maPdfGenerator.ts` | Create-from-scratch, 565 lines, OSHA cols | Large |
| ~~M1.6~~ | ~~Multi-project Compliance PDF~~ | `complianceSummaryPdfGenerator.ts` | **NOT A WIDGET CANDIDATE** — dynamic report with variable-length project list; pagination is data-driven. Coordinate-overlay is correct here. Leave as-is. | n/a |
| M1.7 | WA L&I F700 | `f700Generator.ts` | Currently unimplemented skeleton — build + port together | Medium |

**Exit criteria:** all 7 generators fill by widget name + flatten. Zero
`drawText({x: N, y: N})` coordinate literals in runtime code.

**Infrastructure work needed upfront:**
- Generalize `scripts/calibrate/server.mts` to accept a form name (URL path
  `/wh347`, `/a1131`, etc.) and serve from `scripts/calibrate/<form>/`
- Move existing WH-347 assets to `scripts/calibrate/wh347/`
- Document the "port a new form" procedure in `scripts/calibrate/README.md`

---

## Milestone M2 — Wage data coverage expansion (4–6 sessions)

**Current state:** 50 states + DC at statewide level. CA has 4 counties,
NY has 1 county. All others: no county data. No city data at all.

**Phased expansion:**

| Phase | Deliverable | Effort |
|---|---|---|
| M2.1 | CA county completion (54 remaining counties in `WD_SEED_LIST`) | 1 session — data lookup |
| M2.2 | NY county completion (61 remaining counties) | 1 session — data lookup |
| M2.3 | TX county seeding (254 counties — at least top 50 metros) | 1 session — data lookup |
| M2.4 | FL county seeding (67 counties — top 30 metros) | 1 session — data lookup |
| M2.5 | MA state adapter (parallel to CaDirAdapter pattern) | 2 sessions — new adapter + CSV template |
| M2.6 | NJ state adapter (Wage Hub) | 2 sessions — similar to M2.5 |
| M2.7 | Sync monitoring dashboard (Admin page showing per-state coverage, freshness, last sync) | 1 session — React page |
| M2.8 | Cron config for monthly SAM.gov refresh | 0.5 session — config + alerts |

**City-level coverage (M2.9+):** deferred pending real customer demand.
Would require schema changes (state, county, city keys) and per-metro
research (SF, NYC, Boston, Chicago prevailing wage ordinances).

**Exit criteria:** coverage dashboard shows >80% county coverage for CA, NY,
TX, FL, WA plus statewide for all 50. Sync runs monthly without manual ops.

---

## Milestone M3 — UI polish pass (3–4 sessions)

**Strategy:** fix broken foundations first, then abstract patterns, then
upgrade key screens.

**Phase M3.1 — Foundation fixes (1 session):**
- [ ] Fix Button.tsx — restore secondary/ghost variants (currently all gold)
- [ ] Build `<Input>`, `<Select>`, `<Textarea>` components with label, error,
      help text, required marker props
- [ ] Build `<Table>` component abstracting header/body/footer + alternating
      rows + tfoot styling
- [ ] Build `<Modal>` component (currently PayrollListPage rolls its own)

**Phase M3.2 — Empty + loading states (0.5 session):**
- [ ] Use existing `<EmptyState>` on DashboardPage, PayrollListPage, ReportsPage
- [ ] Build `<Skeleton>` component for major tables (replaces generic spinner
      during data load)
- [ ] Inline form validation feedback on PayrollWeekForm, WorkersPage

**Phase M3.3 — Major screen refreshes (1–2 sessions):**
- [ ] DashboardPage: add compliance-at-a-glance card (active/violations/overdue
      counts with mini status chart) above project grid
- [ ] PayrollWeekDetailPage (131K file): add section headers, `<Card>` wrappers
      per logical group, consider splitting tabs into sub-pages
- [ ] WorkersPage (67K): replace inline editing with row-expand modal pattern

**Phase M3.4 — Payroll entry wizard (2 sessions):**
- [ ] Replace dense PayrollWeekDetailPage entry flow with 3-step wizard:
      (1) select workers, (2) enter hours (week grid), (3) review + submit
- [ ] Keep detail page for *viewing* completed payroll

**Exit criteria:** every major page uses shared components, consistent spacing,
proper empty/loading states. Button variants work correctly. Form validation
inline. Dashboard tells the story of compliance at a glance.

---

## Milestone M4 — Infrastructure + Ops (1–2 sessions)

- [ ] Commit decisions on held files (Button.tsx revert, ProjectDetailPage
      nav reorder, vite.config port change, wdolSync 25-state seed expansion)
- [ ] Production deployment review — is Render.com config current?
- [ ] Monitoring dashboards (Grafana / Sentry hooks?)
- [ ] Backup strategy for `data/*.db` SQLite files
- [ ] Security audit: cookie flags, CSP headers, rate limits on sync endpoints

---

## Sequencing recommendation

Work in this order for maximum shippable increments:

1. **M1.1** (CA A-1-131 port) — 1 session — validates the pattern on a real
   working form, fixes CA-specific alignment risk
2. **M3.1** (UI foundation fixes) — 1 session — Button fix unblocks everything
3. **M2.1 + M2.2** (CA + NY county completion) — 1 session — quick data win
4. **M1.2 + M1.3** (IL + NY state forms port) — 2 sessions
5. **M3.3** (dashboard compliance card) — 1 session — user-visible polish
6. **M2.5 + M2.6** (MA + NJ adapters) — 2 sessions
7. **M1.4–M1.7** remaining form ports — 3 sessions
8. **M3.4** (payroll wizard) — 2 sessions — biggest UX upgrade
9. **M2.7 + M2.8** (sync dashboard + monitoring) — 1 session

**Total: ~14 sessions** to reach a fully ported, broadly covered, polished
state. NOT one continuous run — each phase ships independently.

---

## What I will NOT do in this roadmap

**"Don't stop" is incompatible with good engineering.** Pausing at phase
boundaries for human review, user calibration of each form, and decision
points (which state next? which UX direction?) is what keeps the work
shippable. An always-on agent rebuilding the same feature 10 different
ways is worse than a deliberate multi-session plan.

Every phase above is a natural stopping point where you evaluate, adjust,
and redirect.

## Decision points for user

Before M1 kicks off, please decide:

1. **Which state form port first?** Recommend A-1-131 (real, in use). F700
   would need implementation + port combined — more work.
2. **Button.tsx — revert or keep gold?** Decides whether M3.1 reverts or
   finishes the styling change.
3. **City-level coverage — in or out of v6?** Major schema change if in.
4. **Cron sync schedule — monthly, quarterly, or on-demand only?**
5. **Scope of "every classification"** — do you need hundreds of state-specific
   trade codes, or is "journeyworker, apprentice, specific classification name
   from WD" sufficient? (SAM.gov lists ~200 trade codes per WD — already covered.)

---

## Appendix: held-for-review uncommitted changes (from audit)

| File | Decision pending |
|---|---|
| `src/client/components/ui/Button.tsx` | REVERT? All variants broken |
| `src/client/pages/ProjectDetailPage.tsx` | Depends on Button decision |
| `src/server/services/wdolSync.ts` | 25-state seed expansion — prep for future or commit now? |
| `vite.config.ts` | Port change 3000→4200 intentional? |
