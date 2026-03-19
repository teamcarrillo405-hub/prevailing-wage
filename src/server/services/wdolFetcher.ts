// src/server/services/wdolFetcher.ts
// Fetches one WD from the SAM.gov WDOL v1 API.
// No authentication required (confirmed by live inspection).
// Returns null on any non-200 response or network error.
// ONLY called from wdolSync.ts and wageLookup.ts — never from route handlers directly.
//
// Note: SAM.gov requires Accept: 'application/json, text/plain, */*' — plain 'application/json'
// returns 406 Not Acceptable.

export interface WdolResponse {
  fullReferenceNumber: string;  // e.g. "CA20250001"
  revisionNumber: number;
  location: {
    description: string;
    mapping: Record<string, unknown>;
  };
  document: string;             // Full plain-text WD content — requires regex parsing
  shortName: string;            // e.g. "ca1"
  year: number;
  publishDate: string;          // e.g. "2025-01-24"
  standard: boolean;
  active: boolean;
}

const WDOL_BASE = 'https://sam.gov/api/prod/wdol/v1';

export async function fetchWdFromSamGov(
  wdNumber: string,
  revision: number = 0
): Promise<WdolResponse | null> {
  const url = `${WDOL_BASE}/wd/${encodeURIComponent(wdNumber)}/${revision}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json, text/plain, */*' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[wdolFetcher] ${wdNumber}/${revision} returned ${res.status}`);
      return null;
    }
    return res.json() as Promise<WdolResponse>;
  } catch (err) {
    console.warn(`[wdolFetcher] fetch failed for ${wdNumber}:`, err);
    return null;
  }
}
