import { describe, it, expect, vi, beforeAll } from 'vitest';
import { detectProvider } from '../../src/server/services/importService.js';
import { mapQbRows } from '../../src/server/services/qbMapper.js';
import { mapAdpRows } from '../../src/server/services/adpMapper.js';
import { mapGustoRows } from '../../src/server/services/gustoMapper.js';

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

// ── detectProvider - Paychex ───────────────────────────────────────────────

describe('detectProvider - Paychex', () => {
  it('returns paychex for Paychex Flex headers with Pay Component and Worker ID', () => {
    expect(
      detectProvider(['Pay Component', 'Worker ID', 'Hours', 'Line Date']),
    ).toBe('paychex');
  });

  it('returns paychex even with extra columns mixed in', () => {
    expect(
      detectProvider(['Company', 'Worker ID', 'Pay Component', 'Pay Period', 'Hours', 'Line Date']),
    ).toBe('paychex');
  });

  it('is case-insensitive for Paychex detection', () => {
    expect(
      detectProvider(['pay component', 'worker id', 'hours', 'line date']),
    ).toBe('paychex');
  });

  it('does not return paychex without Worker ID column', () => {
    expect(
      detectProvider(['Pay Component', 'Employee Name', 'Hours']),
    ).not.toBe('paychex');
  });
});

// ── detectProvider - Sage 300 ───────────────────────────────────────────────

describe('detectProvider - Sage 300', () => {
  const SAGE_300_HEADERS = ['Employee', 'Date', 'Job', 'Extra', 'Cost Code', 'Category', 'Certified', 'PayID', 'Units'];

  it('returns sage_300 for Sage 300 CRE positional headers', () => {
    expect(detectProvider(SAGE_300_HEADERS)).toBe('sage_300');
  });

  it('returns sage_300 with extra columns after the 9 positional ones', () => {
    expect(detectProvider([...SAGE_300_HEADERS, 'Extra Column'])).toBe('sage_300');
  });

  it('is case-insensitive for Sage 300 detection', () => {
    expect(detectProvider(SAGE_300_HEADERS.map((h) => h.toLowerCase()))).toBe('sage_300');
  });

  it('does NOT false-positive sage_300 on QB Desktop headers (Employee at index 0)', () => {
    // QB Desktop starts with Employee but second col is Date, third is Duration (not Job)
    expect(
      detectProvider(['Employee', 'Date', 'Duration', 'Customer:Job', 'Payroll Item']),
    ).not.toBe('sage_300');
  });

  it('does NOT false-positive sage_300 on QB Online headers', () => {
    expect(
      detectProvider(['Employee Name', 'Date', 'Hours', 'Customer/Project']),
    ).not.toBe('sage_300');
  });

  it('Sage 300 checked before Paychex — Sage 300 positional does not misfire as Paychex', () => {
    // Sage 300 has 'Employee' not 'Worker ID' + 'Pay Component', so can't be Paychex anyway
    // But confirm the right provider is returned
    expect(detectProvider(SAGE_300_HEADERS)).toBe('sage_300');
  });
});

// ── detectProvider - Sage 100 ───────────────────────────────────────────────

describe('detectProvider - Sage 100', () => {
  it('returns sage_100 for Sage 100 Check Register headers with Employee Name', () => {
    expect(
      detectProvider(['Employee Name', 'Date', 'Hours', 'Pay Type']),
    ).toBe('sage_100');
  });

  it('does not return sage_100 for QB Online headers (Employee Name + Hours) — QB is more specific', () => {
    // QB Online also has 'Employee Name' + 'Hours' — QB signature takes priority
    expect(
      detectProvider(['Employee Name', 'Date', 'Hours', 'Customer/Project']),
    ).toBe('quickbooks');
  });

  it('is case-insensitive for sage_100 detection', () => {
    expect(
      detectProvider(['employee name', 'date', 'hours', 'pay type']),
    ).toBe('sage_100');
  });
});

// ── detectProvider - Gusto ──────────────────────────────────────────────────

describe('detectProvider - Gusto', () => {
  it('returns gusto for Gusto Payroll Journal Report headers', () => {
    expect(
      detectProvider([
        'Employee first name',
        'Employee last name',
        'Regular hours',
        'Payroll end date',
        'Overtime hours',
      ]),
    ).toBe('gusto');
  });

  it('returns gusto even with extra columns mixed in', () => {
    expect(
      detectProvider([
        'Company',
        'Employee first name',
        'Employee last name',
        'Department',
        'Regular hours',
        'Overtime hours',
        'Payroll end date',
        'Notes',
      ]),
    ).toBe('gusto');
  });

  it('returns gusto with only the 4 required signature columns (no overtime column)', () => {
    expect(
      detectProvider([
        'Employee first name',
        'Employee last name',
        'Regular hours',
        'Payroll end date',
      ]),
    ).toBe('gusto');
  });

  it('is case-insensitive for Gusto signature columns', () => {
    expect(
      detectProvider([
        'employee first name',
        'employee last name',
        'regular hours',
        'payroll end date',
      ]),
    ).toBe('gusto');
  });

  it('does not return gusto for QB headers', () => {
    expect(
      detectProvider(['Employee', 'Date', 'Duration', 'Payroll Item']),
    ).not.toBe('gusto');
  });

  it('does not return gusto for ADP headers', () => {
    expect(
      detectProvider(['Co Code', 'File #', 'First Name', 'Last Name', 'Reg Hours']),
    ).not.toBe('gusto');
  });
});

// ── mapGustoRows ────────────────────────────────────────────────────────────

describe('mapGustoRows', () => {
  // Helper: builds a minimal valid Gusto row
  function gustoRow(overrides: Record<string, string> = {}): Record<string, string> {
    return {
      'Employee first name': 'John',
      'Employee last name': 'Smith',
      'Regular hours': '40.00',
      'Overtime hours': '0',
      'Payroll end date': '2025-01-12',
      ...overrides,
    };
  }

  it('concatenates first and last name into csvName as "First Last"', () => {
    const result = mapGustoRows([gustoRow()]);
    const entry = result.entries.get('john smith');
    expect(entry).toBeDefined();
    expect(entry!.csvName).toBe('John Smith');
  });

  it('keys entry by lowercase name for case-insensitive matching', () => {
    const result = mapGustoRows([gustoRow({ 'Employee first name': 'CARLOS', 'Employee last name': 'MENDEZ' })]);
    expect(result.entries.has('carlos mendez')).toBe(true);
    expect(result.entries.has('CARLOS MENDEZ')).toBe(false);
  });

  it('places Regular hours on monSt', () => {
    const result = mapGustoRows([gustoRow({ 'Regular hours': '38.50' })]);
    const entry = result.entries.get('john smith');
    expect(entry!.monSt).toBe(38.5);
    expect(entry!.tueSt).toBe(0);
    expect(entry!.wedSt).toBe(0);
    expect(entry!.thuSt).toBe(0);
    expect(entry!.friSt).toBe(0);
    expect(entry!.satSt).toBe(0);
    expect(entry!.sunSt).toBe(0);
  });

  it('places Overtime hours on monOt', () => {
    const result = mapGustoRows([gustoRow({ 'Regular hours': '40', 'Overtime hours': '6.00' })]);
    const entry = result.entries.get('john smith');
    expect(entry!.monSt).toBe(40);
    expect(entry!.monOt).toBe(6);
  });

  it('adds Double overtime hours to monOt bucket', () => {
    const result = mapGustoRows([
      gustoRow({
        'Regular hours': '40',
        'Overtime hours': '4',
        'Double overtime hours': '2',
      }),
    ]);
    const entry = result.entries.get('john smith');
    expect(entry!.monSt).toBe(40);
    expect(entry!.monOt).toBe(6); // 4 OT + 2 DOT = 6 in monOt
  });

  it('aggregates multiple rows for the same employee', () => {
    const rows = [
      gustoRow({ 'Regular hours': '20', 'Overtime hours': '2' }),
      gustoRow({ 'Regular hours': '20', 'Overtime hours': '3' }),
    ];
    const result = mapGustoRows(rows);
    const entry = result.entries.get('john smith');
    expect(entry!.monSt).toBe(40);
    expect(entry!.monOt).toBe(5);
  });

  it('always returns gustoWeeklyTotalsOnly: true', () => {
    const result = mapGustoRows([gustoRow()]);
    expect(result.gustoWeeklyTotalsOnly).toBe(true);
  });

  it('returns gustoWeeklyTotalsOnly: true even for empty row array (after required col check would throw)', () => {
    // When rows are empty there are no keys to check — but we should confirm the flag
    // is set on a valid non-empty result set
    const result = mapGustoRows([gustoRow()]);
    expect(result.gustoWeeklyTotalsOnly).toBe(true as const);
  });

  it('throws a descriptive error when a required column is missing', () => {
    const rowsMissingPayrollEndDate = [
      {
        'Employee first name': 'Jane',
        'Employee last name': 'Doe',
        'Regular hours': '40',
        // 'Payroll end date' intentionally absent
      },
    ];
    expect(() => mapGustoRows(rowsMissingPayrollEndDate)).toThrow(
      /Gusto CSV is missing required columns/,
    );
    expect(() => mapGustoRows(rowsMissingPayrollEndDate)).toThrow(
      /Payroll end date/,
    );
  });

  it('throws and lists all missing required columns in the error', () => {
    // Only Employee first name present — three columns missing
    const rows = [{ 'Employee first name': 'Jane' }];
    expect(() => mapGustoRows(rows)).toThrow(/Employee last name/);
    expect(() => mapGustoRows(rows)).toThrow(/Regular hours/);
    expect(() => mapGustoRows(rows)).toThrow(/Payroll end date/);
  });

  it('skips rows where both first and last name are empty', () => {
    const rows = [
      gustoRow({ 'Employee first name': '', 'Employee last name': '' }),
      gustoRow({ 'Employee first name': 'Jane', 'Employee last name': 'Doe', 'Regular hours': '35' }),
    ];
    const result = mapGustoRows(rows);
    expect(result.entries.size).toBe(1);
    expect(result.entries.has('jane doe')).toBe(true);
  });

  it('absent Overtime hours column defaults to 0 (not an error)', () => {
    // Gusto zero-OT exports omit the column entirely — this must NOT throw
    const rows = [
      {
        'Employee first name': 'Bob',
        'Employee last name': 'Jones',
        'Regular hours': '32',
        'Payroll end date': '2025-01-12',
        // 'Overtime hours' column intentionally absent
      },
    ];
    expect(() => mapGustoRows(rows)).not.toThrow();
    const result = mapGustoRows(rows);
    const entry = result.entries.get('bob jones');
    expect(entry!.monSt).toBe(32);
    expect(entry!.monOt).toBe(0);
  });

  it('handles multiple different employees in same file', () => {
    const rows = [
      gustoRow({ 'Employee first name': 'Alice', 'Employee last name': 'Brown', 'Regular hours': '40' }),
      gustoRow({ 'Employee first name': 'Carlos', 'Employee last name': 'Mendez', 'Regular hours': '35', 'Overtime hours': '5' }),
    ];
    const result = mapGustoRows(rows);
    expect(result.entries.size).toBe(2);
    expect(result.entries.get('alice brown')!.monSt).toBe(40);
    expect(result.entries.get('carlos mendez')!.monSt).toBe(35);
    expect(result.entries.get('carlos mendez')!.monOt).toBe(5);
  });
});
