import { describe, it, expect } from 'vitest';
import { assertProjectAccess } from '../../src/server/utils/assertProjectAccess.js';

describe('assertProjectAccess', () => {
  it('is a function', () => {
    expect(typeof assertProjectAccess).toBe('function');
  });
});
