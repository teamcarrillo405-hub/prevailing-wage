import { describe, it, expect, vi, beforeAll } from 'vitest';
import { detectProvider } from '../../src/server/services/importService.js';
import { mapQbRows } from '../../src/server/services/qbMapper.js';
import { mapAdpRows } from '../../src/server/services/adpMapper.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// ── detectProvider ─────────────────────────────────────────────────────────

describe('detectProvider', () => {
  it('returns quickbooks for QB Desktop headers', () => {
    expect(
      detectProvider(['Employee', 'Date', 'Duration', 'Customer:Job', 'Payroll Item']),
    ).toBe('quickbooks');
  });

  it('returns quickbooks for QB Online headers (Employee Name + Hours)', () => {
    expect(
      detectProvider(['Employee Name', 'Date', 'Hours', 'Customer/Project']),
    ).toBe('quickbooks');
  });

  it('returns adp for ADP Run headers', () => {
    expect(
      detectProvider(['Co Code', 'Batch ID', 'File #', 'First Name', 'Last Name', 'Reg Hours', 'O/T Hours']),
    ).toBe('adp');
  });

  it('returns unknown for unrecognized headers', () => {
    expect(detectProvider(['Name', 'Amount', 'Date'])).toBe('unknown');
  });

  it('returns unknown for an empty header array', () => {
    expect(detectProvider([])).toBe('unknown');
  });

  it('is case-insensitive for QB detection', () => {
    // Headers trimmed and lower-cased internally
    expect(detectProvider(['employee', 'date', 'duration'])).toBe('quickbooks');
  });

  it('is case-insensitive for ADP detection', () => {
    expect(detectProvider(['co code', 'file #', 'first name', 'last name'])).toBe('adp');
  });
});

// ── mapQbRows ──────────────────────────────────────────────────────────────

describe('mapQbRows', () => {
  it('aggregates multiple rows for the same employee into correct day buckets', () => {
    const rows = [
      { Employee: 'John Smith', Date: '01/06/2025', Duration: '8.00', 'Payroll Item': 'Regular Pay' },
      { Employee: 'John Smith', Date: '01/07/2025', Duration: '8.00', 'Payroll Item': 'Regular Pay' },
      { Employee: 'John Smith', Date: '01/08/2025', Duration: '4.00', 'Payroll Item': 'Regular Pay' },
    ];
    // 01/06/2025 = Monday (getDay()=1), 01/07/2025 = Tuesday, 01/08/2025 = Wednesday
    const result = mapQbRows(rows, '2025-01-12');
    const entry = result.entries.get('john smith');
    expect(entry).toBeDefined();
    expect(entry!.monSt).toBe(8);
    expect(entry!.tueSt).toBe(8);
    expect(entry!.wedSt).toBe(4);
    expect(entry!.thuSt).toBe(0);
    expect(entry!.friSt).toBe(0);
  });

  it('maps "Overtime Pay" payroll item to OT bucket', () => {
    const rows = [
      { Employee: 'Jane Doe', Date: '01/06/2025', Duration: '2.00', 'Payroll Item': 'Overtime Pay' },
    ];
    const result = mapQbRows(rows, '2025-01-12');
    const entry = result.entries.get('jane doe');
    expect(entry).toBeDefined();
    expect(entry!.monOt).toBe(2);
    expect(entry!.monSt).toBe(0);
  });

  it('maps "OT" payroll item to OT bucket', () => {
    const rows = [
      { Employee: 'Test Worker', Date: '01/07/2025', Duration: '3.00', 'Payroll Item': 'OT' },
    ];
    const result = mapQbRows(rows, '2025-01-12');
    const entry = result.entries.get('test worker');
    expect(entry!.tueOt).toBe(3);
    expect(entry!.tueSt).toBe(0);
  });

  it('parses date 01/06/2025 (Monday) correctly to monSt', () => {
    // Explicit test that manual MM/DD/YYYY parse maps to Monday
    const rows = [
      { Employee: 'Worker A', Date: '01/06/2025', Duration: '8.00', 'Payroll Item': 'Regular Pay' },
    ];
    const result = mapQbRows(rows, '2025-01-12');
    const entry = result.entries.get('worker a');
    expect(entry!.monSt).toBe(8);
    // Confirm no other days got hours
    expect(entry!.tueSt).toBe(0);
    expect(entry!.wedSt).toBe(0);
  });

  it('accumulates hours when same employee has multiple rows on the same day', () => {
    const rows = [
      { Employee: 'John Smith', Date: '01/06/2025', Duration: '6.00', 'Payroll Item': 'Regular Pay' },
      { Employee: 'John Smith', Date: '01/06/2025', Duration: '2.00', 'Payroll Item': 'Regular Pay' },
    ];
    const result = mapQbRows(rows, '2025-01-12');
    const entry = result.entries.get('john smith');
    expect(entry!.monSt).toBe(8);
  });

  it('preserves original case in csvName (uses first occurrence)', () => {
    const rows = [
      { Employee: 'JOHN SMITH', Date: '01/06/2025', Duration: '8.00', 'Payroll Item': 'Regular Pay' },
      { Employee: 'john smith', Date: '01/07/2025', Duration: '8.00', 'Payroll Item': 'Regular Pay' },
    ];
    const result = mapQbRows(rows, '2025-01-12');
    // Both rows map to same key; csvName = first occurrence
    expect(result.entries.get('john smith')!.csvName).toBe('JOHN SMITH');
  });

  it('handles QB Online column variant (Employee Name + Hours)', () => {
    const rows = [
      { 'Employee Name': 'Alice Brown', Date: '01/06/2025', Hours: '7.50', 'Service Item': 'Regular' },
    ];
    const result = mapQbRows(rows, '2025-01-12');
    const entry = result.entries.get('alice brown');
    expect(entry).toBeDefined();
    expect(entry!.monSt).toBe(7.5);
  });

  it('maps double time payroll item to OT bucket', () => {
    const rows = [
      { Employee: 'Worker B', Date: '01/11/2025', Duration: '4.00', 'Payroll Item': 'Double Time' },
    ];
    // 01/11/2025 = Saturday
    const result = mapQbRows(rows, '2025-01-12');
    const entry = result.entries.get('worker b');
    expect(entry!.satOt).toBe(4);
    expect(entry!.satSt).toBe(0);
  });

  it('correctly maps Sunday (getDay()=0) to sunSt', () => {
    const rows = [
      { Employee: 'Sunday Worker', Date: '01/12/2025', Duration: '5.00', 'Payroll Item': 'Regular' },
    ];
    // 01/12/2025 = Sunday
    const result = mapQbRows(rows, '2025-01-12');
    const entry = result.entries.get('sunday worker');
    expect(entry!.sunSt).toBe(5);
  });

  it('matches workers case-insensitively via key', () => {
    const rows = [
      { Employee: 'Maria Garcia', Date: '01/06/2025', Duration: '8.00', 'Payroll Item': 'Regular Pay' },
    ];
    const result = mapQbRows(rows, '2025-01-12');
    // Key is always lowercase
    expect(result.entries.has('maria garcia')).toBe(true);
    expect(result.entries.has('Maria Garcia')).toBe(false);
  });
});

// ── mapAdpRows ─────────────────────────────────────────────────────────────

describe('mapAdpRows', () => {
  it('puts Reg Hours on monSt and O/T Hours on monOt', () => {
    const rows = [
      { 'Co Code': 'ABC', 'File #': '001', 'First Name': 'John', 'Last Name': 'Smith', 'Reg Hours': '40.00', 'O/T Hours': '5.00' },
    ];
    const result = mapAdpRows(rows);
    const entry = result.entries.get('john smith');
    expect(entry).toBeDefined();
    expect(entry!.monSt).toBe(40);
    expect(entry!.monOt).toBe(5);
    // All other days must be 0
    expect(entry!.tueSt).toBe(0);
    expect(entry!.wedSt).toBe(0);
    expect(entry!.thuSt).toBe(0);
    expect(entry!.friSt).toBe(0);
    expect(entry!.satSt).toBe(0);
    expect(entry!.sunSt).toBe(0);
    expect(entry!.tueOt).toBe(0);
  });

  it('always includes adpWeeklyTotalsOnly: true in result', () => {
    const result = mapAdpRows([]);
    expect(result.adpWeeklyTotalsOnly).toBe(true);
  });

  it('concatenates trimmed First Name + Last Name into csvName', () => {
    const rows = [
      { 'Co Code': 'ABC', 'File #': '001', 'First Name': '  John  ', 'Last Name': '  Smith  ', 'Reg Hours': '40', 'O/T Hours': '0' },
    ];
    const result = mapAdpRows(rows);
    expect(result.entries.get('john smith')!.csvName).toBe('John Smith');
  });

  it('sums hours for duplicate employee rows (same name appears twice)', () => {
    const rows = [
      { 'Co Code': 'ABC', 'File #': '001', 'First Name': 'John', 'Last Name': 'Smith', 'Reg Hours': '20', 'O/T Hours': '2' },
      { 'Co Code': 'ABC', 'File #': '001', 'First Name': 'John', 'Last Name': 'Smith', 'Reg Hours': '20', 'O/T Hours': '3' },
    ];
    const result = mapAdpRows(rows);
    const entry = result.entries.get('john smith');
    expect(entry!.monSt).toBe(40);
    expect(entry!.monOt).toBe(5);
  });

  it('handles multiple different employees in same file', () => {
    const rows = [
      { 'Co Code': 'ABC', 'File #': '001', 'First Name': 'John', 'Last Name': 'Smith', 'Reg Hours': '40', 'O/T Hours': '0' },
      { 'Co Code': 'ABC', 'File #': '002', 'First Name': 'Jane', 'Last Name': 'Doe', 'Reg Hours': '35', 'O/T Hours': '0' },
    ];
    const result = mapAdpRows(rows);
    expect(result.entries.size).toBe(2);
    expect(result.entries.get('john smith')!.monSt).toBe(40);
    expect(result.entries.get('jane doe')!.monSt).toBe(35);
  });

  it('keys entry by lowercase name for case-insensitive matching', () => {
    const rows = [
      { 'Co Code': 'ABC', 'File #': '001', 'First Name': 'CARLOS', 'Last Name': 'MENDEZ', 'Reg Hours': '40', 'O/T Hours': '0' },
    ];
    const result = mapAdpRows(rows);
    expect(result.entries.has('carlos mendez')).toBe(true);
  });

  it('treats missing O/T Hours as 0', () => {
    const rows = [
      { 'Co Code': 'ABC', 'File #': '001', 'First Name': 'Bob', 'Last Name': 'Jones', 'Reg Hours': '32', 'O/T Hours': '' },
    ];
    const result = mapAdpRows(rows);
    const entry = result.entries.get('bob jones');
    expect(entry!.monOt).toBe(0);
    expect(entry!.monSt).toBe(32);
  });
});
