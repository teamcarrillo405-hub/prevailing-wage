// src/client/components/payrollWizard/pasteParser.ts
// Parse clipboard text into a 2D numeric grid if it looks spreadsheet-shaped.
// Returns null if content is non-numeric or ragged — caller falls back to default paste behavior.

export function parsePastedHours(raw: string): number[][] | null {
  const trimmed = raw.replace(/\r/g, '').replace(/\n+$/, '');
  if (trimmed.length === 0) return null;

  const lines = trimmed.split('\n');
  const grid: number[][] = [];
  let cols = -1;

  for (const line of lines) {
    const cells = line.split('\t').map((cell) => {
      const s = cell.trim();
      if (s === '') return 0;
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    });
    if (cells.some((n) => Number.isNaN(n))) return null;
    if (cols === -1) cols = cells.length;
    else if (cells.length !== cols) return null;
    grid.push(cells);
  }

  return grid;
}
