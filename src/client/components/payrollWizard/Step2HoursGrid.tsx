// src/client/components/payrollWizard/Step2HoursGrid.tsx
import { useState, useCallback, useEffect } from 'react';
import { Step2GridRow, type RowValues, type HourValues, type RowExtras, type MetaField } from './Step2GridRow';
import { Step2BulkActions, STANDARD_WEEK, type StateToggles } from './Step2BulkActions';
import { Step2MobileEntry } from './Step2MobileEntry';
import { parsePastedHours } from './pasteParser';
import { Button } from '../ui/Button';
import { TermTooltip } from '../ui/TermTooltip';

// Field order used for paste — matches the visible column order in the grid.
const FIELD_ORDER: Array<keyof HourValues> = [
  'monSt', 'tueSt', 'wedSt', 'thuSt', 'friSt', 'satSt', 'sunSt',
  'monOt', 'tueOt', 'wedOt', 'thuOt', 'friOt', 'satOt', 'sunOt',
];

export interface GridWorkerRow {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRate: number;
  fringeRate: number;
  deductions: number;
  values: RowValues;
}

export type PayrollFocusField =
  | keyof HourValues
  | keyof RowExtras
  | MetaField;

export interface PayrollFocusTarget {
  workerId: string;
  classificationId: string;
  field?: PayrollFocusField;
}

interface Props {
  initialRows: GridWorkerRow[];
  projectState: string;
  saveStatus?: 'idle' | 'pending' | 'saving' | 'queued' | 'conflict';
  highlightedWorkerIds?: Set<string>;
  focusTarget?: PayrollFocusTarget | null;
  onRowChange: (row: GridWorkerRow) => void;
  onReview: () => void;
  onBack: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const INITIAL_TOGGLES: StateToggles = {
  caDt: false,
  caFringe: false,
  caFica: false,
  ilNonPw: false,
  maFields: false,
  njDeductions: false,
};

export function Step2HoursGrid({
  initialRows,
  projectState,
  saveStatus,
  highlightedWorkerIds,
  focusTarget,
  onRowChange,
  onReview,
  onBack,
}: Props) {
  const [rows, setRows] = useState(initialRows);
  const [toggles, setToggles] = useState<StateToggles>(INITIAL_TOGGLES);

  useEffect(() => {
    if (!highlightedWorkerIds || highlightedWorkerIds.size === 0) return;
    const el = document.querySelector<HTMLElement>('[data-highlighted="true"]');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedWorkerIds]);

  useEffect(() => {
    if (!focusTarget) return;
    const selector = focusTarget.field
      ? `input[data-worker-id="${focusTarget.workerId}"][data-classification-id="${focusTarget.classificationId}"][data-field="${focusTarget.field}"]`
      : `[data-worker-id="${focusTarget.workerId}"][data-classification-id="${focusTarget.classificationId}"]`;
    const focusTimer = window.setTimeout(() => {
      const matches = Array.from(document.querySelectorAll<HTMLElement>(selector));
      const target = matches.find((match) => match.getClientRects().length > 0) ?? matches[0];
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target instanceof HTMLInputElement) {
        target.focus();
        target.select();
      }
    }, 150);
    return () => window.clearTimeout(focusTimer);
  }, [focusTarget]);

  const onToggle = useCallback((key: keyof StateToggles) => {
    setToggles((t) => ({ ...t, [key]: !t[key] }));
  }, []);

  const updateCell = useCallback(
    (workerId: string, classificationId: string, field: keyof HourValues, value: number) => {
      setRows((rs) =>
        rs.map((r) =>
          r.workerId === workerId && r.classificationId === classificationId
            ? { ...r, values: { ...r.values, [field]: value } as RowValues }
            : r
        )
      );
    },
    []
  );

  const updateMeta = useCallback(
    (workerId: string, classificationId: string, field: MetaField, value: number) => {
      setRows((rs) =>
        rs.map((r) =>
          r.workerId === workerId && r.classificationId === classificationId
            ? { ...r, [field]: value }
            : r
        )
      );
    },
    []
  );

  const updateExtra = useCallback(
    (
      workerId: string,
      classificationId: string,
      field: keyof RowExtras,
      value: number | string | null
    ) => {
      setRows((rs) =>
        rs.map((r) => {
          if (r.workerId !== workerId || r.classificationId !== classificationId) return r;
          const nextValues = { ...r.values, [field]: value } as RowValues;
          // CA fringe live-sum: when any disag field changes, update fringeRate for this row.
          if (
            field === 'fringeHealthWelfare' ||
            field === 'fringePension' ||
            field === 'fringeVacation' ||
            field === 'fringeTraining'
          ) {
            const sum =
              (nextValues.fringeHealthWelfare ?? 0) +
              (nextValues.fringePension ?? 0) +
              (nextValues.fringeVacation ?? 0) +
              (nextValues.fringeTraining ?? 0);
            return { ...r, values: nextValues, fringeRate: parseFloat(sum.toFixed(2)) };
          }
          return { ...r, values: nextValues };
        })
      );
    },
    []
  );

  const notifyBlur = useCallback(
    (workerId: string, classificationId: string) => {
      const row = rows.find(
        (r) => r.workerId === workerId && r.classificationId === classificationId
      );
      if (row) onRowChange(row);
    },
    [rows, onRowChange]
  );

  const applyStandardWeekToRow = useCallback(
    (workerId: string, classificationId: string) => {
      let updated: GridWorkerRow | null = null;
      setRows((rs) =>
        rs.map((r) => {
          if (r.workerId === workerId && r.classificationId === classificationId) {
            updated = { ...r, values: { ...STANDARD_WEEK } };
            return updated;
          }
          return r;
        })
      );
      if (updated) onRowChange(updated);
    },
    [onRowChange]
  );

  const applyStandardWeekToAll = useCallback(() => {
    setRows((rs) => {
      const next = rs.map((r) => ({ ...r, values: { ...STANDARD_WEEK } }));
      next.forEach((row) => onRowChange(row));
      return next;
    });
  }, [onRowChange]);

  // Paste handler: spreadsheet-shaped TSV pastes into the focused cell fill rectangularly.
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTableElement>) => {
      const target = e.target as HTMLInputElement;
      if (target.tagName !== 'INPUT') return;
      const startWorkerId = target.dataset.workerId;
      const startClassificationId = target.dataset.classificationId;
      const startField = target.dataset.field as keyof HourValues | undefined;
      if (!startWorkerId || !startClassificationId || !startField) return;

      const grid = parsePastedHours(e.clipboardData.getData('text/plain'));
      if (!grid) return;

      e.preventDefault();
      const startFieldIdx = FIELD_ORDER.indexOf(startField);
      if (startFieldIdx === -1) return;

      setRows((rs) => {
        const startRowIdx = rs.findIndex(
          (r) => r.workerId === startWorkerId && r.classificationId === startClassificationId
        );
        if (startRowIdx === -1) return rs;

        const next = rs.map((row, rowIdx) => {
          const offsetRow = rowIdx - startRowIdx;
          if (offsetRow < 0 || offsetRow >= grid.length) return row;
          const values: RowValues = { ...row.values };
          for (let colIdx = 0; colIdx < grid[offsetRow].length; colIdx++) {
            const fieldIdx = startFieldIdx + colIdx;
            if (fieldIdx >= FIELD_ORDER.length) break;
            values[FIELD_ORDER[fieldIdx]] = grid[offsetRow][colIdx];
          }
          return { ...row, values };
        });

        for (let i = 0; i < grid.length && startRowIdx + i < next.length; i++) {
          onRowChange(next[startRowIdx + i]);
        }
        return next;
      });
    },
    [onRowChange]
  );

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLInputElement;
      if (target.tagName !== 'INPUT') return;
      if (!target.dataset.workerId || !target.dataset.field) return;
      if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const field = target.dataset.field;
      const currentKey = `${target.dataset.workerId}::${target.dataset.classificationId}`;
      const idx = rows.findIndex((r) => `${r.workerId}::${r.classificationId}` === currentKey);
      if (idx === -1) return;
      const nextIdx =
        e.key === 'ArrowUp' ? Math.max(0, idx - 1) : Math.min(rows.length - 1, idx + 1);
      if (nextIdx === idx) return;
      const nextRow = rows[nextIdx];
      const sel = document.querySelector<HTMLInputElement>(
        `input[data-worker-id="${nextRow.workerId}"][data-classification-id="${nextRow.classificationId}"][data-field="${field}"]`
      );
      sel?.focus();
      sel?.select();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [rows]);

  return (
    <div>
      <div className="mb-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">Enter payroll in order</p>
        <div className="mt-2 grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
          <p><span className="font-semibold text-gray-900">1. Hours:</span> enter straight time, overtime, and double-time where required.</p>
          <p><span className="font-semibold text-gray-900">2. Rates:</span> confirm base and fringe rates match the wage determination.</p>
          <p><span className="font-semibold text-gray-900">3. Deductions:</span> use payroll-register values for taxes, benefits, dues, and other A-1-131 deductions.</p>
        </div>
      </div>
      <Step2BulkActions
        onApplyStandardWeekAll={applyStandardWeekToAll}
        projectState={projectState}
        toggles={toggles}
        onToggle={onToggle}
      />

      {/* Mobile view — hidden on sm+ */}
      <div className="block sm:hidden">
        <Step2MobileEntry
          rows={rows}
          toggles={toggles}
          saveStatus={saveStatus}
          focusTarget={focusTarget}
          onCellChange={(workerId, classId, field, value) => updateCell(workerId, classId, field, value)}
          onMetaChange={(workerId, classId, field, value) => updateMeta(workerId, classId, field, value)}
          onExtraChange={(workerId, classId, field, value) => updateExtra(workerId, classId, field, value)}
          onBlur={(workerId, classId) => notifyBlur(workerId, classId)}
          onStandardWeek={(workerId, classId) => applyStandardWeekToRow(workerId, classId)}
          onReview={onReview}
          onBack={onBack}
        />
      </div>

      {/* Desktop table — hidden below sm */}
      <div className="hidden sm:block">
        <div className="overflow-x-auto border border-gray-200 rounded-sm">
          <table className="min-w-full text-sm" aria-label="Weekly payroll hours entry grid" onPaste={handlePaste}>
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left border-r border-gray-200 z-20">
                  Worker
                </th>
                {DAY_LABELS.map((d) => (
                  <th key={`${d}-st`} className="px-1 py-2 text-center text-xs font-semibold" abbr="Straight Time">
                    {d}
                    <br />
                    ST
                  </th>
                ))}
                {DAY_LABELS.map((d) => (
                  <th key={`${d}-ot`} className="px-1 py-2 text-center text-xs font-semibold" abbr="Overtime">
                    {d}
                    <br />
                    OT
                  </th>
                ))}
                <th className="px-1 py-2 text-center text-xs font-semibold bg-slate-100">Base $/hr</th>
                <th className="px-1 py-2 text-center text-xs font-semibold bg-slate-100">Fringe $/hr</th>
                <th className="px-1 py-2 text-center text-xs font-semibold bg-slate-100">
                  <TermTooltip
                    term="Deductions"
                    definition="Voluntary pre-tax deductions (e.g. 401k, health insurance). Do not include taxes — those are calculated automatically. Required for accurate net pay on WH-347."
                  />
                </th>
                {toggles.caDt &&
                  DAY_LABELS.map((d) => (
                    <th
                      key={`${d}-dt`}
                      className="px-1 py-2 text-center text-xs font-semibold bg-amber-50"
                      title="Daily double-time: CA requires 2x pay for hours over 12/day or over 8/day on the 7th consecutive day (CA Labor Code §510)"
                    >
                      {d}
                      <br />
                      DT
                    </th>
                  ))}
                {toggles.caFringe && (
                  <>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-blue-50">H+W</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-blue-50">Pension</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-blue-50">Vacation</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-blue-50">Training</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-blue-50">Fringe $</th>
                  </>
                )}
                {toggles.caFica && (
                  <>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-amber-50">Vac/Hol</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-amber-50">H&W Ded</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-amber-50">Pension Ded</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-amber-50">Training</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-amber-50">Fund Admin</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-amber-50">Dues</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-amber-50">Trav/Subs</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-amber-50">Savings</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-amber-50">Other</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-amber-50">Other Note</th>
                  </>
                )}
                {toggles.ilNonPw && (
                  <th
                    className="px-1 py-2 text-center text-xs font-semibold bg-purple-50"
                    title="Non-Prevailing Wage Hours — IL hours worked on non-public-works portions of the project. Not subject to prevailing wage rates."
                  >
                    Non-PW hrs
                  </th>
                )}
                {toggles.maFields && (
                  <>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-green-50">Check #</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-green-50">All-other hrs</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-green-50">Total gross</th>
                  </>
                )}
                {(toggles.njDeductions || toggles.caFica) && (
                  <>
                    <th
                      className="px-1 py-2 text-center text-xs font-semibold bg-pink-50"
                      title="Federal Insurance Contributions Act — Social Security (6.2%) + Medicare (1.45%) taxes withheld from worker pay"
                    >
                      FICA
                    </th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-pink-50">Fed Tax</th>
                    <th className="px-1 py-2 text-center text-xs font-semibold bg-pink-50">State Tax</th>
                    {toggles.caFica && (
                      <th
                        className="px-1 py-2 text-center text-xs font-semibold bg-pink-50"
                        title="State Disability Insurance — CA state payroll tax withheld from worker wages"
                      >
                        SDI
                      </th>
                    )}
                  </>
                )}
                <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Step2GridRow
                  key={`${r.workerId}::${r.classificationId}`}
                  workerId={r.workerId}
                  classificationId={r.classificationId}
                  workerName={r.workerName}
                  tradeDescription={r.tradeDescription}
                  baseRate={r.baseRate}
                  fringeRate={r.fringeRate}
                  deductions={r.deductions}
                  values={r.values}
                  toggles={toggles}
                  highlighted={highlightedWorkerIds?.has(r.workerId) ?? false}
                  onChange={(field, value) => updateCell(r.workerId, r.classificationId, field, value)}
                  onExtraChange={(field, value) => updateExtra(r.workerId, r.classificationId, field, value)}
                  onMetaChange={(field, value) => updateMeta(r.workerId, r.classificationId, field, value)}
                  onBlur={() => notifyBlur(r.workerId, r.classificationId)}
                  onStandardWeek={() => applyStandardWeekToRow(r.workerId, r.classificationId)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4">
          <span aria-live="polite" className="text-xs">
            {saveStatus === 'queued' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                Queued for sync
              </span>
            )}
            {saveStatus === 'conflict' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Synced by another device
              </span>
            )}
            {(saveStatus === 'pending' || saveStatus === 'saving') && (
              <span className="text-gray-400">Saving…</span>
            )}
            {(saveStatus === 'idle' || saveStatus === undefined) && (
              <span className="text-gray-400">All changes saved</span>
            )}
          </span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onBack}>
              ← Back to roster
            </Button>
            <Button onClick={onReview}>Review →</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
