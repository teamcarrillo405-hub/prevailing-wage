import { describe, it, expect } from 'vitest';
import { DirtySet } from '../../../src/client/components/payrollWizard/dirtySet.js';

describe('DirtySet', () => {
  it('has() is false for unknown keys', () => {
    const s = new DirtySet();
    expect(s.has('w-1', 'c-1')).toBe(false);
  });

  it('add() then has() returns true', () => {
    const s = new DirtySet();
    s.add('w-1', 'c-1');
    expect(s.has('w-1', 'c-1')).toBe(true);
  });

  it('drain() returns all entries and clears', () => {
    const s = new DirtySet();
    s.add('w-1', 'c-1');
    s.add('w-2', 'c-2');
    const out = s.drain();
    expect(out).toHaveLength(2);
    expect(out).toContainEqual({ workerId: 'w-1', classificationId: 'c-1' });
    expect(out).toContainEqual({ workerId: 'w-2', classificationId: 'c-2' });
    expect(s.size()).toBe(0);
  });

  it('add() is idempotent — duplicate adds do not double-count', () => {
    const s = new DirtySet();
    s.add('w-1', 'c-1');
    s.add('w-1', 'c-1');
    expect(s.size()).toBe(1);
  });
});
