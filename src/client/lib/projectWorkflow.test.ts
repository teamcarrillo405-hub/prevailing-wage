import { describe, expect, it } from 'vitest';
import { buildProjectWorkflowState } from './projectWorkflow';

describe('project workflow state', () => {
  it('prioritizes wage lock before workers and payroll', () => {
    const state = buildProjectWorkflowState({
      projectId: 'p1',
      hasProject: true,
      hasPrimaryWageDetermination: false,
      workerCount: 0,
      weeks: [],
      violationCount: 0,
      openCprItems: 0,
    });

    expect(state.primaryAction).toEqual(expect.objectContaining({
      key: 'wage-rates',
      to: '/projects/p1#wage-determinations',
      priority: 'Required',
    }));
    expect(state.readinessStatus).toBe('blocked');
  });

  it('sends users to the open payroll week after setup is complete', () => {
    const state = buildProjectWorkflowState({
      projectId: 'p1',
      hasProject: true,
      hasPrimaryWageDetermination: true,
      workerCount: 5,
      weeks: [{ id: 'w1', submittedAt: null, weekEndingDate: '2026-05-02', payrollNumber: 1 }],
      violationCount: 0,
      openCprItems: 0,
    });

    expect(state.primaryAction).toEqual(expect.objectContaining({
      key: 'payroll-week',
      to: '/projects/p1/payroll/w1',
    }));
    expect(state.steps.find((step) => step.key === 'payroll')).toEqual(expect.objectContaining({
      to: '/projects/p1/payroll/w1',
      status: 'warning',
    }));
  });
});
