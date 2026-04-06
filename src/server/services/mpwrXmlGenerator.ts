// src/server/services/mpwrXmlGenerator.ts
//
// NY MPWR XML generator — NYSDOL MPWR portal compliant
//
// Generates plain (no namespace prefix) XML for upload to the NY DOL MPWR portal.
// Root element: <ProjectRollup> — NOT <CPR:ProjectRollup>.
//
// SSN handling: Per STATE-03 requirement, only ssnLast4 is stored. The generated
// XML uses a '000000' + ssnLast4 placeholder in <ssnLast4>. Contractors enter the
// full SSN directly in the portal.
//
// Multi-classification workers: A worker may have multiple payroll_week_classifications
// (e.g., worked as both Carpenter and Laborer in the same week). These are grouped
// into a single <employeeWorkWeek> with one <workWeek> child per classification.
// Supplement rate derivation: fringe total amount / total hours

import { create } from 'xmlbuilder2';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MpwrXmlInput {
  project: {
    nyprcNumber: string;
    nysContractorRegNumber: string;
    name: string;
    contractorFein: string;
  };
  week: {
    weekEndingDate: string;
  };
  entries: Array<{
    workerId: string;
    workerName: string;
    workerSsnLast4: string | null;
    nysRegisteredApprentice: boolean | number;
    tradeDescription: string;
    laborType: string;
    workerAddress?: string;
    // Daily hours
    monSt: number; monOt: number;
    tueSt: number; tueOt: number;
    wedSt: number; wedOt: number;
    thuSt: number; thuOt: number;
    friSt: number; friOt: number;
    satSt: number; satOt: number;
    sunSt: number; sunOt: number;
    // Totals and rates
    totalStHours: number;
    totalOtHours: number;
    baseRateSnapshot: number;
    grossWages: number | null;
    deductions: number | null;
    netPay: number | null;
    // Fringe fields
    fringeHealthWelfare: number | null;
    fringePension: number | null;
    fringeVacation: number | null;
    fringeTraining: number | null;
  }>;
}

// ── Generator ─────────────────────────────────────────────────────────────

/**
 * Generates an MPWR-compliant XML string for upload to the NY DOL MPWR portal.
 *
 * All numeric values are formatted with .toFixed(2).
 * Special characters in string values are automatically escaped by xmlbuilder2.
 * Root element is <ProjectRollup> with NO namespace prefix per MPWR spec.
 */
export function generateMpwrXml(data: MpwrXmlInput): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('ProjectRollup');

  // ── Project-level elements ───────────────────────────────────────────────
  root.ele('prcNumber').txt(data.project.nyprcNumber);
  root.ele('nysContractorRegNumber').txt(data.project.nysContractorRegNumber);
  root.ele('contractorName').txt(data.project.name);
  root.ele('contractorFein').txt(data.project.contractorFein);
  root.ele('weekEndingDate').txt(data.week.weekEndingDate);

  // ── Group entries by workerId ────────────────────────────────────────────
  // A worker with 2 entries (different tradeDescriptions from payroll_week_classifications)
  // must produce exactly ONE <employeeWorkWeek> with TWO <workWeek> children.
  const workerMap = new Map<string, typeof data.entries>();

  for (const entry of data.entries) {
    const existing = workerMap.get(entry.workerId);
    if (existing) {
      existing.push(entry);
    } else {
      workerMap.set(entry.workerId, [entry]);
    }
  }

  // ── Emit one <employeeWorkWeek> per worker ───────────────────────────────
  for (const [, workerEntries] of workerMap) {
    const firstEntry = workerEntries[0]!;

    // Parse name: "First Last" → firstName = everything before last token, lastName = last token
    const nameParts = firstEntry.workerName.trim().split(/\s+/);
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1]! : '';
    const firstName = nameParts.slice(0, Math.max(1, nameParts.length - 1)).join(' ');

    // SSN placeholder: '000000' + ssnLast4 per STATE-03 requirement
    // Do NOT write ssnLast4 directly — always prepend 000000
    const ssnPlaceholder = firstEntry.workerSsnLast4
      ? '000000' + firstEntry.workerSsnLast4
      : '0000000000';

    // nysRegisteredApprentice as 'true'/'false' string
    const isApprentice = Boolean(firstEntry.nysRegisteredApprentice);

    const empWorkWeek = root.ele('employeeWorkWeek');

    // ── <employee> ────────────────────────────────────────────────────────
    const empEl = empWorkWeek.ele('employee');
    empEl.ele('firstName').txt(firstName);
    empEl.ele('lastName').txt(lastName);
    empEl.ele('ssnLast4').txt(ssnPlaceholder);
    empEl.ele('nysRegisteredApprentice').txt(isApprentice ? 'true' : 'false');

    if (firstEntry.workerAddress) {
      empEl.ele('address').txt(firstEntry.workerAddress);
    }

    // ── One <workWeek> per classification entry ───────────────────────────
    for (const entry of workerEntries) {
      const workWeek = empWorkWeek.ele('workWeek');

      workWeek.ele('workCategory').txt(entry.tradeDescription);
      workWeek.ele('laborType').txt(entry.laborType);
      workWeek.ele('stHourlyRate').txt(entry.baseRateSnapshot.toFixed(2));
      // OT rate is 1.5x straight time
      workWeek.ele('otHourlyRate').txt((entry.baseRateSnapshot * 1.5).toFixed(2));

      // ── <days>: 7 day elements Mon-Sun ───────────────────────────────────
      const daysEl = workWeek.ele('days');

      const dayDefs = [
        { name: 'Monday',    st: entry.monSt, ot: entry.monOt },
        { name: 'Tuesday',   st: entry.tueSt, ot: entry.tueOt },
        { name: 'Wednesday', st: entry.wedSt, ot: entry.wedOt },
        { name: 'Thursday',  st: entry.thuSt, ot: entry.thuOt },
        { name: 'Friday',    st: entry.friSt, ot: entry.friOt },
        { name: 'Saturday',  st: entry.satSt, ot: entry.satOt },
        { name: 'Sunday',    st: entry.sunSt, ot: entry.sunOt },
      ];

      for (const d of dayDefs) {
        const dayEl = daysEl.ele('day');
        dayEl.ele('dayName').txt(d.name);
        dayEl.ele('standardTimeHours').txt(d.st.toFixed(2));
        dayEl.ele('overTimeHours').txt(d.ot.toFixed(2));
      }

      // ── <supplementalPayments> ───────────────────────────────────────────
      // Supplement rate derivation: fringe total amount / total hours
      const stHrs = entry.totalStHours > 0 ? entry.totalStHours : 0;
      const otHrs = entry.totalOtHours > 0 ? entry.totalOtHours : 0;

      const calcRate = (amount: number | null, hours: number): number => {
        if (!amount || hours === 0) return 0;
        return amount / hours;
      };

      const supplementalPayments = workWeek.ele('supplementalPayments');

      // Health/Welfare
      const hw = supplementalPayments.ele('supplementalPayment');
      hw.ele('type').txt('Health/Welfare');
      hw.ele('stHourlyRate').txt(calcRate(entry.fringeHealthWelfare, stHrs).toFixed(4));
      hw.ele('otHourlyRate').txt(calcRate(entry.fringeHealthWelfare, otHrs).toFixed(4));

      // Pension
      const pension = supplementalPayments.ele('supplementalPayment');
      pension.ele('type').txt('Pension');
      pension.ele('stHourlyRate').txt(calcRate(entry.fringePension, stHrs).toFixed(4));
      pension.ele('otHourlyRate').txt(calcRate(entry.fringePension, otHrs).toFixed(4));

      // Vacation/Holiday
      const vac = supplementalPayments.ele('supplementalPayment');
      vac.ele('type').txt('Vacation/Holiday');
      vac.ele('stHourlyRate').txt(calcRate(entry.fringeVacation, stHrs).toFixed(4));
      vac.ele('otHourlyRate').txt(calcRate(entry.fringeVacation, otHrs).toFixed(4));

      // Apprenticeship/Training
      const training = supplementalPayments.ele('supplementalPayment');
      training.ele('type').txt('Apprenticeship/Training');
      training.ele('stHourlyRate').txt(calcRate(entry.fringeTraining, stHrs).toFixed(4));
      training.ele('otHourlyRate').txt(calcRate(entry.fringeTraining, otHrs).toFixed(4));

      // Other (placeholder)
      const other = supplementalPayments.ele('supplementalPayment');
      other.ele('type').txt('Other');
      other.ele('stHourlyRate').txt('0.0000');
      other.ele('otHourlyRate').txt('0.0000');

      // ── Totals and pay ────────────────────────────────────────────────────
      workWeek.ele('totalStHours').txt(entry.totalStHours.toFixed(2));
      workWeek.ele('totalOtHours').txt(entry.totalOtHours.toFixed(2));
      workWeek.ele('grossWages').txt((entry.grossWages ?? 0).toFixed(2));
      workWeek.ele('deductions').txt((entry.deductions ?? 0).toFixed(2));
      workWeek.ele('netPay').txt((entry.netPay ?? 0).toFixed(2));
    }
  }

  return root.end({ prettyPrint: true });
}
