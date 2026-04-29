# Phase 100 Validation: ROI Calculator Page

## Requirement Coverage

| Requirement | Plan | Status |
|-------------|------|--------|
| TRUST-04: /roi public route | 100-01 | Planned |
| TRUST-04: URL param pre-fill | 100-01 | Planned |
| TRUST-04: Hours-saved formula | 100-01 | Planned |
| TRUST-04: Dollar value output | 100-01 | Planned |
| TRUST-04: Email capture CTA | 100-01 | Planned |
| TRUST-04: POST /api/roi-leads | 100-02 | Planned |
| TRUST-04: roi_leads DB table | 100-02 | Planned |

## Wave Structure

Both plans are Wave 1 — they have no inter-plan dependencies and can execute in parallel.

Plan 100-01 (React page) will call /api/roi-leads; it will 404 until Plan 100-02 ships.
That is expected — the UI is testable in isolation (mock fetch in vitest).

## Formula Verification

| Input (workers, weeks/yr, rate) | Expected Hours | Expected Savings |
|---------------------------------|---------------|-----------------|
| 10 workers, 52 wk, $45/hr      | 1,300 hrs     | $58,500          |
| 20 workers, 52 wk, $45/hr      | 2,600 hrs     | $117,000         |
| 50 workers, 52 wk, $45/hr      | 6,500 hrs     | $292,500         |
| 200 workers, 52 wk, $45/hr     | 26,000 hrs    | $1,170,000       |

Formula: annualHours = workers × 2.5 × 52; annualSavings = annualHours × 45

## Manual Smoke Test Checklist

After both plans execute, verify:

- [ ] `http://localhost:5173/roi` loads without login prompt
- [ ] `http://localhost:5173/roi?projects=10&workers=50` pre-fills sliders to 10 and 50
- [ ] Moving workers slider from 20 to 50 updates displayed hours from "2,600 hours" to "6,500 hours"
- [ ] Moving workers slider from 20 to 50 updates displayed savings from "$117,000" to "$292,500"
- [ ] Email field empty → submit button is disabled
- [ ] Enter `test@example.com` → submit button is enabled
- [ ] Click submit → "Sending..." appears → "Report sent! Check your inbox." on success
- [ ] Database row exists: `SELECT * FROM roi_leads` shows the submitted record
- [ ] No HCC nav chrome appears (page has its own floating nav matching LandingPage)
- [ ] Page is visually consistent with LandingPage: navy gradient hero, brand-gold accents

## Automated Test Commands

```bash
# Run all Phase 100 tests
cd /c/Users/glcar/prevailing-wage && npx vitest run src/client/pages/RoiCalculatorPage.test.tsx src/server/routes/roiLeads.test.ts

# TypeScript check (ignore pre-existing workers.ts errors)
cd /c/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | grep -v "workers.ts" | head -20

# Full suite regression check
cd /c/Users/glcar/prevailing-wage && npx vitest run 2>&1 | tail -20
```

## API Contract

```
POST /api/roi-leads
Content-Type: application/json

Request:
{
  "email": "contractor@example.com",
  "projectCount": 5,
  "workerCount": 20,
  "estimatedSavings": 117000
}

Response 201:
{
  "id": "uuid-v4",
  "email": "contractor@example.com",
  "projectCount": 5,
  "workerCount": 20,
  "estimatedSavings": 117000,
  "capturedAt": "2026-04-27T00:00:00.000Z"
}

Response 400 (validation failure):
{
  "error": "Invalid input"
}
```

## DB Schema

```sql
CREATE TABLE IF NOT EXISTS `roi_leads` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `project_count` integer NOT NULL,
  `worker_count` integer NOT NULL,
  `estimated_savings` real NOT NULL,
  `captured_at` text NOT NULL
);
```

Migration file: `src/server/db/migrations/0055_roi_leads.sql`
Journal idx: 55, tag: `0055_roi_leads`
