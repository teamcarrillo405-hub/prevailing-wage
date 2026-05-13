import { describe, expect, it } from 'vitest';
import {
  COMPETITIVE_READINESS,
  readinessCounts,
  readinessScore,
  type CompetitiveReadinessItem,
} from './competitiveReadiness';

describe('competitive readiness model', () => {
  it('keeps every readiness item actionable', () => {
    expect(COMPETITIVE_READINESS.length).toBeGreaterThanOrEqual(6);

    for (const item of COMPETITIVE_READINESS) {
      expect(item.id).toMatch(/^[a-z0-9-]+$/);
      expect(item.category.length).toBeGreaterThan(0);
      expect(item.competitorAdvantage.length).toBeGreaterThan(20);
      expect(item.currentPosition.length).toBeGreaterThan(20);
      expect(item.executionGate.length).toBeGreaterThan(20);
      expect(item.testPlan.length).toBeGreaterThan(20);
      expect(['proven', 'building', 'gap']).toContain(item.status);
    }
  });

  it('calculates counts by status', () => {
    const items: CompetitiveReadinessItem[] = [
      stubItem('one', 'proven'),
      stubItem('two', 'building'),
      stubItem('three', 'building'),
      stubItem('four', 'gap'),
    ];

    expect(readinessCounts(items)).toEqual({ proven: 1, building: 2, gap: 1 });
  });

  it('calculates weighted readiness score', () => {
    const items: CompetitiveReadinessItem[] = [
      stubItem('one', 'proven'),
      stubItem('two', 'building'),
      stubItem('three', 'gap'),
    ];

    expect(readinessScore(items)).toBe(52);
  });
});

function stubItem(id: string, status: CompetitiveReadinessItem['status']): CompetitiveReadinessItem {
  return {
    id,
    category: 'Test',
    competitorAdvantage: 'Competitor advantage description for test.',
    currentPosition: 'Current position description for test.',
    executionGate: 'Execution gate description for test.',
    testPlan: 'Test plan description for test.',
    status,
  };
}
