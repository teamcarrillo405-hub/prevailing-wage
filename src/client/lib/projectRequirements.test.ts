import { describe, expect, it } from 'vitest';
import {
  assessProjectJurisdiction,
  deriveJurisdictionKind,
  jurisdictionExplanation,
  requiredFormsForProject,
  setupBlockersForProject,
} from './projectRequirements';

describe('project requirements', () => {
  it('maps federal projects to WH-347 and wage determination blockers', () => {
    const project = {
      state: 'TX',
      contractType: 'federal-davis-bacon',
      fundingType: 'federal',
      awardingAgency: '',
      wdIdentifier: '',
    };

    expect(deriveJurisdictionKind(project)).toBe('federal');
    expect(requiredFormsForProject(project).map((form) => form.id)).toContain('wh347');
    expect(setupBlockersForProject(project)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'awardingAgency', fixTo: '/settings?field=awardingAgency#project-facts' }),
        expect.objectContaining({ field: 'wdIdentifier', fixTo: '#wage-determinations' }),
      ]),
    );
  });

  it('maps California layered projects to federal, state, and local review requirements', () => {
    const project = {
      state: 'CA',
      contractType: 'state-prevailing',
      fundingType: 'mixed',
      awardingAgency: 'City of Oakland',
      contractNumber: '',
      dirProjectId: '',
      wdIdentifier: 'CA20250001',
    };

    expect(deriveJurisdictionKind(project)).toBe('layered');
    expect(jurisdictionExplanation(project)).toMatch(/Mixed funding/);
    expect(requiredFormsForProject(project).map((form) => form.id)).toEqual([
      'wh347',
      'ca-a1131',
      'ca-ecpr',
      'local-review',
    ]);
    expect(setupBlockersForProject(project).map((blocker) => blocker.field)).toEqual([
      'dirProjectId',
      'contractNumber',
    ]);

    const assessment = assessProjectJurisdiction(project);
    expect(assessment.layers).toEqual(['federal', 'state', 'local']);
    expect(assessment.precedence).toMatch(/federal baseline/);
    expect(assessment.wageSourcePrompt).toMatch(/SAM.gov/);
    expect(assessment.exportPackage.map((item) => item.id)).toEqual([
      'federal-cpr-package',
      'ca-package',
      'local-review-package',
    ]);
  });

  it('flags unconfigured local projects for manual ordinance review', () => {
    const project = {
      state: 'WA',
      contractType: 'gsa-schedule',
      fundingType: 'local',
      awardingAgency: 'Port authority',
    };

    expect(deriveJurisdictionKind(project)).toBe('local');
    expect(requiredFormsForProject(project).some((form) => form.status === 'review')).toBe(true);
    expect(assessProjectJurisdiction(project).wageSourcePrompt).toMatch(/local agency ordinance/);
  });
});
