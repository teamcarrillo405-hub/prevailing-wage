// src/client/components/payrollWizard/Step2HoursGrid.tsx
import { useState, useCallback } from 'react';
import { Step2GridRow, type RowValues } from './Step2GridRow';
import { Button } from '../ui/Button';

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
  onRowChange: (row: GridWorkerRow) => void;
  onReview: () => void;
  onBack: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Step2HoursGrid({ initialRows, onRowChange, onReview, onBack }: Props) {
  const [rows, setRows] = useState(initialRows);

  const updateCell = useCallback(
    (workerId: string, classificationId: string, field: keyof RowValues, value: number) => {
      setRows((rs) =>
        rs.map((r) =>
          r.workerId === workerId && r.classificationId === classificationId
            ? { ...r, values: { ...r.values, [field]: value } }
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

  return (
    <div>
      <div className="overflow-x-auto border border-gray-200 rounded-sm">
        <table className="min-w-full text-sm">
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
