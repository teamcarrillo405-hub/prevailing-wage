// src/client/components/payrollWizard/Step2MobileEntry.tsx
import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { DAYS } from './types';
import type { GridWorkerRow } from './Step2HoursGrid';
import type { PayrollFocusTarget } from './Step2HoursGrid';
import type { HourValues, RowExtras, MetaField } from './Step2GridRow';
import type { StateToggles } from './Step2BulkActions';

interface Props {
  rows: GridWorkerRow[];
  toggles: StateToggles;
  saveStatus?: 'idle' | 'pending' | 'saving' | 'queued' | 'conflict';
  focusTarget?: PayrollFocusTarget | null;
  onCellChange: (workerId: string, classificationId: string, field: keyof HourValues, value: number) => void;
  onMetaChange: (workerId: string, classificationId: string, field: MetaField, value: number) => void;
  onExtraChange: (workerId: string, classificationId: string, field: keyof RowExtras, value: number | string | null) => void;
  onBlur: (workerId: string, classificationId: string) => void;
  onStandardWeek: (workerId: string, classificationId: string) => void;
  onReview: () => void;
  onBack: () => void;
}

const DAY_FULL: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function computeRowTotals(row: GridWorkerRow) {
  let st = 0;
  let ot = 0;
  let dt = 0;
  for (const d of DAYS) {
    st += row.values[`${d}St` as keyof HourValues] || 0;
    ot += row.values[`${d}Ot` as keyof HourValues] || 0;
    dt += row.values[`${d}Dt` as keyof HourValues] || 0;
  }
  return { st, ot, dt, total: st + ot + dt };
}

function hasNonZeroHours(row: GridWorkerRow): boolean {
  for (const d of DAYS) {
    if ((row.values[`${d}St` as keyof HourValues] || 0) > 0) return true;
    if ((row.values[`${d}Ot` as keyof HourValues] || 0) > 0) return true;
    if ((row.values[`${d}Dt` as keyof HourValues] || 0) > 0) return true;
  }
  return false;
}

function hasDayOver24(row: GridWorkerRow): boolean {
  for (const d of DAYS) {
    const st = row.values[`${d}St` as keyof HourValues] || 0;
    const ot = row.values[`${d}Ot` as keyof HourValues] || 0;
    const dt = row.values[`${d}Dt` as keyof HourValues] || 0;
    if (st + ot + dt > 24) return true;
  }
  return false;
}

const TAX_DEDUCTION_FIELDS: Array<[keyof RowExtras, string]> = [
  ['ficaTax', 'FICA'],
  ['federalIncomeTax', 'Fed Tax'],
  ['stateIncomeTax', 'State Tax'],
];

const CA_A1131_DEDUCTION_FIELDS: Array<[keyof RowExtras, string]> = [
  ['sdiTax', 'SDI'],
  ['deductionVacationHoliday', 'Vac/Hol'],
  ['deductionHealthWelfare', 'H&W Ded'],
  ['deductionPension', 'Pension Ded'],
  ['deductionTraining', 'Training'],
  ['deductionFundAdmin', 'Fund Admin'],
  ['deductionDues', 'Dues'],
  ['deductionTravelSubsistence', 'Trav/Subs'],
  ['deductionSavings', 'Savings'],
  ['deductionOther', 'Other'],
];

export function Step2MobileEntry({
  rows,
  toggles,
  saveStatus,
  focusTarget,
  onCellChange,
  onMetaChange,
  onExtraChange,
  onBlur,
  onStandardWeek,
  onReview,
  onBack,
}: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    if (activeIdx === null) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveIdx(null);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeIdx]);

  useEffect(() => {
    if (!focusTarget) return;
    if (!window.matchMedia('(max-width: 639px)').matches) return;
    const targetIdx = rows.findIndex(
      (row) => row.workerId === focusTarget.workerId && row.classificationId === focusTarget.classificationId,
    );
    if (targetIdx === -1) return;
    setActiveIdx(targetIdx);
    const focusTimer = window.setTimeout(() => {
      const target = document.querySelector<HTMLInputElement>(
        `input[data-worker-id="${focusTarget.workerId}"][data-classification-id="${focusTarget.classificationId}"][data-field="${focusTarget.field ?? 'deductions'}"]`,
      );
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus();
      target?.select();
    }, 200);
    return () => window.clearTimeout(focusTimer);
  }, [focusTarget, rows]);

  const activeRow = activeIdx !== null ? rows[activeIdx] : null;

  return (
    <div className="py-2">
      {/* Worker card list */}
      <div className="flex flex-col gap-3">
        {rows.map((row, idx) => {
          const { st, ot, dt, total } = computeRowTotals(row);
          const hasHours = hasNonZeroHours(row);
          const overLimit = hasDayOver24(row);
          return (
            <div
              key={`${row.workerId}::${row.classificationId}`}
              className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900 truncate">{row.workerName}</span>
                  {overLimit && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                      <AlertTriangle className="w-3 h-3" />
                      Check hours
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{row.tradeDescription}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {total.toFixed(1)} hrs
                  {toggles.caDt
                    ? ` (${st.toFixed(1)} ST / ${ot.toFixed(1)} OT / ${dt.toFixed(1)} DT)`
                    : ` (${st.toFixed(1)} ST / ${ot.toFixed(1)} OT)`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasHours && (
                  <CheckCircle className="w-5 h-5 text-green-500" aria-label="Hours entered" />
                )}
                <Button variant="secondary" size="sm" onClick={() => setActiveIdx(idx)}>
                  {hasHours ? 'Edit Hours' : 'Enter Hours'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save status + navigation buttons below card list */}
      <div className="flex items-center justify-between mt-4">
        <span aria-live="polite" className="text-xs text-gray-400">
          {saveStatus === 'pending' || saveStatus === 'saving' ? 'Saving…' : 'All changes saved'}
        </span>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onBack}>
            ← Back to roster
          </Button>
          <Button onClick={onReview}>Review →</Button>
        </div>
      </div>

      {/* Per-worker modal */}
      {activeRow !== null && activeIdx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-worker-modal-title"
          className="fixed inset-0 bg-white z-50 overflow-y-auto"
        >
          {/* Modal header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <div>
              <div id="mobile-worker-modal-title" className="font-medium text-gray-900 text-sm">
                {activeRow.workerName}
              </div>
              <div className="text-xs text-gray-500">{activeRow.tradeDescription}</div>
            </div>
            <button
              type="button"
              onClick={() => setActiveIdx(null)}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none px-2 py-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="px-4 py-4 space-y-5 pb-32">
            {/* Standard week link */}
            <button
              type="button"
              className="text-sm text-brand-gold hover:underline"
              onClick={() => {
                onStandardWeek(activeRow.workerId, activeRow.classificationId);
                onBlur(activeRow.workerId, activeRow.classificationId);
              }}
            >
              Apply standard week (Mon–Fri 8 ST)
            </button>

            {/* Day-by-day sections */}
            {DAYS.map((d) => {
              const stField = `${d}St` as keyof HourValues;
              const otField = `${d}Ot` as keyof HourValues;
              const dtField = `${d}Dt` as keyof HourValues;
              const stVal = activeRow.values[stField] || 0;
              const otVal = activeRow.values[otField] || 0;
              const dtVal = activeRow.values[dtField] || 0;
              const dayTotal = stVal + otVal + dtVal;
              const dayOver = dayTotal > 24;

              return (
                <div key={d} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{DAY_FULL[d]}</span>
                    {dayOver && (
                      <span className="text-xs text-red-500 font-medium">Max 24h/day</span>
                    )}
                  </div>
                  <div className={`grid gap-3 ${toggles.caDt ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ST hrs</label>
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        value={stVal}
                        onChange={(e) =>
                          onCellChange(
                            activeRow.workerId,
                            activeRow.classificationId,
                            stField,
                            Number(e.target.value) || 0
                          )
                        }
                        onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                        className={`w-full py-3 px-3 text-base border rounded-sm focus:outline-none ${
                          dayOver
                            ? 'border-red-400 focus:border-red-400'
                            : 'border-gray-300 focus:border-brand-gold'
                        }`}
                        data-worker-id={activeRow.workerId}
                        data-classification-id={activeRow.classificationId}
                        data-field={stField}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">OT hrs</label>
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        value={otVal}
                        onChange={(e) =>
                          onCellChange(
                            activeRow.workerId,
                            activeRow.classificationId,
                            otField,
                            Number(e.target.value) || 0
                          )
                        }
                        onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                        className={`w-full py-3 px-3 text-base border rounded-sm focus:outline-none ${
                          dayOver
                            ? 'border-red-400 focus:border-red-400'
                            : 'border-gray-300 focus:border-brand-gold'
                        }`}
                        data-worker-id={activeRow.workerId}
                        data-classification-id={activeRow.classificationId}
                        data-field={otField}
                      />
                    </div>
                    {toggles.caDt && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">DT hrs</label>
                        <input
                          type="number"
                          min={0}
                          step={0.25}
                          value={dtVal}
                          onChange={(e) =>
                            onCellChange(
                              activeRow.workerId,
                              activeRow.classificationId,
                              dtField,
                              Number(e.target.value) || 0
                            )
                          }
                          onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                          className={`w-full py-3 px-3 text-base border rounded-sm focus:outline-none ${
                            dayOver
                              ? 'border-red-400 focus:border-red-400'
                              : 'border-gray-300 focus:border-brand-gold'
                          }`}
                          data-worker-id={activeRow.workerId}
                          data-classification-id={activeRow.classificationId}
                          data-field={dtField}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Meta fields: Base, Fringe, Deductions */}
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Pay Rates</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Base $/hr</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={activeRow.baseRate}
                    onChange={(e) =>
                      onMetaChange(
                        activeRow.workerId,
                        activeRow.classificationId,
                        'baseRate',
                        Number(e.target.value) || 0
                      )
                    }
                    onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                    className="w-full py-3 px-3 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-brand-gold"
                    data-worker-id={activeRow.workerId}
                    data-classification-id={activeRow.classificationId}
                    data-field="baseRate"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fringe $/hr</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={activeRow.fringeRate}
                    onChange={(e) =>
                      onMetaChange(
                        activeRow.workerId,
                        activeRow.classificationId,
                        'fringeRate',
                        Number(e.target.value) || 0
                      )
                    }
                    onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                    className="w-full py-3 px-3 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-brand-gold"
                    data-worker-id={activeRow.workerId}
                    data-classification-id={activeRow.classificationId}
                    data-field="fringeRate"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Deductions</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={activeRow.deductions}
                    onChange={(e) =>
                      onMetaChange(
                        activeRow.workerId,
                        activeRow.classificationId,
                        'deductions',
                        Number(e.target.value) || 0
                      )
                    }
                    onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                    className="w-full py-3 px-3 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-brand-gold"
                    data-worker-id={activeRow.workerId}
                    data-classification-id={activeRow.classificationId}
                    data-field="deductions"
                  />
                </div>
              </div>
            </div>

            {/* CA fringe disaggregation */}
            {toggles.caFringe && (
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700">CA Fringe Breakdown</span>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ['fringeHealthWelfare', 'H&W'],
                      ['fringePension', 'Pension'],
                      ['fringeVacation', 'Vacation'],
                      ['fringeTraining', 'Training'],
                    ] as Array<[keyof RowExtras, string]>
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={
                          typeof activeRow.values[field] === 'number'
                            ? (activeRow.values[field] as number)
                            : ''
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          onExtraChange(
                            activeRow.workerId,
                            activeRow.classificationId,
                            field,
                            raw === '' ? null : Number(raw)
                          );
                        }}
                        onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                        className="w-full py-3 px-3 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* IL non-PW hours */}
            {toggles.ilNonPw && (
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700">IL Fields</span>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Non-PW Hours</label>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={
                      typeof activeRow.values.nonPwHours === 'number'
                        ? activeRow.values.nonPwHours
                        : ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      onExtraChange(
                        activeRow.workerId,
                        activeRow.classificationId,
                        'nonPwHours',
                        raw === '' ? null : Number(raw)
                      );
                    }}
                    onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                    className="w-full py-3 px-3 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-brand-gold"
                  />
                </div>
              </div>
            )}

            {/* MA fields */}
            {toggles.maFields && (
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700">MA Fields</span>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Check #</label>
                    <input
                      type="text"
                      value={activeRow.values.checkNumber ?? ''}
                      onChange={(e) =>
                        onExtraChange(
                          activeRow.workerId,
                          activeRow.classificationId,
                          'checkNumber',
                          e.target.value === '' ? null : e.target.value
                        )
                      }
                      onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                      className="w-full py-3 px-3 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-brand-gold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">All-other hrs</label>
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        value={
                          typeof activeRow.values.allOtherHours === 'number'
                            ? activeRow.values.allOtherHours
                            : ''
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          onExtraChange(
                            activeRow.workerId,
                            activeRow.classificationId,
                            'allOtherHours',
                            raw === '' ? null : Number(raw)
                          );
                        }}
                        onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                        className="w-full py-3 px-3 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Total gross</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={
                          typeof activeRow.values.totalWeekGrossWages === 'number'
                            ? activeRow.values.totalWeekGrossWages
                            : ''
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          onExtraChange(
                            activeRow.workerId,
                            activeRow.classificationId,
                            'totalWeekGrossWages',
                            raw === '' ? null : Number(raw)
                          );
                        }}
                        onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                        className="w-full py-3 px-3 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NJ / CA deductions */}
            {(toggles.njDeductions || toggles.caFica) && (
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Tax Deductions</span>
                <div className="grid grid-cols-2 gap-3">
                  {[...TAX_DEDUCTION_FIELDS, ...(toggles.caFica ? CA_A1131_DEDUCTION_FIELDS : [])].map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={
                          typeof activeRow.values[field] === 'number'
                            ? (activeRow.values[field] as number)
                            : ''
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          onExtraChange(
                            activeRow.workerId,
                            activeRow.classificationId,
                            field,
                            raw === '' ? null : Number(raw)
                          );
                        }}
                        onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                        className="w-full py-3 px-3 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-brand-gold"
                        data-worker-id={activeRow.workerId}
                        data-classification-id={activeRow.classificationId}
                        data-field={field}
                      />
                    </div>
                  ))}
                  {toggles.caFica && (
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Other note</label>
                      <input
                        type="text"
                        maxLength={120}
                        value={activeRow.values.deductionOtherDescription ?? ''}
                        onChange={(e) =>
                          onExtraChange(
                            activeRow.workerId,
                            activeRow.classificationId,
                            'deductionOtherDescription',
                            e.target.value === '' ? null : e.target.value
                          )
                        }
                        onBlur={() => onBlur(activeRow.workerId, activeRow.classificationId)}
                        className="w-full py-3 px-3 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-brand-gold"
                        data-worker-id={activeRow.workerId}
                        data-classification-id={activeRow.classificationId}
                        data-field="deductionOtherDescription"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer: prev / next navigation */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <Button
              variant="secondary"
              size="sm"
              disabled={activeIdx === 0}
              onClick={() => setActiveIdx((i) => (i !== null && i > 0 ? i - 1 : i))}
            >
              ← Previous
            </Button>
            <span className="text-xs text-gray-500">
              Worker {activeIdx + 1} of {rows.length}
            </span>
            {activeIdx < rows.length - 1 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveIdx((i) => (i !== null ? i + 1 : i))}
              >
                Next →
              </Button>
            ) : (
              <Button size="sm" onClick={() => setActiveIdx(null)}>
                Done
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
