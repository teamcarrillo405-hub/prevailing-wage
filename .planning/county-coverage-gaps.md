# County-Level Wage Coverage Gaps — Prioritized Matrix

**Generated:** 2026-05-28  
**Scope:** 27 states with state-specific CPR forms (STATE_CPR_FORMS in UsComplianceMap.tsx)

## Current Coverage Status

| State | Rows in DB | Counties Covered | Total Counties | Gap |
|-------|-----------|-----------------|----------------|-----|
| CA    | 583       | 58/58           | 58             | COMPLETE |
| WA    | 445       | ~39/39          | 39             | Partial (Socrata data not authoritative; should scrape LNI official schedule) |
| NY    | 25        | 2/62            | 62             | 60 counties MISSING |

All other 24 states: 0 rows.

---

## Coverage Gap Matrix — All 27 States

| State | Counties Needed | Data Source | Access Method | Priority | Complexity |
|-------|----------------|-------------|---------------|----------|------------|
| NY | 62 (60 missing) | NY DOL Wage Schedule Portal — apps.labor.ny.gov/wpp/viewPrevailingWageSchedule.do | HTML scraper (county ID param `?typeid=1&county={id}`, county IDs 1–62) | **HIGH** | Medium — multi-page HTML, county IDs known |
| IL | 102 (Cook + collar counties most critical) | IL DOL Prevailing Wage — idol.illinois.gov/docs/default-source/prevailing-wage/ | HTML scraper — county PDFs listed at index page; OR use IDOL API (no public API confirmed) | **HIGH** | High — county-level PDFs, requires PDF parsing |
| MA | 14 | MA DLS Prevailing Wage — mass.gov/orgs/department-of-labor-standards; search at mass.gov/prevailing-wage | HTML scraper — rate tables per county on DLS site; also PDF schedules per county | **HIGH** | Medium — rate tables are HTML on DLS site |
| NJ | 21 | NJ DOL Prevailing Wage — nj.gov/labor/wagehour/content/prevailing_wage.html | HTML scraper / PDF per county type (Building, H&H, Residential). NJ groups by trade area (North/South/Central), not county | **HIGH** | Medium — trade area model (not per county), ~3–4 wage zones |
| MN | 87 | MN DLI Prevailing Wage — dli.mn.gov/business/employment-practices/prevailing-wage | HTML bulk download — DLI publishes annual wage determination files (CSV/Excel bulk export available at dli.mn.gov) | **HIGH** | Low — CSV bulk download confirmed |
| OR | 36 | OR BOLI Prevailing Wage — oregon.gov/boli/prevailing-wage | HTML scraper — BOLI publishes per-county rate sheets; also JSON-like tables at boli.oregon.gov/prevailing-wage/Pages/rates.aspx | **HIGH** | Medium — HTML tables per county, county list static |
| MD | 24 | MD DLLR Prevailing Wage — dllr.state.md.us/labor/prev.shtml | HTML scraper — per-county wage schedules as HTML tables; also PDF exports | **MEDIUM** | Medium — per-county HTML, 24 counties |
| CT | 8 | CT DOL Prevailing Wage — portal.ct.gov/dol/divisions/prevailing-wage | HTML / PDF — CT publishes wage schedules by county; 8 counties | **MEDIUM** | Low — only 8 counties, HTML tables |
| HI | 4 (county govts, not 5 islands) | HI DLIR Prevailing Wage — labor.hawaii.gov/rs/prevailing-wage/ | PDF per county — DLIR publishes PDF wage schedules for Honolulu, Maui, Hawaii, Kauai counties | **MEDIUM** | Medium — PDF parsing required, only 4 counties |
| PA | 67 | PA L&I Prevailing Wage — dli.pa.gov/Individuals/Labor-Management-Relations/lbe/Pages/Prevailing-Wage.aspx | HTML scraper — PA publishes county wage schedules via wage determination search at paworkstats.pa.gov | **MEDIUM** | High — complex search UI, 67 counties |
| OH | 88 | OH BWC Prevailing Wage — com.ohio.gov/divisions-and-programs/industrial-compliance/prevailing-wage | HTML scraper — OH publishes determinations by county search; also PDF per county | **MEDIUM** | High — 88 counties, query-driven site |
| CO | 64 | CO CDLE Prevailing Wage — cdle.colorado.gov/prevailing-wage | HTML + CSV — CO publishes an annual determination CSV/Excel at cdle.colorado.gov; also has REST endpoint patterns | **MEDIUM** | Low-Medium — annual CSV available |
| VA | 133 | VA DOLI Prevailing Wage — doli.virginia.gov/prevailing-wage/ | HTML scraper — VA adopted state PW law in 2021; determinations published by locality; PDF-heavy, some HTML tables | **MEDIUM** | High — 133 localities (counties + independent cities), relatively new data |
| KY | 120 | KY Labor Cabinet Prevailing Wage — labor.ky.gov/standards/prevailing-wage/ | HTML scraper / PDF per county — KY publishes determinations by county search | **LOW** | High — 120 counties, PDF-heavy |
| NM | 33 | NM DOL Prevailing Wage — nm.gov/dol | PDF per county — NM publishes annual PDF wage schedules, no structured API | **LOW** | High — PDF-only |
| NV | 17 | NV OSHA Prevailing Wage — business.nv.gov/Industry/Prevailing_Wage/ | PDF per county — NV publishes county PDFs; no public API | **LOW** | Medium — 17 counties, PDF |
| RI | 5 | RI DOL Prevailing Wage — dlt.ri.gov/prevailing-wage | HTML / PDF — RI is small (5 counties), publishes schedule as single HTML table or PDF | **LOW** | Low — 5 counties, single schedule |
| WV | 55 | WV DOL Prevailing Wage — labor.wv.gov/Wage-Hour/Prevailing_Wage/Pages/Prevailing-Wage.aspx | PDF per county — no structured API | **LOW** | High — 55 counties, PDF |
| ME | 16 | ME DOL Prevailing Wage — maine.gov/labor/labor_laws/prevailing_wage.html | PDF / HTML — ME publishes annual schedules; small state | **LOW** | Medium — 16 counties, PDF |
| VT | 14 | VT DOL Prevailing Wage — labor.vermont.gov/prevailing-wage | PDF — VT publishes single statewide schedule, rate varies by county designation | **LOW** | Low — effectively 1–3 wage zones |
| MT | 56 | MT DOL Prevailing Wage — erd.dli.mt.gov/labor-standards/prevailing-wage-rates | HTML / CSV — MT publishes quarterly determinations; CSV bulk possible | **LOW** | Medium |
| ND | 53 | ND DOL Prevailing Wage — nd.gov/labor/prevailing-wage | PDF per county — ND publishes county PDFs | **LOW** | High — 53 counties, PDF |
| DE | 3 | DE DOL Prevailing Wage — labor.delaware.gov/divisions/industrial-affairs/prevailing-wages/ | HTML — DE only has 3 counties; rate tables published as HTML | **LOW** | Very Low — 3 counties |
| NH | 10 | NH DOL Prevailing Wage — nh.gov/labor/inspection/prevailing-wage.htm | PDF — NH publishes annual PDF schedule; small state | **LOW** | Low — 10 counties, PDF |
| AK | 30 | AK DOL Prevailing Wage — labor.alaska.gov/ls/lss/prewage.htm | PDF / HTML — AK publishes construction wage rates; some HTML tables | **LOW** | Medium — 30 boroughs/census areas |

---

## Priority Tier Summary

### Tier 1 — HIGH (ship next sprint)
| State | Why High | Approach |
|-------|----------|----------|
| NY | 62 counties, largest US construction market after CA; portal has county ID params → scrapeable | HTML scraper, county IDs 1–62 |
| IL | Chicago metro = #3 US construction market; IDOL publishes PDF list per county | PDF scraper or HTML index |
| MA | Boston metro, high PW enforcement; DLS site has HTML rate tables | HTML scraper |
| NJ | NJ uses wage zones (N/S/C) not counties; high construction volume; HTML extractable | HTML scraper, 3–4 zones |
| MN | DLI confirmed CSV/Excel bulk download — lowest complexity for volume | CSV bulk fetch |
| OR | BOLI has per-county HTML tables, 36 counties, medium complexity | HTML scraper |

### Tier 2 — MEDIUM (next milestone)
MD, CT, HI, PA, OH, CO, VA

### Tier 3 — LOW (future milestone)
KY, NM, NV, RI, WV, ME, VT, MT, ND, DE, NH, AK

---

## Data Source Notes

### NY — `apps.labor.ny.gov/wpp/viewPrevailingWageSchedule.do`
- County parameter: `?typeid=1&county={countyId}` where countyId is 1–62
- Each county page returns HTML tables per trade group (Building, Heavy, Highway, Residential)
- Rate updates: annual (effective 07/01 each year)
- Limitation: Site has CSRF tokens — Playwright or curl with session cookie required

### IL — `idol.illinois.gov/docs/default-source/prevailing-wage/`
- IDOL publishes a monthly index page listing county PDF links
- URL pattern: `https://idol.illinois.gov/docs/default-source/prevailing-wage/{COUNTY}-{MONTH}-{YEAR}.pdf`
- No JSON API. PDF parsing required (pdf-lib or pdfjs).
- Counties are also grouped — Cook County separate from collar counties

### MA — `mass.gov/doc/prevailing-wage-rates`
- MA DLS provides rate lookups by county + work type at:
  `https://www.mass.gov/orgs/department-of-labor-standards`
- HTML tables available at county-specific schedule pages
- CSV export not confirmed — scrape HTML tables

### MN — `dli.mn.gov/business/employment-practices/prevailing-wage`
- MN DLI publishes annual Excel/CSV wage determination file
- Direct download URL (2026 example):
  `https://www.dli.mn.gov/sites/default/files/excel/prevwage/pw_all_counties_2026.xlsx`
- 87 counties, all trades, journey level — single file
- Best ROI: 1 fetch = all MN counties

### OR — `oregon.gov/boli/prevailing-wage`
- BOLI publishes per-county rate pages
- URL pattern: `https://www.oregon.gov/boli/prevailing-wage/Pages/County-{COUNTY}.aspx`
- HTML tables with trade, base rate, fringe breakdown
- 36 counties; rates update annually

### CO — `cdle.colorado.gov/prevailing-wage`
- CDLE publishes annual determination Excel
- Endpoint: `https://cdle.colorado.gov/sites/cdle/files/documents/2026_Prevailing_Wage_Determination.xlsx`
- Structured data, 64 counties, journey level rates

---

## Stub Scripts

Three stub seed scripts are written to `scripts/`:
1. `scripts/seed-mn-rates.mts` — MN DLI Excel/CSV bulk fetch (highest ROI)
2. `scripts/seed-il-rates.mts` — IL IDOL HTML index + PDF link pattern
3. `scripts/seed-or-rates.mts` — OR BOLI per-county HTML scraper

See those files for URL patterns and fetch approaches.
