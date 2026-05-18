import { describe, expect, it } from 'vitest';
import { getStateSupport, STATE_SUPPORT, validateStateProjectField } from '../../src/shared/stateSupport.js';

describe('state support launch posture', () => {
  it('keeps California as the only production-pilot state', () => {
    const productionPilotStates = STATE_SUPPORT
      .filter((state) => state.status === 'production_pilot')
      .map((state) => state.state);

    expect(productionPilotStates).toEqual(['CA']);
    expect(getStateSupport('CA').supportedExports).toEqual(
      expect.arrayContaining(['A-1-131 PDF', 'CA eCPR XML', 'WH-347 PDF']),
    );
  });

  it('keeps unvalidated states out of customer-ready posture', () => {
    expect(getStateSupport('MN').status).toBe('internal_validation');
    expect(getStateSupport('VA').status).toBe('internal_validation');
    // OR now has an internal_validation generator (OR BOLI CPR)
    expect(getStateSupport('OR').status).toBe('internal_validation');
    // States still fully not_supported use WH-347 only (e.g. FL, GA)
    expect(getStateSupport('FL').status).toBe('not_supported');
    expect(getStateSupport('FL').supportedExports).toEqual(expect.arrayContaining(['WH-347 PDF']));
  });

  it('requires California eCPR project identifiers before export', () => {
    expect(validateStateProjectField('CA', 'contractorFein', '')).toBe('Contractor FEIN is required.');
    expect(validateStateProjectField('CA', 'contractorFein', '12-345')).toBe('Contractor FEIN must be exactly 9 digits.');
    expect(validateStateProjectField('CA', 'contractorFein', '12-3456789')).toBeNull();
    expect(validateStateProjectField('CA', 'dirProjectId', '')).toBe('DIR project ID is required.');
  });
});
