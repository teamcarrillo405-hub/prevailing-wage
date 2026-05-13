// src/client/components/payrollWizard/Step2GridRow.tsx
import { useMemo } from 'react';
import { DAYS } from './types';
import type { StateToggles } from './Step2BulkActions';

// Split so TS can narrow cell() to numeric fields only.
export interface HourValues {
  // Daily straight-time (base)
  monSt: number; tueSt: number; wedSt: number; thuSt: number;
  friSt: number; satSt: number; sunSt: number;
  // Daily overtime (base)
  monOt: number; tueOt: number; wedOt: number; thuOt: number;
  friOt: number; satOt: number; sunOt: number;
  // CA daily double-time (Labor Code §510)
  monDt: number; tueDt: number; wedDt: number; thuDt: number;
  friDt: number; satDt: number; sunDt: number;
}

export interface RowExtras {
  // CA fringe disaggregation (sum = fringeRateSnapshot when all non-null)
  fringeHealthWelfare: number | null;
  fringePension: number | null;
  fringeVacation: number | null;
  fringeTraining: number | null;
  // IL non-prevailing-wage hours
  nonPwHours: number | null;
  // MA nullable
  checkNumber: string | null;
  allOtherHours: number | null;
  totalWeekGrossWages: number | null;
  // NJ deductions + CA SDI
  ficaTax: number | null;
  federalIncomeTax: number | null;
  stateIncomeTax: number | null;
  sdiTax: number | null;
  deductionVacationHoliday: number | null;
  deductionHealthWelfare: number | null;
  deductionPension: number | null;
  deductionTraining: number | null;
  deductionFundAdmin: number | null;
  deductionDues: number | null;
  deductionTravelSubsistence: number | null;
  deductionSavings: number | null;
  deductionOther: number | null;
  deductionOtherDescription: string | null;
}

export type RowValues = HourValues & RowExtras;

export type MetaField = 'baseRate' | 'fringeRate' | 'deductions';

interface Props {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRate: number;
  fringeRate: number;
  deductions: number;
  values: RowValues;
  toggles: StateToggles;
  highlighted?: boolean;
  onChange: (field: keyof HourValues, value: number) => void;
  onExtraChange: (field: keyof RowExtras, value: number | string | null) => void;
  onMetaChange: (field: MetaField, value: number) => void;
  onBlur: () => void;
  onStandardWeek: () => void;
}

export function Step2GridRow({
  workerId,
  classificationId,
  workerName,
  tradeDescription,
  baseRate,
  fringeRate,
  deductions,
  values,
  toggles,
  highlighted,
  onChange,
  onExtraChange,
  onMetaChange,
  onBlur,
  onStandardWeek,
}: Props) {
  const stTotal = useMemo(
    () => DAYS.reduce((sum, d) => sum + (values[`${d}St` as keyof HourValues] || 0), 0),
    [values]
  );
  const otTotal = useMemo(
    () => DAYS.reduce((sum, d) => sum + (values[`${d}Ot` as keyof HourValues] || 0), 0),
    [values]
  );
  const dtTotal = useMemo(
    () => DAYS.reduce((sum, d) => sum + (values[`${d}Dt` as keyof HourValues] || 0), 0),
    [values]
  );
  const fringeSum = useMemo(
    () =>
      (values.fringeHealthWelfare ?? 0) +
      (values.fringePension ?? 0) +
      (values.fringeVacation ?? 0) +
      (values.fringeTraining ?? 0),
    [values.fringeHealthWelfare, values.fringePension, values.fringeVacation, values.fringeTraining]
  );

  // Per-day totals (ST + OT + DT) used for the >24h validation.
  const dayTotals = useMemo(() => {
    const result: Partial<Record<string, number>> = {};
    for (const d of DAYS) {
      result[d] =
        (values[`${d}St` as keyof HourValues] || 0) +
        (values[`${d}Ot` as keyof HourValues] || 0) +
        (values[`${d}Dt` as keyof HourValues] || 0);
    }
    return result;
  }, [values]);

  const weeklyTotal = stTotal + otTotal + dtTotal;

  function numCell(field: keyof HourValues) {
    // Derive the day key (e.g. 'mon', 'tue') from the field name.
    const dayKey = field.replace(/St$|Ot$|Dt$/, '');
    const daySum = dayTotals[dayKey] ?? 0;
    const cellValue = values[field];
    const dayInvalid = daySum > 24;
    const weekInvalid = weeklyTotal > 168;
    const isInvalid = dayInvalid || (weekInvalid && cellValue > 0);

    return (
      <td className="px-1 py-1">
        <div className="relative group">
          <input
            type="number"
            min={0}
            step={0.25}
            value={cellValue}
            onChange={(e) => onChange(field, Number(e.target.value) || 0)}
            onBlur={onBlur}
            onFocus={(e) => e.target.select()}
            className={`w-16 px-2 py-1 text-right text-sm border rounded-sm focus:outline-hidden ${
              isInvalid
                ? 'border-red-400 focus:border-red-400'
                : 'border-gray-200 focus:border-brand-gold'
            }`}
            data-worker-id={workerId}
            data-classification-id={classificationId}
            data-field={field}
          />
          {dayInvalid && (
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 whitespace-nowrap rounded-sm bg-red-600 px-1.5 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
              Max 24h/day
            </span>
          )}
          {!dayInvalid && weekInvalid && cellValue > 0 && (
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 whitespace-nowrap rounded-sm bg-red-600 px-1.5 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
              Weekly total &gt; 168h
            </span>
          )}
        </div>
      </td>
    );
  }

  function metaCell(field: MetaField, current: number, step: number = 0.01, width: string = 'w-20') {
    return (
      <td className="px-1 py-1 bg-slate-50">
        <input
          type="number"
          min={0}
          step={step}
          value={current}
          onChange={(e) => onMetaChange(field, Number(e.target.value) || 0)}
          onBlur={onBlur}
          onFocus={(e) => e.target.select()}
          className={`${width} px-2 py-1 text-right text-sm border border-gray-200 rounded-sm focus:border-brand-gold focus:outline-hidden`}
          data-worker-id={workerId}
          data-classification-id={classificationId}
          data-field={field}
        />
      </td>
    );
  }

  function extraNumCell(field: keyof RowExtras, width: string = 'w-20') {
    const v = values[field];
    const numValue = typeof v === 'number' ? v : v === null ? '' : '';
    return (
      <td className="px-1 py-1">
        <input
          type="number"
          min={0}
          step={0.01}
          value={numValue}
          onChange={(e) => {
            const raw = e.target.value;
            onExtraChange(field, raw === '' ? null : Number(raw));
          }}
          onBlur={onBlur}
          onFocus={(e) => e.target.select()}
          className={`${width} px-2 py-1 text-right text-sm border border-gray-200 rounded-sm focus:border-brand-gold focus:outline-hidden`}
          data-worker-id={workerId}
          data-classification-id={classificationId}
          data-field={field}
        />
      </td>
    );
  }

  function extraTextCell(field: 'checkNumber' | 'deductionOtherDescription', width: string = 'w-24') {
    const v = values[field] ?? '';
    return (
      <td className="px-1 py-1">
        <input
          type="text"
          value={v}
          onChange={(e) => onExtraChange(field, e.target.value === '' ? null : e.target.value)}
          onBlur={onBlur}
          className={`${width} px-2 py-1 text-sm border border-gray-200 rounded-sm focus:border-brand-gold focus:outline-hidden`}
          data-worker-id={workerId}
          data-classification-id={classificationId}
          data-field={field}
        />
      </td>
    );
  }

  return (
    <tr
      className={`border-b border-gray-100 transition-colors ${highlighted ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}`}
      data-highlighted={highlighted ? 'true' : undefined}
    >
      <td className="sticky left-0 bg-white px-3 py-2 border-r border-gray-200 z-10">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="text-sm font-medium">{workerName}</div>
            <div className="text-xs text-gray-500">
              {tradeDescription} · ${baseRate.toFixed(2)}/hr
            </div>
          </div>
          <button
            type="button"
            onClick={onStandardWeek}
            title="Fill Mon-Fri 8 ST, clear OT"
            className="text-xs text-brand-gold hover:underline whitespace-nowrap"
          >
            Standard
          </button>
        </div>
      </td>
      {numCell('monSt')}{numCell('tueSt')}{numCell('wedSt')}{numCell('thuSt')}
      {numCell('friSt')}{numCell('satSt')}{numCell('sunSt')}
      {numCell('monOt')}{numCell('tueOt')}{numCell('wedOt')}{numCell('thuOt')}
      {numCell('friOt')}{numCell('satOt')}{numCell('sunOt')}
      {metaCell('baseRate', baseRate)}
      {metaCell('fringeRate', fringeRate)}
      {metaCell('deductions', deductions, 0.01, 'w-24')}
      {toggles.caDt && (
        <>
          {numCell('monDt')}{numCell('tueDt')}{numCell('wedDt')}{numCell('thuDt')}
          {numCell('friDt')}{numCell('satDt')}{numCell('sunDt')}
        </>
      )}
      {toggles.caFringe && (
        <>
          {extraNumCell('fringeHealthWelfare')}
          {extraNumCell('fringePension')}
          {extraNumCell('fringeVacation')}
          {extraNumCell('fringeTraining')}
          <td className="px-2 py-1 text-right text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-50">
            Sum: ${fringeSum.toFixed(2)}
          </td>
        </>
      )}
      {toggles.ilNonPw && <>{extraNumCell('nonPwHours')}</>}
      {toggles.maFields && (
        <>
          {extraTextCell('checkNumber')}
          {extraNumCell('allOtherHours')}
          {extraNumCell('totalWeekGrossWages', 'w-24')}
        </>
      )}
      {(toggles.njDeductions || toggles.caFica) && (
        <>
          {extraNumCell('ficaTax')}
          {extraNumCell('federalIncomeTax')}
          {extraNumCell('stateIncomeTax')}
          {toggles.caFica && (
            <>
              {extraNumCell('sdiTax')}
              {extraNumCell('deductionVacationHoliday')}
              {extraNumCell('deductionHealthWelfare')}
              {extraNumCell('deductionPension')}
              {extraNumCell('deductionTraining')}
              {extraNumCell('deductionFundAdmin')}
              {extraNumCell('deductionDues')}
              {extraNumCell('deductionTravelSubsistence')}
              {extraNumCell('deductionSavings')}
              {extraNumCell('deductionOther')}
              {extraTextCell('deductionOtherDescription', 'w-32')}
            </>
          )}
        </>
      )}
      <td className="px-3 py-2 text-right text-sm font-semibold whitespace-nowrap">
        {stTotal.toFixed(1)} ST / {otTotal.toFixed(1)} OT
        {toggles.caDt && ` / ${dtTotal.toFixed(1)} DT`}
      </td>
    </tr>
  );
}
