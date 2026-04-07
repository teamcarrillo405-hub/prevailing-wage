// tests/services/paychexMapper.test.ts
// TDD tests for paychexMapper — written before implementation (red phase).

import { describe, it, expect } from 'vitest';
import { mapPaychexRows } from '../../src/server/services/paychexMapper.js';

// ── mapPaychexRows ──────────────────────────────────────────────────────────

describe('mapPaychexRows', () => {
  // Helper: build a minimal valid Paychex row
  function paychexRow(overrides: Record<string, string> = {}): Record<string, string> {
    return {
      'Worker ID': 'W001',
      'Pay Component': 'Regular',
      'Hours': '8',
      'Line Date': '01/06/2025', // Monday
      ...overrides,
    };
  }

  it('aggregates ST hours into monSt for a Monday row', () => {
    const rows = [paychexRow()];
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    expect(entry).toBeDefined();
    expect(entry!.providerWorkerId).toBe('W001');
    expect(entry!.monSt).toBe(8);
  });

  it('aggregates OT hours into correct day bucket for Overtime rows', () => {
    // 01/07/2025 = Tuesday
    const rows = [paychexRow({ 'Pay Component': 'Overtime', 'Hours': '2', 'Line Date': '01/07/2025' })];
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    expect(entry).toBeDefined();
    expect(entry!.tueOt).toBe(2);
    expect(entry!.tueSt).toBe(0);
  });

  it('silently skips unknown Pay Component (Bonus) — no error thrown', () => {
    const rows = [
      paychexRow({ 'Pay Component': 'Bonus', 'Hours': '500' }),
      paychexRow({ 'Hours': '8' }),
    ];
    expect(() => mapPaychexRows(rows)).not.toThrow();
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    // Only regular row contributes; bonus is silently skipped
    expect(entry!.monSt).toBe(8);
  });

  it('aggregates multiple rows for the same Worker ID across days', () => {
    const rows = [
      paychexRow({ 'Line Date': '01/06/2025', 'Hours': '8' }),        // Monday
      paychexRow({ 'Line Date': '01/07/2025', 'Hours': '8' }),        // Tuesday
      paychexRow({ 'Line Date': '01/08/2025', 'Hours': '4' }),        // Wednesday
    ];
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    expect(entry).toBeDefined();
    expect(entry!.monSt).toBe(8);
    expect(entry!.tueSt).toBe(8);
    expect(entry!.wedSt).toBe(4);
    expect(entry!.thuSt).toBe(0);
  });

  it('Pay Component matching is case-insensitive ("regular" == "Regular")', () => {
    const rows = [
      paychexRow({ 'Pay Component': 'regular', 'Hours': '7' }),
      paychexRow({ 'Pay Component': 'REGULAR', 'Line Date': '01/07/2025', 'Hours': '5' }),
    ];
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    expect(entry!.monSt).toBe(7);
    expect(entry!.tueSt).toBe(5);
  });

  it('Pay Component "overtime" case-insensitive routes to OT bucket', () => {
    const rows = [paychexRow({ 'Pay Component': 'OVERTIME', 'Hours': '3' })];
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    expect(entry!.monOt).toBe(3);
    expect(entry!.monSt).toBe(0);
  });

  it('accumulates hours when same worker has multiple rows on the same day', () => {
    const rows = [
      paychexRow({ 'Hours': '6' }),
      paychexRow({ 'Hours': '2' }),
    ];
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    expect(entry!.monSt).toBe(8);
  });

  it('handles multiple different Worker IDs in one file', () => {
    const rows = [
      paychexRow({ 'Worker ID': 'W001', 'Hours': '8' }),
      paychexRow({ 'Worker ID': 'W002', 'Hours': '7.5' }),
    ];
    const result = mapPaychexRows(rows);
    expect(result.entries.size).toBe(2);
    expect(result.entries.get('W001')!.monSt).toBe(8);
    expect(result.entries.get('W002')!.monSt).toBe(7.5);
  });

  it('skips rows with empty Worker ID', () => {
    const rows = [
      paychexRow({ 'Worker ID': '' }),
      paychexRow({ 'Worker ID': 'W002', 'Hours': '8' }),
    ];
    const result = mapPaychexRows(rows);
    expect(result.entries.size).toBe(1);
    expect(result.entries.has('W002')).toBe(true);
  });

  it('parses Line Date 01/06/2025 (Monday) correctly — no new Date(string)', () => {
    // Monday January 6 2025
    const rows = [paychexRow({ 'Line Date': '01/06/2025', 'Hours': '8' })];
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    expect(entry!.monSt).toBe(8);
    expect(entry!.tueSt).toBe(0);
    expect(entry!.wedSt).toBe(0);
  });

  it('correctly places Sunday (01/12/2025) hours in sunSt', () => {
    // January 12 2025 = Sunday
    const rows = [paychexRow({ 'Line Date': '01/12/2025', 'Hours': '5' })];
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    expect(entry!.sunSt).toBe(5);
    expect(entry!.monSt).toBe(0);
  });

  it('correctly places Saturday hours in satSt', () => {
    // January 11 2025 = Saturday
    const rows = [paychexRow({ 'Line Date': '01/11/2025', 'Hours': '4' })];
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    expect(entry!.satSt).toBe(4);
  });

  it('returns paychexWeeklyTotalsOnly: false (Paychex has daily data)', () => {
    const result = mapPaychexRows([paychexRow()]);
    expect(result.paychexWeeklyTotalsOnly).toBe(false);
  });

  it('map is keyed by raw Worker ID string (not lowercased)', () => {
    // Worker ID is numeric/opaque — should not be lowercased
    const rows = [paychexRow({ 'Worker ID': 'W001' })];
    const result = mapPaychexRows(rows);
    expect(result.entries.has('W001')).toBe(true);
    // Should not lower-case
    const entry = result.entries.get('W001');
    expect(entry!.providerWorkerId).toBe('W001');
  });

  it('all ST bucket days are 0 for days with no rows', () => {
    const rows = [paychexRow({ 'Line Date': '01/06/2025', 'Hours': '8' })]; // Monday only
    const result = mapPaychexRows(rows);
    const entry = result.entries.get('W001');
    expect(entry!.tueSt).toBe(0);
    expect(entry!.wedSt).toBe(0);
    expect(entry!.thuSt).toBe(0);
    expect(entry!.friSt).toBe(0);
    expect(entry!.satSt).toBe(0);
    expect(entry!.sunSt).toBe(0);
    expect(entry!.monOt).toBe(0);
  });
});
