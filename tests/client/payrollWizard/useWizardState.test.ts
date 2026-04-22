import { describe, it, expect } from 'vitest';
import { wizardReducer, initialWizardState } from '../../../src/client/components/payrollWizard/useWizardState.js';

describe('wizardReducer', () => {
  it('starts at roster step with no weekId', () => {
    expect(initialWizardState.step).toBe('roster');
    expect(initialWizardState.weekId).toBeNull();
  });

  it('advances from roster to hours when SET_WEEK_ID then ADVANCE', () => {
    const s1 = wizardReducer(initialWizardState, { type: 'SET_WEEK_ID', weekId: 'w-1' });
    expect(s1.weekId).toBe('w-1');
    const s2 = wizardReducer(s1, { type: 'ADVANCE' });
    expect(s2.step).toBe('hours');
  });

  it('refuses ADVANCE from roster without weekId', () => {
    expect(() => wizardReducer(initialWizardState, { type: 'ADVANCE' })).toThrow(/weekId required/);
  });

  it('advances hours -> review and back', () => {
    const s = { ...initialWizardState, step: 'hours' as const, weekId: 'w-1' };
    const forward = wizardReducer(s, { type: 'ADVANCE' });
    expect(forward.step).toBe('review');
    const back = wizardReducer(forward, { type: 'GO_BACK' });
    expect(back.step).toBe('hours');
  });

  it('LOCK sets locked=true and preserves step', () => {
    const s = wizardReducer({ ...initialWizardState, step: 'hours' as const, weekId: 'w-1' }, { type: 'LOCK' });
    expect(s.locked).toBe(true);
    expect(s.step).toBe('hours');
  });
});
