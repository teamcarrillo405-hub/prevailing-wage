// src/client/components/payrollWizard/Step2HoursGrid.tsx
import { useState, useCallback, useEffect } from 'react';
import { Step2GridRow, type RowValues, type HourValues } from './Step2GridRow';
import { Step2BulkActions, STANDARD_WEEK } from './Step2BulkActions';
import { parsePastedHours } from './pasteParser';
import { Button } from '../ui/Button';

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
  values: RowValues;
}

interface Props {
  initialRows: GridWorkerRow[];
  projectState: string;
  onRowChange: (row: GridWorkerRow) => void;
  onReview: () => void;
  onBack: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Step2HoursGrid({ initialRows, projectState: _projectState, onRowChange, onReview, onBack }: Props) {
  const [rows, setRows] = useState(initialRows);

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

  const notifyBlur = useCallback(
    (workerId: string, classificationId: string) => {
      const row = rows.find(
        (r) => r.workerId === workerId && r.classificationId === classificationId
      );
      if (row) onRowChange(row);
    },
    [rows, onRowChange]
  );

  // Standard-week bulk: replace one row's values atomically and notify dirty.
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

  // Apply standard week to every row + notify each as dirty.
  const applyStandardWeekToAll = useCallback(() => {
    setRows((rs) => {
      const next = rs.map((r) => ({ ...r, values: { ...STANDARD_WEEK } }));
      // Fire dirty notifications for each row using the just-built next state
      next.forEach((row) => onRowChange(row));
      return next;
    });
  }, [onRowChange]);

  // Paste handler: spreadsheet-shaped TSV pastes into the focused cell fill rectangularly.
  // Non-numeric or ragged pastes fall through to default text-input paste behavior.
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

        // Notify dirty for each touched row using the freshly-computed state.
        for (let i = 0; i < grid.length && startRowIdx + i < next.length; i++) {
          onRowChange(next[startRowIdx + i]);
        }
        return next;
      });
    },
    [onRowChange]
  );

  // Keyboard nav: Enter + ArrowDown = next row same column, ArrowUp = prev row same column.
  // Tab/Shift-Tab handled by browser defaults. All grid cells carry data-worker-id + data-field.
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
      <Step2BulkActions onApplyStandardWeekAll={applyStandardWeekToAll} />
      <div className="overflow-x-auto border border-gray-200 rounded-sm">
        <table className="min-w-full text-sm" onPaste={handlePaste}>
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left border-r border-gray-200 z-20">
                Worker
              </th>
              {DAY_LABELS.map((d) => (
                <th key={`${d}-st`} className="px-1 py-2 text-center text-xs font-semibold">
                  {d}
                  <br />
                  ST
                </th>
              ))}
              {DAY_LABELS.map((d) => (
                <th key={`${d}-ot`} className="px-1 py-2 text-center text-xs font-semibold">
                  {d}
                  <br />
                  OT
                </th>
              ))}
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
                values={r.values}
                onChange={(field, value) => updateCell(r.workerId, r.classificationId, field, value)}
                onBlur={() => notifyBlur(r.workerId, r.classificationId)}
                onStandardWeek={() => applyStandardWeekToRow(r.workerId, r.classificationId)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          ← Back to roster
        </Button>
        <Button onClick={onReview}>Review →</Button>
      </div>
    </div>
  );
}
