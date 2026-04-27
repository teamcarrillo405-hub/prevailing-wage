import { useMutation, useQuery } from '@tanstack/react-query';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

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

interface BillingUsage {
  projectCount: number;
  workerCount: number;
  memberCount: number;
  limits: {
    maxProjects: number;
    maxWorkers: number;
    maxMembers: number;
  };
  planTier: 'starter' | 'pro' | 'enterprise';
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

// ── UsageBar — inline subcomponent ────────────────────────────────────────────

interface UsageBarProps {
  label: string;
  used: number;
  max: number;
}

function UsageBar({ label, used, max }: UsageBarProps) {
  if (max === Infinity) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-sm text-gray-500">Unlimited</span>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((used / max) * 100));
  const isWarning = pct >= 80;

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className={`text-sm ${isWarning ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {used} / {max}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full transition-all ${isWarning ? 'bg-red-500' : 'bg-brand-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function UsageBarSkeleton() {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
        <div className="h-4 w-12 rounded bg-gray-200 animate-pulse" />
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 animate-pulse" />
    </div>
  );
}

// ── BillingPage ───────────────────────────────────────────────────────────────

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

  const { data: usage } = useQuery<BillingUsage>({
    queryKey: ['billing-usage'],
    queryFn: () =>
      fetch('/api/billing/usage', { credentials: 'include' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          priceId: 'price_pro_placeholder',
          quantity: team?.members?.length ?? 1,
        }),
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
        <LoadingSpinner />
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

  // Determine if any usage dimension is at or above 80% of its finite limit
  const showUpgradeCta = !isPro && usage !== undefined && (
    (usage.limits.maxProjects !== Infinity && Math.round((usage.projectCount / usage.limits.maxProjects) * 100) >= 80) ||
    (usage.limits.maxWorkers !== Infinity && Math.round((usage.workerCount / usage.limits.maxWorkers) * 100) >= 80) ||
    (usage.limits.maxMembers !== Infinity && Math.round((usage.memberCount / usage.limits.maxMembers) * 100) >= 80)
  );

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

      {/* Usage card */}
      <Card padding="default" className="mb-6">
        <h2 className="font-headline text-lg mb-4">Usage</h2>
        {usage ? (
          <div className="divide-y divide-gray-100">
            <UsageBar label="Projects" used={usage.projectCount} max={usage.limits.maxProjects} />
            <UsageBar label="Workers" used={usage.workerCount} max={usage.limits.maxWorkers} />
            <UsageBar label="Team Members" used={usage.memberCount} max={usage.limits.maxMembers} />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <UsageBarSkeleton />
            <UsageBarSkeleton />
            <UsageBarSkeleton />
          </div>
        )}

        {showUpgradeCta && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Button
              variant="primary"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending || portalMutation.isPending}
            >
              {checkoutMutation.isPending ? 'Redirecting...' : 'Upgrade to Pro — Unlock Unlimited'}
            </Button>
          </div>
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
