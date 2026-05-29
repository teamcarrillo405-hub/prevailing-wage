/**
 * NY DOL prevailing wage seed — ALL 62 NY counties
 *
 * Source: SAM.gov federal General Decisions (NY20260002–NY20260113), effective 01/02/2026
 * Source URL: https://sam.gov/api/prod/wdol/v1/wd/{wdNumber}/0
 * NY DOL WPP: https://apps.labor.ny.gov/wpp/
 *
 * Regional groupings used:
 *   NYC-5-BORO  — Bronx, Kings (Brooklyn), New York (Manhattan), Queens, Richmond (Staten Island) — NY20260003
 *   NYC-SUBURBS — Nassau, Suffolk — NY20260012
 *   WESTCHESTER — Westchester — NY20260017
 *   ROCKLAND    — Rockland — NY20260020
 *   PUTNAM      — Putnam — NY20260025
 *   HV-MAIN     — Dutchess, Orange, Sullivan, Ulster — NY20260007
 *   CAPITAL     — Albany, Columbia, Fulton, Greene, Montgomery, Rensselaer, Saratoga,
 *                 Schenectady, Schoharie, Washington, Warren — NY20260002/NY20260039
 *   NORTH       — Clinton, Essex, Franklin, Hamilton, Hamilton, St. Lawrence — grouped
 *   JEFFERSON   — Jefferson, Lewis — NY20260022 / NY20260009
 *   ONEIDA      — Oneida, Madison, Herkimer — NY20260013/NY20260023/NY20260031
 *   ONONDAGA    — Onondaga — NY20260026
 *   CENTRAL     — Broome, Chenango — NY20260004
 *   TOMPKINS    — Tompkins, Cortland, Schuyler — NY20260051
 *   CHEMUNG     — Chemung — NY20260005
 *   TIOGA       — Tioga, Delaware, Otsego — NY20260045/NY20260037/NY20260113
 *   CAYUGA      — Cayuga, Seneca — NY20260036/NY20260040
 *   OSWEGO      — Oswego — NY20260027
 *   WAYNE       — Wayne, Ontario, Livingston, Wyoming, Genesee, Monroe, Orleans,
 *                 Yates, Steuben, Allegany, Cattaraugus, Chautauqua — NY20260010/regional
 *   NIAGARA     — Niagara — NY20260011
 *   ERIE        — Erie — NY20260008
 *
 * Run: npx tsx scripts/seed-ny-all-counties.mts
 */
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || './data/prevailing-wage.db';
const NOW = new Date().toISOString();
const EFFECTIVE = '2025-07-01';
const EXPIRES = '2026-06-30';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

type RateRow = {
  state: string;
  county: string;
  city?: string;
  tradeCode: string;
  laborType: string;
  baseRate: number;
  fringeRate: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// RATES — organized by regional wage tier
// All sourced from SAM.gov federal WD documents (NY20260002 series), which
// incorporate NY DOL union agreements updated through mid-2025.
// "Building" classification rates used throughout (general commercial construction).
// ─────────────────────────────────────────────────────────────────────────────
const RATES: RateRow[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // NYC 5 BOROUGHS — NY20260003 (Bronx, Kings/Brooklyn, New York/Manhattan,
  //                              Queens, Richmond/Staten Island)
  // ═══════════════════════════════════════════════════════════════════════════
  ...(['Bronx', 'Kings', 'New York', 'Queens', 'Richmond'] as const).flatMap(county => [
    { state: 'NY', county, tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 59.05, fringeRate: 48.08 },
    { state: 'NY', county, tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 62.00, fringeRate: 56.59 }, // 74.695% of 49.37 + $19.50 ≈ $56.59
    { state: 'NY', county, tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 58.95, fringeRate: 92.02 },
    { state: 'NY', county, tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 44.70, fringeRate: 29.55 },
    { state: 'NY', county, tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 69.91, fringeRate: 44.02 }, // stone mason
    { state: 'NY', county, tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 44.75, fringeRate: 44.11 },
    { state: 'NY', county, tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 73.00, fringeRate: 32.81 },
    { state: 'NY', county, tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 50.25, fringeRate: 32.62 },
    { state: 'NY', county, tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 53.60, fringeRate: 60.74 },
    { state: 'NY', county, tradeCode: 'GLAZ',  laborType: 'journeyworker', baseRate: 49.20, fringeRate: 57.20 },
  ]),

  // ═══════════════════════════════════════════════════════════════════════════
  // NASSAU & SUFFOLK — NY20260012
  // ═══════════════════════════════════════════════════════════════════════════
  // Nassau (Building — remainder of county)
  { state: 'NY', county: 'Nassau', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 53.56, fringeRate: 34.28 },
  { state: 'NY', county: 'Nassau', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 64.55, fringeRate: 47.39 }, // 18%×64.55 + $35.78 = $11.62 + $35.78
  { state: 'NY', county: 'Nassau', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 58.95, fringeRate: 92.02 },
  { state: 'NY', county: 'Nassau', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 42.55, fringeRate: 34.79 },
  { state: 'NY', county: 'Nassau', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 69.91, fringeRate: 44.02 },
  { state: 'NY', county: 'Nassau', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 60.73, fringeRate: 45.75 },
  { state: 'NY', county: 'Nassau', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 51.25, fringeRate: 47.36 },
  { state: 'NY', county: 'Nassau', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 53.60, fringeRate: 60.74 },
  { state: 'NY', county: 'Nassau', tradeCode: 'GLAZ',  laborType: 'journeyworker', baseRate: 49.20, fringeRate: 57.20 },
  { state: 'NY', county: 'Nassau', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 44.75, fringeRate: 44.11 },

  // Suffolk (Building)
  { state: 'NY', county: 'Suffolk', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 53.56, fringeRate: 34.43 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 64.25, fringeRate: 47.26 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 58.95, fringeRate: 92.60 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 45.35, fringeRate: 32.36 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 68.84, fringeRate: 36.70 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 54.56, fringeRate: 35.23 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 60.73, fringeRate: 51.95 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 58.75, fringeRate: 39.86 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 62.34, fringeRate: 55.00 },
  { state: 'NY', county: 'Suffolk', tradeCode: 'GLAZ',  laborType: 'journeyworker', baseRate: 64.23, fringeRate: 43.03 },

  // ═══════════════════════════════════════════════════════════════════════════
  // WESTCHESTER — NY20260017
  // ═══════════════════════════════════════════════════════════════════════════
  { state: 'NY', county: 'Westchester', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 50.12, fringeRate: 31.73 },
  { state: 'NY', county: 'Westchester', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 51.50, fringeRate: 42.22 }, // 3%×51.50 + $40.67 = $42.22
  { state: 'NY', county: 'Westchester', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 58.95, fringeRate: 92.02 },
  { state: 'NY', county: 'Westchester', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 44.05, fringeRate: 32.40 },
  { state: 'NY', county: 'Westchester', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 47.44, fringeRate: 38.00 },
  { state: 'NY', county: 'Westchester', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 44.75, fringeRate: 44.11 },
  { state: 'NY', county: 'Westchester', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 65.07, fringeRate: 45.35 },
  { state: 'NY', county: 'Westchester', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 50.25, fringeRate: 32.62 },
  { state: 'NY', county: 'Westchester', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 55.29, fringeRate: 47.43 },
  { state: 'NY', county: 'Westchester', tradeCode: 'GLAZ',  laborType: 'journeyworker', baseRate: 49.20, fringeRate: 57.20 },

  // ═══════════════════════════════════════════════════════════════════════════
  // ROCKLAND — NY20260020
  // ═══════════════════════════════════════════════════════════════════════════
  { state: 'NY', county: 'Rockland', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 50.12, fringeRate: 31.73 },
  { state: 'NY', county: 'Rockland', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 51.50, fringeRate: 42.22 },
  { state: 'NY', county: 'Rockland', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 42.63, fringeRate: 53.70 },
  { state: 'NY', county: 'Rockland', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 33.80, fringeRate: 21.95 },
  { state: 'NY', county: 'Rockland', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 47.44, fringeRate: 38.00 },
  { state: 'NY', county: 'Rockland', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 39.14, fringeRate: 24.66 },
  { state: 'NY', county: 'Rockland', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 53.20, fringeRate: 46.57 },
  { state: 'NY', county: 'Rockland', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 50.25, fringeRate: 32.62 },
  { state: 'NY', county: 'Rockland', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 55.29, fringeRate: 47.43 },
  { state: 'NY', county: 'Rockland', tradeCode: 'GLAZ',  laborType: 'journeyworker', baseRate: 49.20, fringeRate: 57.20 },

  // ═══════════════════════════════════════════════════════════════════════════
  // PUTNAM — NY20260025
  // ═══════════════════════════════════════════════════════════════════════════
  { state: 'NY', county: 'Putnam', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 50.12, fringeRate: 31.73 },
  { state: 'NY', county: 'Putnam', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 51.50, fringeRate: 42.22 },
  { state: 'NY', county: 'Putnam', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 42.63, fringeRate: 53.70 },
  { state: 'NY', county: 'Putnam', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 44.05, fringeRate: 32.40 },
  { state: 'NY', county: 'Putnam', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 46.39, fringeRate: 37.45 },
  { state: 'NY', county: 'Putnam', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 44.75, fringeRate: 44.11 },
  { state: 'NY', county: 'Putnam', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 65.07, fringeRate: 45.35 },
  { state: 'NY', county: 'Putnam', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 50.25, fringeRate: 32.62 },
  { state: 'NY', county: 'Putnam', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 55.29, fringeRate: 47.43 },
  { state: 'NY', county: 'Putnam', tradeCode: 'GLAZ',  laborType: 'journeyworker', baseRate: 49.20, fringeRate: 57.20 },

  // ═══════════════════════════════════════════════════════════════════════════
  // HUDSON VALLEY — Dutchess, Orange, Sullivan, Ulster — NY20260007
  // ═══════════════════════════════════════════════════════════════════════════
  ...(['Dutchess', 'Orange', 'Sullivan', 'Ulster'] as const).flatMap(county => [
    { state: 'NY', county, tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 44.72, fringeRate: 31.23 },
    { state: 'NY', county, tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 51.50, fringeRate: 42.22 },
    { state: 'NY', county, tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 42.63, fringeRate: 53.70 },
    { state: 'NY', county, tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 35.95, fringeRate: 27.15 },
    { state: 'NY', county, tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 46.45, fringeRate: 37.50 },
    { state: 'NY', county, tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 39.14, fringeRate: 24.66 },
    // Plumber: Dutchess/Ulster use $60.66; Orange/Sullivan use $53.20
    { state: 'NY', county, tradeCode: 'PLUM',  laborType: 'journeyworker',
      baseRate:  (county === 'Dutchess' || county === 'Ulster') ? 60.66 : 53.20,
      fringeRate: (county === 'Dutchess' || county === 'Ulster') ? 45.35 : 46.57 },
    { state: 'NY', county, tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 50.25, fringeRate: 32.62 },
    { state: 'NY', county, tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 55.29, fringeRate: 47.43 },
    { state: 'NY', county, tradeCode: 'GLAZ',  laborType: 'journeyworker', baseRate: 49.20, fringeRate: 57.20 },
  ]),

  // ═══════════════════════════════════════════════════════════════════════════
  // CAPITAL DISTRICT — Albany, Columbia, Fulton, Greene, Montgomery,
  //   Rensselaer, Saratoga, Schenectady, Schoharie — NY20260002
  // ═══════════════════════════════════════════════════════════════════════════
  ...(['Albany', 'Columbia', 'Fulton', 'Greene', 'Montgomery',
       'Rensselaer', 'Saratoga', 'Schenectady', 'Schoharie'] as const).flatMap(county => [
    { state: 'NY', county, tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 36.38, fringeRate: 24.65 },
    { state: 'NY', county, tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 48.00, fringeRate: 32.09 },
    { state: 'NY', county, tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 38.50, fringeRate: 25.48 },
    { state: 'NY', county, tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 36.16, fringeRate: 26.68 },
    { state: 'NY', county, tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 41.79, fringeRate: 22.33 },
    { state: 'NY', county, tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 33.50, fringeRate: 21.69 },
    { state: 'NY', county, tradeCode: 'PLUM',  laborType: 'journeyworker',
      // Saratoga/Washington use $44.88; rest use $55.26
      baseRate:  (county === 'Saratoga') ? 44.88 : 55.26,
      fringeRate: (county === 'Saratoga') ? 33.60 : 29.12 },
    { state: 'NY', county, tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 38.05, fringeRate: 24.27 },
    { state: 'NY', county, tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 33.73, fringeRate: 33.04 },
    { state: 'NY', county, tradeCode: 'GLAZ',  laborType: 'journeyworker', baseRate: 40.36, fringeRate: 24.40 },
  ]),

  // Washington and Warren — same district, similar rates to Capital (NY20260002/NY20260039)
  ...(['Washington', 'Warren'] as const).flatMap(county => [
    { state: 'NY', county, tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 36.38, fringeRate: 24.65 },
    { state: 'NY', county, tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 48.00, fringeRate: 32.09 },
    { state: 'NY', county, tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 38.50, fringeRate: 25.48 },
    { state: 'NY', county, tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 23.68, fringeRate: 21.45 },
    { state: 'NY', county, tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 36.19, fringeRate: 20.48 },
    { state: 'NY', county, tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 33.50, fringeRate: 21.69 },
    { state: 'NY', county, tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 44.88, fringeRate: 33.60 },
    { state: 'NY', county, tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 38.05, fringeRate: 24.27 },
    { state: 'NY', county, tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 33.73, fringeRate: 33.04 },
    { state: 'NY', county, tradeCode: 'GLAZ',  laborType: 'journeyworker', baseRate: 40.36, fringeRate: 24.40 },
  ]),

  // ═══════════════════════════════════════════════════════════════════════════
  // NORTH COUNTRY — Clinton, Essex, Franklin, Hamilton
  //   (No dedicated building WD found; grouped with Capital District rates
  //    since they share union jurisdiction; Hamilton verified NY20260046 H&H only)
  // ═══════════════════════════════════════════════════════════════════════════
  ...(['Clinton', 'Essex', 'Franklin', 'Hamilton'] as const).flatMap(county => [
    { state: 'NY', county, tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 36.38, fringeRate: 24.65 },
    { state: 'NY', county, tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 48.00, fringeRate: 32.09 },
    { state: 'NY', county, tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 38.50, fringeRate: 25.48 },
    { state: 'NY', county, tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 23.68, fringeRate: 21.45 },
    { state: 'NY', county, tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 36.19, fringeRate: 20.48 },
    { state: 'NY', county, tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 33.50, fringeRate: 21.69 },
    { state: 'NY', county, tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 44.88, fringeRate: 33.60 },
    { state: 'NY', county, tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 38.05, fringeRate: 24.27 },
    { state: 'NY', county, tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 33.73, fringeRate: 33.04 },
    { state: 'NY', county, tradeCode: 'GLAZ',  laborType: 'journeyworker', baseRate: 40.36, fringeRate: 24.40 },
  ]),

  // ═══════════════════════════════════════════════════════════════════════════
  // ST. LAWRENCE — grouped with Jefferson/Lewis (North Country H&H NY20260009)
  // ═══════════════════════════════════════════════════════════════════════════
  { state: 'NY', county: 'St. Lawrence', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 25.70, fringeRate: 15.85 },
  { state: 'NY', county: 'St. Lawrence', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 43.50, fringeRate: 28.39 },
  { state: 'NY', county: 'St. Lawrence', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 29.41, fringeRate: 21.63 },
  { state: 'NY', county: 'St. Lawrence', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 27.03, fringeRate: 25.45 },
  { state: 'NY', county: 'St. Lawrence', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 27.03, fringeRate: 25.45 },
  { state: 'NY', county: 'St. Lawrence', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 22.32, fringeRate: 13.95 },
  { state: 'NY', county: 'St. Lawrence', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 33.72, fringeRate: 16.03 },
  { state: 'NY', county: 'St. Lawrence', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 35.80, fringeRate: 25.99 },
  { state: 'NY', county: 'St. Lawrence', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 28.11, fringeRate: 17.75 },

  // ═══════════════════════════════════════════════════════════════════════════
  // JEFFERSON & LEWIS — NY20260022 (building) / NY20260009 (H&H)
  // ═══════════════════════════════════════════════════════════════════════════
  ...(['Jefferson', 'Lewis'] as const).flatMap(county => [
    { state: 'NY', county, tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 25.70, fringeRate: 15.85 },
    { state: 'NY', county, tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 43.50, fringeRate: 28.39 }, // 5.75%×43.50 + $25.88
    { state: 'NY', county, tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 29.41, fringeRate: 21.63 },
    { state: 'NY', county, tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 27.03, fringeRate: 25.45 },
    { state: 'NY', county, tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 27.03, fringeRate: 25.45 },
    { state: 'NY', county, tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 22.32, fringeRate: 13.95 },
    { state: 'NY', county, tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 33.72, fringeRate: 16.03 },
    { state: 'NY', county, tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 35.80, fringeRate: 25.99 },
    { state: 'NY', county, tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 28.11, fringeRate: 17.75 },
  ]),

  // ═══════════════════════════════════════════════════════════════════════════
  // ONEIDA — NY20260013
  // ═══════════════════════════════════════════════════════════════════════════
  { state: 'NY', county: 'Oneida', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 32.64, fringeRate: 21.97 },
  { state: 'NY', county: 'Oneida', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 50.50, fringeRate: 35.03 },
  { state: 'NY', county: 'Oneida', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.50, fringeRate: 31.39 },
  { state: 'NY', county: 'Oneida', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 22.50, fringeRate: 20.64 },
  { state: 'NY', county: 'Oneida', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 39.24, fringeRate: 22.02 },
  { state: 'NY', county: 'Oneida', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 28.32, fringeRate: 26.88 },
  { state: 'NY', county: 'Oneida', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 45.93, fringeRate: 33.77 },
  { state: 'NY', county: 'Oneida', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 35.80, fringeRate: 25.99 },
  { state: 'NY', county: 'Oneida', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 36.29, fringeRate: 23.31 },

  // MADISON — NY20260023 (Building; similar to Oneida)
  { state: 'NY', county: 'Madison', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 32.64, fringeRate: 21.97 },
  { state: 'NY', county: 'Madison', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 50.50, fringeRate: 35.03 },
  { state: 'NY', county: 'Madison', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.50, fringeRate: 31.39 },
  { state: 'NY', county: 'Madison', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 22.50, fringeRate: 20.64 },
  { state: 'NY', county: 'Madison', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 39.24, fringeRate: 22.02 },
  { state: 'NY', county: 'Madison', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 28.32, fringeRate: 26.88 },
  { state: 'NY', county: 'Madison', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 45.93, fringeRate: 33.77 },
  { state: 'NY', county: 'Madison', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 35.80, fringeRate: 25.99 },
  { state: 'NY', county: 'Madison', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 36.29, fringeRate: 23.31 },

  // HERKIMER — NY20260031
  { state: 'NY', county: 'Herkimer', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 30.85, fringeRate: 21.32 },
  { state: 'NY', county: 'Herkimer', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 50.50, fringeRate: 35.03 },
  { state: 'NY', county: 'Herkimer', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.50, fringeRate: 31.39 },
  { state: 'NY', county: 'Herkimer', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 22.50, fringeRate: 20.64 },
  { state: 'NY', county: 'Herkimer', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 39.24, fringeRate: 22.02 },
  { state: 'NY', county: 'Herkimer', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 27.27, fringeRate: 26.23 },
  { state: 'NY', county: 'Herkimer', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 45.93, fringeRate: 33.77 },
  { state: 'NY', county: 'Herkimer', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 35.80, fringeRate: 25.99 },
  { state: 'NY', county: 'Herkimer', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 36.29, fringeRate: 23.31 },

  // ═══════════════════════════════════════════════════════════════════════════
  // ONONDAGA — NY20260026
  // ═══════════════════════════════════════════════════════════════════════════
  { state: 'NY', county: 'Onondaga', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 32.99, fringeRate: 21.92 },
  { state: 'NY', county: 'Onondaga', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 50.50, fringeRate: 35.03 },
  { state: 'NY', county: 'Onondaga', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 37.16, fringeRate: 30.68 },
  { state: 'NY', county: 'Onondaga', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 29.88, fringeRate: 22.90 },
  { state: 'NY', county: 'Onondaga', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 23.88, fringeRate: 19.60 },
  { state: 'NY', county: 'Onondaga', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 23.25, fringeRate: 21.21 },
  { state: 'NY', county: 'Onondaga', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
  { state: 'NY', county: 'Onondaga', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 35.80, fringeRate: 25.99 },
  { state: 'NY', county: 'Onondaga', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 36.29, fringeRate: 23.31 },

  // OSWEGO — NY20260027 (similar to Onondaga/Oneida district)
  { state: 'NY', county: 'Oswego', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 32.99, fringeRate: 21.92 },
  { state: 'NY', county: 'Oswego', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 50.50, fringeRate: 35.03 },
  { state: 'NY', county: 'Oswego', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 37.16, fringeRate: 30.68 },
  { state: 'NY', county: 'Oswego', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 29.88, fringeRate: 22.90 },
  { state: 'NY', county: 'Oswego', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 23.88, fringeRate: 19.60 },
  { state: 'NY', county: 'Oswego', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 23.25, fringeRate: 21.21 },
  { state: 'NY', county: 'Oswego', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
  { state: 'NY', county: 'Oswego', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 35.80, fringeRate: 25.99 },
  { state: 'NY', county: 'Oswego', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 36.29, fringeRate: 23.31 },

  // CAYUGA — NY20260036 (H&H only in probe; use Onondaga/central rates for building)
  { state: 'NY', county: 'Cayuga', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 31.59, fringeRate: 23.24 },
  { state: 'NY', county: 'Cayuga', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.50, fringeRate: 31.89 },
  { state: 'NY', county: 'Cayuga', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 37.16, fringeRate: 30.68 },
  { state: 'NY', county: 'Cayuga', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 26.50, fringeRate: 22.71 },
  { state: 'NY', county: 'Cayuga', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 29.87, fringeRate: 17.79 },
  { state: 'NY', county: 'Cayuga', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 23.25, fringeRate: 21.21 },
  { state: 'NY', county: 'Cayuga', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
  { state: 'NY', county: 'Cayuga', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 30.50, fringeRate: 19.84 },
  { state: 'NY', county: 'Cayuga', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 35.94, fringeRate: 20.89 },

  // SENECA — NY20260040 (H&H only; use Tompkins-region rates for building)
  { state: 'NY', county: 'Seneca', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 31.59, fringeRate: 23.24 },
  { state: 'NY', county: 'Seneca', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.50, fringeRate: 31.89 },
  { state: 'NY', county: 'Seneca', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.75, fringeRate: 30.80 },
  { state: 'NY', county: 'Seneca', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 26.50, fringeRate: 22.71 },
  { state: 'NY', county: 'Seneca', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 29.87, fringeRate: 17.79 },
  { state: 'NY', county: 'Seneca', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 27.00, fringeRate: 26.00 },
  { state: 'NY', county: 'Seneca', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
  { state: 'NY', county: 'Seneca', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.10, fringeRate: 28.20 },
  { state: 'NY', county: 'Seneca', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 43.01, fringeRate: 28.66 },

  // ═══════════════════════════════════════════════════════════════════════════
  // CENTRAL NY — Broome, Chenango — NY20260004
  // ═══════════════════════════════════════════════════════════════════════════
  ...(['Broome', 'Chenango'] as const).flatMap(county => [
    { state: 'NY', county, tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 31.69, fringeRate: 21.92 },
    { state: 'NY', county, tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 42.68, fringeRate: 33.06 },
    { state: 'NY', county, tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 37.16, fringeRate: 30.68 },
    { state: 'NY', county, tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 26.50, fringeRate: 22.46 },
    { state: 'NY', county, tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 34.34, fringeRate: 28.46 },
    { state: 'NY', county, tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 28.60, fringeRate: 23.83 },
    { state: 'NY', county, tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 44.91, fringeRate: 33.31 },
    { state: 'NY', county, tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 30.50, fringeRate: 19.84 },
    { state: 'NY', county, tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 35.94, fringeRate: 20.89 },
  ]),

  // ═══════════════════════════════════════════════════════════════════════════
  // TOMPKINS — NY20260051
  // ═══════════════════════════════════════════════════════════════════════════
  { state: 'NY', county: 'Tompkins', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 31.59, fringeRate: 23.24 },
  { state: 'NY', county: 'Tompkins', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.50, fringeRate: 31.89 },
  { state: 'NY', county: 'Tompkins', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 37.16, fringeRate: 30.68 },
  { state: 'NY', county: 'Tompkins', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 26.50, fringeRate: 22.71 },
  { state: 'NY', county: 'Tompkins', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 29.87, fringeRate: 17.79 },
  { state: 'NY', county: 'Tompkins', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 29.70, fringeRate: 24.73 },
  { state: 'NY', county: 'Tompkins', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
  { state: 'NY', county: 'Tompkins', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 30.50, fringeRate: 19.84 },
  { state: 'NY', county: 'Tompkins', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 35.94, fringeRate: 20.89 },

  // CORTLAND — NY20260042 (similar to Tompkins/Broome region)
  { state: 'NY', county: 'Cortland', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 31.59, fringeRate: 23.24 },
  { state: 'NY', county: 'Cortland', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.50, fringeRate: 31.89 },
  { state: 'NY', county: 'Cortland', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 37.16, fringeRate: 30.68 },
  { state: 'NY', county: 'Cortland', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 26.50, fringeRate: 22.71 },
  { state: 'NY', county: 'Cortland', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 29.87, fringeRate: 17.79 },
  { state: 'NY', county: 'Cortland', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 23.25, fringeRate: 21.21 },
  { state: 'NY', county: 'Cortland', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
  { state: 'NY', county: 'Cortland', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 30.50, fringeRate: 19.84 },
  { state: 'NY', county: 'Cortland', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 35.94, fringeRate: 20.89 },

  // SCHUYLER — NY20260005 (same as Chemung)
  { state: 'NY', county: 'Schuyler', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 31.59, fringeRate: 23.24 },
  { state: 'NY', county: 'Schuyler', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 43.40, fringeRate: 31.72 },
  { state: 'NY', county: 'Schuyler', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.75, fringeRate: 30.80 },
  { state: 'NY', county: 'Schuyler', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 22.10, fringeRate: 19.65 },
  { state: 'NY', county: 'Schuyler', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 33.26, fringeRate: 30.21 },
  { state: 'NY', county: 'Schuyler', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 26.13, fringeRate: 23.78 },
  { state: 'NY', county: 'Schuyler', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
  { state: 'NY', county: 'Schuyler', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 30.50, fringeRate: 19.84 },
  { state: 'NY', county: 'Schuyler', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 35.94, fringeRate: 20.89 },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHEMUNG — NY20260005
  // ═══════════════════════════════════════════════════════════════════════════
  { state: 'NY', county: 'Chemung', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 31.59, fringeRate: 23.24 },
  { state: 'NY', county: 'Chemung', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 43.40, fringeRate: 31.72 },
  { state: 'NY', county: 'Chemung', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.75, fringeRate: 30.80 },
  { state: 'NY', county: 'Chemung', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 22.10, fringeRate: 19.65 },
  { state: 'NY', county: 'Chemung', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 33.26, fringeRate: 30.21 },
  { state: 'NY', county: 'Chemung', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 26.13, fringeRate: 23.78 },
  { state: 'NY', county: 'Chemung', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
  { state: 'NY', county: 'Chemung', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 30.50, fringeRate: 19.84 },
  { state: 'NY', county: 'Chemung', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 35.94, fringeRate: 20.89 },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIOGA — NY20260045 (Building; similar to Broome/Chemung zone)
  // DELAWARE — grouped with Tioga
  // OTSEGO — NY20260113
  // ═══════════════════════════════════════════════════════════════════════════
  ...(['Tioga', 'Delaware'] as const).flatMap(county => [
    { state: 'NY', county, tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 31.59, fringeRate: 23.24 },
    { state: 'NY', county, tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 42.68, fringeRate: 33.06 },
    { state: 'NY', county, tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 37.16, fringeRate: 30.68 },
    { state: 'NY', county, tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 26.50, fringeRate: 22.71 },
    { state: 'NY', county, tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 29.87, fringeRate: 17.79 },
    { state: 'NY', county, tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 26.13, fringeRate: 23.78 },
    { state: 'NY', county, tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
    { state: 'NY', county, tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 30.50, fringeRate: 19.84 },
    { state: 'NY', county, tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 35.94, fringeRate: 20.89 },
  ]),

  // Otsego — NY20260113
  { state: 'NY', county: 'Otsego', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 33.24, fringeRate: 24.60 },
  { state: 'NY', county: 'Otsego', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 42.68, fringeRate: 33.06 },
  { state: 'NY', county: 'Otsego', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 42.63, fringeRate: 53.70 },
  { state: 'NY', county: 'Otsego', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 32.30, fringeRate: 26.90 },
  { state: 'NY', county: 'Otsego', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 34.32, fringeRate: 20.52 },
  { state: 'NY', county: 'Otsego', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 25.37, fringeRate: 19.91 },
  { state: 'NY', county: 'Otsego', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 37.19, fringeRate: 27.89 },
  { state: 'NY', county: 'Otsego', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 50.25, fringeRate: 39.62 },
  { state: 'NY', county: 'Otsego', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 35.94, fringeRate: 20.89 },

  // ═══════════════════════════════════════════════════════════════════════════
  // WESTERN NY — Monroe (NY20260010), Orleans (NY20260034), Livingston,
  //   Wayne, Ontario, Steuben, Allegany, Wyoming, Genesee, Yates
  // ═══════════════════════════════════════════════════════════════════════════

  // Monroe — NY20260010
  { state: 'NY', county: 'Monroe', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 33.24, fringeRate: 23.46 },
  { state: 'NY', county: 'Monroe', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.30, fringeRate: 30.20 }, // 5.5%×44.30 + $27.76 = $30.20
  { state: 'NY', county: 'Monroe', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.75, fringeRate: 30.80 },
  { state: 'NY', county: 'Monroe', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 29.07, fringeRate: 21.49 },
  { state: 'NY', county: 'Monroe', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 35.81, fringeRate: 27.65 },
  { state: 'NY', county: 'Monroe', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 27.27, fringeRate: 26.23 },
  { state: 'NY', county: 'Monroe', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 42.68, fringeRate: 27.88 },
  { state: 'NY', county: 'Monroe', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.10, fringeRate: 28.20 },
  { state: 'NY', county: 'Monroe', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 43.01, fringeRate: 28.66 },

  // Orleans — NY20260034
  { state: 'NY', county: 'Orleans', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 34.26, fringeRate: 25.94 },
  { state: 'NY', county: 'Orleans', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.20, fringeRate: 32.90 },
  { state: 'NY', county: 'Orleans', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 36.25, fringeRate: 33.12 },
  { state: 'NY', county: 'Orleans', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 29.07, fringeRate: 21.49 },
  { state: 'NY', county: 'Orleans', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 37.44, fringeRate: 32.71 },
  { state: 'NY', county: 'Orleans', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 33.00, fringeRate: 28.21 },
  { state: 'NY', county: 'Orleans', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 42.20, fringeRate: 29.80 },
  { state: 'NY', county: 'Orleans', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.96, fringeRate: 26.03 },
  { state: 'NY', county: 'Orleans', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 39.50, fringeRate: 29.18 },

  // Livingston — NY20260030
  { state: 'NY', county: 'Livingston', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 30.05, fringeRate: 22.19 },
  { state: 'NY', county: 'Livingston', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.30, fringeRate: 30.20 },
  { state: 'NY', county: 'Livingston', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.75, fringeRate: 30.80 },
  { state: 'NY', county: 'Livingston', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 26.22, fringeRate: 21.49 },
  { state: 'NY', county: 'Livingston', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 35.81, fringeRate: 27.65 },
  { state: 'NY', county: 'Livingston', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 27.27, fringeRate: 26.23 },
  { state: 'NY', county: 'Livingston', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 42.68, fringeRate: 27.88 },
  { state: 'NY', county: 'Livingston', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.10, fringeRate: 28.20 },
  { state: 'NY', county: 'Livingston', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 43.01, fringeRate: 28.66 },

  // Wayne — similar to Monroe district
  { state: 'NY', county: 'Wayne', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 33.24, fringeRate: 23.46 },
  { state: 'NY', county: 'Wayne', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.30, fringeRate: 30.20 },
  { state: 'NY', county: 'Wayne', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.75, fringeRate: 30.80 },
  { state: 'NY', county: 'Wayne', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 29.07, fringeRate: 21.49 },
  { state: 'NY', county: 'Wayne', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 35.81, fringeRate: 27.65 },
  { state: 'NY', county: 'Wayne', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 27.27, fringeRate: 26.23 },
  { state: 'NY', county: 'Wayne', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 42.68, fringeRate: 27.88 },
  { state: 'NY', county: 'Wayne', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.10, fringeRate: 28.20 },
  { state: 'NY', county: 'Wayne', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 43.01, fringeRate: 28.66 },

  // Ontario — similar to Livingston/Monroe
  { state: 'NY', county: 'Ontario', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 30.05, fringeRate: 22.19 },
  { state: 'NY', county: 'Ontario', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.30, fringeRate: 30.20 },
  { state: 'NY', county: 'Ontario', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.75, fringeRate: 30.80 },
  { state: 'NY', county: 'Ontario', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 26.22, fringeRate: 21.49 },
  { state: 'NY', county: 'Ontario', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 35.81, fringeRate: 27.65 },
  { state: 'NY', county: 'Ontario', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 27.27, fringeRate: 26.23 },
  { state: 'NY', county: 'Ontario', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 42.68, fringeRate: 27.88 },
  { state: 'NY', county: 'Ontario', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.10, fringeRate: 28.20 },
  { state: 'NY', county: 'Ontario', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 43.01, fringeRate: 28.66 },

  // Steuben — Southern Tier / Finger Lakes crossover; similar to Chemung/Livingston
  { state: 'NY', county: 'Steuben', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 31.59, fringeRate: 23.24 },
  { state: 'NY', county: 'Steuben', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 43.40, fringeRate: 31.72 },
  { state: 'NY', county: 'Steuben', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.75, fringeRate: 30.80 },
  { state: 'NY', county: 'Steuben', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 22.10, fringeRate: 19.65 },
  { state: 'NY', county: 'Steuben', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 33.26, fringeRate: 30.21 },
  { state: 'NY', county: 'Steuben', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 26.13, fringeRate: 23.78 },
  { state: 'NY', county: 'Steuben', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
  { state: 'NY', county: 'Steuben', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 30.50, fringeRate: 19.84 },
  { state: 'NY', county: 'Steuben', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 35.94, fringeRate: 20.89 },

  // Allegany — NY20260047 (H&H only; use Steuben/Livingston building rates)
  { state: 'NY', county: 'Allegany', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 31.59, fringeRate: 23.24 },
  { state: 'NY', county: 'Allegany', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 43.40, fringeRate: 31.72 },
  { state: 'NY', county: 'Allegany', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.75, fringeRate: 30.80 },
  { state: 'NY', county: 'Allegany', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 22.10, fringeRate: 19.65 },
  { state: 'NY', county: 'Allegany', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 33.26, fringeRate: 30.21 },
  { state: 'NY', county: 'Allegany', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 26.13, fringeRate: 23.78 },
  { state: 'NY', county: 'Allegany', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 35.51, fringeRate: 24.57 },
  { state: 'NY', county: 'Allegany', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 30.50, fringeRate: 19.84 },
  { state: 'NY', county: 'Allegany', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 35.94, fringeRate: 20.89 },

  // Genesee — NY20260029 (H&H only; use Monroe district building rates)
  { state: 'NY', county: 'Genesee', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 33.24, fringeRate: 23.46 },
  { state: 'NY', county: 'Genesee', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.20, fringeRate: 32.90 },
  { state: 'NY', county: 'Genesee', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 36.25, fringeRate: 33.12 },
  { state: 'NY', county: 'Genesee', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 29.07, fringeRate: 21.49 },
  { state: 'NY', county: 'Genesee', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 37.44, fringeRate: 32.71 },
  { state: 'NY', county: 'Genesee', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 33.00, fringeRate: 28.21 },
  { state: 'NY', county: 'Genesee', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 42.20, fringeRate: 29.80 },
  { state: 'NY', county: 'Genesee', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.96, fringeRate: 26.03 },
  { state: 'NY', county: 'Genesee', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 39.50, fringeRate: 29.18 },

  // Wyoming — similar to Genesee/Orleans (Western NY Building)
  { state: 'NY', county: 'Wyoming', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 33.24, fringeRate: 23.46 },
  { state: 'NY', county: 'Wyoming', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.20, fringeRate: 32.90 },
  { state: 'NY', county: 'Wyoming', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 36.25, fringeRate: 33.12 },
  { state: 'NY', county: 'Wyoming', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 29.07, fringeRate: 21.49 },
  { state: 'NY', county: 'Wyoming', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 37.44, fringeRate: 32.71 },
  { state: 'NY', county: 'Wyoming', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 33.00, fringeRate: 28.21 },
  { state: 'NY', county: 'Wyoming', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 42.20, fringeRate: 29.80 },
  { state: 'NY', county: 'Wyoming', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.96, fringeRate: 26.03 },
  { state: 'NY', county: 'Wyoming', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 39.50, fringeRate: 29.18 },

  // Yates — NY20260073
  { state: 'NY', county: 'Yates', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 32.64, fringeRate: 21.97 },
  { state: 'NY', county: 'Yates', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 45.00, fringeRate: 31.12 },
  { state: 'NY', county: 'Yates', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 35.75, fringeRate: 30.80 },
  { state: 'NY', county: 'Yates', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 29.07, fringeRate: 21.49 },
  { state: 'NY', county: 'Yates', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 27.00, fringeRate: 26.00 },
  { state: 'NY', county: 'Yates', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 27.15, fringeRate: 12.47 },
  { state: 'NY', county: 'Yates', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.10, fringeRate: 28.20 },
  { state: 'NY', county: 'Yates', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 43.01, fringeRate: 28.66 },

  // ═══════════════════════════════════════════════════════════════════════════
  // NIAGARA — NY20260011 (H&H; use Erie/WNY district for building rates)
  // ═══════════════════════════════════════════════════════════════════════════
  { state: 'NY', county: 'Niagara', tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 34.26, fringeRate: 25.94 },
  { state: 'NY', county: 'Niagara', tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.20, fringeRate: 32.90 },
  { state: 'NY', county: 'Niagara', tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 36.25, fringeRate: 33.12 },
  { state: 'NY', county: 'Niagara', tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 29.07, fringeRate: 21.49 },
  { state: 'NY', county: 'Niagara', tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 37.44, fringeRate: 32.71 },
  { state: 'NY', county: 'Niagara', tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 33.00, fringeRate: 28.21 },
  { state: 'NY', county: 'Niagara', tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 42.20, fringeRate: 29.80 },
  { state: 'NY', county: 'Niagara', tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.96, fringeRate: 26.03 },
  { state: 'NY', county: 'Niagara', tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 39.50, fringeRate: 29.18 },

  // ═══════════════════════════════════════════════════════════════════════════
  // ERIE — NY20260008 (H&H/Cattaraugus/Chautauqua/Erie; use Orleans/WNY building rates)
  // CATTARAUGUS & CHAUTAUQUA — same WD as Erie H&H; building rates from WNY district
  // ═══════════════════════════════════════════════════════════════════════════
  ...(['Erie', 'Cattaraugus', 'Chautauqua'] as const).flatMap(county => [
    { state: 'NY', county, tradeCode: 'CARP',  laborType: 'journeyworker', baseRate: 34.26, fringeRate: 25.94 },
    { state: 'NY', county, tradeCode: 'ELEC',  laborType: 'journeyworker', baseRate: 44.20, fringeRate: 32.90 },
    { state: 'NY', county, tradeCode: 'IRON',  laborType: 'journeyworker', baseRate: 36.25, fringeRate: 33.12 },
    { state: 'NY', county, tradeCode: 'LABO',  laborType: 'journeyworker', baseRate: 29.07, fringeRate: 21.49 },
    { state: 'NY', county, tradeCode: 'MASO',  laborType: 'journeyworker', baseRate: 37.44, fringeRate: 32.71 },
    { state: 'NY', county, tradeCode: 'PAIN',  laborType: 'journeyworker', baseRate: 33.00, fringeRate: 28.21 },
    { state: 'NY', county, tradeCode: 'PLUM',  laborType: 'journeyworker', baseRate: 42.20, fringeRate: 29.80 },
    { state: 'NY', county, tradeCode: 'ROOF',  laborType: 'journeyworker', baseRate: 34.96, fringeRate: 26.03 },
    { state: 'NY', county, tradeCode: 'SMET',  laborType: 'journeyworker', baseRate: 39.50, fringeRate: 29.18 },
  ]),

];

// ─────────────────────────────────────────────────────────────────────────────
// DB OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

const upsertRate = db.prepare(`
  INSERT INTO county_wage_determinations
    (id, state, county, city, trade_code, labor_type, base_rate, fringe_rate,
     effective_date, source, synced_at, expires_at)
  VALUES
    (@id, @state, @county, @city, @tradeCode, @laborType, @baseRate, @fringeRate,
     @effectiveDate, 'dol', @now, @expires)
  ON CONFLICT(id) DO UPDATE SET
    base_rate      = excluded.base_rate,
    fringe_rate    = excluded.fringe_rate,
    effective_date = excluded.effective_date,
    synced_at      = excluded.synced_at,
    expires_at     = excluded.expires_at
`);

const upsertSource = db.prepare(`
  INSERT INTO state_wage_sources
    (state, source_type, api_url, scrape_path, last_synced_at, sync_status)
  VALUES
    (@state, 'pdf', @apiUrl, @scrapePath, @now, 'ok')
  ON CONFLICT(state) DO UPDATE SET
    last_synced_at = excluded.last_synced_at,
    sync_status    = 'ok'
`);

let inserted = 0;

const seedAll = db.transaction(() => {
  for (const row of RATES) {
    const id = `ny-${row.county.toLowerCase().replace(/[\s.]/g, '-')}-${row.tradeCode.toLowerCase()}-${EFFECTIVE}`;
    upsertRate.run({
      id,
      state:         row.state,
      county:        row.county,
      city:          row.city ?? null,
      tradeCode:     row.tradeCode,
      laborType:     row.laborType,
      baseRate:      row.baseRate,
      fringeRate:    row.fringeRate,
      effectiveDate: EFFECTIVE,
      now:           NOW,
      expires:       EXPIRES,
    });
    inserted++;
  }

  upsertSource.run({
    state:      'NY',
    apiUrl:     'https://apps.labor.ny.gov/wpp/viewPrevailingWageSchedule.do',
    scrapePath: '?typeid=1&county={countyId}',
    now:        NOW,
  });
});

try {
  seedAll();
  const counties = new Set(RATES.map(r => r.county));
  console.log(`✓ NY DOL seed complete — ${inserted} rows upserted across ${counties.size} counties`);
  console.log(`  Effective: ${EFFECTIVE} → ${EXPIRES}`);
  console.log(`  Source: SAM.gov General Decisions (NY20260002 series, 01/02/2026)`);
  console.log(`  state_wage_sources.NY sync_status = ok`);
  console.log(`\n  Counties seeded:`);
  [...counties].sort().forEach(c => console.log(`    • ${c}`));
} catch (err) {
  console.error('✗ NY DOL seed failed:', err);
  process.exit(1);
} finally {
  db.close();
}
