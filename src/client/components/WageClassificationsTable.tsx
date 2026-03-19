// src/client/components/WageClassificationsTable.tsx
import type { WageClassification } from '../../shared/types.js';

interface Props {
  classifications: WageClassification[];
}

export function WageClassificationsTable({ classifications }: Props) {
  if (classifications.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No classifications found for this determination.
      </p>
    );
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ backgroundColor: '#F5C518' }}>
            <th className="px-3 py-2 text-left font-semibold font-headline text-gray-900">Trade Code</th>
            <th className="px-3 py-2 text-left font-semibold font-headline text-gray-900">Description</th>
            <th className="px-3 py-2 text-left font-semibold font-headline text-gray-900">Labor Type</th>
            <th className="px-3 py-2 text-right font-semibold font-headline text-gray-900">Base Rate</th>
            <th className="px-3 py-2 text-right font-semibold font-headline text-gray-900">Fringe Rate</th>
            <th className="px-3 py-2 text-right font-semibold font-headline text-gray-900">Total Rate</th>
          </tr>
        </thead>
        <tbody>
          {classifications.map((c, i) => (
            <tr
              key={c.id}
              className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
            >
              <td className="px-3 py-2 font-mono text-xs uppercase tracking-wide">{c.tradeCode}</td>
              <td className="px-3 py-2">{c.tradeDescription}</td>
              <td className="px-3 py-2 text-gray-600 capitalize">{c.laborType}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(c.baseRate)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(c.fringeRate)}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(c.totalRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
