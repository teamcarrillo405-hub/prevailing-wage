// src/server/services/stateWageAdapter.ts
// Manual-import state adapters for WAGE-05 (v1.x).
// NO live HTTP calls — all data comes from wageDeterminations table seeded via POST /admin/wages/import-state.
// Live scraping is NOT implemented in v1 (CA DIR, WA L&I, NY DOL have no confirmed public APIs).
// To add live scraping in v2: implement fetchDetermination() with HTTP call; supportsLookup() stays the same.

import { eq, and, desc } from 'drizzle-orm';
import { wageDeterminations } from '../db/schema.js';
import { getDb } from '../db/index.js';
import { getCachedClassifications } from './wageCache.js';
import { registerAdapters, FederalWdolAdapter } from './wageLookup.js';
import type { WageAdapter } from './wageLookup.js';
import type { WageDetermination, WageClassification } from '../../shared/types.js';
import { LocalWageAdapter } from './localWageAdapter.js';
import { ScaDolAdapter } from './scaAdapter.js';

// Required CSV column names for import validation.
export const STATE_CSV_COLUMNS = [
  'state', 'county', 'wd_number',
  'trade_code', 'trade_description', 'labor_type', 'base_rate', 'fringe_rate',
] as const;

// Maps state code → source value for DB storage.
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

// Base class for manual-import state adapters.
// All state adapters share the same read logic — only the state code differs.
abstract class ManualImportStateAdapter implements WageAdapter {
  abstract source: WageAdapter['source'];
  abstract stateCode: string;

  supportsLookup(state: string): boolean {
    return state.toUpperCase() === this.stateCode;
  }

  async fetchDetermination(state: string, county: string): Promise<WageDetermination | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(wageDeterminations)
      .where(
        and(
          eq(wageDeterminations.source, this.source as any),
          eq(wageDeterminations.state, state.toUpperCase()),
          eq(wageDeterminations.county, county),
          eq(wageDeterminations.isActive, true)
        )
      )
      .orderBy(desc(wageDeterminations.publishDate))
      .limit(1);

    if (!row) return null;

    const classifications = await getCachedClassifications(row.id);
    return {
      id: row.id,
      source: this.source as any,
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

export class CaDirAdapter extends ManualImportStateAdapter {
  source = 'ca-dir' as const;
  stateCode = 'CA';
}

export class WaLiAdapter extends ManualImportStateAdapter {
  source = 'wa-li' as const;
  stateCode = 'WA';
}

export class NyDolAdapter extends ManualImportStateAdapter {
  source = 'ny-dol' as const;
  stateCode = 'NY';
}

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

// Priority order: state adapters first, local adapters, SCA, FederalWdolAdapter last.
// lookupWageDetermination() finds the first adapter where supportsLookup(state) is true.
export const WAGE_ADAPTERS: WageAdapter[] = [
  new CaDirAdapter(), new WaLiAdapter(), new NyDolAdapter(),
  new PaDliAdapter(), new OhComAdapter(), new CoCowcAdapter(),
  new MdDllrAdapter(), new OrBoliAdapter(), new CtDolAdapter(),
  new HiDlirAdapter(), new KyLaborAdapter(), new NmDolAdapter(),
  new NvDirAdapter(), new RiDltAdapter(), new WvLaborAdapter(),
  new MeDolAdapter(), new VtDfrAdapter(), new MtDliAdapter(),
  new NdDltAdapter(), new DeDolAdapter(), new NhDolAdapter(),
  new AkDolAdapter(),
  new LocalWageAdapter('NY', 'NYC'),      // NYC — NY state rates with NYC DCAS header
  new LocalWageAdapter('IL', 'Cook'),     // Cook County, IL
  new LocalWageAdapter('DC', 'DC'),       // Washington DC (DC OCP)
  new LocalWageAdapter('CA', 'LACounty'), // LA County Public Works
  new ScaDolAdapter(),
  new FederalWdolAdapter(), // always last — fallback
];

// Register immediately at module load — this replaces the default adapter array in wageLookup.ts.
// This file is imported in index.ts so the adapters are registered at server startup.
registerAdapters(WAGE_ADAPTERS);
