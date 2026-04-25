import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Layout } from '../components/shared/Layout.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';

interface QboStatusResponse {
  data: {
    connected: boolean;
    realmId?: string;
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
    nearExpiry?: boolean;
  };
}

export function IntegrationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<QboStatusResponse>({
    queryKey: ['qbo-status'],
    queryFn: () => api.get<QboStatusResponse>('/api/integrations/qbo/status'),
  });

  const disconnect = useMutation({
    mutationFn: () => api.delete<unknown>('/api/integrations/qbo'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qbo-status'] }),
  });

  const status = data?.data;

  return (
    <Layout>
      <PageHeader
        title="Integrations"
        subtitle="Connect third-party services to streamline your prevailing wage workflow."
      />

      <div className="max-w-2xl space-y-6">
        {/* QuickBooks Online card */}
        <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">QuickBooks Online</h2>
              <p className="text-sm text-gray-600 mt-1">
                Import employees and time records directly from QuickBooks — eliminates the CSV
                export step.
              </p>
            </div>
            {isLoading ? null : status?.connected ? (
              <Badge variant="compliant">Connected</Badge>
            ) : (
              <Badge variant="neutral">Not connected</Badge>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-400">Checking connection status...</p>
          ) : status?.connected ? (
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

        <p className="text-xs text-gray-500">
          QuickBooks credentials are stored encrypted with AES-256-GCM and never appear in
          plaintext.
        </p>
      </div>
    </Layout>
  );
}
