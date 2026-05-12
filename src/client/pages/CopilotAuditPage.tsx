import { useQuery } from '@tanstack/react-query';
import { Bot, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { api } from '../lib/api';

interface CopilotInteraction {
  id: string;
  projectId: string | null;
  payrollWeekId: string | null;
  pagePath: string | null;
  userMessage: string;
  assistantMessage: string;
  suggestions: unknown;
  modelUsed: string;
  latencyMs: number | null;
  createdAt: string;
}

interface CopilotLedgerResponse {
  data: CopilotInteraction[];
}

function actionLabel(message: string) {
  if (message.startsWith('[apply-action:')) return 'Applied action';
  if (message.startsWith('[reviewed-action:')) return 'Reviewed plan';
  if (message.startsWith('[rejected-action:')) return 'Rejected plan';
  if (message.startsWith('[prepare-action:')) return 'Prepared plan';
  return 'Chat guidance';
}

function actionTone(message: string) {
  if (message.startsWith('[apply-action:')) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (message.startsWith('[rejected-action:')) return 'border-red-200 bg-red-50 text-red-800';
  if (message.startsWith('[prepare-action:')) return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-gray-200 bg-gray-100 text-gray-700';
}

export function CopilotAuditPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['copilot-audit'],
    queryFn: () => api.get<CopilotLedgerResponse>('/copilot/interactions?limit=100'),
  });

  const interactions = data?.data ?? [];
  const applied = interactions.filter((item) => item.userMessage.startsWith('[apply-action:')).length;
  const prepared = interactions.filter((item) => item.userMessage.startsWith('[prepare-action:')).length;
  const reviewed = interactions.filter((item) => item.userMessage.startsWith('[reviewed-action:')).length;

  return (
    <Layout>
      <PageHeader
        title="Copilot Audit"
        subtitle="Review Copilot guidance, prepared plans, approvals, rejections, and applied actions."
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Applied actions</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{applied}</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-brand-gold" aria-hidden="true" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Prepared plans</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{prepared}</p>
            </div>
            <Bot className="h-5 w-5 text-brand-gold" aria-hidden="true" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Reviewed plans</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{reviewed}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-brand-gold" aria-hidden="true" />
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Copilot audit ledger is unavailable.
        </Card>
      ) : interactions.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-10 w-10 text-gray-400" />}
          title="No Copilot activity yet"
          message="Use the Copilot on a project or payroll page to create the first audited interaction."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="divide-y divide-gray-100">
            {interactions.map((item) => (
              <article key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${actionTone(item.userMessage)}`}>
                      {actionLabel(item.userMessage)}
                    </span>
                    <h2 className="mt-2 text-sm font-semibold text-gray-900">{item.assistantMessage}</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.pagePath ?? 'No page path'} · {item.modelUsed}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="mt-3 rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">User / action request</p>
                  <p className="mt-1 break-words text-sm text-gray-700">{item.userMessage}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
