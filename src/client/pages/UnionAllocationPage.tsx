// src/client/pages/UnionAllocationPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { UnionTradeForm } from '../components/UnionTradeForm.js';
import { UnionSummaryTable } from '../components/UnionSummaryTable.js';
import type { UnionAllocationResult } from '../../server/services/unionAllocation.js';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

interface Props {
  projectId: string;
}

export function UnionAllocationPage({ projectId }: Props) {
  const [result, setResult] = useState<UnionAllocationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAllocation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/union/${projectId}/allocation`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load allocation');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadAllocation(); }, [loadAllocation]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <PageHeader
        title="Union Trade Allocation"
        action={result && result.trades.length > 0 ? (
          <a
            href={`/api/union/${projectId}/allocation/pdf`}
            className="text-sm font-medium text-brand-gold hover:underline"
          >
            Export PDF
          </a>
        ) : undefined}
      />

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Add Trade / Union
        </h2>
        <UnionTradeForm projectId={projectId} onSaved={loadAllocation} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Allocation Summary
        </h2>
        {loading && <LoadingSpinner />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && !loading && <UnionSummaryTable result={result} />}
      </section>
    </div>
  );
}
