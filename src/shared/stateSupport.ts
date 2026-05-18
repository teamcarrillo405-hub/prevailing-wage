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
    supportedExports: ['PW-12 PDF', 'MPWR XML', 'NYC DCAS CPR PDF', 'WH-347 PDF'],
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
  {
    state: 'PA',
    name: 'Pennsylvania',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'PA-CPR generator and route available; not externally released.',
    launchDecision: 'Pilot after PA Prevailing Wage Bureau field review.',
    supportedExports: ['PA-CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'paContractId', label: 'PA contract ID' },
      { key: 'paContractorLicense', label: 'PA contractor license' },
    ],
    nextGate: 'Validate PA-CPR output against a real PennDOT or municipal project.',
  },
  {
    state: 'OH',
    name: 'Ohio',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'OH PWC-28 generator available; not released.',
    launchDecision: 'Pilot after Ohio Department of Commerce field review.',
    supportedExports: ['OH PWC-28 PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'ohContractId', label: 'OH contract ID' },
      { key: 'ohAwardingAuthority', label: 'Awarding authority' },
    ],
    nextGate: 'Validate against real Ohio public works project.',
  },
  {
    state: 'CO',
    name: 'Colorado',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'CO COWC CPR generator available.',
    launchDecision: 'Pilot after COWC field review.',
    supportedExports: ['CO COWC CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'coContractId', label: 'CO contract ID' },
      { key: 'coAwardingAgency', label: 'Awarding agency' },
    ],
    nextGate: 'Validate against real CO public works project.',
  },
  {
    state: 'MD',
    name: 'Maryland',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'MD DLLR CPR generator available.',
    launchDecision: 'Pilot after DLLR field review.',
    supportedExports: ['MD DLLR CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'mdContractId', label: 'MD contract ID' },
      { key: 'mdAwardingAgency', label: 'Awarding agency' },
    ],
    nextGate: 'Validate against real MD public works project.',
  },
  {
    state: 'OR',
    name: 'Oregon',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'OR BOLI CPR generator available.',
    launchDecision: 'Pilot after BOLI field review.',
    supportedExports: ['OR BOLI CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'orBoliProjectId', label: 'BOLI project ID' },
      { key: 'orContractorCcb', label: 'CCB license number' },
    ],
    nextGate: 'Validate against real OR public works project.',
  },
  {
    state: 'CT',
    name: 'Connecticut',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'CT DOL CPR generator available.',
    launchDecision: 'Pilot after CT DOL field review.',
    supportedExports: ['CT DOL CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'ctContractId', label: 'CT contract ID' }],
    nextGate: 'Validate against real CT municipal project.',
  },
  {
    state: 'HI',
    name: 'Hawaii',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'HI DLI CPR generator with daily OT/DT support available.',
    launchDecision: 'Pilot after HI DLI field review.',
    supportedExports: ['HI DLI CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'hiContractId', label: 'HI contract ID' },
      { key: 'hiAwardingAgency', label: 'Awarding agency' },
    ],
    nextGate: 'Validate DT columns against real HI public works project.',
  },
  {
    state: 'KY',
    name: 'Kentucky',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'KY CPR generator available.',
    launchDecision: 'Pilot after KY Labor Cabinet review.',
    supportedExports: ['KY CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'kyContractId', label: 'KY contract ID' }],
    nextGate: 'Validate against real KY public works project.',
  },
  {
    state: 'NM',
    name: 'New Mexico',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'NM DOL CPR generator available.',
    launchDecision: 'Pilot after NM DOL field review.',
    supportedExports: ['NM DOL CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'nmContractId', label: 'NM contract ID' }],
    nextGate: 'Validate against real NM public works project.',
  },
  {
    state: 'NV',
    name: 'Nevada',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'NV DIR CPR generator available.',
    launchDecision: 'Pilot after NV DIR field review.',
    supportedExports: ['NV DIR CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'nvContractId', label: 'NV contract ID' },
      { key: 'nvContractorLicense', label: 'NV contractor license' },
    ],
    nextGate: 'Validate against real NV public works project.',
  },
  {
    state: 'RI',
    name: 'Rhode Island',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'RI DOL CPR generator available.',
    launchDecision: 'Pilot after RI DOL review.',
    supportedExports: ['RI DOL CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'riContractId', label: 'RI contract ID' }],
    nextGate: 'Validate against real RI public works project.',
  },
  {
    state: 'WV',
    name: 'West Virginia',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'WV DOL CPR generator available.',
    launchDecision: 'Pilot after WV DOL review.',
    supportedExports: ['WV DOL CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'wvContractId', label: 'WV contract ID' }],
    nextGate: 'Validate against real WV public works project.',
  },
  {
    state: 'ME',
    name: 'Maine',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'ME DOL CPR generator available.',
    launchDecision: 'Pilot after ME DOL review.',
    supportedExports: ['ME DOL CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'meContractId', label: 'ME contract ID' }],
    nextGate: 'Validate against real ME public works project.',
  },
  {
    state: 'VT',
    name: 'Vermont',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'VT DFR CPR generator available.',
    launchDecision: 'Pilot after VT DFR review.',
    supportedExports: ['VT DFR CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'vtContractId', label: 'VT contract ID' }],
    nextGate: 'Validate against real VT public works project.',
  },
  {
    state: 'MT',
    name: 'Montana',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'MT DLI CPR generator available.',
    launchDecision: 'Pilot after MT DLI review.',
    supportedExports: ['MT DLI CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'mtContractId', label: 'MT contract ID' }],
    nextGate: 'Validate against real MT public works project.',
  },
  {
    state: 'ND',
    name: 'North Dakota',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'ND DLT CPR generator available.',
    launchDecision: 'Pilot after ND DLT review.',
    supportedExports: ['ND DLT CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'ndContractId', label: 'ND contract ID' }],
    nextGate: 'Validate against real ND public works project.',
  },
  {
    state: 'DE',
    name: 'Delaware',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'DE DOL CPR generator available.',
    launchDecision: 'Pilot after DE DOL review.',
    supportedExports: ['DE DOL CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'deContractId', label: 'DE contract ID' }],
    nextGate: 'Validate against real DE public works project.',
  },
  {
    state: 'NH',
    name: 'New Hampshire',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'NH DOT CPR generator available. Highway projects only (RSA 228:22). Not general public works.',
    launchDecision: 'Pilot after NH DOT review. Note narrow scope — highway contracts only.',
    supportedExports: ['NH DOT CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [{ key: 'nhContractId', label: 'NH contract ID' }],
    nextGate: 'Validate against real NH DOT highway project.',
  },
  {
    state: 'AK',
    name: 'Alaska',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'AK DOL CPR generator available with Sunday-first week order.',
    launchDecision: 'Pilot after AK DOL review.',
    supportedExports: ['AK DOL CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'akContractId', label: 'AK contract ID' },
      { key: 'akAwardingAgency', label: 'Awarding agency' },
    ],
    nextGate: 'Validate against real AK public works project.',
  },
  {
    state: 'DC',
    name: 'Washington DC',
    status: 'internal_validation',
    statusLabel: 'Internal Validation',
    posture: 'DC OCP CPR generator available. DC uses DOES rates, NOT federal Davis-Bacon.',
    launchDecision: 'Pilot after DC DOES field review. Confirm DC wage rates imported correctly.',
    supportedExports: ['DC OCP CPR PDF', 'WH-347 PDF'],
    requiredProjectFields: [
      { key: 'dcContractNumber', label: 'DC contract number' },
      { key: 'dcAgency', label: 'DC agency' },
      { key: 'dcBusinessLicense', label: 'DC business license' },
    ],
    nextGate: 'Import DC DOES wage rates; validate output against real DC OCP project.',
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
