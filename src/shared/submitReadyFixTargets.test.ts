import { describe, expect, it } from 'vitest';
import { buildSubmitReadyFixHref, getSubmitReadyFixTarget } from './submitReadyFixTargets';

describe('submit-ready fix targets', () => {
  it('maps known submit-ready issues to actionable instructions', () => {
    const issueIds = [
      'wd-lock',
      'payroll-entries',
      'pay-calculation',
      'rate-snapshots',
      'compliance-review',
      'human-certification-review',
      'signature',
      'subcontractor-cpr',
      'import-review',
      'export-readiness',
    ];

    for (const issueId of issueIds) {
      const target = getSubmitReadyFixTarget(issueId);
      expect(target.label.length).toBeGreaterThan(8);
      expect(target.instruction.length).toBeGreaterThan(25);
      expect(['payroll-week', 'project', 'settings']).toContain(target.routeScope);
    }
  });

  it('builds project and week hrefs with exact anchors', () => {
    expect(buildSubmitReadyFixHref('signature', { projectId: 'p1', weekId: 'w1' }))
      .toBe('/projects/p1#contractor-signature');
    expect(buildSubmitReadyFixHref('import-review', { projectId: 'p1', weekId: 'w1' }))
      .toBe('/projects/p1/payroll/w1#import-reconciliation');
  });
});
