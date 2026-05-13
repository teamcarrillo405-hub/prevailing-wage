export type StateLaunchStatus =
  | 'production_pilot'
  | 'controlled_pilot'
  | 'federal_first'
  | 'internal_validation'
  | 'not_supported';

export interface StateSupportConfig {
  state: string;
  name: string;
  status: StateLaunchStatus;
  statusLabel: string;
  posture: string;
  launchDecision: string;
  supportedExports: string[];
  requiredProjectFields: Array<{ key: string; label: string }>;
  nextGate: string;
}

export const STATE_SUPPORT: StateSupportConfig[] = [
  {
    state: 'CA',
    name: 'California',
    status: 'production_pilot',
    statusLabel: 'Production Pilot',
    posture: 'Strongest support: eCPR readiness, A-1-131, fringe breakdown, daily OT/DT, project fields, and tests.',
    launchDecision: 'Use as the primary production proving ground.',
    supportedExports: ['A-1-131 PDF', 'CA eCPR XML', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'cslbLicense', label: 'CSLB license' },
      { key: 'wcPolicyNumber', label: 'Workers comp policy' },
      { key: 'contractorFein', label: 'Contractor FEIN' },
      { key: 'dirProjectId', label: 'DIR project ID' },
      { key: 'awardingAgency', label: 'Awarding agency' },
      { key: 'contractNumber', label: 'Contract number' },
    ],
    nextGate: 'Complete real contractor UAT and resolve all blocker/high findings.',
  },
  {
    state: 'WA',
    name: 'Washington',
    status: 'controlled_pilot',
    statusLabel: 'Controlled Pilot',
    posture: 'F700, CPR XML, L&I fields, trade codes, and route tests are in place.',
    launchDecision: 'Run with selected contractors before broad sales.',
    supportedExports: ['F700 PDF', 'WA CPR XML', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'ubiNumber', label: 'UBI number' },
      { key: 'lniCertificate', label: 'L&I certificate' },
      { key: 'wcAccount', label: 'Workers comp account' },
      { key: 'pwiaIntentId', label: 'PWIA intent ID' },
    ],
    nextGate: 'Validate PWIA workflow and generated XML against current L&I portal expectations.',
  },
  {
    state: 'NY',
    name: 'New York',
    status: 'controlled_pilot',
    statusLabel: 'Controlled Pilot',
    posture: 'PW-12, MPWR XML, and route tests are in place.',
    launchDecision: 'Pilot after current electronic CPR requirements are confirmed.',
    supportedExports: ['PW-12 PDF', 'MPWR XML', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'nyprcNumber', label: 'PRC number' },
      { key: 'nysContractorRegNumber', label: 'NYS contractor registration' },
    ],
    nextGate: 'Confirm latest electronic certified payroll effective dates and submission format.',
  },
  {
    state: 'IL',
    name: 'Illinois',
    status: 'controlled_pilot',
    statusLabel: 'Controlled Pilot',
    posture: 'IDOL/PDF support, non-prevailing-hours capture, and tests are in place.',
    launchDecision: 'Pilot after agency package review.',
    supportedExports: ['IL Certified Transcript PDF', 'WH-347 PDF'],
    requiredProjectFields: [],
    nextGate: 'Validate mixed public/private hour handling with pilot payroll.',
  },
  {
    state: 'MA',
    name: 'Massachusetts',
    status: 'controlled_pilot',
    statusLabel: 'Controlled Pilot',
    posture: 'CPR PDF, MA-specific fields, and tests are in place.',
    launchDecision: 'Pilot after DLS field review.',
    supportedExports: ['MA DLS payroll PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'maDlsProjectId', label: 'DLS project ID' },
      { key: 'maSicCode', label: 'SIC code' },
    ],
    nextGate: 'Validate DLS package against a real project and payroll week.',
  },
  {
    state: 'NJ',
    name: 'New Jersey',
    status: 'controlled_pilot',
    statusLabel: 'Controlled Pilot',
    posture: 'MW-562 export, deduction fields, and tests are in place.',
    launchDecision: 'Pilot after deduction and worker demographic review.',
    supportedExports: ['MW-562 PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'njPwcNumber', label: 'PWC number' },
      { key: 'njContractId', label: 'Contract ID' },
    ],
    nextGate: 'Validate MW-562 output with a contractor payroll owner.',
  },
  {
    state: 'TX',
    name: 'Texas',
    status: 'federal_first',
    statusLabel: 'Federal-First',
    posture: 'Strong federal Davis-Bacon use case and WD coverage; limited state-specific burden.',
    launchDecision: 'Position for federal projects first unless local/state reporting applies.',
    supportedExports: ['TX CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'txdotProjectId', label: 'TxDOT project ID' },
      { key: 'txContractorLicense', label: 'Contractor license' },
      { key: 'txAwardingAgency', label: 'Awarding agency' },
    ],
    nextGate: 'Confirm whether each target project has TxDOT or local reporting requirements.',
  },
  {
    state: 'MN',
    name: 'Minnesota',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'Generator and route are available; workflow is not externally released.',
    launchDecision: 'Use internally until route, UI, preflight, and pilot evidence are complete.',
    supportedExports: ['MN DLI payroll PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'mnContractId', label: 'Contract ID' }],
    nextGate: 'Validate the route and project-field workflow with pilot data before customer use.',
  },
  {
    state: 'VA',
    name: 'Virginia',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'Generator and route are available; workflow is not externally released.',
    launchDecision: 'Use internally until route, UI, preflight, and pilot evidence are complete.',
    supportedExports: ['VA DOLI payroll PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'vaContractId', label: 'Contract ID' }],
    nextGate: 'Validate the route and project-field workflow with pilot data before customer use.',
  },
];

export function getStateSupport(state: string | null | undefined): StateSupportConfig {
  const normalized = (state ?? '').trim().toUpperCase();
  return STATE_SUPPORT.find((item) => item.state === normalized) ?? {
    state: normalized || 'FED',
    name: normalized || 'Federal',
    status: 'not_supported',
    statusLabel: 'Not Supported',
    posture: 'No state-specific package has been validated for this jurisdiction.',
    launchDecision: 'Use WH-347 only when a federal Davis-Bacon package applies; do not offer state-specific export.',
    supportedExports: ['WH-347 PDF'],
    requiredProjectFields: [],
    nextGate: 'Complete state source review, field mapping, export validation, and pilot UAT.',
  };
}

export function isStateSpecificExportEnabled(state: string | null | undefined): boolean {
  const support = getStateSupport(state);
  return support.status !== 'not_supported';
}

export function validateStateProjectField(
  state: string | null | undefined,
  key: string,
  value: unknown,
): string | null {
  const support = getStateSupport(state);
  const field = support.requiredProjectFields.find((candidate) => candidate.key === key);
  if (!field) return null;

  const text = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (!text) return `${field.label} is required.`;

  if (support.state === 'CA' && key === 'contractorFein') {
    const digits = text.replace(/\D/g, '');
    if (!/^\d{9}$/.test(digits)) {
      return 'Contractor FEIN must be exactly 9 digits.';
    }
  }

  return null;
}
