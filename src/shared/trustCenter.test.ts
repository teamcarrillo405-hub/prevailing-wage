import { describe, expect, it } from 'vitest';
import { TRUST_CONTROLS, summarizeTrustControls } from './trustCenter';

describe('trust center controls', () => {
  it('keeps public trust posture explicit and evidence-oriented', () => {
    expect(TRUST_CONTROLS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'tenant-rbac', status: 'implemented' }),
        expect.objectContaining({ id: 'audit-integrity', status: 'implemented' }),
        expect.objectContaining({ id: 'backup-restore', status: 'needs-evidence' }),
        expect.objectContaining({ id: 'soc2', status: 'planned' }),
      ]),
    );

    for (const control of TRUST_CONTROLS) {
      expect(control.evidence.length).toBeGreaterThan(20);
      expect(control.buyerProof.length).toBeGreaterThan(20);
    }
  });

  it('calculates readiness without treating planned controls as complete', () => {
    const summary = summarizeTrustControls(TRUST_CONTROLS);

    expect(summary.readinessPercent).toBeGreaterThan(60);
    expect(summary.readinessPercent).toBeLessThan(100);
    expect(summary.counts.implemented).toBeGreaterThan(0);
    expect(summary.openItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'mfa', status: 'action-needed' }),
        expect.objectContaining({ id: 'soc2', status: 'planned' }),
      ]),
    );
  });
});
