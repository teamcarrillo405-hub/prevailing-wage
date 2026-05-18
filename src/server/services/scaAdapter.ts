// src/server/services/scaAdapter.ts
// Service Contract Act wage determination adapter.
// SCA WDs are on SAM.gov WDOL — same fetch path as Davis-Bacon.
// source = 'sca-dol'. Distinguishable from federal-dol via jurisdiction_type = 'sca'.

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
