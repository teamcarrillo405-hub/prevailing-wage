# Phase 57 Validation Checklist — Audit Log CSV Export

## Automated checks

Run these in order. All must pass before marking Phase 57 complete.

### 1. TypeScript — no compile errors

```bash
npx tsc --noEmit
```

Expected: zero errors, zero warnings.

### 2. Route integration tests

```bash
npx vitest run tests/routes/audit.test.ts
```

Expected: 4 tests, all PASS.

| Test | What it proves |
|------|----------------|
| 403 for non-member | `assertProjectAccess` is enforced (NFR-03) |
| 200 + text/csv | Route exists and returns correct Content-Type |
| BOM bytes EF BB BF | Excel-safe UTF-8 encoding is present |
| `=` action escaped with `'` | Formula injection protection is active |

### 3. No regression in other route tests

```bash
npx vitest run tests/routes/
```

Expected: all existing tests continue to pass.

---

## Manual spot-checks

These require a running dev server (`npm run dev` or equivalent).

### CSV download — happy path

1. Log in as a project owner.
2. Navigate to `/projects/<id>/activity`.
3. Click "Export CSV".
4. Verify the browser downloads a file named `project-audit-<id>.csv`.
5. Open the file in Excel (or LibreOffice Calc).
6. Confirm columns: Date, User, Entity Type, Entity ID, Action, Details.
7. Confirm no formula-bar prompt / security warning from Excel for normal rows.

### CSV download — date filter forwarded

1. Set a "From" date on the activity page.
2. Click "Export CSV".
3. Inspect the download URL in the browser — confirm `?from=<date>` is appended.
4. Open the CSV and confirm only rows on or after that date are present.

### Formula injection — manual verification

1. Using a database client or integration test seed, insert an audit log row where
   `action = '=HYPERLINK("http://evil.com","click")'`.
2. Download the CSV for that project.
3. Open in Excel — confirm the cell reads `'=HYPERLINK(...)` (the leading `'` prevents
   Excel from evaluating it as a formula).

### Authorization — negative case

1. Log in as User B (not a member of User A's project).
2. Request `GET /api/audit/<projectA-id>/csv` directly (e.g., via curl or browser).
3. Confirm response is `403 Access denied` (not a CSV body).

### No audit log recursion

1. Download the CSV.
2. Immediately refresh the Project Activity page.
3. Confirm no new audit entry appears for the CSV download action itself.

---

## Acceptance gate

Phase 57 is complete when:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run tests/routes/audit.test.ts` — 4/4 PASS
- [ ] `npx vitest run tests/routes/` — no regressions
- [ ] Manual: CSV downloads with correct filename
- [ ] Manual: BOM confirmed (file opens without encoding prompt in Excel)
- [ ] Manual: Formula injection cell is prefixed with `'`
- [ ] Manual: Unauthorized user receives 403
- [ ] Manual: CSV download does not appear in the activity log itself
