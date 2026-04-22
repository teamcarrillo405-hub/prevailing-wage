import { describe, it, expect } from 'vitest';
import { parsePastedHours } from '../../../src/client/components/payrollWizard/pasteParser.js';

describe('parsePastedHours', () => {
  it('parses a 1x1 single cell', () => {
    expect(parsePastedHours('8')).toEqual([[8]]);
  });

  it('parses a 1x7 Mon-Sun row', () => {
    expect(parsePastedHours('8\t8\t8\t8\t8\t0\t0')).toEqual([[8, 8, 8, 8, 8, 0, 0]]);
  });

  it('parses a 2x3 block', () => {
    expect(parsePastedHours('8\t8\t8\n8\t8\t4')).toEqual([[8, 8, 8], [8, 8, 4]]);
  });

  it('coerces empty cells to 0', () => {
    expect(parsePastedHours('8\t\t4')).toEqual([[8, 0, 4]]);
  });

  it('strips trailing blank lines (Excel quirk)', () => {
    expect(parsePastedHours('8\t8\n\n')).toEqual([[8, 8]]);
  });

  it('returns null for non-numeric content (fall back to default paste)', () => {
    expect(parsePastedHours('not a number')).toBeNull();
  });

  it('returns null for ragged rows (inconsistent column count)', () => {
    expect(parsePastedHours('8\t8\n8\t8\t8')).toBeNull();
  });
});
