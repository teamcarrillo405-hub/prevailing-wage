import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCprStatus, STATUS_BADGE } from '../../src/client/lib/cprStatus';
import type { CprWeek } from '../../src/client/lib/cprStatus';

// Helper: format a Date to YYYY-MM-DD
function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Helper: build a minimal CprWeek with the given fields
function makeWeek(overrides: Partial<CprWeek>): CprWeek {
  return {
    id: 'test-id',
    subcontractorId: 'sub-id',
    weekEndingDate: toYMD(new Date()),
    receivedDate: null,
    isCompliant: null,
    notes: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('getCprStatus', () => {
  // Fix system time to a known date: 2026-03-01 (local time)
  const NOW = new Date('2026-03-15T12:00:00');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when receivedDate is null (not received)', () => {
    it('returns overdue when weekEndingDate is more than 7 days ago', () => {
      // 8 days ago → overdue
      const eightDaysAgo = new Date(NOW);
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      const week = makeWeek({ weekEndingDate: toYMD(eightDaysAgo), receivedDate: null });
      expect(getCprStatus(week)).toBe('overdue');
    });

    it('returns not-received when weekEndingDate is exactly 7 days ago', () => {
      // 7 days ago → not-received (boundary: inclusive)
      const sevenDaysAgo = new Date(NOW);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const week = makeWeek({ weekEndingDate: toYMD(sevenDaysAgo), receivedDate: null });
      expect(getCprStatus(week)).toBe('not-received');
    });

    it('returns not-received when weekEndingDate is today', () => {
      const week = makeWeek({ weekEndingDate: toYMD(NOW), receivedDate: null });
      expect(getCprStatus(week)).toBe('not-received');
    });

    it('returns not-received when weekEndingDate is in the future', () => {
      const tomorrow = new Date(NOW);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const week = makeWeek({ weekEndingDate: toYMD(tomorrow), receivedDate: null });
      expect(getCprStatus(week)).toBe('not-received');
    });
  });

  describe('when receivedDate is set', () => {
    it('returns received-compliant when isCompliant === 1 (strict equality)', () => {
      const week = makeWeek({
        weekEndingDate: toYMD(NOW),
        receivedDate: '2026-03-14',
        isCompliant: 1,
      });
      expect(getCprStatus(week)).toBe('received-compliant');
    });

    it('returns received-non-compliant when isCompliant === 0', () => {
      const week = makeWeek({
        weekEndingDate: toYMD(NOW),
        receivedDate: '2026-03-14',
        isCompliant: 0,
      });
      expect(getCprStatus(week)).toBe('received-non-compliant');
    });

    it('returns received-non-compliant when isCompliant === null (unassessed)', () => {
      const week = makeWeek({
        weekEndingDate: toYMD(NOW),
        receivedDate: '2026-03-14',
        isCompliant: null,
      });
      expect(getCprStatus(week)).toBe('received-non-compliant');
    });

    it('does NOT treat isCompliant === 0 as falsy (three-state check)', () => {
      // isCompliant 0 must produce non-compliant, not compliant
      const week = makeWeek({
        weekEndingDate: toYMD(NOW),
        receivedDate: '2026-03-14',
        isCompliant: 0,
      });
      expect(getCprStatus(week)).not.toBe('received-compliant');
    });
  });

  describe('overdue boundary at exactly 7 vs 8 days', () => {
    it('exactly 8 days ago is overdue', () => {
      const d = new Date(NOW);
      d.setDate(d.getDate() - 8);
      const week = makeWeek({ weekEndingDate: toYMD(d), receivedDate: null });
      expect(getCprStatus(week)).toBe('overdue');
    });

    it('exactly 7 days ago is not-received (not overdue)', () => {
      const d = new Date(NOW);
      d.setDate(d.getDate() - 7);
      const week = makeWeek({ weekEndingDate: toYMD(d), receivedDate: null });
      expect(getCprStatus(week)).toBe('not-received');
    });
  });
});

describe('STATUS_BADGE', () => {
  it('maps received-compliant to variant compliant and correct label', () => {
    expect(STATUS_BADGE['received-compliant']).toEqual({
      variant: 'compliant',
      label: 'Received \u2014 Compliant',
    });
  });

  it('maps received-non-compliant to variant violation and correct label', () => {
    expect(STATUS_BADGE['received-non-compliant']).toEqual({
      variant: 'violation',
      label: 'Received \u2014 Non-Compliant',
    });
  });

  it('maps not-received to variant neutral and correct label', () => {
    expect(STATUS_BADGE['not-received']).toEqual({
      variant: 'neutral',
      label: 'Not Received',
    });
  });

  it('maps overdue to variant warning and correct label', () => {
    expect(STATUS_BADGE['overdue']).toEqual({
      variant: 'warning',
      label: 'Overdue',
    });
  });
});
