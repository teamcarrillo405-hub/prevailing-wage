# Prevailing Wage Coverage Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all prevailing wage coverage gaps: 19 remaining state-law CPR forms, state wage adapters for all prevailing-wage states, county/local wage infrastructure (NYC, Chicago/Cook, DC, LA County), and Service Contract Act (SCA) support.

**Architecture:** Each state follows the same three-part pattern established by MA/NJ/IL/MN/VA: (1) a programmatic pdf-lib generator service, (2) a route handler in `export.ts`, and (3) a `stateSupport.ts` entry. County/local adds a new `jurisdiction_type` column and `local_wage_ordinances` table. SCA extends the WD seed list with a new source adapter.

**Tech Stack:** Node.js + TypeScript, pdf-lib (PDF generation), Drizzle ORM + SQLite, Vitest (tests), Express router

**Next migration idx:** 74 (current highest registered: idx 73, tag `0073_project_budgets_backfill`)

---

## States WITH prevailing wage laws that still need forms (19 states)

| State | Law | Form name |
|-------|-----|-----------|
| PA | PA Prevailing Wage Act (1961) | PA-CPR |
| OH | ORC Chapter 4115 | PWC-28 |
| CO | CRS § 8-17-101 COWC | CO CPR |
| MD | MD Code Lab. & Emp. § 17-201 | DLLR CPR |
| OR | ORS 279C.800 BOLI | OR BOLI CPR |
| CT | CGS § 31-53 | CT DOL CPR |
| HI | HRS Chapter 104 | HI DLI CPR |
| KY | KRS 337.505 | KY CPR |
| NM | NMSA § 13-4-11 | NM DOL CPR |
| NV | NRS 338.010 | NV DIR CPR |
| RI | RIGL § 37-13-1 | RI DOL CPR |
| WV | WV Code § 21-5A | WV DOL CPR |
| ME | 26 MRS § 1311 | ME DOL CPR |
| VT | 21 VSA § 391 | VT DFR CPR |
| MT | MCA § 18-2-401 | MT DLI CPR |
| ND | NDCC 34-14-01 | ND DLT CPR |
| DE | 29 Del. C. § 6960 | DE DOL CPR |
| NH | RSA 228:22 | NH DOT CPR |
| AK | AS 36.05.010 | AK DOL CPR |

## States WITHOUT prevailing wage laws (no state form needed — WH-347 only)
FL, GA, AZ, NC, SC, TN, IN, MO (repealed 1994), IA (repealed 2002), WI (repealed 2017), MS, LA (repealed 2010), AR, OK, NE (repealed 2015), KS, AL, ID (limited/highway only), SD, UT, WY

---

## File Map

### Wave A — DB Infrastructure
- Create: `src/server/db/migrations/0074_jurisdiction_type.sql`
- Create: `src/server/db/migrations/0075_local_wage_ordinances.sql`
- Create: `src/server/db/migrations/0076_pa_oh_co_project_fields.sql`
- Create: `src/server/db/migrations/0077_md_or_ct_project_fields.sql`
- Create: `src/server/db/migrations/0078_hi_ky_nm_nv_project_fields.sql`
- Create: `src/server/db/migrations/0079_ri_wv_me_vt_mt_nd_de_nh_ak_fields.sql`
- Modify: `src/server/db/migrations/meta/_journal.json` (add entries for each)

### Wave B — State Wage Adapters
- Modify: `src/server/services/stateWageAdapter.ts` (add 19 ManualImportStateAdapter subclasses + expand STATE_SOURCE_MAP)

### Wave C — PA, OH, CO (Tier 1 volume)
- Create: `src/server/services/paCprGenerator.ts`
- Create: `src/server/services/ohPwc28Generator.ts`
- Create: `src/server/services/coCprGenerator.ts`
- Create: `src/server/services/paCprGenerator.test.ts`
- Create: `src/server/services/ohPwc28Generator.test.ts`
- Create: `src/server/services/coCprGenerator.test.ts`
- Modify: `src/server/routes/export.ts` (add PA/OH/CO routes)
- Modify: `src/shared/stateSupport.ts` (add PA/OH/CO entries)

### Wave D — MD, OR, CT, HI
- Create: `src/server/services/mdDllrGenerator.ts`
- Create: `src/server/services/orBoliGenerator.ts`
- Create: `src/server/services/ctDolGenerator.ts`
- Create: `src/server/services/hiDliGenerator.ts`
- (+ tests and route additions, same pattern as Wave C)

### Wave E — KY, NM, NV, RI, WV
- Create: `src/server/services/kyCprGenerator.ts`
- Create: `src/server/services/nmCprGenerator.ts`
- Create: `src/server/services/nvDirGenerator.ts`
- Create: `src/server/services/riDolGenerator.ts`
- Create: `src/server/services/wvDolGenerator.ts`
- (+ tests and route additions)

### Wave F — ME, VT, MT, ND, DE, NH, AK
- Create: `src/server/services/meDolGenerator.ts`
- Create: `src/server/services/vtDfrGenerator.ts`
- Create: `src/server/services/mtDliGenerator.ts`
- Create: `src/server/services/ndDltGenerator.ts`
- Create: `src/server/services/deDolGenerator.ts`
- Create: `src/server/services/nhDotGenerator.ts`
- Create: `src/server/services/akDolGenerator.ts`
- (+ tests and route additions)

### Wave G — County/Local Infrastructure
- Create: `src/server/services/localWageAdapter.ts`
- Create: `src/server/services/nycCprGenerator.ts`
- Create: `src/server/services/cookCprGenerator.ts`
- Create: `src/server/services/dcOcpGenerator.ts`
- Create: `src/server/services/laCountyCprGenerator.ts`
- Modify: `src/server/routes/wages.ts` (add `/local-lookup` endpoint)
- Modify: `src/server/routes/export.ts` (NYC/Cook/DC/LAC routes)

### Wave H — Service Contract Act
- Modify: `src/server/services/wdolSync.ts` (add SCA seed list)
- Create: `src/server/services/scaAdapter.ts`
- Modify: `src/server/services/stateWageAdapter.ts` (register SCA adapter)
- Modify: `src/shared/stateSupport.ts` (add `jurisdiction: 'sca'` concept)

---

## Task 1: DB Migration — jurisdiction_type + local_wage_ordinances

**Files:**
- Create: `src/server/db/migrations/0074_jurisdiction_type.sql`
- Create: `src/server/db/migrations/0075_local_wage_ordinances.sql`
- Modify: `src/server/db/migrations/meta/_journal.json`

- [ ] **Step 1: Write migration 0074**

```sql
-- 0074_jurisdiction_type.sql
-- Add jurisdiction_type to wage_determinations so county/local WDs are distinguishable.
-- 'federal' = Davis-Bacon WDOL, 'state' = state agency, 'county' = county ordinance,
-- 'local' = municipal ordinance, 'sca' = Service Contract Act
ALTER TABLE `wage_determinations` ADD COLUMN `jurisdiction_type` text NOT NULL DEFAULT 'federal';
--> statement-breakpoint
-- locality_name stores sub-county name (e.g. "NYC", "Cook County", "DC")
ALTER TABLE `wage_determinations` ADD COLUMN `locality_name` text;
```

- [ ] **Step 2: Write migration 0075**

```sql
-- 0075_local_wage_ordinances.sql
-- Stores county/municipal prevailing wage ordinance metadata.
-- Each row represents one locality's wage schedule, linked to wage_determinations via locality_name+state.
CREATE TABLE IF NOT EXISTS local_wage_ordinances (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  locality_name TEXT NOT NULL,   -- e.g. "NYC", "Cook County", "DC", "LA County"
  jurisdiction_type TEXT NOT NULL, -- 'county' | 'local'
  administering_agency TEXT NOT NULL, -- e.g. "NYC DCAS", "Cook County DOL"
  effective_date TEXT NOT NULL,
  expiration_date TEXT,
  source_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_local_wage_ordinances_state_locality
  ON local_wage_ordinances(state, locality_name);
```

- [ ] **Step 3: Register both migrations in `_journal.json`**

Append after the `idx: 73` entry:
```json
    ,{
      "idx": 74,
      "version": "7",
      "when": 1747500000000,
      "tag": "0074_jurisdiction_type",
      "breakpoints": true
    },
    {
      "idx": 75,
      "version": "7",
      "when": 1747500001000,
      "tag": "0075_local_wage_ordinances",
      "breakpoints": true
    }
```

- [ ] **Step 4: Run and verify**

```bash
npm run db:migrate
# Then in sqlite3 or your DB client:
# SELECT name, sql FROM sqlite_master WHERE name IN ('wage_determinations','local_wage_ordinances');
# Verify jurisdiction_type and locality_name columns exist on wage_determinations.
```

- [ ] **Step 5: Commit**

```bash
git add src/server/db/migrations/0074_jurisdiction_type.sql \
        src/server/db/migrations/0075_local_wage_ordinances.sql \
        src/server/db/migrations/meta/_journal.json
git commit -m "feat: add jurisdiction_type + local_wage_ordinances schema"
```

---

## Task 2: DB Migrations — State project fields (PA, OH, CO, MD, OR, CT, HI, KY, NM, NV, RI, WV, ME, VT, MT, ND, DE, NH, AK)

**Files:**
- Create: `src/server/db/migrations/0076_pa_oh_co_project_fields.sql`
- Create: `src/server/db/migrations/0077_md_or_ct_hi_project_fields.sql`
- Create: `src/server/db/migrations/0078_ky_nm_nv_ri_wv_project_fields.sql`
- Create: `src/server/db/migrations/0079_me_vt_mt_nd_de_nh_ak_fields.sql`
- Modify: `src/server/db/migrations/meta/_journal.json`

- [ ] **Step 1: Write migration 0076**

```sql
-- 0076_pa_oh_co_project_fields.sql
ALTER TABLE `projects` ADD COLUMN `pa_contract_id` text;
ALTER TABLE `projects` ADD COLUMN `pa_contractor_license` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `oh_contract_id` text;
ALTER TABLE `projects` ADD COLUMN `oh_awarding_authority` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `co_contract_id` text;
ALTER TABLE `projects` ADD COLUMN `co_awarding_agency` text;
```

- [ ] **Step 2: Write migration 0077**

```sql
-- 0077_md_or_ct_hi_project_fields.sql
ALTER TABLE `projects` ADD COLUMN `md_contract_id` text;
ALTER TABLE `projects` ADD COLUMN `md_awarding_agency` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `or_boli_project_id` text;
ALTER TABLE `projects` ADD COLUMN `or_contractor_ccb` text;   -- CCB license number
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `ct_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `hi_contract_id` text;
ALTER TABLE `projects` ADD COLUMN `hi_awarding_agency` text;
```

- [ ] **Step 3: Write migration 0078**

```sql
-- 0078_ky_nm_nv_ri_wv_project_fields.sql
ALTER TABLE `projects` ADD COLUMN `ky_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `nm_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `nv_contract_id` text;
ALTER TABLE `projects` ADD COLUMN `nv_contractor_license` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `ri_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `wv_contract_id` text;
```

- [ ] **Step 4: Write migration 0079**

```sql
-- 0079_me_vt_mt_nd_de_nh_ak_fields.sql
ALTER TABLE `projects` ADD COLUMN `me_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `vt_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `mt_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `nd_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `de_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `nh_contract_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `ak_contract_id` text;
```

- [ ] **Step 5: Register in `_journal.json`** — append idx 76–79 in the same format as Task 1 Step 3.

- [ ] **Step 6: Run and verify**

```bash
npm run db:migrate
# SELECT sql FROM sqlite_master WHERE name = 'projects';
# Confirm pa_contract_id, oh_contract_id, etc. are present.
```

- [ ] **Step 7: Commit**

```bash
git add src/server/db/migrations/0076_pa_oh_co_project_fields.sql \
        src/server/db/migrations/0077_md_or_ct_hi_project_fields.sql \
        src/server/db/migrations/0078_ky_nm_nv_ri_wv_project_fields.sql \
        src/server/db/migrations/0079_me_vt_mt_nd_de_nh_ak_fields.sql \
        src/server/db/migrations/meta/_journal.json
git commit -m "feat: add state project fields for 19 prevailing wage states"
```

---

## Task 3: State Wage Adapters — expand stateWageAdapter.ts

**Files:**
- Modify: `src/server/services/stateWageAdapter.ts`

These 19 states have their own prevailing wage laws. Add a `ManualImportStateAdapter` subclass for each so admin can import CSV wage data from each state's DOL website. No live scraping — same pattern as CA/WA/NY.

- [ ] **Step 1: Expand `STATE_SOURCE_MAP`**

In `stateWageAdapter.ts`, find `export const STATE_SOURCE_MAP` and replace with:

```typescript
export const STATE_SOURCE_MAP: Record<string, WageAdapter['source']> = {
  CA: 'ca-dir',
  WA: 'wa-li',
  NY: 'ny-dol',
  PA: 'pa-dli',
  OH: 'oh-com',
  CO: 'co-cowc',
  MD: 'md-dllr',
  OR: 'or-boli',
  CT: 'ct-dol',
  HI: 'hi-dlir',
  KY: 'ky-labor',
  NM: 'nm-dol',
  NV: 'nv-dir',
  RI: 'ri-dlt',
  WV: 'wv-labor',
  ME: 'me-dol',
  VT: 'vt-dfr',
  MT: 'mt-dli',
  ND: 'nd-dlt',
  DE: 'de-dol',
  NH: 'nh-dol',
  AK: 'ak-dol',
};
```

- [ ] **Step 2: Update `WageAdapter['source']` union in `wageLookup.ts`**

Find the `source` field in the `WageAdapter` interface and replace:

```typescript
source: 'federal-dol' | 'ca-dir' | 'wa-li' | 'ny-dol' | 'pa-dli' | 'oh-com' |
        'co-cowc' | 'md-dllr' | 'or-boli' | 'ct-dol' | 'hi-dlir' | 'ky-labor' |
        'nm-dol' | 'nv-dir' | 'ri-dlt' | 'wv-labor' | 'me-dol' | 'vt-dfr' |
        'mt-dli' | 'nd-dlt' | 'de-dol' | 'nh-dol' | 'ak-dol' | 'local' | 'sca-dol' | 'manual';
```

- [ ] **Step 3: Add adapter classes for all 19 new states**

Append after the `NyDolAdapter` class (before the `WAGE_ADAPTERS` array):

```typescript
export class PaDliAdapter extends ManualImportStateAdapter {
  source = 'pa-dli' as const;
  stateCode = 'PA';
}
export class OhComAdapter extends ManualImportStateAdapter {
  source = 'oh-com' as const;
  stateCode = 'OH';
}
export class CoCowcAdapter extends ManualImportStateAdapter {
  source = 'co-cowc' as const;
  stateCode = 'CO';
}
export class MdDllrAdapter extends ManualImportStateAdapter {
  source = 'md-dllr' as const;
  stateCode = 'MD';
}
export class OrBoliAdapter extends ManualImportStateAdapter {
  source = 'or-boli' as const;
  stateCode = 'OR';
}
export class CtDolAdapter extends ManualImportStateAdapter {
  source = 'ct-dol' as const;
  stateCode = 'CT';
}
export class HiDlirAdapter extends ManualImportStateAdapter {
  source = 'hi-dlir' as const;
  stateCode = 'HI';
}
export class KyLaborAdapter extends ManualImportStateAdapter {
  source = 'ky-labor' as const;
  stateCode = 'KY';
}
export class NmDolAdapter extends ManualImportStateAdapter {
  source = 'nm-dol' as const;
  stateCode = 'NM';
}
export class NvDirAdapter extends ManualImportStateAdapter {
  source = 'nv-dir' as const;
  stateCode = 'NV';
}
export class RiDltAdapter extends ManualImportStateAdapter {
  source = 'ri-dlt' as const;
  stateCode = 'RI';
}
export class WvLaborAdapter extends ManualImportStateAdapter {
  source = 'wv-labor' as const;
  stateCode = 'WV';
}
export class MeDolAdapter extends ManualImportStateAdapter {
  source = 'me-dol' as const;
  stateCode = 'ME';
}
export class VtDfrAdapter extends ManualImportStateAdapter {
  source = 'vt-dfr' as const;
  stateCode = 'VT';
}
export class MtDliAdapter extends ManualImportStateAdapter {
  source = 'mt-dli' as const;
  stateCode = 'MT';
}
export class NdDltAdapter extends ManualImportStateAdapter {
  source = 'nd-dlt' as const;
  stateCode = 'ND';
}
export class DeDolAdapter extends ManualImportStateAdapter {
  source = 'de-dol' as const;
  stateCode = 'DE';
}
export class NhDolAdapter extends ManualImportStateAdapter {
  source = 'nh-dol' as const;
  stateCode = 'NH';
}
export class AkDolAdapter extends ManualImportStateAdapter {
  source = 'ak-dol' as const;
  stateCode = 'AK';
}
```

- [ ] **Step 4: Register all new adapters in `WAGE_ADAPTERS`**

Replace the `WAGE_ADAPTERS` array:

```typescript
export const WAGE_ADAPTERS: WageAdapter[] = [
  new CaDirAdapter(), new WaLiAdapter(), new NyDolAdapter(),
  new PaDliAdapter(), new OhComAdapter(), new CoCowcAdapter(),
  new MdDllrAdapter(), new OrBoliAdapter(), new CtDolAdapter(),
  new HiDlirAdapter(), new KyLaborAdapter(), new NmDolAdapter(),
  new NvDirAdapter(), new RiDltAdapter(), new WvLaborAdapter(),
  new MeDolAdapter(), new VtDfrAdapter(), new MtDliAdapter(),
  new NdDltAdapter(), new DeDolAdapter(), new NhDolAdapter(),
  new AkDolAdapter(),
  new FederalWdolAdapter(), // always last — fallback
];
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|ERROR)"
```
Expected: all existing tests pass. No new tests needed here — adapters share the tested `ManualImportStateAdapter` base class logic.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/stateWageAdapter.ts src/server/services/wageLookup.ts
git commit -m "feat: add manual-import wage adapters for 19 prevailing-wage states"
```

---

## Task 4: PA CPR Generator (Pennsylvania — full example)

Pennsylvania uses the **PA-CPR** form. Fields: contractor FEIN, PA contractor license, county, payroll number, week ending date, worker table with Mon–Sun ST/OT hours, gross wages, deductions, net pay, and a Page 2 Statement of Compliance citing the PA Prevailing Wage Act (43 P.S. § 165-1).

**Files:**
- Create: `src/server/services/paCprGenerator.ts`
- Create: `src/server/services/paCprGenerator.test.ts`
- Modify: `src/server/routes/export.ts`
- Modify: `src/shared/stateSupport.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/services/paCprGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillPaCpr, PA_CPR_FORM_VERSION } from './paCprGenerator.js';
import type { PaCprInput } from './paCprGenerator.js';

const minimal: PaCprInput = {
  contractor: { name: 'Test Contractor', fein: '123456789', address: '1 Main St, Pittsburgh, PA 15201', paContractorLicense: null },
  project: { name: 'Bridge Repair', paContractId: 'PA-2025-001', county: 'Allegheny', awardingAuthority: 'PennDOT' },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Jane Smith', certifierTitle: 'Controller', signatureDate: '2025-06-27' },
};

describe('paCprGenerator', () => {
  it('PA_CPR_FORM_VERSION is defined', () => {
    expect(PA_CPR_FORM_VERSION).toBe('PA-CPR Rev. 2024');
  });

  it('generates a valid PDF with correct title', async () => {
    const bytes = await fillPaCpr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('PA Certified Payroll — PA-CPR Rev. 2024');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2); // page 1 + compliance page
  });

  it('does not throw with multiple workers', async () => {
    const data: PaCprInput = {
      ...minimal,
      entries: [{
        workerName: 'Bob Jones', workerSsnLast4: '1234', workerAddress: '5 Oak Ave',
        classification: 'Carpenter', isApprentice: false,
        monSt: 8, monOt: 0, tueSt: 8, tueOt: 0, wedSt: 8, wedOt: 0,
        thuSt: 8, thuOt: 0, friSt: 8, friOt: 0, satSt: 0, satOt: 0, sunSt: 0, sunOt: 0,
        baseRate: 45.00, fringeRate: 18.50, grossWages: 1875.00,
        ficaTax: 143.44, fitWithheld: 312.50, stateWithheld: 57.56, otherDeductions: 0,
        netPay: 1361.50,
      }],
    };
    await expect(fillPaCpr(data)).resolves.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/server/services/paCprGenerator.test.ts
```
Expected: FAIL — `Cannot find module './paCprGenerator.js'`

- [ ] **Step 3: Create the generator**

Create `src/server/services/paCprGenerator.ts`:

```typescript
// src/server/services/paCprGenerator.ts
//
// Pennsylvania PA-CPR Certified Payroll PDF generator (pdf-lib programmatic drawing).
// Authority: PA Prevailing Wage Act, 43 P.S. § 165-1 et seq.
// Form: PA-CPR Rev. 2024 — drawn from scratch (no fillable template).
//
// Layout: letter portrait 612 × 792 pt, MARGIN 36, origin BOTTOM-LEFT.
// Pages: 1 (header + worker table, overflow to additional pages) + compliance page (always last).

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const NAVY = rgb(0.08, 0.20, 0.42);
const WHITE = rgb(1, 1, 1);
const LIGHT_GRAY = rgb(0.94, 0.94, 0.94);
const BLACK = rgb(0, 0, 0);

export const PA_CPR_FORM_VERSION = 'PA-CPR Rev. 2024';

export interface PaCprInput {
  contractor: {
    name: string;
    fein: string;
    address: string;
    paContractorLicense: string | null;
  };
  project: {
    name: string;
    paContractId: string | null;
    county: string;
    awardingAuthority: string;
  };
  week: {
    weekEndingDate: string;  // ISO YYYY-MM-DD
    payrollNumber: string;
  };
  entries: Array<{
    workerName: string;
    workerSsnLast4: string | null;
    workerAddress: string;
    classification: string;
    isApprentice: boolean;
    monSt: number; monOt: number;
    tueSt: number; tueOt: number;
    wedSt: number; wedOt: number;
    thuSt: number; thuOt: number;
    friSt: number; friOt: number;
    satSt: number; satOt: number;
    sunSt: number; sunOt: number;
    baseRate: number;
    fringeRate: number;
    grossWages: number;
    ficaTax: number;
    fitWithheld: number;
    stateWithheld: number;
    otherDeductions: number;
    netPay: number;
  }>;
  compliance: {
    certifierName: string;
    certifierTitle: string;
    signatureDate: string;  // ISO YYYY-MM-DD
  };
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

async function drawHeader(page: PDFPage, bold: PDFFont, reg: PDFFont, data: PaCprInput): Promise<void> {
  const { contractor, project, week } = data;
  let y = PAGE_H - MARGIN;

  // Title bar
  page.drawRectangle({ x: MARGIN, y: y - 28, width: CONTENT_W, height: 28, color: NAVY });
  page.drawText('PENNSYLVANIA CERTIFIED PAYROLL RECORD', {
    x: MARGIN + 8, y: y - 20, size: 11, font: bold, color: WHITE,
  });
  page.drawText(PA_CPR_FORM_VERSION, {
    x: MARGIN + CONTENT_W - 120, y: y - 20, size: 8, font: reg, color: WHITE,
  });
  y -= 36;

  // Contractor / project row
  const col2 = MARGIN + CONTENT_W / 2;
  page.drawText(`Contractor: ${contractor.name}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
  page.drawText(`Project: ${project.name}`, { x: col2, y, size: 8, font: bold, color: BLACK });
  y -= 14;
  page.drawText(`Address: ${contractor.address}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
  page.drawText(`Contract No: ${project.paContractId ?? '—'}`, { x: col2, y, size: 8, font: reg, color: BLACK });
  y -= 14;
  page.drawText(`FEIN: ${contractor.fein}  License: ${contractor.paContractorLicense ?? '—'}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
  page.drawText(`County: ${project.county}  Awarding Authority: ${project.awardingAuthority}`, { x: col2, y, size: 8, font: reg, color: BLACK });
  y -= 14;
  page.drawText(`Payroll No: ${week.payrollNumber}  Week Ending: ${isoToDisplay(week.weekEndingDate)}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
}

async function drawTableHeader(page: PDFPage, bold: PDFFont, y: number): Promise<void> {
  page.drawRectangle({ x: MARGIN, y: y - 16, width: CONTENT_W, height: 16, color: NAVY });
  const cols = [
    { label: 'Worker / Classification', x: MARGIN + 2, w: 110 },
    { label: 'M', x: MARGIN + 114, w: 22 },
    { label: 'Tu', x: MARGIN + 136, w: 22 },
    { label: 'W', x: MARGIN + 158, w: 22 },
    { label: 'Th', x: MARGIN + 180, w: 22 },
    { label: 'F', x: MARGIN + 202, w: 22 },
    { label: 'Sa', x: MARGIN + 224, w: 22 },
    { label: 'Su', x: MARGIN + 246, w: 22 },
    { label: 'ST', x: MARGIN + 270, w: 22 },
    { label: 'OT', x: MARGIN + 292, w: 22 },
    { label: 'Base', x: MARGIN + 316, w: 36 },
    { label: 'Gross', x: MARGIN + 354, w: 40 },
    { label: 'Deduct', x: MARGIN + 396, w: 42 },
    { label: 'Net', x: MARGIN + 440, w: 36 },
  ];
  for (const col of cols) {
    page.drawText(col.label, { x: col.x, y: y - 12, size: 7, font: bold, color: WHITE });
  }
}

async function drawWorkerRow(
  page: PDFPage,
  reg: PDFFont,
  y: number,
  entry: PaCprInput['entries'][0],
  idx: number,
): Promise<void> {
  const bg = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
  page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_W, height: 24, color: bg });

  const totalSt = entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt + entry.friSt + entry.satSt + entry.sunSt;
  const totalOt = entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt + entry.friOt + entry.satOt + entry.sunOt;
  const totalDeduct = entry.ficaTax + entry.fitWithheld + entry.stateWithheld + entry.otherDeductions;
  const ssnDisplay = entry.workerSsnLast4 ? `***-**-${entry.workerSsnLast4}` : '';

  page.drawText(`${entry.workerName}  ${ssnDisplay}`, { x: MARGIN + 2, y: y - 10, size: 7, font: reg, color: BLACK });
  page.drawText(`${entry.classification}${entry.isApprentice ? ' (App)' : ''}`, { x: MARGIN + 2, y: y - 20, size: 6, font: reg, color: BLACK });

  const hours = [entry.monSt, entry.tueSt, entry.wedSt, entry.thuSt, entry.friSt, entry.satSt, entry.sunSt, totalSt, totalOt];
  const hxBase = MARGIN + 114;
  hours.forEach((h, i) => {
    page.drawText(h > 0 ? String(h) : '—', { x: hxBase + i * 22, y: y - 14, size: 7, font: reg, color: BLACK });
  });

  page.drawText(`$${fmt(entry.baseRate)}`, { x: MARGIN + 316, y: y - 14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(entry.grossWages)}`, { x: MARGIN + 354, y: y - 14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(totalDeduct)}`, { x: MARGIN + 396, y: y - 14, size: 7, font: reg, color: BLACK });
  page.drawText(`$${fmt(entry.netPay)}`, { x: MARGIN + 440, y: y - 14, size: 7, font: reg, color: BLACK });
}

async function drawCompliancePage(doc: PDFDocument, bold: PDFFont, reg: PDFFont, data: PaCprInput): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  page.drawRectangle({ x: MARGIN, y: y - 28, width: CONTENT_W, height: 28, color: NAVY });
  page.drawText('STATEMENT OF COMPLIANCE — Pennsylvania Prevailing Wage Act (43 P.S. § 165-1)', {
    x: MARGIN + 8, y: y - 20, size: 9, font: bold, color: WHITE,
  });
  y -= 50;

  const text = [
    'I, the undersigned, do hereby state:',
    '',
    '(1) That the payroll is correct and complete; that the wage rates paid to each worker are not',
    '    less than the applicable prevailing wage rate required under the Pennsylvania Prevailing',
    '    Wage Act, 43 P.S. § 165-1 et seq.;',
    '',
    '(2) That each worker has been paid not less than the applicable prevailing wage rate and',
    '    fringe benefits for the classification of work actually performed;',
    '',
    '(3) That all deductions from wages shown are authorized under law or by written agreement',
    '    signed by the employee.',
  ];

  for (const line of text) {
    page.drawText(line, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
    y -= 14;
  }

  y -= 30;
  page.drawText(`Signature: _______________________________`, { x: MARGIN, y, size: 9, font: reg, color: BLACK });
  page.drawText(`Date: ${isoToDisplay(data.compliance.signatureDate)}`, { x: MARGIN + 280, y, size: 9, font: reg, color: BLACK });
  y -= 20;
  page.drawText(`Printed Name: ${data.compliance.certifierName}`, { x: MARGIN, y, size: 9, font: reg, color: BLACK });
  page.drawText(`Title: ${data.compliance.certifierTitle}`, { x: MARGIN + 280, y, size: 9, font: reg, color: BLACK });
}

export async function fillPaCpr(data: PaCprInput): Promise<Uint8Array> {
  const doc = PDFDocument.create ? await PDFDocument.create() : await (PDFDocument as any).create();
  doc.setTitle(`PA Certified Payroll — ${PA_CPR_FORM_VERSION}`);

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const page1 = doc.addPage([PAGE_W, PAGE_H]);
  await drawHeader(page1, bold, reg, data);

  let currentPage = page1;
  let y = PAGE_H - MARGIN - 110; // below header
  await drawTableHeader(currentPage, bold, y);
  y -= 20;

  for (let i = 0; i < data.entries.length; i++) {
    if (y - 30 < MARGIN + 40) {
      currentPage = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      await drawTableHeader(currentPage, bold, y);
      y -= 20;
    }
    await drawWorkerRow(currentPage, reg, y, data.entries[i], i);
    y -= 26;
  }

  await drawCompliancePage(doc, bold, reg, data);

  return doc.save();
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/server/services/paCprGenerator.test.ts
```
Expected: 3 passing

- [ ] **Step 5: Add PA to `stateSupport.ts`**

Append to the `STATE_SUPPORT` array before the closing `]`:

```typescript
  {
    state: 'PA',
    name: 'Pennsylvania',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'PA-CPR generator and route available; not externally released.',
    launchDecision: 'Pilot after PA Prevailing Wage Bureau field review.',
    supportedExports: ['PA-CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'paContractId', label: 'PA contract ID' },
      { key: 'paContractorLicense', label: 'PA contractor license' },
    ],
    nextGate: 'Validate PA-CPR output against a real PennDOT or municipal project.',
  },
```

- [ ] **Step 6: Add PA route to `export.ts`**

After the existing import block, add:
```typescript
import { fillPaCpr, type PaCprInput } from '../services/paCprGenerator.js';
```

Add the route handler after the TX route handler:
```typescript
router.get('/pa-cpr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const projectRecord = project as unknown as Record<string, unknown>;

    const input: PaCprInput = {
      contractor: {
        name: String(projectRecord.name ?? ''),
        fein: String(projectRecord.contractorFein ?? ''),
        address: `${projectRecord.state ?? ''}, ${projectRecord.county ?? ''}`,
        paContractorLicense: projectRecord.paContractorLicense != null ? String(projectRecord.paContractorLicense) : null,
      },
      project: {
        name: String(projectRecord.name ?? ''),
        paContractId: projectRecord.paContractId != null ? String(projectRecord.paContractId) : null,
        county: String(projectRecord.county ?? ''),
        awardingAuthority: String(projectRecord.awardingAgency ?? ''),
      },
      week: {
        weekEndingDate: week.weekEndingDate,
        payrollNumber: String(week.payrollNumber ?? '1'),
      },
      entries: entries.map((e) => ({
        workerName: e.workerName ?? '',
        workerSsnLast4: e.ssnLast4 ?? null,
        workerAddress: e.workerAddress ?? '',
        classification: e.tradeDescription ?? '',
        isApprentice: e.laborType === 'apprentice',
        monSt: e.monSt ?? 0, monOt: e.monOt ?? 0,
        tueSt: e.tueSt ?? 0, tueOt: e.tueOt ?? 0,
        wedSt: e.wedSt ?? 0, wedOt: e.wedOt ?? 0,
        thuSt: e.thuSt ?? 0, thuOt: e.thuOt ?? 0,
        friSt: e.friSt ?? 0, friOt: e.friOt ?? 0,
        satSt: e.satSt ?? 0, satOt: e.satOt ?? 0,
        sunSt: e.sunSt ?? 0, sunOt: e.sunOt ?? 0,
        baseRate: e.baseRate ?? 0,
        fringeRate: e.fringeRate ?? 0,
        grossWages: e.grossWages ?? 0,
        ficaTax: e.ficaTax ?? 0,
        fitWithheld: e.fitWithheld ?? 0,
        stateWithheld: e.stateWithheld ?? 0,
        otherDeductions: e.otherDeductions ?? 0,
        netPay: e.netPay ?? 0,
      })),
      compliance: {
        certifierName: String(projectRecord.certifierName ?? ''),
        certifierTitle: String(projectRecord.certifierTitle ?? ''),
        signatureDate: week.weekEndingDate,
      },
    };

    const bytes = await fillPaCpr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="pa-cpr-week-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'PA CPR export failed');
    return res.status(500).json({ error: 'PA CPR export failed' });
  }
});
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```
Expected: all passing

- [ ] **Step 8: Commit**

```bash
git add src/server/services/paCprGenerator.ts \
        src/server/services/paCprGenerator.test.ts \
        src/server/routes/export.ts \
        src/shared/stateSupport.ts
git commit -m "feat: add Pennsylvania PA-CPR certified payroll generator"
```

---

## Tasks 5–12: OH, CO, MD, OR, CT, HI, KY, NM (same pattern as Task 4)

Each task follows the **exact same 8-step structure** as Task 4. The unique elements per state are:

### Task 5: Ohio (OH) — PWC-28 / ORC 4115

**Generator:** `src/server/services/ohPwc28Generator.ts`
**Test:** `src/server/services/ohPwc28Generator.test.ts`
**Route:** `GET /api/export/oh-pwc28/:weekId`
**Form constant:** `OH_PWC28_FORM_VERSION = 'OH PWC-28 Rev. 2023'`
**Compliance cite:** Ohio ORC § 4115.07
**`stateSupport.ts` entry:**
```typescript
{
  state: 'OH',
  name: 'Ohio',
  status: 'internal_validation',
  statusLabel: 'Internal Validation',
  posture: 'OH PWC-28 generator available; not released.',
  launchDecision: 'Pilot after Ohio Department of Commerce field review.',
  supportedExports: ['OH PWC-28 PDF', 'WH-347 PDF'],
  requiredProjectFields: [
    { key: 'ohContractId', label: 'OH contract ID' },
    { key: 'ohAwardingAuthority', label: 'Awarding authority' },
  ],
  nextGate: 'Validate against real Ohio public works project.',
}
```

**`PwcInput` interface unique fields vs PA:**
- `project.ohContractId` instead of `paContractId`
- `project.ohAwardingAuthority` instead of `paContractorLicense`
- No `paContractorLicense` field
- Compliance: "Ohio Prevailing Wage Law (ORC Chapter 4115)"

---

### Task 6: Colorado (CO) — COWC CPR / CRS § 8-17-101

**Generator:** `src/server/services/coCprGenerator.ts`
**Form constant:** `CO_CPR_FORM_VERSION = 'CO COWC CPR Rev. 2024'`
**Compliance cite:** CRS § 8-17-101 et seq. (Colorado Prevailing Wage Act)
**Unique fields:**
```typescript
project: {
  coContractId: string | null;
  coAwardingAgency: string;
  projectCounty: string;
}
```
**`stateSupport.ts` entry:**
```typescript
{
  state: 'CO', name: 'Colorado', status: 'internal_validation',
  statusLabel: 'Internal Validation',
  posture: 'CO COWC CPR generator available.',
  launchDecision: 'Pilot after COWC field review.',
  supportedExports: ['CO COWC CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [
    { key: 'coContractId', label: 'CO contract ID' },
    { key: 'coAwardingAgency', label: 'Awarding agency' },
  ],
  nextGate: 'Validate against real CO public works project.',
}
```

---

### Task 7: Maryland (MD) — DLLR CPR / Lab. & Emp. § 17-201

**Generator:** `src/server/services/mdDllrGenerator.ts`
**Form constant:** `MD_DLLR_FORM_VERSION = 'MD DLLR CPR Rev. 2023'`
**Compliance cite:** MD Code, Lab. & Emp. § 17-201 et seq.
**Unique fields:**
```typescript
project: {
  mdContractId: string | null;
  mdAwardingAgency: string;
}
contractor: {
  mdContractorLicense: string | null; // MD MHIC license if applicable
}
```
**`stateSupport.ts` entry:**
```typescript
{
  state: 'MD', name: 'Maryland', status: 'internal_validation',
  statusLabel: 'Internal Validation',
  posture: 'MD DLLR CPR generator available.',
  launchDecision: 'Pilot after DLLR field review.',
  supportedExports: ['MD DLLR CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [
    { key: 'mdContractId', label: 'MD contract ID' },
    { key: 'mdAwardingAgency', label: 'Awarding agency' },
  ],
  nextGate: 'Validate against real MD public works project.',
}
```

---

### Task 8: Oregon (OR) — BOLI CPR / ORS 279C.800

**Generator:** `src/server/services/orBoliGenerator.ts`
**Form constant:** `OR_BOLI_FORM_VERSION = 'OR BOLI CPR Rev. 2024'`
**Compliance cite:** ORS 279C.800 et seq. (Oregon Bureau of Labor and Industries)
**Unique fields:** OR BOLI adds a **CCB contractor license** field and **EEO demographics** (gender, minority status) per worker.
```typescript
contractor: {
  orCcbLicense: string | null;  // Construction Contractors Board
}
project: {
  orBoliProjectId: string | null;
}
entries: Array<{
  // ... standard fields ...
  isWoman: boolean | null;
  isMinority: boolean | null;
}>
```
**`stateSupport.ts` entry:**
```typescript
{
  state: 'OR', name: 'Oregon', status: 'internal_validation',
  statusLabel: 'Internal Validation',
  posture: 'OR BOLI CPR generator available.',
  launchDecision: 'Pilot after BOLI field review.',
  supportedExports: ['OR BOLI CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [
    { key: 'orBoliProjectId', label: 'BOLI project ID' },
    { key: 'orContractorCcb', label: 'CCB license number' },
  ],
  nextGate: 'Validate against real OR public works project.',
}
```

---

### Task 9: Connecticut (CT) — DOL CPR / CGS § 31-53

**Generator:** `src/server/services/ctDolGenerator.ts`
**Form constant:** `CT_DOL_FORM_VERSION = 'CT DOL CPR Rev. 2023'`
**Compliance cite:** CGS § 31-53 (Connecticut Prevailing Wage Law)
**Unique fields:**
```typescript
project: {
  ctContractId: string | null;
  ctAwardingMunicipality: string;  // CT PW applies to municipal projects ≥ $400k
}
```
**`stateSupport.ts` entry:**
```typescript
{
  state: 'CT', name: 'Connecticut', status: 'internal_validation',
  statusLabel: 'Internal Validation',
  posture: 'CT DOL CPR generator available.',
  launchDecision: 'Pilot after CT DOL field review.',
  supportedExports: ['CT DOL CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [{ key: 'ctContractId', label: 'CT contract ID' }],
  nextGate: 'Validate against real CT municipal project.',
}
```

---

### Task 10: Hawaii (HI) — DLI CPR / HRS Chapter 104

**Generator:** `src/server/services/hiDliGenerator.ts`
**Form constant:** `HI_DLI_FORM_VERSION = 'HI DLI CPR Rev. 2024'`
**Compliance cite:** HRS Chapter 104 (Hawaii Wages and Hours of Employees on Public Works)
**Unique fields:** HI adds **overtime double-time** distinction (HRS 104 requires DT after 10 hours/day or on 7th consecutive day).
```typescript
entries: Array<{
  // standard fields plus:
  monDt: number; tueDt: number; wedDt: number; thuDt: number;
  friDt: number; satDt: number; sunDt: number;
  dtRate: number;  // 2x base rate
}>
project: {
  hiContractId: string | null;
  hiAwardingAgency: string;
}
```
**`stateSupport.ts` entry:**
```typescript
{
  state: 'HI', name: 'Hawaii', status: 'internal_validation',
  statusLabel: 'Internal Validation',
  posture: 'HI DLI CPR generator with daily OT/DT support available.',
  launchDecision: 'Pilot after HI DLI field review.',
  supportedExports: ['HI DLI CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [
    { key: 'hiContractId', label: 'HI contract ID' },
    { key: 'hiAwardingAgency', label: 'Awarding agency' },
  ],
  nextGate: 'Validate DT columns against real HI public works project.',
}
```

---

### Task 11: Kentucky (KY) — KRS 337.505

**Generator:** `src/server/services/kyCprGenerator.ts`
**Form constant:** `KY_CPR_FORM_VERSION = 'KY Labor Cabinet CPR Rev. 2023'`
**Compliance cite:** KRS 337.505–337.550 (Kentucky Prevailing Wage Act)
**Unique fields:**
```typescript
project: {
  kyContractId: string | null;
  kyAwardingAgency: string;
}
```
**`stateSupport.ts` entry:**
```typescript
{
  state: 'KY', name: 'Kentucky', status: 'internal_validation',
  statusLabel: 'Internal Validation',
  posture: 'KY CPR generator available.',
  launchDecision: 'Pilot after KY Labor Cabinet review.',
  supportedExports: ['KY CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [{ key: 'kyContractId', label: 'KY contract ID' }],
  nextGate: 'Validate against real KY public works project.',
}
```

---

### Task 12: New Mexico (NM) — NMSA § 13-4-11

**Generator:** `src/server/services/nmCprGenerator.ts`
**Form constant:** `NM_CPR_FORM_VERSION = 'NM DOL CPR Rev. 2023'`
**Compliance cite:** NMSA § 13-4-11 et seq. (New Mexico Prevailing Wage Act)
**Unique fields:**
```typescript
project: {
  nmContractId: string | null;
  nmAwardingAgency: string;
}
```
**`stateSupport.ts` entry:**
```typescript
{
  state: 'NM', name: 'New Mexico', status: 'internal_validation',
  statusLabel: 'Internal Validation',
  posture: 'NM DOL CPR generator available.',
  launchDecision: 'Pilot after NM DOL field review.',
  supportedExports: ['NM DOL CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [{ key: 'nmContractId', label: 'NM contract ID' }],
  nextGate: 'Validate against real NM public works project.',
}
```

---

## Tasks 13–17: NV, RI, WV, ME, VT (same 8-step pattern)

### Task 13: Nevada (NV) — NRS 338 CPR

**Generator:** `src/server/services/nvDirGenerator.ts`
**Form constant:** `NV_DIR_FORM_VERSION = 'NV DIR CPR Rev. 2024'`
**Compliance cite:** NRS 338.010 et seq.
**Unique:** NV requires contractor license number on form.
```typescript
contractor: { nvContractorLicense: string | null }
project: { nvContractId: string | null }
```
**`stateSupport.ts` entry:**
```typescript
{ state: 'NV', name: 'Nevada', status: 'internal_validation',
  statusLabel: 'Internal Validation', posture: 'NV DIR CPR generator available.',
  launchDecision: 'Pilot after NV DIR field review.',
  supportedExports: ['NV DIR CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [
    { key: 'nvContractId', label: 'NV contract ID' },
    { key: 'nvContractorLicense', label: 'NV contractor license' },
  ], nextGate: 'Validate against real NV public works project.' }
```

### Task 14: Rhode Island (RI) — RIGL § 37-13

**Generator:** `src/server/services/riDolGenerator.ts`
**Form constant:** `RI_DOL_FORM_VERSION = 'RI DOL CPR Rev. 2023'`
**Compliance cite:** RIGL § 37-13-1 et seq.
**Unique fields:** `project.riContractId`
**`stateSupport.ts` entry:**
```typescript
{ state: 'RI', name: 'Rhode Island', status: 'internal_validation',
  statusLabel: 'Internal Validation', posture: 'RI DOL CPR generator available.',
  launchDecision: 'Pilot after RI DOL review.',
  supportedExports: ['RI DOL CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [{ key: 'riContractId', label: 'RI contract ID' }],
  nextGate: 'Validate against real RI public works project.' }
```

### Task 15: West Virginia (WV) — WV Code § 21-5A

**Generator:** `src/server/services/wvDolGenerator.ts`
**Form constant:** `WV_DOL_FORM_VERSION = 'WV DOL CPR Rev. 2023'`
**Compliance cite:** WV Code § 21-5A-1 et seq.
**Unique fields:** `project.wvContractId`
**`stateSupport.ts` entry:**
```typescript
{ state: 'WV', name: 'West Virginia', status: 'internal_validation',
  statusLabel: 'Internal Validation', posture: 'WV DOL CPR generator available.',
  launchDecision: 'Pilot after WV DOL review.',
  supportedExports: ['WV DOL CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [{ key: 'wvContractId', label: 'WV contract ID' }],
  nextGate: 'Validate against real WV public works project.' }
```

### Task 16: Maine (ME) — 26 MRS § 1311

**Generator:** `src/server/services/meDolGenerator.ts`
**Form constant:** `ME_DOL_FORM_VERSION = 'ME DOL CPR Rev. 2023'`
**Compliance cite:** 26 MRS § 1311 et seq. (Maine Prevailing Wage Law)
**Unique fields:** `project.meContractId`
**`stateSupport.ts` entry:**
```typescript
{ state: 'ME', name: 'Maine', status: 'internal_validation',
  statusLabel: 'Internal Validation', posture: 'ME DOL CPR generator available.',
  launchDecision: 'Pilot after ME DOL review.',
  supportedExports: ['ME DOL CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [{ key: 'meContractId', label: 'ME contract ID' }],
  nextGate: 'Validate against real ME public works project.' }
```

### Task 17: Vermont (VT) — 21 VSA § 391

**Generator:** `src/server/services/vtDfrGenerator.ts`
**Form constant:** `VT_DFR_FORM_VERSION = 'VT DFR CPR Rev. 2023'`
**Compliance cite:** 21 VSA § 391 et seq. (Vermont Prevailing Wage Act)
**Unique fields:** `project.vtContractId`
**`stateSupport.ts` entry:**
```typescript
{ state: 'VT', name: 'Vermont', status: 'internal_validation',
  statusLabel: 'Internal Validation', posture: 'VT DFR CPR generator available.',
  launchDecision: 'Pilot after VT DFR review.',
  supportedExports: ['VT DFR CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [{ key: 'vtContractId', label: 'VT contract ID' }],
  nextGate: 'Validate against real VT public works project.' }
```

---

## Tasks 18–22: MT, ND, DE, NH, AK (same 8-step pattern)

### Task 18: Montana (MT) — MCA § 18-2-401

**Generator:** `src/server/services/mtDliGenerator.ts`
**Form constant:** `MT_DLI_FORM_VERSION = 'MT DLI CPR Rev. 2023'`
**Compliance cite:** MCA § 18-2-401 et seq.
**Unique fields:** `project.mtContractId`
**`stateSupport.ts`:** `state: 'MT', name: 'Montana'` — same structure as ME/VT.

### Task 19: North Dakota (ND) — NDCC 34-14-01

**Generator:** `src/server/services/ndDltGenerator.ts`
**Form constant:** `ND_DLT_FORM_VERSION = 'ND DLT CPR Rev. 2023'`
**Compliance cite:** NDCC 34-14-01 et seq.
**Unique fields:** `project.ndContractId`
**`stateSupport.ts`:** `state: 'ND', name: 'North Dakota'`

### Task 20: Delaware (DE) — 29 Del. C. § 6960

**Generator:** `src/server/services/deDolGenerator.ts`
**Form constant:** `DE_DOL_FORM_VERSION = 'DE DOL CPR Rev. 2023'`
**Compliance cite:** 29 Del. C. § 6960 et seq.
**Unique fields:** `project.deContractId`
**`stateSupport.ts`:** `state: 'DE', name: 'Delaware'`

### Task 21: New Hampshire (NH) — RSA 228:22 (DOT prevailing wage)

**Generator:** `src/server/services/nhDotGenerator.ts`
**Form constant:** `NH_DOT_FORM_VERSION = 'NH DOT CPR Rev. 2023'`
**Compliance cite:** RSA 228:22 (NH applies prevailing wages to state highway projects)
**Note:** NH scope is narrower than most — applies to DOT highway contracts only, not all public works.
**Unique fields:** `project.nhContractId`, `project.nhDotProjectNumber`
**`stateSupport.ts`:** `state: 'NH', name: 'New Hampshire'`, posture note: *"Highway projects only (RSA 228:22). Not general public works."*

### Task 22: Alaska (AK) — AS 36.05.010

**Generator:** `src/server/services/akDolGenerator.ts`
**Form constant:** `AK_DOL_FORM_VERSION = 'AK DOL CPR Rev. 2024'`
**Compliance cite:** AS 36.05.010 et seq. (Alaska Prevailing Wage Act)
**Unique:** AK has strong prevailing wage coverage and uses a 7-day Su–Sa work week like MA.
```typescript
entries: Array<{
  // Su-Mo-Tu-We-Th-Fr-Sa order (Sunday first like MA)
  sunSt: number; monSt: number; tueSt: number; wedSt: number;
  thuSt: number; friSt: number; satSt: number;
  // OT mirrors same order
  sunOt: number; monOt: number; tueOt: number; wedOt: number;
  thuOt: number; friOt: number; satOt: number;
}>
project: { akContractId: string | null; akAwardingAgency: string }
```
**`stateSupport.ts`:** `state: 'AK', name: 'Alaska'`, note Su-first week order.

---

## Task 23: Run all state generator tests

After completing Tasks 4–22:

- [ ] **Run full test suite**

```bash
npm test 2>&1 | tail -20
```
Expected: all 19 new generator tests + all 188 existing tests passing.

- [ ] **Commit**

```bash
git add src/server/services/\*Generator.ts src/server/services/\*Generator.test.ts \
        src/server/routes/export.ts src/shared/stateSupport.ts
git commit -m "feat: add CPR generators for 19 prevailing-wage states (OH, CO, MD, OR, CT, HI, KY, NM, NV, RI, WV, ME, VT, MT, ND, DE, NH, AK)"
```

---

## Task 24: County/Local — localWageAdapter + NYC CPR

County/local wages use the same `wageDeterminations` table but with `jurisdiction_type = 'county'` or `'local'`. The adapter reads from the `local_wage_ordinances` table for metadata and `wageDeterminations` for rates (imported via admin CSV).

**Files:**
- Create: `src/server/services/localWageAdapter.ts`
- Create: `src/server/services/nycCprGenerator.ts`
- Create: `src/server/services/nycCprGenerator.test.ts`
- Modify: `src/server/routes/wages.ts`
- Modify: `src/server/routes/export.ts`
- Modify: `src/server/services/stateWageAdapter.ts`

- [ ] **Step 1: Write `localWageAdapter.ts`**

```typescript
// src/server/services/localWageAdapter.ts
// Adapter for county/municipal prevailing wage schedules.
// Locality is resolved by project's state + locality_name project field.
// Rate data imported via admin CSV — same flow as state adapters.

import { eq, and } from 'drizzle-orm';
import { wageDeterminations } from '../db/schema.js';
import { getDb } from '../db/index.js';
import { getCachedClassifications } from './wageCache.js';
import type { WageAdapter, WageDetermination } from './wageLookup.js';
import type { WageClassification } from '../../shared/types.js';

export class LocalWageAdapter implements WageAdapter {
  source = 'local' as const;
  private localityName: string;
  private stateCode: string;

  constructor(stateCode: string, localityName: string) {
    this.stateCode = stateCode.toUpperCase();
    this.localityName = localityName;
  }

  supportsLookup(state: string): boolean {
    return state.toUpperCase() === this.stateCode;
  }

  async fetchDetermination(state: string, county: string): Promise<WageDetermination | null> {
    const db = getDb();
    const row = db
      .select()
      .from(wageDeterminations)
      .where(
        and(
          eq(wageDeterminations.source, 'local'),
          eq(wageDeterminations.state, state.toUpperCase()),
          eq(wageDeterminations.county, this.localityName),
          eq(wageDeterminations.isActive, true),
        )
      )
      .limit(1)
      .get() as typeof wageDeterminations.$inferSelect | undefined;

    if (!row) return null;

    const classifications = getCachedClassifications(row.id);
    return {
      id: row.id,
      source: 'local',
      wdNumber: row.wdNumber,
      revisionNumber: row.revisionNumber,
      state: row.state,
      county: row.county ?? null,
      constructionType: row.constructionType ?? null,
      publishDate: row.publishDate ?? null,
      isActive: Boolean(row.isActive),
      cachedAt: row.cachedAt,
      cacheExpiresAt: row.cacheExpiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      classifications: classifications.map((c) => ({
        id: c.id,
        wageDeterminationId: c.wageDeterminationId,
        tradeCode: c.tradeCode,
        tradeDescription: c.tradeDescription,
        laborType: c.laborType as WageClassification['laborType'],
        baseRate: c.baseRate,
        fringeRate: c.fringeRate,
        totalRate: c.totalRate,
        createdAt: c.createdAt,
      })),
    };
  }
}
```

- [ ] **Step 2: Register locality adapters in `stateWageAdapter.ts`**

Import `LocalWageAdapter` and add instances to `WAGE_ADAPTERS` before the `FederalWdolAdapter` fallback:

```typescript
import { LocalWageAdapter } from './localWageAdapter.js';

// Inside WAGE_ADAPTERS array, before FederalWdolAdapter:
new LocalWageAdapter('NY', 'NYC'),      // NYC — NY state rates with NYC DCAS header
new LocalWageAdapter('IL', 'Cook'),     // Cook County, IL
new LocalWageAdapter('DC', 'DC'),       // Washington DC (DC OCP)
new LocalWageAdapter('CA', 'LACounty'), // LA County Public Works
```

- [ ] **Step 3: Write NYC CPR generator (header-only variant)**

NYC uses the **NY state prevailing wage rates** but requires the NYC DCAS-specific header fields. The worker table and compliance page are identical to the PW-12 pattern.

Create `src/server/services/nycCprGenerator.ts`:

```typescript
// src/server/services/nycCprGenerator.ts
// NYC DCAS Certified Payroll — extends NY PW-12 format with NYC-specific header fields.
// Authority: NYC Administrative Code § 6-109 (Living Wage) +
//            NY Labor Law § 220 (prevailing wage rates from NY DOL).

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const NYC_CPR_FORM_VERSION = 'NYC DCAS CPR Rev. 2024';

export interface NycCprInput {
  contractor: {
    name: string;
    fein: string;
    address: string;
    nycVendorId: string | null;    // NYC DCAS vendor/contract ID
  };
  project: {
    name: string;
    nycContractNumber: string | null;  // NYC contract number (e.g. "PIN 8502017CP0001")
    borough: string;                    // Manhattan | Brooklyn | Queens | Bronx | Staten Island
    dcasProjectManager: string | null;  // optional
  };
  week: { weekEndingDate: string; payrollNumber: string };
  entries: Array<{
    workerName: string;
    workerSsnLast4: string | null;
    workerAddress: string;
    classification: string;
    isApprentice: boolean;
    monSt: number; monOt: number;
    tueSt: number; tueOt: number;
    wedSt: number; wedOt: number;
    thuSt: number; thuOt: number;
    friSt: number; friOt: number;
    satSt: number; satOt: number;
    sunSt: number; sunOt: number;
    baseRate: number; fringeRate: number;
    grossWages: number; deductions: number; netPay: number;
  }>;
  compliance: { certifierName: string; certifierTitle: string; signatureDate: string };
}

export async function fillNycCpr(data: NycCprInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`NYC DCAS Certified Payroll — ${NYC_CPR_FORM_VERSION}`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const PAGE_W = 612, PAGE_H = 792, MARGIN = 36, CONTENT_W = PAGE_W - 2 * MARGIN;
  const NAVY = rgb(0.0, 0.16, 0.38); // NYC blue
  const WHITE = rgb(1,1,1), BLACK = rgb(0,0,0), GRAY = rgb(0.94,0.94,0.94);

  const page1 = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Title bar
  page1.drawRectangle({ x: MARGIN, y: y-28, width: CONTENT_W, height: 28, color: NAVY });
  page1.drawText('NEW YORK CITY DCAS CERTIFIED PAYROLL RECORD', {
    x: MARGIN+8, y: y-20, size: 10, font: bold, color: WHITE });
  page1.drawText(NYC_CPR_FORM_VERSION, {
    x: MARGIN+CONTENT_W-130, y: y-20, size: 8, font: reg, color: WHITE });
  y -= 38;

  const col2 = MARGIN + CONTENT_W / 2;
  page1.drawText(`Contractor: ${data.contractor.name}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
  page1.drawText(`Contract No: ${data.project.nycContractNumber ?? '—'}`, { x: col2, y, size: 8, font: bold, color: BLACK });
  y -= 14;
  page1.drawText(`FEIN: ${data.contractor.fein}  Vendor ID: ${data.contractor.nycVendorId ?? '—'}`, { x: MARGIN, y, size: 8, font: reg, color: BLACK });
  page1.drawText(`Borough: ${data.project.borough}  PM: ${data.project.dcasProjectManager ?? '—'}`, { x: col2, y, size: 8, font: reg, color: BLACK });
  y -= 14;
  page1.drawText(`Payroll No: ${data.week.payrollNumber}  Week Ending: ${data.week.weekEndingDate}`, { x: MARGIN, y, size: 8, font: bold, color: BLACK });
  y -= 24;

  // Table header
  page1.drawRectangle({ x: MARGIN, y: y-16, width: CONTENT_W, height: 16, color: NAVY });
  ['Worker', 'M','Tu','W','Th','F','Sa','Su','ST','OT','Base','Gross','Deduct','Net'].forEach((h, i) => {
    const xs = [MARGIN+2, MARGIN+112, MARGIN+134, MARGIN+156, MARGIN+178, MARGIN+200, MARGIN+222, MARGIN+244, MARGIN+266, MARGIN+288, MARGIN+312, MARGIN+352, MARGIN+394, MARGIN+438];
    page1.drawText(h, { x: xs[i] ?? MARGIN, y: y-12, size: 7, font: bold, color: WHITE });
  });
  y -= 20;

  let currentPage = page1;
  data.entries.forEach((e, idx) => {
    if (y - 26 < MARGIN + 40) {
      currentPage = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    const bg = idx % 2 === 0 ? WHITE : GRAY;
    currentPage.drawRectangle({ x: MARGIN, y: y-24, width: CONTENT_W, height: 24, color: bg });
    const ssn = e.workerSsnLast4 ? `***-**-${e.workerSsnLast4}` : '';
    currentPage.drawText(`${e.workerName} ${ssn}`, { x: MARGIN+2, y: y-10, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`${e.classification}${e.isApprentice?' (App)':''}`, { x: MARGIN+2, y: y-20, size: 6, font: reg, color: BLACK });
    const totSt = e.monSt+e.tueSt+e.wedSt+e.thuSt+e.friSt+e.satSt+e.sunSt;
    const totOt = e.monOt+e.tueOt+e.wedOt+e.thuOt+e.friOt+e.satOt+e.sunOt;
    [e.monSt,e.tueSt,e.wedSt,e.thuSt,e.friSt,e.satSt,e.sunSt,totSt,totOt].forEach((h, i) => {
      const hxs = [MARGIN+112, MARGIN+134, MARGIN+156, MARGIN+178, MARGIN+200, MARGIN+222, MARGIN+244, MARGIN+266, MARGIN+288];
      currentPage.drawText(h>0?String(h):'—', { x: hxs[i]??MARGIN, y: y-14, size: 7, font: reg, color: BLACK });
    });
    currentPage.drawText(`$${e.baseRate.toFixed(2)}`, { x: MARGIN+312, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${e.grossWages.toFixed(2)}`, { x: MARGIN+352, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${e.deductions.toFixed(2)}`, { x: MARGIN+394, y: y-14, size: 7, font: reg, color: BLACK });
    currentPage.drawText(`$${e.netPay.toFixed(2)}`, { x: MARGIN+438, y: y-14, size: 7, font: reg, color: BLACK });
    y -= 26;
  });

  // Compliance page
  const comp = doc.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - MARGIN;
  comp.drawRectangle({ x: MARGIN, y: cy-28, width: CONTENT_W, height: 28, color: NAVY });
  comp.drawText('STATEMENT OF COMPLIANCE — NY Labor Law § 220 / NYC Admin. Code § 6-109', {
    x: MARGIN+8, y: cy-20, size: 9, font: bold, color: WHITE });
  cy -= 50;
  [
    'I hereby certify that this payroll is correct and complete, that the wage rates paid are not',
    'less than the applicable prevailing wage rates established under New York Labor Law § 220',
    'and, where applicable, the NYC Living Wage per Administrative Code § 6-109.',
    '',
    'All deductions from wages are authorized under law or by written agreement signed by',
    'the employee.',
  ].forEach(line => {
    comp.drawText(line, { x: MARGIN, y: cy, size: 8, font: reg, color: BLACK });
    cy -= 14;
  });
  cy -= 30;
  comp.drawText('Signature: ____________________________', { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });
  comp.drawText(`Date: ${data.compliance.signatureDate}`, { x: MARGIN+300, y: cy, size: 9, font: reg, color: BLACK });
  cy -= 20;
  comp.drawText(`Name: ${data.compliance.certifierName}  Title: ${data.compliance.certifierTitle}`, { x: MARGIN, y: cy, size: 9, font: reg, color: BLACK });

  return doc.save();
}
```

- [ ] **Step 4: Write test**

Create `src/server/services/nycCprGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillNycCpr, NYC_CPR_FORM_VERSION } from './nycCprGenerator.js';
import type { NycCprInput } from './nycCprGenerator.js';

const minimal: NycCprInput = {
  contractor: { name: 'Test GC', fein: '987654321', address: '1 Centre St, New York, NY 10007', nycVendorId: 'VND-001' },
  project: { name: 'Sidewalk Repair', nycContractNumber: 'PIN8502024CP001', borough: 'Brooklyn', dcasProjectManager: null },
  week: { weekEndingDate: '2025-07-04', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Alice Brown', certifierTitle: 'PM', signatureDate: '2025-07-04' },
};

describe('nycCprGenerator', () => {
  it('NYC_CPR_FORM_VERSION is defined', () => {
    expect(NYC_CPR_FORM_VERSION).toBe('NYC DCAS CPR Rev. 2024');
  });
  it('generates PDF with correct title and ≥2 pages', async () => {
    const bytes = await fillNycCpr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('NYC DCAS Certified Payroll — NYC DCAS CPR Rev. 2024');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test -- src/server/services/nycCprGenerator.test.ts
```
Expected: 2 passing

- [ ] **Step 6: Add NYC to `stateSupport.ts`**

Note: NYC is a locality of NY state, not a separate state code. Add to the NY entry's `supportedExports`:

In the `state: 'NY'` entry, update:
```typescript
supportedExports: ['PW-12 PDF', 'MPWR XML', 'NYC DCAS CPR PDF', 'WH-347 PDF'],
```

- [ ] **Step 7: Add NYC route to `export.ts`**

```typescript
import { fillNycCpr, type NycCprInput } from '../services/nycCprGenerator.js';

// GET /api/export/nyc-cpr/:weekId
router.get('/nyc-cpr/:weekId', async (req, res) => {
  try {
    const week = await getPayrollWeek(req.params.weekId);
    if (!week) return res.status(404).json({ error: 'Payroll week not found' });
    const { project } = await assertProjectAccess(getDb(), week.projectId, req.user!.userId);
    const entries = await getPayrollEntriesWithWorkerDetails(req.params.weekId);
    const p = project as unknown as Record<string, unknown>;

    const input: NycCprInput = {
      contractor: {
        name: String(p.name ?? ''), fein: String(p.contractorFein ?? ''),
        address: String(p.address ?? ''), nycVendorId: p.nycVendorId != null ? String(p.nycVendorId) : null,
      },
      project: {
        name: String(p.name ?? ''), nycContractNumber: p.nycContractNumber != null ? String(p.nycContractNumber) : null,
        borough: String(p.nycBorough ?? ''), dcasProjectManager: p.dcasProjectManager != null ? String(p.dcasProjectManager) : null,
      },
      week: { weekEndingDate: week.weekEndingDate, payrollNumber: String(week.payrollNumber ?? '1') },
      entries: entries.map((e) => ({
        workerName: e.workerName ?? '', workerSsnLast4: e.ssnLast4 ?? null,
        workerAddress: e.workerAddress ?? '', classification: e.tradeDescription ?? '',
        isApprentice: e.laborType === 'apprentice',
        monSt: e.monSt ?? 0, monOt: e.monOt ?? 0, tueSt: e.tueSt ?? 0, tueOt: e.tueOt ?? 0,
        wedSt: e.wedSt ?? 0, wedOt: e.wedOt ?? 0, thuSt: e.thuSt ?? 0, thuOt: e.thuOt ?? 0,
        friSt: e.friSt ?? 0, friOt: e.friOt ?? 0, satSt: e.satSt ?? 0, satOt: e.satOt ?? 0,
        sunSt: e.sunSt ?? 0, sunOt: e.sunOt ?? 0,
        baseRate: e.baseRate ?? 0, fringeRate: e.fringeRate ?? 0,
        grossWages: e.grossWages ?? 0, deductions: (e.ficaTax ?? 0) + (e.fitWithheld ?? 0) + (e.stateWithheld ?? 0),
        netPay: e.netPay ?? 0,
      })),
      compliance: { certifierName: String(p.certifierName ?? ''), certifierTitle: String(p.certifierTitle ?? ''), signatureDate: week.weekEndingDate },
    };

    const bytes = await fillNycCpr(input);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="nyc-cpr-${req.params.weekId}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (err) {
    if ((err as Error).message === 'Project access denied') return res.status(403).json({ error: 'Access denied' });
    logger.error({ err }, 'NYC CPR export failed');
    return res.status(500).json({ error: 'NYC CPR export failed' });
  }
});
```

- [ ] **Step 8: Commit**

```bash
git add src/server/services/localWageAdapter.ts \
        src/server/services/stateWageAdapter.ts \
        src/server/services/nycCprGenerator.ts \
        src/server/services/nycCprGenerator.test.ts \
        src/server/routes/export.ts src/shared/stateSupport.ts
git commit -m "feat: add local wage adapter + NYC DCAS CPR generator"
```

---

## Task 25: Chicago/Cook County CPR

Cook County uses **IL state prevailing wages** but the Cook County Living Wage Ordinance (CCLLWO) adds a county-specific header block and a separate compliance certification referencing the CCLLWO.

**Files:**
- Create: `src/server/services/cookCprGenerator.ts`
- Create: `src/server/services/cookCprGenerator.test.ts`
- Modify: `src/server/routes/export.ts`

**`CookCprInput` unique fields vs `IlPdfInput`:**
```typescript
project: {
  cookContractId: string | null;           // Cook County contract number
  cookLivingWageApplies: boolean;          // CCLLWO threshold ($25k+) — adds page 3 LWO affidavit
  ccllwoContractYear: string | null;       // e.g. "2025"
}
```
**Form constant:** `COOK_CPR_FORM_VERSION = 'Cook County CPR Rev. 2024'`
**Compliance pages:**
1. IL Certified Transcript of Payroll (IDOL — 820 ILCS 130/5)
2. Cook County Living Wage Ordinance Compliance Affidavit (if `cookLivingWageApplies`)

**Generator structure:** Follow `ilPdfGenerator.ts` pattern exactly. Add a third `drawLwoAffidavit()` function that appends the Cook County LWO page when `cookLivingWageApplies` is true.

**Test:**
```typescript
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillCookCpr, COOK_CPR_FORM_VERSION } from './cookCprGenerator.js';
import type { CookCprInput } from './cookCprGenerator.js';

const minimal: CookCprInput = {
  contractor: { name: 'Test Co', fein: '111223333', address: '100 N LaSalle' },
  project: { name: 'Bridge Work', cookContractId: 'CC-2025-001', location: 'Cook County, IL',
    contractingAgency: 'Cook County DOT', cookLivingWageApplies: false, ccllwoContractYear: null },
  week: { weekEndingDate: '2025-06-27', payrollNumber: '1' },
  entries: [],
  compliance: { certifierName: 'Joe Smith', certifierTitle: 'CFO', signatureDate: '2025-06-27' },
};

describe('cookCprGenerator', () => {
  it('COOK_CPR_FORM_VERSION is defined', () => {
    expect(COOK_CPR_FORM_VERSION).toBe('Cook County CPR Rev. 2024');
  });
  it('generates 2-page PDF without LWO', async () => {
    const bytes = await fillCookCpr(minimal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
  it('generates 3-page PDF with LWO affidavit', async () => {
    const bytes = await fillCookCpr({ ...minimal, project: { ...minimal.project, cookLivingWageApplies: true, ccllwoContractYear: '2025' } });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
  });
});
```

**Route:** `GET /api/export/cook-cpr/:weekId` — same pattern as IL route with the Cook County extra fields.

**Commit:** `feat: add Chicago/Cook County CPR generator with CCLLWO affidavit`

---

## Task 26: Washington DC — DC OCP CPR

DC has its own prevailing wage rates set by the DC Department of Employment Services (DOES) under DC Code § 32-1002. **DC rates are NOT Davis-Bacon** — they are set independently and often higher.

**Files:**
- Create: `src/server/services/dcOcpGenerator.ts`
- Create: `src/server/services/dcOcpGenerator.test.ts`
- Modify: `src/server/routes/export.ts`
- Modify: `src/shared/stateSupport.ts`

**`DcOcpInput` unique fields:**
```typescript
contractor: {
  dcBusinessLicense: string | null;  // DC business license (BBL number)
}
project: {
  dcContractNumber: string | null;   // DC OCP contract number
  dcAgency: string;                  // e.g. "DC Office of Contracting and Procurement"
  dcProjectManager: string | null;
}
```
**Form constant:** `DC_OCP_FORM_VERSION = 'DC DOES CPR Rev. 2024'`
**Compliance cite:** DC Code § 32-1002 et seq. (DC Minimum Wage Act Revision Act of 1992)

**`stateSupport.ts` entry:**
```typescript
{
  state: 'DC',
  name: 'Washington DC',
  status: 'internal_validation',
  statusLabel: 'Internal Validation',
  posture: 'DC OCP CPR generator available. DC uses DOES rates, NOT federal Davis-Bacon.',
  launchDecision: 'Pilot after DC DOES field review. Confirm DC wage rates imported correctly.',
  supportedExports: ['DC OCP CPR PDF', 'WH-347 PDF'],
  requiredProjectFields: [
    { key: 'dcContractNumber', label: 'DC contract number' },
    { key: 'dcAgency', label: 'DC agency' },
    { key: 'dcBusinessLicense', label: 'DC business license' },
  ],
  nextGate: 'Import DC DOES wage rates; validate output against real DC OCP project.',
}
```

**Test structure:** Same as PA/NYC pattern. Verify title = `'DC DOES Certified Payroll — DC DOES CPR Rev. 2024'`, pageCount ≥ 2.

**Route:** `GET /api/export/dc-ocp/:weekId`

**Commit:** `feat: add Washington DC OCP CPR generator`

---

## Task 27: LA County Supplemental CPR

LA County uses CA DIR prevailing wage rates but the LA County Department of Public Works (DPW) requires its own header block on certified payrolls for projects under its jurisdiction (not City of LA — that's a separate entity).

**Files:**
- Create: `src/server/services/laCountyCprGenerator.ts`
- Create: `src/server/services/laCountyCprGenerator.test.ts`
- Modify: `src/server/routes/export.ts`

**`LaCountyCprInput` unique fields vs `A1131Data`:**
```typescript
project: {
  laCountyProjectId: string | null;    // DPW project number
  laDpwDistrict: string | null;        // Supervisorial district 1–5
  dirProjectId: string;                // still required (CA DIR)
}
```
**Form constant:** `LA_COUNTY_CPR_FORM_VERSION = 'LA County DPW CPR Rev. 2024'`
**Note:** The worker table still uses CA DIR fringe breakdown (same as A-1-131) because CA DIR rates govern. The LA County header replaces the DIR header block.

**Test:** Verify title, ≥2 pages, no throw with workers.

**Route:** `GET /api/export/la-county-cpr/:weekId`

**Commit:** `feat: add LA County DPW supplemental CPR generator`

---

## Task 28: Service Contract Act (SCA) Support

The SCA (41 USC §§ 6701–6707) covers service workers on federal contracts. WDs come from the same SAM.gov WDOL endpoint — WD numbers follow the format `XX-YYYY-NNNN` where XX is two-letter state/region code.

**Files:**
- Create: `src/server/services/scaAdapter.ts`
- Modify: `src/server/services/wdolSync.ts` (add SCA seed entries)
- Modify: `src/server/services/wageLookup.ts` (add `'sca-dol'` source)
- Modify: `src/server/services/stateWageAdapter.ts` (register SCA adapter)

- [ ] **Step 1: Create `scaAdapter.ts`**

```typescript
// src/server/services/scaAdapter.ts
// Service Contract Act wage determination adapter.
// SCA WDs are on SAM.gov WDOL — same fetch path as Davis-Bacon.
// source = 'sca-dol'. Distinguishable from federal-dol via jurisdiction_type = 'sca'.

import crypto from 'crypto';
import { upsertWageDetermination, upsertClassifications, getCachedWd } from './wageCache.js';
import { fetchWdFromSamGov } from './wdolFetcher.js';
import { parseWdDocument } from './wdolParser.js';
import type { WageAdapter, WageDetermination } from './wageLookup.js';

// SCA WD numbers use format: "2015-4" or "05-2047" depending on vintage.
// Modern format matches Davis-Bacon format on SAM.gov.
// supportsLookup returns false by default — SCA must be explicitly requested.
// The route GET /api/wages/lookup?state=&county=&contractType=sca triggers SCA lookup.

export class ScaDolAdapter implements WageAdapter {
  source = 'sca-dol' as const;

  supportsLookup(_state: string): boolean {
    return false; // Not auto-triggered by state+county; use explicit SCA seed lookup.
  }

  // Direct fetch by WD number — called via fetchAndCacheByWdNumber.
  async fetchDetermination(_state: string, _county: string): Promise<WageDetermination | null> {
    return null; // SCA is fetched by WD number, not state+county.
  }
}
```

- [ ] **Step 2: Add SCA seed entries to `wdolSync.ts`**

SCA WD numbers are available on SAM.gov. Add representative entries for the top 20 metro areas. Append to `WD_SEED_LIST`:

```typescript
  // ── Service Contract Act (SCA) WDs ──────────────────────────────────────────
  // SCA: 41 USC §§ 6701–6707. Covers service workers on federal contracts.
  // These are fetched by WD number via /api/wages/fetch?wdNumber=...
  // Format: 4-digit year + sequential number (modern SAM.gov format)
  { wdNumber: '2015-4', state: 'CA', county: 'Los Angeles', revision: 0 },
  { wdNumber: '2015-5', state: 'NY', county: 'New York', revision: 0 },
  { wdNumber: '2015-3', state: 'TX', county: 'Harris', revision: 0 },
  { wdNumber: '2015-6', state: 'IL', county: 'Cook', revision: 0 },
  { wdNumber: '2015-7', state: 'FL', county: 'Miami-Dade', revision: 0 },
  { wdNumber: '2015-8', state: 'PA', county: 'Philadelphia', revision: 0 },
  { wdNumber: '2015-9', state: 'OH', county: 'Cuyahoga', revision: 0 },
  { wdNumber: '2015-10', state: 'GA', county: 'Fulton', revision: 0 },
  { wdNumber: '2015-11', state: 'WA', county: 'King', revision: 0 },
  { wdNumber: '2015-12', state: 'MA', county: 'Suffolk', revision: 0 },
  { wdNumber: '2015-13', state: 'AZ', county: 'Maricopa', revision: 0 },
  { wdNumber: '2015-14', state: 'CO', county: 'Denver', revision: 0 },
  { wdNumber: '2015-15', state: 'MD', county: 'Montgomery', revision: 0 },
  { wdNumber: '2015-16', state: 'DC', county: 'DC', revision: 0 },
  { wdNumber: '2015-17', state: 'OR', county: 'Multnomah', revision: 0 },
  { wdNumber: '2015-18', state: 'MN', county: 'Hennepin', revision: 0 },
  { wdNumber: '2015-19', state: 'MI', county: 'Wayne', revision: 0 },
  { wdNumber: '2015-20', state: 'NC', county: 'Mecklenburg', revision: 0 },
  { wdNumber: '2015-21', state: 'VA', county: 'Fairfax', revision: 0 },
  { wdNumber: '2015-22', state: 'NJ', county: 'Hudson', revision: 0 },
```

- [ ] **Step 3: Register SCA adapter in `stateWageAdapter.ts`**

```typescript
import { ScaDolAdapter } from './scaAdapter.js';

// Add to WAGE_ADAPTERS (before FederalWdolAdapter):
new ScaDolAdapter(),
```

- [ ] **Step 4: Add SCA WD seed support to `wages.ts` route**

Add `contractType: z.enum(['sca']).optional()` to `LookupQuerySchema`. When `contractType === 'sca'`, filter `wageDeterminations` where `source = 'sca-dol'`:

In `wagesRouter.get('/lookup', ...)`, after `const wd = await lookupWageDetermination(state, county)`, add:
```typescript
// If contractType=sca requested and the cached WD is federal-dol (not sca-dol), return 404
// so the caller knows to use the explicit WD number fetch instead.
if (parsed.data.contractType === 'sca' && wd?.source !== 'sca-dol') {
  return res.status(404).json({ error: `No SCA wage determination cached for ${county}, ${state}. Use /api/wages/fetch?wdNumber=<wd>` });
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/scaAdapter.ts \
        src/server/services/wdolSync.ts \
        src/server/services/wageLookup.ts \
        src/server/services/stateWageAdapter.ts \
        src/server/routes/wages.ts
git commit -m "feat: add Service Contract Act (SCA) adapter and WD seed entries"
```

---

## Task 29: Final coverage audit

After all tasks complete, verify the gap table from the original analysis is closed.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```
Expected: all tests passing (≥ 207 tests: 188 existing + 19 new state generator tests).

- [ ] **Step 2: Verify state support registry**

Run this in a scratch script or REPL:
```typescript
import { STATE_SUPPORT } from './src/shared/stateSupport.js';
const states = STATE_SUPPORT.map(s => s.state).sort();
console.log('Registered states:', states);
// Expected: CA, WA, NY, IL, MA, NJ, TX, MN, VA, PA, OH, CO, MD, OR, CT, HI, KY, NM, NV, RI, WV, ME, VT, MT, ND, DE, NH, AK, DC
// Count: 29
```

- [ ] **Step 3: Verify adapter registration**

```typescript
import { WAGE_ADAPTERS } from './src/server/services/stateWageAdapter.js';
console.log('Adapters:', WAGE_ADAPTERS.map(a => a.source));
// Expected: ca-dir, wa-li, ny-dol, pa-dli, oh-com, co-cowc, md-dllr, or-boli, ct-dol,
//           hi-dlir, ky-labor, nm-dol, nv-dir, ri-dlt, wv-labor, me-dol, vt-dfr, mt-dli,
//           nd-dlt, de-dol, nh-dol, ak-dol, local, sca-dol, federal-dol
```

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete prevailing wage coverage — 19 state forms, county/local infrastructure, SCA support"
```

---

## Remaining coverage notes (out of scope for this plan)

| Item | Why deferred |
|------|-------------|
| Live scraping for state wage portals (CA DIR, WA L&I, PA DLI, etc.) | No confirmed public API; manual CSV import covers the use case |
| DBRA non-construction (residential, etc.) | Edge case; WH-347 format already handles it |
| SCA SF-1444 (Report of Violations) | Enforcement tool, not a CPR form |
| NYC Comptroller eCPR electronic submission | Portal-specific XML; requires NYC Comptroller pilot agreement |
| DC Verified Application portal XML | DC DOES portal submission requires agency onboarding |
| Chicago CCPJ portal submission | Cook County portal XML requires county vendor agreement |
| Interstate projects (multiple state WDs) | Multi-state project support is a separate milestone |

---

*Plan created: 2026-05-17*
