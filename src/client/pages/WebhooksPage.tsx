// src/client/pages/WebhooksPage.tsx
// Route: /settings/webhooks — manage webhook endpoints.
// Protected route (requires auth).

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Send, ChevronDown, ChevronUp, Webhook } from 'lucide-react';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  failureCount: number;
  lastDeliveredAt: string | null;
  createdAt: string;
}

interface Delivery {
  id: string;
  event: string;
  statusCode: number | null;
  responseBody: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  retryCount: number;
  status: 'pending' | 'succeeded' | 'failed';
}

const AVAILABLE_EVENTS = [
  { value: 'payroll.submitted', label: 'Payroll Submitted', description: 'Fired when a payroll week is marked as submitted to an agency' },
  { value: 'violation.detected', label: 'Violation Detected', description: 'Fired when a compliance check finds wage or apprentice-ratio violations' },
  { value: 'worker.added', label: 'Worker Added', description: 'Fired when a new worker is created on a project' },
  { value: 'payroll.week.created', label: 'Payroll Week Created', description: 'Fired when a new payroll week is opened for a project' },
  { value: 'cpr.submitted', label: 'CPR Submitted', description: 'Fired when a certified payroll report is submitted to an agency' },
  { value: 'subcontractor.cpr.received', label: 'Subcontractor CPR Received', description: 'Fired when a subcontractor CPR week record is created or uploaded' },
  { value: 'compliance.cleared', label: 'Compliance Cleared', description: 'Fired when all violations are resolved for a payroll week' },
  { value: '*', label: 'All Events', description: 'Subscribe to all current and future events' },
] as const;

type EventValue = typeof AVAILABLE_EVENTS[number]['value'];

export function WebhooksPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<EventValue[]>(['payroll.submitted']);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [urlError, setUrlError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get<{ data: WebhookRow[] }>('/webhooks'),
  });

  const { data: deliveryData, refetch: refetchDeliveries } = useQuery({
    queryKey: ['webhook-deliveries', expandedId],
    queryFn: () => expandedId ? api.get<{ data: Delivery[] }>(`/webhooks/${expandedId}/deliveries`) : null,
    enabled: !!expandedId,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<{ data: WebhookRow }>('/webhooks', { url: newUrl, events: selectedEvents }),
    onSuccess: () => {
      setShowModal(false);
      setNewUrl('');
      setSelectedEvents(['payroll.submitted']);
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/webhooks/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/webhooks/${id}/test`, {}),
    onSuccess: (_, id) => {
      if (expandedId === id) refetchDeliveries();
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries', id] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: ({ webhookId, deliveryId }: { webhookId: string; deliveryId: string }) =>
      api.post(`/webhooks/${webhookId}/deliveries/${deliveryId}/retry`, {}),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries', vars.webhookId] });
    },
  });

  const webhooks = data?.data ?? [];
  const deliveries = deliveryData?.data ?? [];

  function toggleEvent(ev: EventValue) {
    setSelectedEvents(prev =>
      prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]
    );
  }

  function validateUrl(url: string) {
    try { new URL(url); setUrlError(''); return true; } catch { setUrlError('Must be a valid URL'); return false; }
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Layout>
      <div className="w-full md:max-w-2xl md:mx-auto">
      <PageHeader
        title="Webhooks"
        subtitle="Receive real-time HTTP notifications when payroll is submitted or violations are detected."
      />

      <div className="flex justify-end mb-6">
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Webhook
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Webhook className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700 mb-1">No webhooks configured</p>
          <p className="text-sm">Add a webhook URL to receive real-time event notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Webhook header */}
              <div className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono text-gray-900 truncate">{wh.url}</code>
                    <span
                      className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        wh.active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {wh.active ? 'Active' : 'Inactive'}
                    </span>
                    {wh.failureCount > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {wh.failureCount} failure{wh.failureCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {wh.events.map(ev => (
                      <span key={ev} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {ev}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Last delivered: {formatDate(wh.lastDeliveredAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => testMutation.mutate(wh.id)}
                    disabled={testMutation.isPending}
                    className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Send test ping"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleMutation.mutate({ id: wh.id, active: !wh.active })}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      wh.active
                        ? 'border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {wh.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this webhook?')) deleteMutation.mutate(wh.id);
                    }}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    {expandedId === wh.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Deliveries panel */}
              {expandedId === wh.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Deliveries</h4>
                  {deliveries.length === 0 ? (
                    <p className="text-sm text-gray-500">No deliveries recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {deliveries.map(d => (
                        <div key={d.id} className="bg-white border border-gray-200 rounded-lg p-3 text-xs">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className={`font-mono px-2 py-0.5 rounded text-xs ${
                              d.status === 'succeeded' ? 'bg-emerald-100 text-emerald-700'
                              : d.status === 'failed' ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                            }`}>
                              {d.status}{d.statusCode ? ` · ${d.statusCode}` : ''}
                            </span>
                            {d.retryCount > 0 && (
                              <span className="text-xs text-gray-400 ml-1">retry {d.retryCount}/5</span>
                            )}
                            {d.status === 'failed' && (
                              <button
                                onClick={() => retryMutation.mutate({ webhookId: wh.id, deliveryId: d.id })}
                                className="text-xs text-blue-600 hover:underline ml-2"
                                disabled={retryMutation.isPending}
                              >
                                Retry
                              </button>
                            )}
                            <span className="text-blue-700 font-medium">{d.event}</span>
                            <span className="text-gray-400 ml-auto">
                              {formatDate(d.deliveredAt ?? d.failedAt)}
                            </span>
                          </div>
                          {d.responseBody && (
                            <code className="block text-gray-600 truncate">{d.responseBody.slice(0, 150)}</code>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Webhook Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Webhook</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={e => { setNewUrl(e.target.value); validateUrl(e.target.value); }}
                  placeholder="https://your-app.example.com/webhooks"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  autoFocus
                />
                {urlError && <p className="text-xs text-red-600 mt-1">{urlError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Events to subscribe
                </label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map(({ value, label, description }) => (
                    <label key={value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(value)}
                        onChange={() => toggleEvent(value)}
                        className="mt-0.5 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500">{description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                Payloads are signed with HMAC-SHA256. Your signing secret will be shown once after creation.
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setNewUrl(''); setSelectedEvents(['payroll.submitted']); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newUrl || !!urlError || selectedEvents.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? 'Adding...' : 'Add Webhook'}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end md:max-w-2xl */}
    </Layout>
  );
}
