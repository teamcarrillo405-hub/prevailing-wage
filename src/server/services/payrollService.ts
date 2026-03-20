// src/server/services/payrollService.ts
import { randomUUID } from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  payrollWeeks,
  payrollEntries,
  workers,
  workerClassifications,
} from '../db/schema.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CreatePayrollWeekInput {
  projectId: string;
  weekEndingDate: string; // ISO 8601 date string e.g. "2025-01-05"
  payrollNumber: number;
}

export interface UpsertPayrollEntryInput {
  payrollWeekId: string;
  workerId: string;
  classificationId: string;
  monSt?: number;
  tueSt?: number;
  wedSt?: number;
  thuSt?: number;
  friSt?: number;
  satSt?: number;
  sunSt?: number;
  monOt?: number;
  tueOt?: number;
  wedOt?: number;
  thuOt?: number;
  friOt?: number;
  satOt?: number;
  sunOt?: number;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  grossWages?: number | null;
  deductions?: number;
  netPay?: number | null;
}

// ── Service Functions ─────────────────────────────────────────────────────

export async function createPayrollWeek(
  input: CreatePayrollWeekInput,
): Promise<{ id: string; payrollNumber: number }> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(payrollWeeks).values({
    id,
    projectId: input.projectId,
    weekEndingDate: input.weekEndingDate,
    payrollNumber: input.payrollNumber,
    isFinal: false,
    createdAt: now,
    updatedAt: now,
  });

  return { id, payrollNumber: input.payrollNumber };
}

export async function getPayrollWeek(weekId: string) {
  const db = getDb();
  const [week] = await db
    .select()
    .from(payrollWeeks)
    .where(eq(payrollWeeks.id, weekId))
    .limit(1);
  return week ?? null;
}

export async function listPayrollWeeks(projectId: string) {
  const db = getDb();
  return db
    .select()
    .from(payrollWeeks)
    .where(eq(payrollWeeks.projectId, projectId))
    .orderBy(desc(payrollWeeks.weekEndingDate));
}

export async function upsertPayrollEntry(input: UpsertPayrollEntryInput) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  const values = {
    id,
    payrollWeekId: input.payrollWeekId,
    workerId: input.workerId,
    classificationId: input.classificationId,
    monSt: input.monSt ?? 0,
    tueSt: input.tueSt ?? 0,
    wedSt: input.wedSt ?? 0,
    thuSt: input.thuSt ?? 0,
    friSt: input.friSt ?? 0,
    satSt: input.satSt ?? 0,
    sunSt: input.sunSt ?? 0,
    monOt: input.monOt ?? 0,
    tueOt: input.tueOt ?? 0,
    wedOt: input.wedOt ?? 0,
    thuOt: input.thuOt ?? 0,
    friOt: input.friOt ?? 0,
    satOt: input.satOt ?? 0,
    sunOt: input.sunOt ?? 0,
    baseRateSnapshot: input.baseRateSnapshot,
    fringeRateSnapshot: input.fringeRateSnapshot,
    grossWages: input.grossWages ?? null,
    deductions: input.deductions ?? 0,
    netPay: input.netPay ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .insert(payrollEntries)
    .values(values)
    .onConflictDoUpdate({
      target: [
        payrollEntries.payrollWeekId,
        payrollEntries.workerId,
        payrollEntries.classificationId,
      ],
      set: {
        monSt: values.monSt,
        tueSt: values.tueSt,
        wedSt: values.wedSt,
        thuSt: values.thuSt,
        friSt: values.friSt,
        satSt: values.satSt,
        sunSt: values.sunSt,
        monOt: values.monOt,
        tueOt: values.tueOt,
        wedOt: values.wedOt,
        thuOt: values.thuOt,
        friOt: values.friOt,
        satOt: values.satOt,
        sunOt: values.sunOt,
        baseRateSnapshot: values.baseRateSnapshot,
        fringeRateSnapshot: values.fringeRateSnapshot,
        grossWages: values.grossWages,
        deductions: values.deductions,
        netPay: values.netPay,
        updatedAt: now,
      },
    });

  // Return the entry by the unique constraint fields (id may differ from inserted)
  const [entry] = await db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.payrollWeekId, input.payrollWeekId))
    // We filter to the specific worker+classification for the return value
    .limit(100);

  const match = entry
    ? [entry].find(
        (e) =>
          e.workerId === input.workerId &&
          e.classificationId === input.classificationId,
      )
    : null;

  return match ?? null;
}

export async function getPayrollEntries(weekId: string) {
  const db = getDb();
  const rows = await db
    .select({
      entry: payrollEntries,
      workerName: workers.name,
      tradeDescription: workerClassifications.tradeDescription,
      laborType: workerClassifications.laborType,
      programName: workerClassifications.programName,
    })
    .from(payrollEntries)
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .innerJoin(
      workerClassifications,
      eq(payrollEntries.classificationId, workerClassifications.id),
    )
    .where(eq(payrollEntries.payrollWeekId, weekId));

  return rows;
}
