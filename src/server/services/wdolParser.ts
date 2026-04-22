// src/server/services/wdolParser.ts
// Extracts trade classifications from the plain-text WD document field.
//
// DBA WD documents use two main formats:
//
// CA (and most states) format — leading spaces, dot-fill, dollar sign:
//   "   Carpenter..................$ 49.58            25.27"
//
// TX format — no leading indent, dots, dollar sign, optional ** (federal min wage marker):
//   "CARPENTER........................$  7.25 **"
//   "BOILERMAKER......................$ 16.35 **         2.315"
//
// Both formats use dots (.) as the fill character between description and rate.
// Validated against CA20250001.txt (93 matches) and TX20250001.txt (16 matches).

export interface ParsedClassification {
  code: string;          // Uppercase slug, max 20 chars, e.g. "CARPENTER"
  description: string;   // Human readable, e.g. "Carpenter"
  baseRate: number;      // $/hour as float, e.g. 49.58
  fringeRate: number;    // $/hour as float, e.g. 25.27 (0 if not specified)
  totalRate: number;     // baseRate + fringeRate, rounded to 2 decimal places
}

// Trailing footnote suffix (e.g. `+a+b`, `+a`, ` a`) — WDOL uses this in
// heavy-dredging and some regional WDs to reference footnote sections.
// Does not affect the numeric rate; we strip it.
const FOOTNOTE_SFX = '(?:\\s*\\+?[a-z](?:\\+[a-z])*)?';

// CA-style: 3+ leading spaces, uppercase-starting description, 2+ dots, $ sign, base, 2+ spaces, fringe
const CA_RE = new RegExp(
  `^\\s{3,}([A-Z][A-Za-z0-9 \\-\\/\\(\\),:#]{2,60}?)\\.{2,}\\$\\s*(\\d{2,3}\\.\\d{2})\\s{2,}(\\d{1,3}\\.\\d{2})${FOOTNOTE_SFX}\\s*$`,
  'gm',
);

// TX-style: 0-4 leading spaces, uppercase-starting description, 2+ dots, $ sign, base, optional ** marker, optional fringe
const TX_RE = new RegExp(
  `^([ \\t]{0,4}[A-Z][A-Za-z0-9 \\-\\/\\(\\),:#]{2,60}?)\\.{2,}\\$\\s*(\\d{1,3}\\.\\d{2})\\s+\\*{0,2}\\s*(\\d+\\.\\d+)?${FOOTNOTE_SFX}\\s*$`,
  'gm',
);

// Dredging-style: "     CLASS A1....................$ 47.07        15.34+a+b"
// — baseRate allows 2 digits before decimal, fringe rate always has footnote suffix.
// Separate regex rather than folding into TX_RE because description format differs
// ("CLASS A1" is allowed to be shorter than TX_RE's 2-char minimum).
const DREDGE_RE = new RegExp(
  `^\\s{2,}([A-Z][A-Za-z0-9 \\-\\/\\(\\),:#]{1,60}?)\\.{2,}\\$\\s*(\\d{1,3}\\.\\d{2})\\s+(\\d{1,3}\\.\\d{2})\\+[a-z](?:\\+[a-z])*\\s*$`,
  'gm',
);

function extractMatches(
  text: string,
  re: RegExp,
  seen: Set<string>,
  results: ParsedClassification[]
): void {
  // Create fresh regex instance on every call to avoid lastIndex bleed from the g flag
  const freshRe = new RegExp(re.source, re.flags);
  let match: RegExpExecArray | null;

  while ((match = freshRe.exec(text)) !== null) {
    const description = match[1].trim();
    if (description.length < 3) continue;

    const baseRate = parseFloat(match[2]);
    const fringeRate = match[3] ? parseFloat(match[3]) : 0;

    if (isNaN(baseRate)) continue;

    const code = description
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 20);

    const dedupKey = `${code}:${baseRate}:${fringeRate}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    results.push({
      code,
      description,
      baseRate,
      fringeRate,
      totalRate: parseFloat((baseRate + fringeRate).toFixed(2)),
    });
  }
}

export function parseWdDocument(document: string): ParsedClassification[] {
  if (!document) return [];

  const results: ParsedClassification[] = [];
  const seen = new Set<string>();

  // Run CA-style first (most specific — requires 3+ leading spaces + mandatory fringe)
  extractMatches(document, CA_RE, seen, results);

  // Run TX-style (catches lines without leading spaces that CA_RE misses)
  extractMatches(document, TX_RE, seen, results);

  // Run Dredging-style (lines with footnote-suffixed fringes like "15.34+a+b")
  extractMatches(document, DREDGE_RE, seen, results);

  // Emit warning if parsing found nothing despite a non-trivial document
  if (results.length === 0 && document.length > 500) {
    console.warn(
      '[wdolParser] Zero classifications extracted from %d-byte document. ' +
      'Leading excerpt: %s',
      document.length,
      document.slice(0, 200).replace(/\n/g, ' | '),
    );
  }

  return results;
}
