export type CompetitiveStatus = 'proven' | 'building' | 'gap';

export interface CompetitiveReadinessItem {
  id: string;
  category: string;
  competitorAdvantage: string;
  currentPosition: string;
  executionGate: string;
  testPlan: string;
  status: CompetitiveStatus;
}

export const COMPETITIVE_READINESS: CompetitiveReadinessItem[] = [
  {
    id: 'labor-compliance-coverage',
    category: 'Coverage',
    competitorAdvantage: 'LCPtracker and eMars cover broad labor compliance programs, agency reporting, and mature public works workflows.',
    currentPosition: 'Strong contractor-first CA and federal certified payroll workflow with controlled state readiness gates.',
    executionGate: 'Complete a real California production pilot and close every blocker/high finding before expanding general availability.',
    testPlan: 'Run two real payroll weeks through intake, import, preflight, CA exports, WH-347 when applicable, review, and audit package export.',
    status: 'building',
  },
  {
    id: 'payroll-interfaces',
    category: 'Integrations',
    competitorAdvantage: 'Incumbents advertise payroll interfaces and repeatable provider handoff workflows.',
    currentPosition: 'Import pipeline supports QuickBooks, ADP, Gusto, Paychex, Sage 300 CRE, and Sage 100 Contractor with provider guidance and templates.',
    executionGate: 'Validate each provider with contractor source exports and save mapping evidence for every unresolved worker ID.',
    testPlan: 'Preview and commit one sample from each provider, verify unmatched worker handling, and compare committed totals to source payroll.',
    status: 'building',
  },
  {
    id: 'agency-workflows',
    category: 'Agency Workflow',
    competitorAdvantage: 'PRISM and eMars are positioned around prime, subcontractor, agency review, statements of compliance, and audit workflows.',
    currentPosition: 'Auditor roles, subcontractor CPR upload, reviewer permissions, certification, and audit evidence flows are in place.',
    executionGate: 'Prove that prime, subcontractor, and reviewer users can complete the workflow without payroll edit leakage.',
    testPlan: 'Invite an auditor, send a subcontractor CPR request, upload CPR evidence, approve/reject as reviewer, and confirm payroll edits remain blocked.',
    status: 'building',
  },
  {
    id: 'support-training',
    category: 'Support',
    competitorAdvantage: 'LCPtracker publicly emphasizes training, support, and implementation assistance.',
    currentPosition: 'Methodology, pilot runbook, onboarding next steps, and in-app copilot guidance exist but are not yet packaged as a training program.',
    executionGate: 'Publish a repeatable implementation checklist, user roles guide, and first-week certified payroll walkthrough.',
    testPlan: 'Have a new contractor user complete onboarding and first payroll from the guide without live help; log every support gap.',
    status: 'gap',
  },
  {
    id: 'security-trust',
    category: 'Trust',
    competitorAdvantage: 'LCPtracker has public security positioning and FedRAMP marketplace progress.',
    currentPosition: 'MFA, SSO, security events, audit hash chain, public security policy, and role-based access controls are implemented.',
    executionGate: 'Package the security evidence room: controls summary, backup/restore evidence, access review evidence, and incident response process.',
    testPlan: 'Run security export, verify MFA and SSO settings, test auditor access boundaries, and complete a restore-check record.',
    status: 'building',
  },
  {
    id: 'market-proof',
    category: 'Proof',
    competitorAdvantage: 'Incumbents win trust through existing agency adoption, references, and proven project history.',
    currentPosition: 'Product capability is ahead of market proof; pilot evidence and a contractor case study are still required.',
    executionGate: 'Create a signed pilot result summary with exported artifacts, findings log, before/after time savings, and customer quote approval.',
    testPlan: 'Compare manual process time to PrevWage run time, reconcile generated totals, and archive evidence references outside the repo.',
    status: 'gap',
  },
];

export function readinessScore(items: CompetitiveReadinessItem[] = COMPETITIVE_READINESS) {
  const weights: Record<CompetitiveStatus, number> = {
    proven: 1,
    building: 0.55,
    gap: 0,
  };
  const score = items.reduce((sum, item) => sum + weights[item.status], 0) / items.length;
  return Math.round(score * 100);
}

export function readinessCounts(items: CompetitiveReadinessItem[] = COMPETITIVE_READINESS) {
  return items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { proven: 0, building: 0, gap: 0 } as Record<CompetitiveStatus, number>,
  );
}
