export type TrustControlStatus = 'implemented' | 'needs-evidence' | 'action-needed' | 'planned';

export type TrustControl = {
  id: string;
  label: string;
  category: 'access' | 'data' | 'audit' | 'operations' | 'compliance';
  status: TrustControlStatus;
  evidence: string;
  buyerProof: string;
  nextAction?: string;
};

export const TRUST_CONTROLS: TrustControl[] = [
  {
    id: 'mfa',
    label: 'Multi-factor authentication',
    category: 'access',
    status: 'action-needed',
    evidence: 'TOTP MFA is available for every user account.',
    buyerProof: 'Account-level MFA status is exposed in the security dashboard and evidence room.',
    nextAction: 'Require MFA before enterprise pilot signoff.',
  },
  {
    id: 'session-revocation',
    label: 'Session revocation',
    category: 'access',
    status: 'implemented',
    evidence: 'Session versioning invalidates previously issued JWTs after revoke-sessions.',
    buyerProof: 'Users can revoke active sessions from the account security dashboard.',
  },
  {
    id: 'tenant-rbac',
    label: 'Tenant isolation and RBAC',
    category: 'access',
    status: 'implemented',
    evidence: 'Project access checks enforce owner, member, and auditor boundaries on scoped routes.',
    buyerProof: 'Auditors can review evidence without payroll write access.',
  },
  {
    id: 'ssn-encryption',
    label: 'Worker data encryption',
    category: 'data',
    status: 'implemented',
    evidence: 'Sensitive worker identifiers use AES-256-GCM envelopes before persistence.',
    buyerProof: 'APIs expose SSN last four only and never return full plaintext SSNs.',
  },
  {
    id: 'security-events',
    label: 'Security event logging',
    category: 'audit',
    status: 'needs-evidence',
    evidence: 'Login and session security events are written to an account-scoped audit table.',
    buyerProof: 'Users can export recent security events as CSV or JSON for auditor review.',
    nextAction: 'Generate at least one recent security event before each enterprise evidence review.',
  },
  {
    id: 'audit-integrity',
    label: 'Audit hash-chain integrity',
    category: 'audit',
    status: 'implemented',
    evidence: 'Project audit events support integrity verification and evidence packet export.',
    buyerProof: 'Evidence packets include payroll weeks, imports, submit-ready results, and project audit records.',
  },
  {
    id: 'backup-restore',
    label: 'Backup and restore drill',
    category: 'operations',
    status: 'needs-evidence',
    evidence: 'Daily backups are part of the production operating model.',
    buyerProof: 'Enterprise review should include the latest restore-drill date and owner attestation.',
    nextAction: 'Attach a dated restore-drill result before public enterprise launch.',
  },
  {
    id: 'incident-response',
    label: 'Incident response',
    category: 'operations',
    status: 'implemented',
    evidence: 'Responsible disclosure target is 72-hour acknowledgement and 14-day remediation timeline.',
    buyerProof: 'Security contact and response commitments are published on the public security page.',
  },
  {
    id: 'soc2',
    label: 'SOC 2 readiness',
    category: 'compliance',
    status: 'planned',
    evidence: 'SOC 2 Type II audit is planned after production pilot evidence is collected.',
    buyerProof: 'Current posture is presented as in progress, not as completed certification.',
    nextAction: 'Collect pilot evidence, restore-drill proof, and access-review records before audit kickoff.',
  },
];

const STATUS_WEIGHT: Record<TrustControlStatus, number> = {
  implemented: 1,
  'needs-evidence': 0.55,
  'action-needed': 0.25,
  planned: 0,
};

export function summarizeTrustControls(controls: TrustControl[] = TRUST_CONTROLS) {
  const counts = controls.reduce<Record<TrustControlStatus, number>>(
    (acc, control) => {
      acc[control.status] += 1;
      return acc;
    },
    { implemented: 0, 'needs-evidence': 0, 'action-needed': 0, planned: 0 },
  );

  const weightedScore = controls.reduce((sum, control) => sum + STATUS_WEIGHT[control.status], 0);
  const readinessPercent = controls.length === 0 ? 0 : Math.round((weightedScore / controls.length) * 100);

  return {
    readinessPercent,
    counts,
    openItems: controls
      .filter((control) => control.status !== 'implemented')
      .map((control) => ({
        id: control.id,
        label: control.label,
        status: control.status,
        nextAction: control.nextAction ?? control.evidence,
      })),
  };
}

export function categoryLabel(category: TrustControl['category']): string {
  switch (category) {
    case 'access':
      return 'Access';
    case 'data':
      return 'Data Protection';
    case 'audit':
      return 'Auditability';
    case 'operations':
      return 'Operations';
    case 'compliance':
      return 'Compliance';
  }
}
