import { getDb } from '../db/index.js';
import { wageDeterminations } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const CENSUS_COUNTY_SOURCE_URL = 'https://www2.census.gov/geo/docs/reference/codes/files/national_county.txt';

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

const STATE_CODES = new Set(Object.keys(STATE_NAMES));

interface CensusCounty {
  state: string;
  stateFips: string;
  countyFips: string;
  countyName: string;
  normalizedCountyName: string;
}

interface WdStateCoverage {
  statewideWds: number;
  namedCountyKeys: Set<string>;
}

export interface CountyCoverageAudit {
  source: {
    label: string;
    url: string;
    retrievedAt: string;
    scope: string;
  };
  totals: {
    states: number;
    censusCountyEquivalents: number;
    explicitlyMatchedCounties: number;
    statewideFallbackCoveredCounties: number;
    missingCounties: number;
    coveragePercent: number;
    statesWithStatewideFallback: number;
  };
  byState: Array<{
    state: string;
    stateName: string;
    censusCountyEquivalents: number;
    namedWdCountyKeys: number;
    explicitCountyMatches: number;
    statewideWds: number;
    statewideFallbackCoveredCounties: number;
    missingCounties: number;
    coveragePercent: number;
  }>;
  missing: Array<{
    state: string;
    stateName: string;
    countyName: string;
    stateFips: string;
    countyFips: string;
  }>;
}

let censusCountyCache: { retrievedAt: string; counties: CensusCounty[] } | null = null;

function normalizeCountyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\b(county|parish|borough|census area|municipality|city and borough|city|municipio)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadCensusCounties(): Promise<{ retrievedAt: string; counties: CensusCounty[] }> {
  if (censusCountyCache) return censusCountyCache;

  const res = await fetch(CENSUS_COUNTY_SOURCE_URL, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Census county source returned ${res.status}`);
  }

  const text = await res.text();
  const retrievedAt = new Date().toISOString();
  const counties = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [state, stateFips, countyFips, countyName] = line.split(',');
      return {
        state,
        stateFips,
        countyFips,
        countyName,
        normalizedCountyName: normalizeCountyName(countyName),
      };
    })
    .filter((county) => STATE_CODES.has(county.state));

  censusCountyCache = { retrievedAt, counties };
  return censusCountyCache;
}

function getWdCoverageByState(): Map<string, WdStateCoverage> {
  const db = getDb();
  const rows = db
    .select({
      state: wageDeterminations.state,
      county: wageDeterminations.county,
    })
    .from(wageDeterminations)
    .where(eq(wageDeterminations.isActive, true))
    .all();

  const coverage = new Map<string, WdStateCoverage>();
  for (const row of rows) {
    const current = coverage.get(row.state) ?? {
      statewideWds: 0,
      namedCountyKeys: new Set<string>(),
    };
    if (row.county) {
      current.namedCountyKeys.add(normalizeCountyName(row.county));
    } else {
      current.statewideWds += 1;
    }
    coverage.set(row.state, current);
  }
  return coverage;
}

export async function getCountyCoverageAudit(): Promise<CountyCoverageAudit> {
  const { counties, retrievedAt } = await loadCensusCounties();
  const wdCoverage = getWdCoverageByState();
  const byState: CountyCoverageAudit['byState'] = [];
  const missing: CountyCoverageAudit['missing'] = [];

  for (const state of Object.keys(STATE_NAMES).sort()) {
    const stateCounties = counties.filter((county) => county.state === state);
    const stateCoverage = wdCoverage.get(state) ?? { statewideWds: 0, namedCountyKeys: new Set<string>() };
    let explicitCountyMatches = 0;
    let statewideFallbackCoveredCounties = 0;
    let missingCounties = 0;

    for (const county of stateCounties) {
      const hasExplicitMatch = stateCoverage.namedCountyKeys.has(county.normalizedCountyName);
      if (hasExplicitMatch) {
        explicitCountyMatches += 1;
      } else if (stateCoverage.statewideWds > 0) {
        statewideFallbackCoveredCounties += 1;
      } else {
        missingCounties += 1;
        missing.push({
          state,
          stateName: STATE_NAMES[state],
          countyName: county.countyName,
          stateFips: county.stateFips,
          countyFips: county.countyFips,
        });
      }
    }

    const covered = explicitCountyMatches + statewideFallbackCoveredCounties;
    byState.push({
      state,
      stateName: STATE_NAMES[state],
      censusCountyEquivalents: stateCounties.length,
      namedWdCountyKeys: stateCoverage.namedCountyKeys.size,
      explicitCountyMatches,
      statewideWds: stateCoverage.statewideWds,
      statewideFallbackCoveredCounties,
      missingCounties,
      coveragePercent: stateCounties.length > 0 ? Math.round((covered / stateCounties.length) * 100) : 0,
    });
  }

  const totals = byState.reduce((acc, row) => {
    acc.censusCountyEquivalents += row.censusCountyEquivalents;
    acc.explicitlyMatchedCounties += row.explicitCountyMatches;
    acc.statewideFallbackCoveredCounties += row.statewideFallbackCoveredCounties;
    acc.missingCounties += row.missingCounties;
    if (row.statewideWds > 0) acc.statesWithStatewideFallback += 1;
    return acc;
  }, {
    censusCountyEquivalents: 0,
    explicitlyMatchedCounties: 0,
    statewideFallbackCoveredCounties: 0,
    missingCounties: 0,
    statesWithStatewideFallback: 0,
  });

  const coveredCounties = totals.explicitlyMatchedCounties + totals.statewideFallbackCoveredCounties;

  return {
    source: {
      label: 'U.S. Census Bureau national county and county-equivalent file',
      url: CENSUS_COUNTY_SOURCE_URL,
      retrievedAt,
      scope: '50 states plus District of Columbia',
    },
    totals: {
      states: Object.keys(STATE_NAMES).length,
      censusCountyEquivalents: totals.censusCountyEquivalents,
      explicitlyMatchedCounties: totals.explicitlyMatchedCounties,
      statewideFallbackCoveredCounties: totals.statewideFallbackCoveredCounties,
      missingCounties: totals.missingCounties,
      coveragePercent: totals.censusCountyEquivalents > 0 ? Math.round((coveredCounties / totals.censusCountyEquivalents) * 100) : 0,
      statesWithStatewideFallback: totals.statesWithStatewideFallback,
    },
    byState,
    missing,
  };
}
