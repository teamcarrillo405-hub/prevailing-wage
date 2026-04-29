# Phase 58 Validation — Enhanced Fringe Report

## Automated Checks

Run these after execution completes.

### 1. Integration tests pass
```bash
npx vitest run tests/routes/fringe-breakdown.test.ts
```
Expected: 2 tests pass (403 unauthorized, 200 with correct structure)

### 2. TypeScript compilation clean
```bash
npx tsc --noEmit
```
Expected: exit 0, no errors

### 3. Full test suite unbroken
```bash
npx vitest run
```
Expected: all pre-existing tests continue to pass

---

## Structural Checks (grep-verifiable)

### Service function exported
```bash
grep -n "export.*getFringeBreakdown\|export.*FringeBreakdownRow" src/server/services/reportsService.ts
```
Expected: lines present for both the interface and the function export

### Route registered
```bash
grep -n "fringe-breakdown" src/server/routes/reports.ts
```
Expected: at least one line (the route handler)

### Tab in ReportsPage
```bash
grep -n "fringeBreakdown" src/client/pages/ReportsPage.tsx
```
Expected: multiple lines (useState type, tabClass call, button onClick, query, panel condition)

### Optional weekId param handled
```bash
grep -n "weekId" src/server/routes/reports.ts
```
Expected: line extracting `req.query.weekId`

```bash
grep -n "weekId" src/server/services/reportsService.ts
```
Expected: getFringeBreakdown signature shows `weekId?: string` parameter

---

## Response Shape Verification

After seeding a CA project with fringe entries (fringeHealthWelfare, fringePension, etc. set to non-zero values), a call to:

```
GET /api/reports/:projectId/fringe-breakdown
```

Must return:
```json
{
  "rows": [
    {
      "fundType": "healthWelfare",
      "unionLocal": "Carpenters Local 409",
      "classificationLevel": "journeyworker",
      "totalAmount": 40.00,
      "workerCount": 1
    },
    ...
  ]
}
```

Rules to verify:
- `fundType` is one of: `healthWelfare`, `pension`, `vacation`, `training`
- `unionLocal` is a string (null workers.unionLocal becomes `"Unaffiliated"`)
- `classificationLevel` is one of: `journeyworker`, `apprentice`, `foreman`
- `totalAmount` is a number > 0 (zero-amount fund types are excluded from results)
- `workerCount` is a positive integer

---

## UI Validation (manual, optional)

1. Start dev server: `npm run dev`
2. Log in and navigate to a project with payroll entries that have CA-style fringe values
3. Click **Reports** in the project nav
4. Verify three tabs appear: "Fringe Benefit Summary", "Pay History", "Fringe Breakdown"
5. Click **Fringe Breakdown**
6. Verify table columns: Union Local | Classification | H&W | Pension | Vacation | Training
7. Verify totals row at the bottom sums each fund type column
8. For a project with no CA-style fringe entries, verify the empty state message appears instead of the table

---

## Scope Boundaries (what was NOT changed)

- `src/server/index.ts` — NOT modified (reportsRouter already registered at /api/reports)
- Existing Fringe Benefit Summary tab — NOT modified
- Existing Pay History tab — NOT modified
- Database schema — NOT modified (uses existing Phase 29 fringe columns)
- No new database migrations required
