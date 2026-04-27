export type PlanTier = 'starter' | 'pro' | 'enterprise';

const LIMITS: Record<PlanTier, { maxMembers: number; maxProjects: number; maxWorkers: number }> = {
  starter:    { maxMembers: 2, maxProjects: 3, maxWorkers: 25 },
  pro:        { maxMembers: 10, maxProjects: Infinity, maxWorkers: Infinity },
  enterprise: { maxMembers: 999, maxProjects: Infinity, maxWorkers: Infinity },
};

export function getMemberLimit(tier: PlanTier): number {
  return LIMITS[tier].maxMembers;
}

export function getLimits(tier: PlanTier): { maxMembers: number; maxProjects: number; maxWorkers: number } {
  return LIMITS[tier];
}
