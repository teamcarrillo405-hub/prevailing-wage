// src/client/components/payrollWizard/useWizardState.ts
import { useReducer } from 'react';
import type { WizardStep } from './types.js';

export interface WizardState {
  step: WizardStep;
  weekId: string | null;
  locked: boolean;
}

export type WizardAction =
  | { type: 'SET_WEEK_ID'; weekId: string }
  | { type: 'ADVANCE' }
  | { type: 'GO_BACK' }
  | { type: 'LOCK' };

export const initialWizardState: WizardState = {
  step: 'roster',
  weekId: null,
  locked: false,
};

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_WEEK_ID':
      return { ...state, weekId: action.weekId };
    case 'ADVANCE': {
      if (state.step === 'roster') {
        if (!state.weekId) throw new Error('weekId required before advancing from roster');
        return { ...state, step: 'hours' };
      }
      if (state.step === 'hours') return { ...state, step: 'review' };
      return state;
    }
    case 'GO_BACK': {
      if (state.step === 'review') return { ...state, step: 'hours' };
      if (state.step === 'hours') return { ...state, step: 'roster' };
      return state;
    }
    case 'LOCK':
      return { ...state, locked: true };
    default:
      return state;
  }
}

export function useWizardState(initialWeekId: string | null = null) {
  const start: WizardState = initialWeekId
    ? { step: 'hours', weekId: initialWeekId, locked: false }
    : initialWizardState;
  return useReducer(wizardReducer, start);
}
