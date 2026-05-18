export type TimeEvidenceSource = 'field_gps' | 'field_no_gps' | 'admin_entered' | 'admin_corrected';
export type TimeEvidenceReviewStatus = 'captured' | 'needs_review';

export interface TimeEvidenceInput {
  punchedAt: string;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
}

export interface TimeEvidenceState {
  source: TimeEvidenceSource;
  sourceLabel: string;
  reviewStatus: TimeEvidenceReviewStatus;
  reviewLabel: string;
  detail: string;
}

const ADMIN_TIME_DIFF_MS = 2 * 60 * 1000;

export function getTimeEvidenceState(punch: TimeEvidenceInput): TimeEvidenceState {
  const punchedAt = new Date(punch.punchedAt).getTime();
  const createdAt = new Date(punch.createdAt).getTime();
  const hasGps = punch.latitude != null && punch.longitude != null;
  const timeWasAdjusted =
    Number.isFinite(punchedAt) &&
    Number.isFinite(createdAt) &&
    Math.abs(createdAt - punchedAt) > ADMIN_TIME_DIFF_MS;

  if (timeWasAdjusted && hasGps) {
    return {
      source: 'admin_corrected',
      sourceLabel: 'Admin-corrected time',
      reviewStatus: 'needs_review',
      reviewLabel: 'Needs supervisor review',
      detail: 'Original field location remains attached; punch time was adjusted by an admin.',
    };
  }

  if (timeWasAdjusted) {
    return {
      source: 'admin_entered',
      sourceLabel: 'Admin-entered missed punch',
      reviewStatus: 'needs_review',
      reviewLabel: 'Needs supervisor review',
      detail: 'Entered after the fact without GPS coordinates.',
    };
  }

  if (hasGps) {
    return {
      source: 'field_gps',
      sourceLabel: 'Worker-entered GPS',
      reviewStatus: 'captured',
      reviewLabel: 'Field evidence captured',
      detail:
        punch.accuracyMeters == null
          ? 'Worker-entered punch includes location coordinates.'
          : `Worker-entered punch includes GPS accuracy of ${Math.round(punch.accuracyMeters)}m.`,
    };
  }

  return {
    source: 'field_no_gps',
    sourceLabel: 'Worker-entered no GPS',
    reviewStatus: 'needs_review',
    reviewLabel: 'Needs supervisor review',
    detail: 'Worker-entered punch was accepted without location evidence.',
  };
}
