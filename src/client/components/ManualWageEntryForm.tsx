// src/client/components/ManualWageEntryForm.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../contexts/ToastContext';
import type { WageDetermination } from '../../shared/types.js';

interface ClassificationRow {
  tradeCode: string;
  tradeDescription: string;
  laborType: 'journeyworker' | 'foreman' | 'apprentice';
  baseRate: string; // string in form, parsed on submit
  fringeRate: string;
}

interface Props {
  state: string;
  county: string;
  onSuccess: (wd: WageDetermination) => void;
}

const emptyRow = (): ClassificationRow => ({
  tradeCode: '',
  tradeDescription: '',
  laborType: 'journeyworker',
  baseRate: '',
  fringeRate: '',
});

export function ManualWageEntryForm({ state, county, onSuccess }: Props) {
  const { toast } = useToast();
  const [wdNumber, setWdNumber] = useState('');
  const [constructionType, setConstructionType] = useState('');
  const [rows, setRows] = useState<ClassificationRow[]>([emptyRow()]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        state,
        county,
        wdNumber,
        constructionType: constructionType || undefined,
        classifications: rows.map((r) => ({
          tradeCode: r.tradeCode.toUpperCase(),
          tradeDescription: r.tradeDescription,
          laborType: r.laborType,
          baseRate: parseFloat(r.baseRate),
          fringeRate: parseFloat(r.fringeRate),
          totalRate: parseFloat(r.baseRate) + parseFloat(r.fringeRate),
        })),
      };
      const res = await fetch('/api/wages/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? 'Failed to create manual entry');
      }
      return res.json() as Promise<{ wd: WageDetermination }>;
    },
    onSuccess: (data) => { toast.success('Manual wage entry saved'); onSuccess(data.wd); },
    onError: (err: Error) => toast.error(err.message || 'Could not save wage entry'),
  });

  const updateRow = (i: number, field: keyof ClassificationRow, value: string) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="mt-6 border border-gray-200 rounded-lg p-5">
      <h3 className="font-headline text-lg font-semibold text-gray-900 mb-4">
        Enter Prevailing Wage Rates Manually
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        No federal wage determination was found for {county}, {state}. Enter rates manually below.
      </p>

      {mutation.error && (
        <p className="text-sm text-red-700 mb-3">{String(mutation.error.message)}</p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">WD Number *</label>
          <input
            type="text"
            value={wdNumber}
            onChange={(e) => setWdNumber(e.target.value)}
            placeholder="e.g. CA-DIR-2025-CARP"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Construction Type</label>
          <select
            value={constructionType}
            onChange={(e) => setConstructionType(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">-- Select type --</option>
            <option value="Building">Building</option>
            <option value="Heavy">Heavy</option>
            <option value="Highway">Highway</option>
            <option value="Residential">Residential</option>
          </select>
        </div>
      </div>

      <h4 className="text-sm font-semibold text-gray-900 mb-2">Classifications</h4>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-6 gap-2 mb-2 items-center">
          <input
            type="text"
            placeholder="Trade Code"
            value={row.tradeCode}
            onChange={(e) => updateRow(i, 'tradeCode', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm col-span-1"
          />
          <input
            type="text"
            placeholder="Description"
            value={row.tradeDescription}
            onChange={(e) => updateRow(i, 'tradeDescription', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm col-span-2"
          />
          <input
            type="number"
            placeholder="Base Rate"
            step="0.01"
            value={row.baseRate}
            onChange={(e) => updateRow(i, 'baseRate', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            type="number"
            placeholder="Fringe Rate"
            step="0.01"
            value={row.fringeRate}
            onChange={(e) => updateRow(i, 'fringeRate', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            disabled={rows.length === 1}
            className="text-gray-400 hover:text-red-600 text-sm disabled:opacity-30"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="text-sm text-brand-gold hover:underline mb-4"
      >
        + Add Classification
      </button>

      <div>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !wdNumber || rows.some((r) => !r.tradeCode || !r.tradeDescription || !r.baseRate)}
          className="px-5 py-2 rounded font-semibold text-gray-900 disabled:opacity-50 bg-brand-gold"
        >
          {mutation.isPending ? 'Saving...' : 'Save Manual Entry'}
        </button>
      </div>
    </div>
  );
}
