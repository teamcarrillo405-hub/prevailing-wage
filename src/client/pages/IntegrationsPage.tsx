import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Layout } from '../components/shared/Layout.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { IntegrationsSkeleton } from '../components/ui/Skeleton.js';

interface QboStatusResponse {
  data: {
    connected: boolean;
    realmId?: string;
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
    nearExpiry?: boolean;
  };
}

interface ProcoreStatusResponse {
  data: {
    connected: boolean;
    companyId?: string;
    nearExpiry?: boolean;
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
  };
}

interface QboEmployee {
  qboId: string;
  displayName: string;
  email: string | null;
}

// ── Employee Mapping (stored in localStorage, keyed by qboId → our workerId) ──
const MAPPING_KEY = 'qbo_employee_mapping';

function loadMapping(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MAPPING_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function saveMapping(mapping: Record<string, string>): void {
  localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
}

function EmployeeMappingSection() {
  const [qboEmployees, setQboEmployees] = useState<QboEmployee[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>(loadMapping);
  const [saved, setSaved] = useState(false);

  // Minimal worker list fetch (no project scoping — cross-project search not needed here;
  // the mapping UI is intentionally simple: user picks from a text input for each QB employee)

  async function fetchEmployees() {
    setFetching(true);
    setError(null);
    try {
      const resp = await api.post<{ data: { employees: QboEmployee[]; count: number } }>(
        '/integrations/qbo/sync-employees',
        {},
      );
      setQboEmployees(resp.data.employees);
    } catch {
      setError('Failed to fetch employees from QuickBooks. Check your connection.');
    } finally {
      setFetching(false);
    }
  }

  function handleMap(qboId: string, workerName: string) {
    setMapping((prev) => ({ ...prev, [qboId]: workerName }));
    setSaved(false);
  }

  function handleSave() {
    saveMapping(mapping);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  useEffect(() => {
    // Sync persisted mapping on mount so other components can read it
    setMapping(loadMapping());
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Employee Mapping</h2>
          <p className="text-sm text-gray-600 mt-1">
            Link QuickBooks employees to workers in your prevailing-wage projects. Mapping is used
            when syncing QB time records to auto-populate payroll entries.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!qboEmployees && (
        <Button variant="secondary" size="sm" onClick={fetchEmployees} loading={fetching} disabled={fetching}>
          {fetching ? 'Loading...' : 'Load QB Employees'}
        </Button>
      )}

      {qboEmployees && qboEmployees.length === 0 && (
        <p className="text-sm text-gray-500">No employees found in your QuickBooks company.</p>
      )}

      {qboEmployees && qboEmployees.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Enter the exact worker name as it appears in this app (case-insensitive matching is applied during sync).
          </p>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {qboEmployees.map((emp) => (
              <div key={emp.qboId} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{emp.displayName}</p>
                  {emp.email && <p className="text-xs text-gray-400 truncate">{emp.email}</p>}
                </div>
                <span className="text-gray-400 text-sm shrink-0">maps to</span>
                <input
                  type="text"
                  value={mapping[emp.qboId] ?? ''}
                  onChange={(e) => handleMap(emp.qboId, e.target.value)}
                  placeholder="Worker name in app"
                  className="w-48 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button variant="primary" size="sm" onClick={handleSave}>
              Save Mapping
            </Button>
            {saved && <span className="text-sm text-green-600">Saved.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const procoreJustConnected = searchParams.get('procore') === 'connected';

  const { data, isLoading } = useQuery<QboStatusResponse>({
    queryKey: ['qbo-status'],
    queryFn: () => api.get<QboStatusResponse>('/api/integrations/qbo/status'),
  });

  const disconnect = useMutation({
    mutationFn: () => api.delete<unknown>('/api/integrations/qbo'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qbo-status'] }),
  });

  const { data: procoreData } = useQuery<ProcoreStatusResponse>({
    queryKey: ['procore-status'],
    queryFn: () => api.get<ProcoreStatusResponse>('/api/integrations/procore/status'),
  });

  const disconnectProcore = useMutation({
    mutationFn: () => api.delete<unknown>('/api/integrations/procore'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procore-status'] }),
  });

  const status = data?.data;
  const procoreStatus = procoreData?.data;

  return (
    <Layout>
      <PageHeader
        title="Integrations"
        subtitle="Connect third-party services to streamline your prevailing wage workflow."
      />

      <div className="w-full max-w-2xl md:mx-auto space-y-6">
        {isLoading && <IntegrationsSkeleton />}

        {/* QuickBooks Online card */}
        {!isLoading && (
          <>
            <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">QuickBooks Online</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Import employees and time records directly from QuickBooks — eliminates the CSV
                    export step.
                  </p>
                </div>
                {status?.connected ? (
                  <Badge variant="compliant">Connected</Badge>
                ) : (
                  <Badge variant="neutral">Not connected</Badge>
                )}
              </div>

              {status?.connected ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Realm ID:</span>{' '}
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {status.realmId}
                    </span>
                  </p>

                  {status.nearExpiry && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      Your QuickBooks connection expires soon. Reconnect to maintain access.
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { window.location.href = '/api/integrations/qbo/connect'; }}
                    >
                      Reconnect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 border border-red-200"
                      onClick={() => disconnect.mutate()}
                      loading={disconnect.isPending}
                      disabled={disconnect.isPending}
                    >
                      {disconnect.isPending ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => { window.location.href = '/api/integrations/qbo/connect'; }}
                >
                  Connect to QuickBooks
                </Button>
              )}
            </div>

            {status?.connected && <EmployeeMappingSection />}

            {/* Procore connection success banner */}
            {procoreJustConnected && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Procore connected successfully.
              </div>
            )}

            {/* Procore card */}
            <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Procore</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Import timesheet entries directly from Procore projects to populate
                    prevailing wage payroll entries without manual re-entry.
                  </p>
                </div>
                {procoreStatus?.connected ? (
                  <Badge variant="compliant">Connected</Badge>
                ) : (
                  <Badge variant="neutral">Not connected</Badge>
                )}
              </div>

              {procoreStatus?.connected ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Company ID:</span>{' '}
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {procoreStatus.companyId}
                    </span>
                  </p>

                  {procoreStatus.nearExpiry && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      Your Procore connection expires soon. Reconnect to maintain access.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-1">
                    <a
                      href="/procore/import"
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Import Timesheets
                    </a>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { window.location.href = '/api/integrations/procore/connect'; }}
                    >
                      Reconnect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 border border-red-200"
                      onClick={() => disconnectProcore.mutate()}
                      loading={disconnectProcore.isPending}
                      disabled={disconnectProcore.isPending}
                    >
                      {disconnectProcore.isPending ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => { window.location.href = '/api/integrations/procore/connect'; }}
                >
                  Connect to Procore
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-500">
              QuickBooks and Procore credentials are stored encrypted with AES-256-GCM and never
              appear in plaintext.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
