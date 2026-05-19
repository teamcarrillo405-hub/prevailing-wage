import { Layout } from '../components/shared/Layout.js';
import { PageHeader } from '../components/ui/PageHeader.js';

export function SettingsPage() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        <PageHeader title="Settings" subtitle="Account and integration preferences" />

        {/* QuickBooks Integration */}
        <div className="bg-surface-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-headline text-lg text-white">QuickBooks Integration</h3>
              <p className="text-sm text-surface-muted mt-0.5">Sync certified payroll to QuickBooks Online as Journal Entries</p>
            </div>
            <span className="px-2 py-1 text-xs rounded bg-surface-page text-surface-muted border border-surface-card">Not Connected</span>
          </div>
          <p className="text-sm text-surface-muted">To connect QuickBooks Online, set the <code className="text-brand-gold">QB_CLIENT_ID</code> and <code className="text-brand-gold">QB_CLIENT_SECRET</code> environment variables and restart the server.</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(['Labor','Fringe','Tax'] as const).map(type => (
              <div key={type} className="bg-surface-page rounded-lg p-3">
                <p className="text-xs text-surface-muted mb-1">{type} Account</p>
                <input placeholder="QB Account ID" disabled className="w-full bg-surface-card text-surface-muted text-sm rounded px-2 py-1 border border-surface-card cursor-not-allowed" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
