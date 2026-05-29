import { describe, it, expect } from 'vitest';
import { STATE_COMPLIANCE_RULES } from '../../src/server/services/complianceService.js';

describe('STATE_COMPLIANCE_RULES dispatch table', () => {
  it('has CA with daily OT + DT thresholds', () => {
    const ca = STATE_COMPLIANCE_RULES['CA'];
    expect(ca.dailyStLimit).toBe(8);
    expect(ca.dailyOtCeiling).toBe(12);
    expect(ca.dailyDtEnabled).toBe(true);
  });

  it('has NY with daily OT threshold, no DT', () => {
    const ny = STATE_COMPLIANCE_RULES['NY'];
    expect(ny.dailyStLimit).toBe(8);
    expect(ny.dailyDtEnabled).toBeFalsy();
  });

  it('has AK with daily OT threshold and 1:3 apprentice ratio', () => {
    const ak = STATE_COMPLIANCE_RULES['AK'];
    expect(ak.dailyStLimit).toBe(8);
    expect(ak.maxApprenticeRatio).toBeCloseTo(0.33, 1);
  });

  it('has HI with daily OT and 1:5 apprentice ratio', () => {
    const hi = STATE_COMPLIANCE_RULES['HI'];
    expect(hi.dailyStLimit).toBe(8);
    expect(hi.maxApprenticeRatio).toBe(0.2);
  });

  it('has NV with daily OT threshold', () => {
    expect(STATE_COMPLIANCE_RULES['NV'].dailyStLimit).toBe(8);
  });

  it('has OR with daily OT threshold', () => {
    expect(STATE_COMPLIANCE_RULES['OR'].dailyStLimit).toBe(8);
  });

  it('has WA with daily OT threshold', () => {
    expect(STATE_COMPLIANCE_RULES['WA'].dailyStLimit).toBe(8);
  });

  it('has MT with no daily threshold (weekly OT only)', () => {
    const mt = STATE_COMPLIANCE_RULES['MT'];
    expect(mt.dailyStLimit).toBeUndefined();
    expect(mt.dailyDtEnabled).toBeUndefined();
  });

  it('has IL with no daily threshold', () => {
    expect(STATE_COMPLIANCE_RULES['IL'].dailyStLimit).toBeUndefined();
  });

  it('has CO with 1:4 apprentice ratio (tighter than federal)', () => {
    expect(STATE_COMPLIANCE_RULES['CO'].maxApprenticeRatio).toBe(0.25);
  });

  it('covers all major prevailing wage states', () => {
    const majorStates = ['CA', 'NY', 'IL', 'WA', 'PA', 'OH', 'MA', 'NJ', 'MN', 'VA', 'CO', 'AK', 'HI', 'NV', 'OR', 'MT'];
    for (const state of majorStates) {
      expect(STATE_COMPLIANCE_RULES[state], `${state} should be in dispatch table`).toBeDefined();
      expect(STATE_COMPLIANCE_RULES[state].label).toBeTruthy();
    }
  });

  it('all entries have a human-readable label', () => {
    for (const [state, rules] of Object.entries(STATE_COMPLIANCE_RULES)) {
      expect(rules.label, `${state} should have a label`).toBeTruthy();
    }
  });
});
