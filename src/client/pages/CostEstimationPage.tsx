// src/client/pages/CostEstimationPage.tsx
//
// Cost Estimation Calculator — lets contractors build a bid estimate from
// prevailing wages + crew size + duration + loaded markups.
//
// Flow:
//   1. Pick state + county → fetch wage determination + classifications
//   2. Build crew: for each trade, set count × hrs/week × weeks × OT multiplier
//   3. Set markup percentages (overhead / G&A / profit)
//   4. See fully-loaded bid cost per line + grand total
//
// Reuses:
//   - /api/wages/lookup  (same endpoint WageLookupPage uses)
//   - calculateGsaRate() pure function from server/services/gsaRateBuilder
//     (imported client-side; the file has no server deps)

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Trash2, Plus } from 'lucide-react';
import type { WageDetermination, WageClassification } from '../../shared/types.js';
import { calculateGsaRate } from '../../server/services/gsaRateBuilder.js';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Table, THead, TBody, TFoot, Tr, Th, Td } from '../components/ui/Table';
import { EmptyState } from '../components/ui/EmptyState';

interface LookupResult {
  wd: WageDetermination;
  classifications: WageClassification[];
}

interface CrewLine {
  id: string;
  classificationId: string;  // references a WageClassification.id
  count: number;
  hoursPerWeek: number;
  weeks: number;
  otMultiplier: number;      // e.g., 1.5 for time-and-a-half
  otHoursPerWeek: number;    // OT hours separate from straight time
}

function newLineId() {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function fetchLookup(state: string, county: string): Promise<LookupResult> {
  const res = await fetch(
    `/api/wages/lookup?state=${encodeURIComponent(state)}&county=${encodeURIComponent(county)}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
  return res.json();
}

export function CostEstimationPage() {
  const [stateInput, setStateInput] = useState('');
  const [countyInput, setCountyInput] = useState('');
  const [submitted, setSubmitted] = useState<{ state: string; county: string } | null>(null);

  const [crew, setCrew] = useState<CrewLine[]>([]);
  const [overheadPct, setOverheadPct] = useState(30);
  const [gaPct, setGaPct] = useState(12);
  const [profitPct, setProfitPct] = useState(8);

  const { data, isLoading, error } = useQuery<LookupResult>({
    queryKey: ['cost-estimation', 'wages', submitted?.state, submitted?.county],
    queryFn: () => fetchLookup(submitted!.state, submitted!.county),
    enabled: Boolean(submitted),
    retry: false,
  });

  const classifications = data?.classifications ?? [];
  const classificationById = useMemo(
    () => new Map(classifications.map(c => [c.id, c])),
    [classifications],
  );

  // ── Crew operations ────────────────────────────────────────────────────
  function addLine() {
    if (classifications.length === 0) return;
    setCrew(prev => [...prev, {
      id: newLineId(),
      classificationId: classifications[0].id,
      count: 1,
      hoursPerWeek: 40,
      weeks: 1,
      otMultiplier: 1.5,
      otHoursPerWeek: 0,
    }]);
  }
  function updateLine(id: string, patch: Partial<CrewLine>) {
    setCrew(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }
  function removeLine(id: string) {
    setCrew(prev => prev.filter(l => l.id !== id));
  }

  // ── Calculation ────────────────────────────────────────────────────────
  const computed = useMemo(() => {
    if (!crew.length) return { lines: [], grandTotal: 0, totalHours: 0, totalWorkers: 0 };
    let grandTotal = 0;
    let totalHours = 0;
    let totalWorkers = 0;
    const lines = crew.map(l => {
      const c = classificationById.get(l.classificationId);
      if (!c) return { line: l, classification: null, stCost: 0, otCost: 0, lineTotal: 0, totalHrs: 0 };
      const rate = calculateGsaRate({
        baseRate: c.baseRate,
        fringeRate: c.fringeRate,
        overheadPct, gaPct, profitPct,
      });
      const stHrs = l.hoursPerWeek * l.weeks;
      const otHrs = l.otHoursPerWeek * l.weeks;
      const stCost = rate.billableRate * stHrs * l.count;
      const otCost = rate.billableRate * l.otMultiplier * otHrs * l.count;
      const lineTotal = stCost + otCost;
      grandTotal += lineTotal;
      totalHours += (stHrs + otHrs) * l.count;
      totalWorkers += l.count;
      return { line: l, classification: c, rate, stCost, otCost, lineTotal, totalHrs: (stHrs + otHrs) * l.count };
    });
    return { lines, grandTotal, totalHours, totalWorkers };
  }, [crew, classificationById, overheadPct, gaPct, profitPct]);

  function fmt(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <PageHeader
        title="Cost Estimation Calculator"
        subtitle="Build a fully-loaded bid estimate from prevailing wages"
      />

      {/* ── Step 1: Jurisdiction ─────────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">1. Where is the project?</h2>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!stateInput.trim() || !countyInput.trim()) return;
            setCrew([]); // reset crew when jurisdiction changes
            setSubmitted({ state: stateInput.trim().toUpperCase(), county: countyInput.trim() });
          }}
        >
          <Input
            id="state"
            label="State"
            value={stateInput}
            onChange={e => setStateInput(e.target.value.toUpperCase())}
            placeholder="CA"
            maxLength={2}
            className="uppercase w-20"
            required
          />
          <Input
            id="county"
            label="County"
            value={countyInput}
            onChange={e => setCountyInput(e.target.value)}
            placeholder="Los Angeles"
            className="w-64"
            required
          />
          <Button type="submit">Load Wages</Button>
        </form>

        {isLoading && <p className="mt-3 text-sm text-gray-500">Loading wage determination…</p>}
        {error && (
          <p className="mt-3 text-sm text-red-600">
            {/404/.test(error.message)
              ? 'County not found — double-check the spelling or try searching by state only.'
              : /fetch|network|failed to fetch/i.test(error.message)
                ? 'Could not reach the wage database. Check your connection and try again.'
                : 'Something went wrong. Please try again.'}
          </p>
        )}
        {data && (
          <p className="mt-3 text-sm text-gray-600">
            Loaded <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{data.wd.wdNumber}</span>
            {' '}— {data.wd.county ?? 'statewide'}, {data.wd.state} — {data.classifications.length} trade classifications
          </p>
        )}
      </section>

      {/* ── Step 2: Crew ─────────────────────────────────────────────── */}
      {data && (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">2. Build your crew</h2>
            <Button variant="secondary" size="sm" onClick={addLine} disabled={classifications.length === 0}>
              <Plus className="size-3.5 mr-1" /> Add crew line
            </Button>
          </div>
          {crew.length === 0 ? (
            <EmptyState
              heading="No crew lines yet"
              message={'Click "Add crew line" to start building your estimate.'}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Classification</Th>
                  <Th align="right">Workers</Th>
                  <Th align="right">ST hrs/wk</Th>
                  <Th align="right">OT hrs/wk</Th>
                  <Th align="right">Weeks</Th>
                  <Th align="right">OT ×</Th>
                  <Th></Th>
                </Tr>
              </THead>
              <TBody>
                {crew.map(l => (
                  <Tr key={l.id}>
                    <Td>
                      <select
                        value={l.classificationId}
                        onChange={e => updateLine(l.id, { classificationId: e.target.value })}
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-sm"
                      >
                        {classifications.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.tradeDescription} ({c.laborType[0].toUpperCase()})
                            {' '}— ${c.baseRate.toFixed(2)} + ${c.fringeRate.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td numeric>
                      <input type="number" min={1} value={l.count}
                        onChange={e => updateLine(l.id, { count: Math.max(1, +e.target.value || 1) })}
                        className="w-16 text-right border border-gray-300 rounded-sm px-2 py-1 text-sm tabular-nums" />
                    </Td>
                    <Td numeric>
                      <input type="number" min={0} max={168} value={l.hoursPerWeek}
                        onChange={e => updateLine(l.id, { hoursPerWeek: Math.max(0, +e.target.value || 0) })}
                        className="w-20 text-right border border-gray-300 rounded-sm px-2 py-1 text-sm tabular-nums" />
                    </Td>
                    <Td numeric>
                      <input type="number" min={0} max={168} value={l.otHoursPerWeek}
                        onChange={e => updateLine(l.id, { otHoursPerWeek: Math.max(0, +e.target.value || 0) })}
                        className="w-20 text-right border border-gray-300 rounded-sm px-2 py-1 text-sm tabular-nums" />
                    </Td>
                    <Td numeric>
                      <input type="number" min={1} value={l.weeks}
                        onChange={e => updateLine(l.id, { weeks: Math.max(1, +e.target.value || 1) })}
                        className="w-16 text-right border border-gray-300 rounded-sm px-2 py-1 text-sm tabular-nums" />
                    </Td>
                    <Td numeric>
                      <input type="number" min={1} step={0.1} value={l.otMultiplier}
                        onChange={e => updateLine(l.id, { otMultiplier: Math.max(1, +e.target.value || 1) })}
                        className="w-16 text-right border border-gray-300 rounded-sm px-2 py-1 text-sm tabular-nums" />
                    </Td>
                    <Td>
                      <button onClick={() => removeLine(l.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label="Remove line">
                        <Trash2 className="size-4" />
                      </button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </section>
      )}

      {/* ── Step 3: Markups ──────────────────────────────────────────── */}
      {data && (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">3. Markups (fully-loaded rate)</h2>
          <div className="grid grid-cols-3 gap-4">
            <Input id="oh" label="Overhead %" type="number" min={0} max={200} value={overheadPct}
              onChange={e => setOverheadPct(+e.target.value || 0)} />
            <Input id="ga" label="G&A %" type="number" min={0} max={200} value={gaPct}
              onChange={e => setGaPct(+e.target.value || 0)} />
            <Input id="profit" label="Profit %" type="number" min={0} max={100} value={profitPct}
              onChange={e => setProfitPct(+e.target.value || 0)} />
          </div>
          <div className="mt-3 text-xs text-gray-500 space-y-0.5">
            <p className="font-medium text-gray-600">How your billable rate is built:</p>
            <p>Step 1: Labor cost = Base rate + Fringe rate</p>
            <p>Step 2: Add overhead = Labor cost × (1 + Overhead %)</p>
            <p>Step 3: Add G&amp;A = Step 2 × (1 + G&amp;A %)</p>
            <p>Step 4: Add profit = Step 3 × (1 + Profit %) = <span className="font-medium text-gray-700">your billable rate</span></p>
          </div>
        </section>
      )}

      {/* ── Step 4: Result ───────────────────────────────────────────── */}
      {data && crew.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">4. Bid Summary</h2>
          <Table>
            <THead>
              <Tr>
                <Th>Classification</Th>
                <Th align="right">Billable $/hr</Th>
                <Th align="right">ST Cost</Th>
                <Th align="right">OT Cost</Th>
                <Th align="right">Line Total</Th>
              </Tr>
            </THead>
            <TBody>
              {computed.lines.map(({ line, classification, rate, stCost, otCost, lineTotal }) =>
                classification && rate ? (
                  <Tr key={line.id}>
                    <Td>
                      {classification.tradeDescription}
                      {' '}<span className="text-xs text-gray-500">× {line.count}</span>
                    </Td>
                    <Td numeric>{fmt(rate.billableRate)}</Td>
                    <Td numeric>{fmt(stCost)}</Td>
                    <Td numeric>{fmt(otCost)}</Td>
                    <Td numeric className="font-semibold">{fmt(lineTotal)}</Td>
                  </Tr>
                ) : null
              )}
            </TBody>
            <TFoot>
              <Tr>
                <Td colSpan={2} className="font-semibold">
                  {computed.totalWorkers} worker{computed.totalWorkers === 1 ? '' : 's'}
                  , {computed.totalHours.toLocaleString()} total hrs
                </Td>
                <Td numeric className="font-semibold text-gray-500">—</Td>
                <Td numeric className="font-semibold text-gray-500">—</Td>
                <Td numeric className="text-lg font-bold">{fmt(computed.grandTotal)}</Td>
              </Tr>
            </TFoot>
          </Table>
          <p className="mt-3 text-xs text-gray-500">
            Fully-loaded bid cost for {submitted?.county}, {submitted?.state} using WD {data.wd.wdNumber}.
          </p>
        </section>
      )}
    </div>
  );
}
