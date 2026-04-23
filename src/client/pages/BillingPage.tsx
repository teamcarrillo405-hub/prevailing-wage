import { useMutation, useQuery } from '@tanstack/react-query';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

interface BillingStatus {
  customerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  planTier: 'starter' | 'pro' | 'enterprise';
}

interface TeamData {
  members: { id: string; email: string; role: string; joinedAt: string }[];
  pendingInvite: { id: string; email: string; expiresAt: string } | null;
  isOwner: boolean;
}

const PLAN_LABELS: Record<BillingStatus['planTier'], string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const STATUS_BADGE: Record<string, 'compliant' | 'warning' | 'neutral' | 'violation'> = {
  active: 'compliant',
  trialing: 'warning',
  past_due: 'violation',
  canceled: 'neutral',
  unpaid: 'violation',
};

export function BillingPage() {
  const { data: billing, isLoading: billingLoading, error: billingError } = useQuery<BillingStatus>({
    queryKey: ['billing-status'],
    queryFn: () =>
      fetch('/api/billing/status', { credentials: 'include' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
  });

  const { data: team, isLoading: teamLoading, error: teamError } = useQuery<TeamData>({
    queryKey: ['team'],
    queryFn: () =>
      fetch('/api/team', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => d.data),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId: 'price_pro_placeholder' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error?: string }).error ?? 'Checkout failed');
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error?: string }).error ?? 'Portal failed');
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const isOwner = team?.isOwner ?? false;
  const isLoading = billingLoading || teamLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-16 text-gray-500">Loading...</div>
      </Layout>
    );
  }

  if (teamError) {
    return (
      <Layout>
        <PageHeader title="Billing" subtitle="Manage your subscription and plan" />
        <Card padding="default">
          <p className="text-sm text-red-600">Could not load team information. Please try again.</p>
        </Card>
      </Layout>
    );
  }

  if (billingError) {
    return (
      <Layout>
        <PageHeader title="Billing" subtitle="Manage your plan and subscription" />
        <Card padding="default">
          <p className="text-sm text-red-600">
            Could not load billing information. Please try again later.
          </p>
        </Card>
      </Layout>
    );
  }

  const planTier = billing?.planTier ?? 'starter';
  const subscriptionStatus = billing?.subscriptionStatus;
  const hasSubscription = !!billing?.subscriptionId;
  const isPro = planTier === 'pro' || planTier === 'enterprise';

  const mutationError = checkoutMutation.error?.message ?? portalMutation.error?.message ?? null;

  return (
    <Layout>
      <PageHeader title="Billing" subtitle="Manage your plan and subscription" />

      <Card padding="default" className="mb-6">
        <h2 className="font-headline text-lg mb-4">Current Plan</h2>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-text-primary">{PLAN_LABELS[planTier]}</span>
          {subscriptionStatus && (
            <Badge variant={STATUS_BADGE[subscriptionStatus] ?? 'neutral'}>
              {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
            </Badge>
          )}
        </div>
        {planTier === 'starter' && (
          <p className="text-sm text-gray-500 mt-2">
            You are on the free Starter plan. Upgrade to Pro for unlimited projects and advanced
            compliance features.
          </p>
        )}
        {planTier === 'pro' && (
          <p className="text-sm text-gray-500 mt-2">
            You have access to all Pro features including unlimited projects and advanced reporting.
          </p>
        )}
        {planTier === 'enterprise' && (
          <p className="text-sm text-gray-500 mt-2">
            You are on the Enterprise plan. Contact support for billing changes.
          </p>
        )}
      </Card>

      {isOwner ? (
        <Card padding="default">
          <h2 className="font-headline text-lg mb-4">Manage Billing</h2>

          {mutationError && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700 mb-4">
              {mutationError}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {!isPro && (
              <Button
                variant="primary"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending || portalMutation.isPending}
              >
                {checkoutMutation.isPending ? 'Redirecting...' : 'Upgrade to Pro'}
              </Button>
            )}

            {hasSubscription && (
              <Button
                variant="secondary"
                onClick={() => portalMutation.mutate()}
                disabled={checkoutMutation.isPending || portalMutation.isPending}
              >
                {portalMutation.isPending ? 'Redirecting...' : 'Manage Subscription'}
              </Button>
            )}

            {isPro && !hasSubscription && (
              <p className="text-sm text-gray-500">
                No active subscription found. Contact support if this is unexpected.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <Card padding="default">
          <h2 className="font-headline text-lg mb-2">Billing Management</h2>
          <p className="text-sm text-gray-500">
            Only the account owner can manage billing and subscriptions.
          </p>
        </Card>
      )}
    </Layout>
  );
}
