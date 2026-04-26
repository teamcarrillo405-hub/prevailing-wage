// src/client/pages/ApiKeysPage.tsx
// Route: /settings/api-keys — manage API keys for the public v1 REST API.
// Protected route (requires auth).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, Trash2, Plus, Key } from 'lucide-react';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface CreatedKey extends ApiKey {
  key: string;
}

const ALL_SCOPES = [
  { value: 'projects:read', label: 'Projects (read)', description: 'Read project metadata and compliance summaries' },
  { value: 'payroll:read', label: 'Payroll (read)', description: 'Read payroll weeks and submission status' },
  { value: 'workers:read', label: 'Workers (read)', description: 'Read worker records (no SSN)' },
] as const;

type Scope = typeof ALL_SCOPES[number]['value'];

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>(['projects:read']);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<{ data: ApiKey[] }>('/keys'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<{ data: CreatedKey }>('/keys', {
        name: newKeyName.trim(),
        scopes: selectedScopes,
      }),
    onSuccess: (result) => {
      setCreatedKey(result.data);
      setShowModal(false);
      setNewKeyName('');
      setSelectedScopes(['projects:read']);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.delete(`/keys/${keyId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const keys = data?.data ?? [];

  function toggleScope(scope: Scope) {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <Layout>
      <div className="w-full md:max-w-2xl md:mx-auto">
      <PageHeader
        title="API Keys"
        subtitle="Manage API keys for programmatic access to your project data."
      />

      <div className="flex items-center justify-between mb-6">
        <Link to="/api-docs" className="text-sm text-blue-600 hover:underline">
          View API Documentation &rarr;
        </Link>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Create Key
        </Button>
      </div>

      {/* One-time key display after creation */}
      {createdKey && (
        <div className="mb-6 border border-amber-300 bg-amber-50 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-900 mb-1">
                API key created — copy it now
              </p>
              <p className="text-sm text-amber-700 mb-3">
                This key will not be shown again. Store it somewhere safe.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 break-all">
                  {createdKey.key}
                </code>
                <button
                  onClick={copyKey}
                  className="flex-shrink-0 p-2 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 transition-colors"
                  title="Copy key"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-amber-700" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-3 text-xs text-amber-600 hover:text-amber-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Keys list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Key className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700 mb-1">No API keys yet</p>
          <p className="text-sm">Create your first key to start using the REST API.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(key => (
            <div key={key.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
              <Key className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{key.name}</span>
                  <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                    {key.keyPrefix}...
                  </code>
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {key.scopes.map(scope => (
                    <span key={scope} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {scope}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Created {formatDate(key.createdAt)}
                  {key.lastUsedAt ? ` · Last used ${formatDate(key.lastUsedAt)}` : ' · Never used'}
                  {key.expiresAt ? ` · Expires ${formatDate(key.expiresAt)}` : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Revoke "${key.name}"? This cannot be undone.`)) {
                    revokeMutation.mutate(key.id);
                  }
                }}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Revoke key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Key Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create API Key</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="e.g. My ERP Integration"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scopes
                </label>
                <div className="space-y-2">
                  {ALL_SCOPES.map(({ value, label, description }) => (
                    <label key={value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(value)}
                        onChange={() => toggleScope(value)}
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
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setNewKeyName(''); setSelectedScopes(['projects:read']); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newKeyName.trim() || selectedScopes.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Key'}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end md:max-w-2xl */}
    </Layout>
  );
}
