// src/client/pages/SubcontractorsPage.tsx
// Route: /projects/:projectId/subcontractors
// Lists subcontractors and shows DBE participation report with CSV export.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Building2, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

// ── Types ────────────────────────────────────────────────────────────────────

interface Subcontractor {
  id: string;
  name: string;
  licenseNumber: string | null;
  contactName: string | null;
  contactEmail: string | null;
  address: string | null;
  dbeClassification: string;
  certSummary?: {
    certCount: number;
    isCertified: boolean;
    hasExpiredCert: boolean;
    hasSuspendedCert: boolean;
    hasPendingCert: boolean;
  };
}

interface DbeReportLine {
  tier: number;
  subName: string;
  dbeCert: string | null;
  contractValue: number;
  percentOfPrime: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

function dbeVariant(cert: string | null): 'compliant' | 'warning' | 'neutral' {
  if (!cert) return 'neutral';
  if (cert === 'DBE') return 'compliant';
  return 'warning';
}

function exportDbeReportCsv(rows: DbeReportLine[], projectId: string) {
  const header = 'Tier,Sub Name,DBE Cert,Contract Value,% of Prime\n';
  const body = rows
    .map(r =>
      [r.tier, `"${r.subName.replace(/"/g, '""')}"`, r.dbeCert ?? 'None', r.contractValue.toFixed(2), r.percentOfPrime.toFixed(1)].join(','),
    )
    .join('\n');
  const csv = header + body;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dbe-report-project-${projectId}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ── Sub List Tab ─────────────────────────────────────────────────────────────

function SubListTab({ subs }: { subs: Subcontractor[] }) {
  if (subs.length === 0) {
    return (
      <EmptyState
        heading="No subcontractors yet"
        message="Add subcontractors from the Project Detail page to start tracking CPR compliance."
      />
    );
  }

  return (
    <div className="space-y-3">
      {subs.map((sub) => (
        <Card key={sub.id} padding="default">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{sub.name}</p>
              {sub.contactName && (
                <p className="text-sm text-gray-500 mt-0.5">{sub.contactName}</p>
              )}
              {sub.contactEmail && (
                <p className="text-sm text-gray-400">{sub.contactEmail}</p>
              )}
              {sub.address && (
                <p className="text-sm text-gray-400 mt-1 truncate">{sub.address}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {sub.dbeClassification && sub.dbeClassification !== 'none' && (
                <Badge variant="compliant">{sub.dbeClassification.toUpperCase()}</Badge>
              )}
              {sub.certSummary?.hasExpiredCert && (
                <Badge variant="violation">Cert Expired</Badge>
              )}
              {sub.certSummary?.hasSuspendedCert && (
                <Badge variant="violation">Cert Suspended</Badge>
              )}
              {sub.certSummary?.hasPendingCert && (
                <Badge variant="warning">Cert Pending</Badge>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── DBE Report Tab ────────────────────────────────────────────────────────────

function DbeReportTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dbe-report', projectId],
    queryFn: () => api.get<DbeReportLine[]>(`/projects/${projectId}/subcontractors/dbe-report`),
    enabled: Boolean(projectId),
  });

  const rows = data ?? [];

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">Loading DBE report...</div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-sm text-red-500">Failed to load DBE report.</div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        heading="No subcontractors with contract values"
        message="Add subcontractors and set contract values to generate a DBE participation report."
      />
    );
  }

  const totalValue = rows.filter(r => r.tier === 1).reduce((s, r) => s + r.contractValue, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Prime contract total: <span className="font-semibold text-gray-900">{fmt(totalValue)}</span>
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => exportDbeReportCsv(rows, projectId)}
        >
          <Download className="w-4 h-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Sub Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">DBE Cert</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Contract Value</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">% of Prime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {row.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.tier > 1 && (
                      <span className="mr-1 text-gray-300">{'└'.repeat(row.tier - 1)}</span>
                    )}
                    {row.subName}
                  </td>
                  <td className="px-4 py-3">
                    {row.dbeCert ? (
                      <Badge variant={dbeVariant(row.dbeCert)}>{row.dbeCert}</Badge>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {fmt(row.contractValue)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {row.percentOfPrime.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'subs' | 'dbe-report';

export function SubcontractorsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('subs');

  const { data: subsData, isLoading } = useQuery({
    queryKey: ['subcontractors', projectId],
    queryFn: () =>
      api.get<{ data: { subcontractors: Subcontractor[] } }>(`/projects/${projectId}/subcontractors`),
    enabled: Boolean(projectId),
  });

  const subs: Subcontractor[] = subsData?.data?.subcontractors ?? [];

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'subs', label: `Subcontractors (${subs.length})`, icon: <Building2 className="w-4 h-4" /> },
    { id: 'dbe-report', label: 'DBE Report', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <PageHeader
          title="Subcontractors"
          subtitle="Manage subcontractors and view DBE participation for this project."
          action={
            <Link
              to={`/projects/${projectId}`}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Back to project
            </Link>
          }
        />

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-brand-gold text-nav-dark'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading...</div>
        ) : activeTab === 'subs' ? (
          <SubListTab subs={subs} />
        ) : (
          <DbeReportTab projectId={projectId!} />
        )}
      </div>
    </Layout>
  );
}
