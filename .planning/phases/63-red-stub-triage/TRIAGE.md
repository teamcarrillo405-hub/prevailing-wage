# RED Stub Triage — 17 Pre-Existing Failing Tests

**Scanned at:** commit `f82c445` (post-phase-60 merge + TS7006 cleanup)
**Total failing:** 17 across 6 test files (matches session memory's count).
**Note:** These failures pre-date Phase 60 (payroll wizard). No regressions from wizard work.

## Summary

The failures cluster into four feature-level groups. Fixing by group is more efficient than one-test-at-a-time because the tests within a group likely share a root cause.

---

## Group A — PDF export state-gate + auth (7 tests — `tests/routes/export.test.ts`)

| Test | Pattern |
|------|---------|
| `CAL-02 should return 400 for non-CA project` | state-gate |
| `CAL-02 should return PDF for CA project` | golden path |
| `CAL-02 should return 403 for unauthorized access` | IDOR guard |
| `STATE-13 should return 400 for non-WA project on f700 route` | state-gate |
| `NJ-02 returns 400 when project state is not NJ` | state-gate |
| `NJ-02 returns 200 with PDF content-type for a valid NJ project` | golden path |
| `NJ-02 returns 403 for cross-tenant access (IDOR guard)` | IDOR |

**Hypothesis:** The export endpoints (CA a1131, WA f700, NJ mw562) likely exist but either (a) don't apply the shared `assertProjectAccess` / state-gate middleware consistently, or (b) the test fixtures don't create the right seed data for the state-gate to pass.

**Fix complexity:** Moderate. Likely one or two middleware/route-wiring fixes resolves most of the group. Start by opening `src/server/routes/export.ts` (or wherever a1131/f700/mw562 are routed) and comparing against a passing export route (e.g., MA's mw562, per `tests/services/maPdfGenerator.test.ts` passing).

**Recommendation:** Tackle first. High leverage, likely shared root cause.

---

## Group B — CA-specific project fields (3 tests — `tests/routes/projects.test.ts`)

| Test |
|------|
| `should persist cslbLicense and wcPolicyNumber on CA project creation` |
| `should allow CA project creation without CSLB fields (optional)` |
| `should NOT include CA fields in response for non-CA project` |

**Hypothesis:** California Contractor State License Board (CSLB) license + Workers' Comp policy number fields are required on CA public-works projects. The `projects` table schema may be missing these columns, OR the create service strips them, OR the response serializer doesn't include them.

**Fix complexity:** Moderate. Check `src/server/db/schema.ts` projects table — if `cslbLicense` / `wcPolicyNumber` columns missing, a migration is needed. If present, the gap is in `createProject` service or response shaping.

**Recommendation:** Quick win if columns exist. Migration if not.

---

## Group C — Payroll route edge cases (5 tests — `tests/routes/payroll.test.ts`)

| Test |
|------|
| `AMD-02: Amendment week WH-347 Content-Disposition filename contains "amended"` |
| `PAY-01 + PAY-02 Test 7: Source entry daily hours (monSt..sunOt) are preserved in copied entries` |
| `should accept monDt-sunDt fields in payroll entry for CA project` |
| `should default DT fields to 0 when not provided` |
| (two more — see full vitest output) |

**Hypothesis (AMD-02):** WH-347 export generates a `Content-Disposition: filename="..."` header. For amendment weeks (where `amendmentNumber != null`), the filename should include the word "amended". The current filename logic likely omits that marker.

**Hypothesis (PAY-01 Test 7):** `POST /api/payroll/weeks/copy` copies entries from a source week. Test 7 asserts daily hour fields survive the copy. If failing, the copy service might be zeroing hours or only copying the worker+rate, not the hours themselves.

**Hypothesis (monDt-sunDt):** DT fields ARE in the schema and `UpsertEntrySchema` (verified during Phase 60). Tests may be asserting specific defaults on a code path that doesn't set them, OR the test expects DT fields to be present on non-CA responses too.

**Fix complexity:** Mixed — AMD-02 is trivial (one-line filename change). PAY-01 Test 7 is moderate (check `copyPayrollWeek` in payrollService). DT tests need inspection.

**Recommendation:** Fix AMD-02 first (trivial). Others need 15 min of reading each.

---

## Group D — Raw PDF generator tests (~5 tests — `tests/services/{ma,nj}PdfGenerator.test.ts`)

| Test |
|------|
| `should return a valid PDF (starts with %PDF)` — MA + NJ |
| `should produce PDF output > 1000 bytes` — MA + NJ |
| `should handle empty workers array` — MA + NJ |

**Hypothesis:** These are service-level tests on `maPdfGenerator` / `njPdfGenerator`. They bypass the route layer entirely. Failures suggest the generators may (a) throw on empty worker input, (b) produce output below 1000 bytes on test fixtures, or (c) not return a `Uint8Array` / `Buffer` starting with the `%PDF` magic bytes.

**Fix complexity:** Unknown. Could be a trivial guard (`if (workers.length === 0) return buildEmptyTemplate()`) or a deeper rendering issue. Requires reading each test.

**Recommendation:** Defer. Route-level tests (Group A's NJ-02 PDF test) cover the happy path at a higher level — fixing Group A may incidentally fix Group D's happy-path tests. Focus effort there first.

---

## Group E — Misc singletons (2 tests across compliance, team, import, reports)

Each of these is a singleton failure in a larger test file, likely a specific regression or incomplete implementation:

- `tests/security/cross-tenant.test.ts > Cross-tenant IDOR protection` — global auth test, suspicious. Possibly seed data issue.
- `tests/services/complianceService.test.ts > COMP-01` — 4 sub-tests failing on `computeCompliance`. Share a root cause; test fixtures may have stale rate snapshots after a schema migration.
- `tests/routes/team.test.ts > DELETE /api/team/members/:userId owner tries to remove themselves` — likely a guard missing that returns 400 instead of 200.
- `tests/routes/import.test.ts > POST /api/payroll/import/mappings returns 400 when required fields are missing` — validation middleware issue.
- `tests/routes/reports.test.ts > fringe-summary + pay-history` — endpoint implementations incomplete (session memory also flagged these as RED stubs).

**Fix complexity:** Variable. Each needs individual investigation.

**Recommendation:** Defer. Individual singletons rarely share leverage — fix after the groups above are cleared.

---

## Execution Order (recommended)

1. **Group A — PDF export state-gate** (7 tests, shared root cause, high leverage)
2. **Group C — AMD-02 filename marker** (1 test, trivial)
3. **Group B — CSLB/WC fields on projects** (3 tests, shared root cause)
4. **Group C — PAY-01 Test 7 copy week hours** (1 test, moderate)
5. **Group D — PDF generator tests** (likely resolves alongside Group A)
6. **Group E — singletons** (1-by-1, last)

## Out of scope for this triage

- **Actual fixes.** This document lists hypotheses, not implementations. Each group deserves its own phase with proper plan + UAT.
- **Stale `.claude/worktrees/` test files.** Those are scratch dirs from prior subagent sessions, not real failures. They inflate the raw FAIL count in `npx vitest run` but aren't project tests. Could be cleaned with `rm -rf .claude/worktrees/` in a hygiene pass.

## Artifacts

- Vitest output: `cd /c/Users/glcar/prevailing-wage && npx vitest run tests 2>&1 > /tmp/vitest.log` (excludes `.claude/worktrees`)
- Session memory: phase 60 notes that the 17-failure count pre-dates wizard work
