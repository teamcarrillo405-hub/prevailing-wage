// src/client/components/VarianceTrendChart.tsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { WeeklyVarianceRow } from '../../server/services/varianceService.js';

const CHART_GOLD = 'var(--color-brand-gold)';
const CHART_GRAY = '#6B7280';   // gray-500 — no token equivalent
const CHART_GRID = '#E5E7EB';   // gray-200 — no token equivalent

interface Props {
  weeks: WeeklyVarianceRow[];
}

function fmtCurrency(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function VarianceTrendChart({ weeks }: Props) {
  if (weeks.length === 0) {
    return null;
  }

  // Recharts data: each point is a WeeklyVarianceRow
  // X axis: weekEndingDate (abbreviated for space)
  const data = weeks.map(w => ({
    ...w,
    weekLabel: w.weekEndingDate.slice(5), // "MM-DD" from "YYYY-MM-DD"
  }));

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
        Cumulative Spend vs Budget Burn Rate
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis
            dataKey="weekLabel"
            tick={{ fontSize: 11, fill: CHART_GRAY }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => fmtCurrency(v)}
            tick={{ fontSize: 10, fill: CHART_GRAY }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip
            formatter={(value) => fmtCurrency(Number(value))}
            labelFormatter={(label) => `Week: ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="cumulativeActual"
            name="Actual Spend"
            stroke={CHART_GOLD}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="cumulativeBurnRate"
            name="Budget Burn Rate"
            stroke={CHART_GRAY}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
