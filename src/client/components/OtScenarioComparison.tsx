// src/client/components/OtScenarioComparison.tsx
// Pure client-side scenario comparison table — NO server calls.
// Calls compareScenarios() from otCalculator.ts directly (synchronous pure function).
import { useState } from 'react';
import { compareScenarios } from '../../server/services/otCalculator.js';
import type { OtScenario } from '../../server/services/otCalculator.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function parseDailyHours(input: string): number[] {
  return input
    .split(',')
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));
}

// ── Default Scenarios ──────────────────────────────────────────────────────

function defaultScenarios(threshold: number, baseRate: number, fringeRate: number): OtScenario[] {
  return [
    {
      label: '5x8h (Mon-Fri)',
      dailyHours: [8, 8, 8, 8, 8],
      baseRate,
      fringeRate,
      overtimeThreshold: threshold,
    },
    {
      label: '4x10h (Mon-Thu)',
      dailyHours: [10, 10, 10, 10],
      baseRate,
      fringeRate,
      overtimeThreshold: threshold,
    },
  ];
}

// ── Component ──────────────────────────────────────────────────────────────

interface OtScenarioComparisonProps {
  defaultThreshold?: number;
  baseRate?: number;
  fringeRate?: number;
}

export function OtScenarioComparison({
  defaultThreshold = 40,
  baseRate: initialBaseRate = 0,
  fringeRate: initialFringeRate = 0,
}: OtScenarioComparisonProps) {
  const [baseRate, setBaseRate] = useState(initialBaseRate);
  const [fringeRate, setFringeRate] = useState(initialFringeRate);

  const [scenarios, setScenarios] = useState<OtScenario[]>(() =>
    defaultScenarios(defaultThreshold, initialBaseRate, initialFringeRate),
  );

  // Add scenario form state
  const [newLabel, setNewLabel] = useState('');
  const [newHoursInput, setNewHoursInput] = useState('');
  const [addError, setAddError] = useState('');

  // Keep scenarios in sync when baseRate / fringeRate change
  function updateRates(newBase: number, newFringe: number) {
    setBaseRate(newBase);
    setFringeRate(newFringe);
    setScenarios((prev) =>
      prev.map((s) => ({ ...s, baseRate: newBase, fringeRate: newFringe })),
    );
  }

  function removeScenario(index: number) {
    setScenarios((prev) => prev.filter((_, i) => i !== index));
  }

  function addScenario() {
    setAddError('');
    const label = newLabel.trim();
    if (!label) {
      setAddError('Label is required');
      return;
    }
    const hours = parseDailyHours(newHoursInput);
    if (hours.length === 0) {
      setAddError('Enter comma-separated daily hours (e.g. 8,8,8,8,8)');
      return;
    }
    setScenarios((prev) => [
      ...prev,
      { label, dailyHours: hours, baseRate, fringeRate, overtimeThreshold: defaultThreshold },
    ]);
    setNewLabel('');
    setNewHoursInput('');
  }

  // Run comparison synchronously — no async/await, no server round-trip
  const results = compareScenarios(scenarios);
  const allNoOt = results.every((r) => r.overtimeHours === 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
        Schedule Scenario Comparison
      </h3>

      {/* Rate Inputs */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Base Rate ($/hr)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={baseRate || ''}
            onChange={(e) => updateRates(parseFloat(e.target.value) || 0, fringeRate)}
            placeholder="e.g. 30.00"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Fringe Rate ($/hr)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={fringeRate || ''}
            onChange={(e) => updateRates(baseRate, parseFloat(e.target.value) || 0)}
            placeholder="e.g. 10.00"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
          />
        </div>
      </div>

      {/* Comparison Table */}
      {allNoOt && results.length > 0 && (
        <div className="mb-4 rounded bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
          No overtime in any scenario — all schedules are at or below the {defaultThreshold}h threshold.
        </div>
      )}

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
              <th className="py-2 text-left font-medium">Scenario</th>
              <th className="py-2 text-right font-medium">Total Hours</th>
              <th className="py-2 text-right font-medium">OT Hours</th>
              <th className="py-2 text-right font-medium">Straight-Time Pay</th>
              <th className="py-2 text-right font-medium">OT Premium</th>
              <th className="py-2 text-right font-medium">Fringe (1.0x all hrs, CWHSSA)</th>
              <th className="py-2 text-right font-medium">Total Weekly Cost</th>
              <th className="py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2 text-gray-900 font-medium">{r.label}</td>
                <td className="py-2 text-right font-mono text-gray-700">
                  {r.totalHours.toFixed(1)}
                  {r.overtimeHours > 0 && (
                    <span className="ml-1 text-amber-600">
                      ({r.overtimeHours.toFixed(1)} OT)
                    </span>
                  )}
                </td>
                <td className="py-2 text-right font-mono text-gray-700">
                  {r.overtimeHours > 0 ? (
                    <span className="text-amber-600">{r.overtimeHours.toFixed(1)}</span>
                  ) : (
                    <span className="text-green-600">0</span>
                  )}
                </td>
                <td className="py-2 text-right font-mono text-gray-900">
                  {fmt(r.result.straightTimeBasePay)}
                </td>
                <td className="py-2 text-right font-mono text-gray-900">
                  {r.result.overtimePremium > 0 ? (
                    <span className="text-amber-600">{fmt(r.result.overtimePremium)}</span>
                  ) : (
                    fmt(r.result.overtimePremium)
                  )}
                </td>
                <td className="py-2 text-right font-mono text-gray-900">
                  {fmt(r.result.totalFringePay)}
                </td>
                <td className="py-2 text-right font-mono font-semibold text-[#F5C518]">
                  {fmt(r.result.totalWeeklyCost)}
                </td>
                <td className="py-2 text-right">
                  {results.length > 1 && (
                    <button
                      onClick={() => removeScenario(i)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${r.label}`}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">No scenarios. Add one below.</p>
        )}
      </div>

      {/* Add Scenario Form */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Add Scenario
        </h4>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. 5x8h + Sat 4h"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">
              Daily Hours (comma-separated, Mon first)
            </label>
            <input
              type="text"
              value={newHoursInput}
              onChange={(e) => setNewHoursInput(e.target.value)}
              placeholder="e.g. 8,8,8,8,8,4,0"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
            />
          </div>
          <button
            type="button"
            onClick={addScenario}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
          >
            + Add
          </button>
        </div>
        {addError && <p className="mt-2 text-xs text-red-600">{addError}</p>}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        CWHSSA: fringe is 1.0x for all hours including OT. OT premium applies to base rate only.
        Weekly OT threshold: {defaultThreshold}h.
      </p>
    </div>
  );
}
