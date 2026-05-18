import { describe, expect, it } from 'vitest';
import { getTimeEvidenceState } from '../../src/client/lib/timeEvidence';

const createdAt = '2026-05-16T15:00:00.000Z';

describe('getTimeEvidenceState', () => {
  it('labels worker-entered GPS punches as captured field evidence', () => {
    expect(
      getTimeEvidenceState({
        punchedAt: createdAt,
        createdAt,
        latitude: 34.05,
        longitude: -118.25,
        accuracyMeters: 18.4,
      }),
    ).toEqual(
      expect.objectContaining({
        source: 'field_gps',
        sourceLabel: 'Worker-entered GPS',
        reviewStatus: 'captured',
      }),
    );
  });

  it('labels worker-entered punches without GPS as needing review', () => {
    expect(
      getTimeEvidenceState({
        punchedAt: createdAt,
        createdAt,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
      }),
    ).toEqual(
      expect.objectContaining({
        source: 'field_no_gps',
        reviewStatus: 'needs_review',
      }),
    );
  });

  it('labels after-the-fact no-GPS punches as admin-entered', () => {
    expect(
      getTimeEvidenceState({
        punchedAt: '2026-05-16T08:00:00.000Z',
        createdAt,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
      }),
    ).toEqual(
      expect.objectContaining({
        source: 'admin_entered',
        sourceLabel: 'Admin-entered missed punch',
        reviewStatus: 'needs_review',
      }),
    );
  });

  it('labels adjusted GPS punches as admin-corrected while preserving field evidence', () => {
    expect(
      getTimeEvidenceState({
        punchedAt: '2026-05-16T08:00:00.000Z',
        createdAt,
        latitude: 34.05,
        longitude: -118.25,
        accuracyMeters: 24,
      }),
    ).toEqual(
      expect.objectContaining({
        source: 'admin_corrected',
        sourceLabel: 'Admin-corrected time',
        reviewStatus: 'needs_review',
      }),
    );
  });
});
