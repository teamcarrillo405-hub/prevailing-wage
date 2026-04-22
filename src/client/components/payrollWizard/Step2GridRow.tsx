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
  // NJ deductions
  ficaTax: number | null;
  federalIncomeTax: number | null;
  stateIncomeTax: number | null;
}

export type RowValues = HourValues & RowExtras;

interface Props {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRate: number;
  values: RowValues;
  toggles: StateToggles;
  onChange: (field: keyof HourValues, value: number) => void;
  onExtraChange: (field: keyof RowExtras, value: number | string | null) => void;
  onBlur: () => void;
  onStandardWeek: () => void;
}

export function Step2GridRow({
  workerId,
  classificationId,
  workerName,
  tradeDescription,
  baseRate,
  values,
  toggles,
  onChange,
  onExtraChange,
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

  function numCell(field: keyof HourValues) {
    return (
      <td className="px-1 py-1">
        <input
          type="number"
          min={0}
          step={0.25}
          value={values[field]}
          onChange={(e) => onChange(field, Number(e.target.value) || 0)}
          onBlur={onBlur}
          onFocus={(e) => e.target.select()}
          className="w-16 px-2 py-1 text-right text-sm border border-gray-200 rounded-sm focus:border-brand-gold focus:outline-hidden"
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

  function extraTextCell(field: 'checkNumber', width: string = 'w-24') {
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
    <tr className="border-b border-gray-100">
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
      {toggles.njDeductions && (
        <>
          {extraNumCell('ficaTax')}
          {extraNumCell('federalIncomeTax')}
          {extraNumCell('stateIncomeTax')}
        </>
      )}
      <td className="px-3 py-2 text-right text-sm font-semibold whitespace-nowrap">
        {stTotal.toFixed(1)} ST / {otTotal.toFixed(1)} OT
        {toggles.caDt && ` / ${dtTotal.toFixed(1)} DT`}
      </td>
    </tr>
  );
}
