export type PlanTier = 'starter' | 'pro' | 'enterprise';

const LIMITS: Record<PlanTier, { maxMembers: number }> = {
  starter:    { maxMembers: 2 },
  pro:        { maxMembers: 10 },
  enterprise: { maxMembers: 999 },
};

export function getMemberLimit(tier: PlanTier): number {
  return LIMITS[tier]?.maxMembers ?? 2;
}
