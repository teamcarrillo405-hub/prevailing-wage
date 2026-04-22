// src/client/components/payrollWizard/Step2GridRow.tsx
import { useMemo } from 'react';
import { DAYS } from './types';

export interface RowValues {
  monSt: number; tueSt: number; wedSt: number; thuSt: number;
  friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number;
  friOt: number; satOt: number; sunOt: number;
}

interface Props {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRate: number;
  values: RowValues;
  onChange: (field: keyof RowValues, value: number) => void;
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
  onChange,
  onBlur,
  onStandardWeek,
}: Props) {
  const stTotal = useMemo(
    () => DAYS.reduce((sum, d) => sum + (values[`${d}St` as keyof RowValues] || 0), 0),
    [values]
  );
  const otTotal = useMemo(
    () => DAYS.reduce((sum, d) => sum + (values[`${d}Ot` as keyof RowValues] || 0), 0),
    [values]
  );

  function cell(field: keyof RowValues) {
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
      {cell('monSt')}{cell('tueSt')}{cell('wedSt')}{cell('thuSt')}
      {cell('friSt')}{cell('satSt')}{cell('sunSt')}
      {cell('monOt')}{cell('tueOt')}{cell('wedOt')}{cell('thuOt')}
      {cell('friOt')}{cell('satOt')}{cell('sunOt')}
      <td className="px-3 py-2 text-right text-sm font-semibold whitespace-nowrap">
        {stTotal.toFixed(1)} ST / {otTotal.toFixed(1)} OT
      </td>
    </tr>
  );
}
