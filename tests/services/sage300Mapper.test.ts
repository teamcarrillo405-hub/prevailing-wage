// tests/services/sage300Mapper.test.ts
// TDD tests for sage300Mapper — written before implementation (red phase).

import { describe, it, expect } from 'vitest';
import { isSage300CRE, mapSage300Rows, mapSage100Rows } from '../../src/server/services/sage300Mapper.js';

// ── isSage300CRE ────────────────────────────────────────────────────────────

describe('isSage300CRE', () => {
  // Canonical positional headers (case as they appear in real Sage 300 exports)
  const SAGE_300_HEADERS = ['Employee', 'Date', 'Job', 'Extra', 'Cost Code', 'Category', 'Certified', 'PayID', 'Units'];

  it('returns true for exact Sage 300 CRE positional headers', () => {
    expect(isSage300CRE(SAGE_300_HEADERS)).toBe(true);
  });

  it('returns true when additional columns follow the 9 positional ones', () => {
    expect(isSage300CRE([...SAGE_300_HEADERS, 'Extra Column', 'Another Column'])).toBe(true);
  });

  it('is case-insensitive — lowercase headers still match', () => {
    expect(isSage300CRE(SAGE_300_HEADERS.map((h) => h.toLowerCase()))).toBe(true);
  });

  it('is case-insensitive — uppercase headers still match', () => {
    expect(isSage300CRE(SAGE_300_HEADERS.map((h) => h.toUpperCase()))).toBe(true);
  });

  it('returns false when fewer than 9 columns provided', () => {
    expect(isSage300CRE(SAGE_300_HEADERS.slice(0, 8))).toBe(false);
  });

  it('returns false when columns are in wrong order', () => {
    // Swap Employee and Date
    const wrong = ['Date', 'Employee', 'Job', 'Extra', 'Cost Code', 'Category', 'Certified', 'PayID', 'Units'];
    expect(isSage300CRE(wrong)).toBe(false);
  });

  it('returns false for empty header array', () => {
    expect(isSage300CRE([])).toBe(false);
  });

  it('returns false for QB headers that start with Employee', () => {
    // QB Desktop: ['Employee', 'Date', 'Duration', 'Customer:Job', 'Payroll Item']
    // This starts with 'Employee' but does NOT match Sage 300 positional at index 2 ('Duration' vs 'Job')
    expect(isSage300CRE(['Employee', 'Date', 'Duration', 'Customer:Job', 'Payroll Item'])).toBe(false);
  });

  it('returns false for ADP headers', () => {
    expect(isSage300CRE(['Co Code', 'File #', 'First Name', 'Last Name', 'Reg Hours', 'O/T Hours'])).toBe(false);
  });
});

// ── mapSage300Rows ──────────────────────────────────────────────────────────

describe('mapSage300Rows', () => {
  function sage300Row(overrides: Record<string, string> = {}): Record<string, string> {
    return {
      'Employee': '12345',
      'Date': '01/06/2025', // Monday
      'Job': 'PROJECT-A',
      'Extra': '',
      'Cost Code': '01-100',
      'Category': 'LAB',
      'Certified': 'Y',
      'PayID': 'REG',
      'Units': '8',
      ...overrides,
    };
  }

  it('maps PayID REG to ST bucket for the correct day', () => {
    const rows = [sage300Row()];
    const result = mapSage300Rows(rows);
    const entry = result.entries.get('12345');
    expect(entry).toBeDefined();
    expect(entry!.providerWorkerId).toBe('12345');
    expect(entry!.monSt).toBe(8);
  });

  it('maps PayID OT to OT bucket for the correct day', () => {
    const rows = [sage300Row({ 'PayID': 'OT', 'Units': '2', 'Date': '01/07/2025' })]; // Tuesday
    const result = mapSage300Rows(rows);
    const entry = result.entries.get('12345');
    expect(entry!.tueOt).toBe(2);
    expect(entry!.tueSt).toBe(0);
  });

  it('maps PayID DT (double-time) to OT bucket', () => {
    const rows = [sage300Row({ 'PayID': 'DT', 'Units': '4' })]; // Monday DT
    const result = mapSage300Rows(rows);
    const entry = result.entries.get('12345');
    expect(entry!.monOt).toBe(4);
    expect(entry!.monSt).toBe(0);
  });

  it('PayID matching is case-insensitive', () => {
    const rows = [
      sage300Row({ 'PayID': 'reg', 'Units': '8' }),
    ];
    const result = mapSage300Rows(rows);
    const entry = result.entries.get('12345');
    expect(entry!.monSt).toBe(8);
  });

  it('silently skips unknown PayID (VAC) — no error', () => {
    const rows = [
      sage300Row({ 'PayID': 'VAC', 'Units': '8' }),
      sage300Row({ 'Units': '8' }),
    ];
    expect(() => mapSage300Rows(rows)).not.toThrow();
    const result = mapSage300Rows(rows);
    const entry = result.entries.get('12345');
    // Only the REG row contributes
    expect(entry!.monSt).toBe(8);
  });

  it('aggregates multiple rows for the same Employee across days', () => {
    const rows = [
      sage300Row({ 'Date': '01/06/2025', 'Units': '8' }),  // Monday
      sage300Row({ 'Date': '01/07/2025', 'Units': '8' }),  // Tuesday
      sage300Row({ 'Date': '01/08/2025', 'Units': '4' }),  // Wednesday
    ];
    const result = mapSage300Rows(rows);
    const entry = result.entries.get('12345');
    expect(entry!.monSt).toBe(8);
    expect(entry!.tueSt).toBe(8);
    expect(entry!.wedSt).toBe(4);
  });

  it('handles multiple different Employee IDs', () => {
    const rows = [
      sage300Row({ 'Employee': '11111', 'Units': '8' }),
      sage300Row({ 'Employee': '22222', 'Units': '7.5' }),
    ];
    const result = mapSage300Rows(rows);
    expect(result.entries.size).toBe(2);
    expect(result.entries.get('11111')!.monSt).toBe(8);
    expect(result.entries.get('22222')!.monSt).toBe(7.5);
  });

  it('Employee field is providerWorkerId (numeric string)', () => {
    const rows = [sage300Row({ 'Employee': '98765' })];
    const result = mapSage300Rows(rows);
    const entry = result.entries.get('98765');
    expect(entry).toBeDefined();
    expect(entry!.providerWorkerId).toBe('98765');
  });

  it('correctly places Sunday (01/12/2025) hours in sunSt', () => {
    const rows = [sage300Row({ 'Date': '01/12/2025', 'Units': '5' })];
    const result = mapSage300Rows(rows);
    const entry = result.entries.get('12345');
    expect(entry!.sunSt).toBe(5);
    expect(entry!.monSt).toBe(0);
  });

  it('returns sage300WeeklyTotalsOnly: false (Sage 300 has daily data)', () => {
    const result = mapSage300Rows([sage300Row()]);
    expect(result.sage300WeeklyTotalsOnly).toBe(false);
  });
});

// ── mapSage100Rows ──────────────────────────────────────────────────────────

describe('mapSage100Rows', () => {
  function sage100Row(overrides: Record<string, string> = {}): Record<string, string> {
    return {
      'Employee Name': 'John Smith',
      'Date': '01/06/2025', // Monday
      'Hours': '8',
      'Pay Type': 'Regular',
      ...overrides,
    };
  }

  it('maps Employee Name to csvName (name-based path)', () => {
    const rows = [sage100Row()];
    const result = mapSage100Rows(rows);
    const entry = result.entries.get('john smith');
    expect(entry).toBeDefined();
    expect(entry!.csvName).toBe('John Smith');
  });

  it('keys entries by lowercase employee name for case-insensitive matching', () => {
    const rows = [sage100Row({ 'Employee Name': 'CARLOS MENDEZ' })];
    const result = mapSage100Rows(rows);
    expect(result.entries.has('carlos mendez')).toBe(true);
    expect(result.entries.has('CARLOS MENDEZ')).toBe(false);
  });

  it('aggregates hours for the same employee across rows', () => {
    const rows = [
      sage100Row({ 'Date': '01/06/2025', 'Hours': '8' }),  // Monday
      sage100Row({ 'Date': '01/07/2025', 'Hours': '8' }),  // Tuesday
    ];
    const result = mapSage100Rows(rows);
    const entry = result.entries.get('john smith');
    expect(entry!.monSt).toBe(8);
    expect(entry!.tueSt).toBe(8);
  });

  it('skips rows with empty Employee Name', () => {
    const rows = [
      sage100Row({ 'Employee Name': '' }),
      sage100Row({ 'Employee Name': 'Jane Doe', 'Hours': '7' }),
    ];
    const result = mapSage100Rows(rows);
    expect(result.entries.size).toBe(1);
    expect(result.entries.has('jane doe')).toBe(true);
  });

  it('handles multiple different employees', () => {
    const rows = [
      sage100Row({ 'Employee Name': 'Alice Brown', 'Hours': '40' }),
      sage100Row({ 'Employee Name': 'Carlos Mendez', 'Hours': '35' }),
    ];
    const result = mapSage100Rows(rows);
    expect(result.entries.size).toBe(2);
    expect(result.entries.get('alice brown')!.monSt).toBe(40);
    expect(result.entries.get('carlos mendez')!.monSt).toBe(35);
  });

  it('returns sage100WeeklyTotalsOnly: false', () => {
    const result = mapSage100Rows([sage100Row()]);
    expect(result.sage100WeeklyTotalsOnly).toBe(false);
  });
});
