export type JurisdictionKind = 'federal' | 'state' | 'local' | 'layered' | 'private';
export type JurisdictionLayer = 'federal' | 'state' | 'local' | 'private';

export interface ProjectJurisdictionInput {
  state: string;
  county?: string | null;
  contractType: string;
  fundingType: string;
  awardingAgency?: string | null;
  contractNumber?: string | null;
  dirProjectId?: string | null;
  wdIdentifier?: string | null;
}

export interface RuleItem {
  id: string;
  label: string;
  reason: string;
  status: 'required' | 'review' | 'not_applicable';
  fixTo?: string;
}

export interface ValidationItem {
  field: string;
  title: string;
  detail: string;
  fixTo: string;
}

interface RuleLayerConfig {
  layer: JurisdictionLayer;
  forms: RuleItem[];
  evidence: RuleItem[];
  exportPackage: RuleItem[];
  validation: ValidationItem[];
  wageSourcePrompt: string;
}

export interface JurisdictionAssessment {
  kind: JurisdictionKind;
  layers: JurisdictionLayer[];
  explanation: string;
  precedence: string;
  wageSourcePrompt: string;
  forms: RuleItem[];
  evidence: RuleItem[];
  exportPackage: RuleItem[];
  validation: ValidationItem[];
}

const FEDERAL_RULE: RuleLayerConfig = {
  layer: 'federal',
  wageSourcePrompt: 'Lock the SAM.gov wage determination used for classifications, basic hourly rates, fringes, and the statement of compliance.',
  forms: [
    {
      id: 'wh347',
      label: 'Federal WH-347 certified payroll',
      reason: 'Required for Davis-Bacon or federally funded certified payroll preparation.',
      status: 'required',
      fixTo: '#wage-determinations',
    },
  ],
  evidence: [
    {
      id: 'federal-wage-determination',
      label: 'Locked wage determination and classifications',
      reason: 'Auditors need the wage decision, modification, construction type, and classification source used for each worker.',
      status: 'required',
      fixTo: '#wage-determinations',
    },
    {
      id: 'federal-fringe-statement',
      label: 'Fringe and statement of compliance evidence',
      reason: 'Federal review depends on cash fringe, benefit credit, deduction, signature, and certification support.',
      status: 'required',
      fixTo: '#contractor-signature',
    },
  ],
  exportPackage: [
    {
      id: 'federal-cpr-package',
      label: 'WH-347 PDF plus audit evidence packet',
      reason: 'Federal exports should include payroll rows, statement of compliance, signature, wage decision, and correction history.',
      status: 'required',
      fixTo: '#required-forms',
    },
  ],
  validation: [
    {
      field: 'awardingAgency',
      title: 'Awarding agency is missing',
      detail: 'Add the public agency that controls the project so exports, evidence, and reviewer language identify the right recipient.',
      fixTo: '/settings?field=awardingAgency#project-facts',
    },
    {
      field: 'wdIdentifier',
      title: 'Wage determination is not locked',
      detail: 'Lock the wage determination used for classifications and payroll calculations before certified payroll export.',
      fixTo: '#wage-determinations',
    },
  ],
};

const CA_RULE: RuleLayerConfig = {
  layer: 'state',
  wageSourcePrompt: 'Use California public works fields with the DIR project ID, awarding agency, contract number, and state form package review.',
  forms: [
    {
      id: 'ca-a1131',
      label: 'California A-1-131',
      reason: 'California public works projects need the state CPR package fields and contractor/project identifiers.',
      status: 'required',
      fixTo: '/settings#state-fields',
    },
    {
      id: 'ca-ecpr',
      label: 'California DIR eCPR XML',
      reason: 'DIR project ID, awarding agency, contract number, FEIN, and fringe breakdowns are checked before export.',
      status: 'required',
      fixTo: '/settings?field=dirProjectId#state-fields',
    },
  ],
  evidence: [
    {
      id: 'ca-dir-identifiers',
      label: 'DIR project and contractor identifiers',
      reason: 'California exports depend on DIR project ID, FEIN, awarding agency, contract number, and contractor license evidence.',
      status: 'required',
      fixTo: '/settings?field=dirProjectId#state-fields',
    },
    {
      id: 'ca-fringe-breakdown',
      label: 'California fringe and deduction breakdown',
      reason: 'State review expects deductions, contributions, cash fringe, and benefit credits to reconcile to payroll source data.',
      status: 'required',
      fixTo: '#required-forms',
    },
  ],
  exportPackage: [
    {
      id: 'ca-package',
      label: 'A-1-131 PDF, DIR eCPR XML, and evidence packet',
      reason: 'California pilot exports should include project identifiers, payroll rows, fringe breakdowns, signature, and evidence.',
      status: 'required',
      fixTo: '#required-forms',
    },
  ],
  validation: [
    {
      field: 'awardingAgency',
      title: 'Awarding agency is missing',
      detail: 'Add the public agency from the California award record so forms and evidence packets identify the correct recipient.',
      fixTo: '/settings?field=awardingAgency#project-facts',
    },
    {
      field: 'dirProjectId',
      title: 'California DIR project ID is missing',
      detail: 'Enter the DIR project ID before generating California eCPR materials.',
      fixTo: '/settings?field=dirProjectId#state-fields',
    },
    {
      field: 'contractNumber',
      title: 'Contract number is missing',
      detail: 'Enter the contract number so California forms and evidence packets match the award record.',
      fixTo: '/settings?field=contractNumber#project-facts',
    },
  ],
};

function stateReviewRule(state: string): RuleLayerConfig {
  return {
    layer: 'state',
    wageSourcePrompt: `${state} prevailing wage support is partially configured. Confirm the official wage source and agency package before export.`,
    forms: [
      {
        id: `${state.toLowerCase()}-state-review`,
        label: `${state} state CPR package`,
        reason: 'State prevailing wage requirements are partially configured and should be reviewed before submission.',
        status: 'review',
        fixTo: '/settings#state-fields',
      },
    ],
    evidence: [
      {
        id: `${state.toLowerCase()}-state-evidence-review`,
        label: `${state} state evidence review`,
        reason: 'Confirm state-specific wage source, forms, apprenticeship expectations, and submission evidence before export.',
        status: 'review',
        fixTo: '/settings#state-fields',
      },
    ],
    exportPackage: [
      {
        id: `${state.toLowerCase()}-review-package`,
        label: `${state} state package review`,
        reason: 'State-specific export support is not fully validated for this project and should be reviewed before submission.',
        status: 'review',
        fixTo: '/settings#state-fields',
      },
    ],
    validation: [
      {
        field: 'awardingAgency',
        title: 'Awarding agency is missing',
        detail: 'Add the public agency that controls the state prevailing wage project before preparing exports.',
        fixTo: '/settings?field=awardingAgency#project-facts',
      },
    ],
  };
}

const LOCAL_REVIEW_RULE: RuleLayerConfig = {
  layer: 'local',
  wageSourcePrompt: 'Confirm whether a city, county, school district, transit, housing, port, airport, or other local agency ordinance adds stricter requirements.',
  forms: [
    {
      id: 'local-review',
      label: 'Local ordinance / agency review',
      reason: 'Local public agencies can add stricter wage, apprenticeship, evidence, or submission requirements.',
      status: 'review',
      fixTo: '/settings#project-facts',
    },
  ],
  evidence: [
    {
      id: 'local-ordinance-evidence',
      label: 'Local ordinance or agency instruction',
      reason: 'If the local agency has an ordinance or portal package, attach or record the instruction before export.',
      status: 'review',
      fixTo: '/settings#project-facts',
    },
  ],
  exportPackage: [
    {
      id: 'local-review-package',
      label: 'Local agency package review',
      reason: 'Local overlays are not silently assumed; the project should carry a review item until the ordinance is configured.',
      status: 'review',
      fixTo: '/settings#project-facts',
    },
  ],
  validation: [
    {
      field: 'awardingAgency',
      title: 'Local controlling agency is missing',
      detail: 'Add the local agency so the team can confirm whether a city, county, district, port, airport, or authority rule applies.',
      fixTo: '/settings?field=awardingAgency#project-facts',
    },
  ],
};

const PRIVATE_RULE: RuleLayerConfig = {
  layer: 'private',
  wageSourcePrompt: 'Confirm whether the contract or funding source adds prevailing wage requirements before treating this as outside scope.',
  forms: [
    {
      id: 'none-configured',
      label: 'No prevailing wage forms configured',
      reason: 'Confirm the contract and funding source before treating the project as outside prevailing wage scope.',
      status: 'review',
      fixTo: '/settings#project-facts',
    },
  ],
  evidence: [],
  exportPackage: [],
  validation: [],
};

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function uniqueByField(items: ValidationItem[]): ValidationItem[] {
  return Array.from(new Map(items.map((item) => [item.field, item])).values());
}

export function deriveJurisdictionKind(project: ProjectJurisdictionInput): JurisdictionKind {
  if (project.contractType === 'private') return 'private';
  if (project.fundingType === 'mixed') return 'layered';
  if (project.fundingType === 'federal' || project.contractType === 'federal-davis-bacon') return 'federal';
  if (project.contractType === 'state-prevailing' || project.fundingType === 'state') return 'state';
  return 'local';
}

export function assessProjectJurisdiction(project: ProjectJurisdictionInput): JurisdictionAssessment {
  const kind = deriveJurisdictionKind(project);
  const state = project.state?.toUpperCase() || 'FED';
  const stateRule = state === 'CA' ? CA_RULE : stateReviewRule(state);
  const rules =
    kind === 'private' ? [PRIVATE_RULE]
    : kind === 'federal' ? [FEDERAL_RULE]
    : kind === 'state' ? [stateRule]
    : kind === 'local' ? [LOCAL_REVIEW_RULE]
    : [FEDERAL_RULE, stateRule, LOCAL_REVIEW_RULE];

  const explanations: Record<JurisdictionKind, string> = {
    layered: 'Mixed funding means federal baseline rules may apply while state or local public works requirements can also control stricter forms, evidence, or payroll checks.',
    federal: 'Federal funding or a Davis-Bacon contract type points this project to WH-347, wage determination, fringe, certified payroll, and evidence checks.',
    state: `${state} state prevailing wage settings drive the state form checklist, wage source prompts, and export expectations.`,
    local: 'This project may depend on city, county, school district, transit, housing, port, airport, or other local agency rules. Confirm the local ordinance before export.',
    private: 'Private projects do not automatically require prevailing wage forms unless the contract or funding source adds those requirements.',
  };

  const precedence: Record<JurisdictionKind, string> = {
    layered: 'Apply the federal baseline first, keep state or local requirements when they are stricter or require different forms, and flag unconfigured local rules for review instead of assuming they are clear.',
    federal: 'Use the federal Davis-Bacon baseline as the controlling package unless the award documents add state or local overlays.',
    state: 'Use the state prevailing wage package as controlling for forms and project identifiers; federal WH-347 is included only when federal funding or contract facts require it.',
    local: 'Use the local agency requirement as a review overlay until the ordinance, wage source, and submission package are configured.',
    private: 'Do not apply public works forms automatically; require contract or funding evidence before adding prevailing wage obligations.',
  };

  return {
    kind,
    layers: rules.map((rule) => rule.layer),
    explanation: explanations[kind],
    precedence: precedence[kind],
    wageSourcePrompt: rules.map((rule) => rule.wageSourcePrompt).join(' '),
    forms: uniqueById(rules.flatMap((rule) => rule.forms)),
    evidence: uniqueById(rules.flatMap((rule) => rule.evidence)),
    exportPackage: uniqueById(rules.flatMap((rule) => rule.exportPackage)),
    validation: uniqueByField(rules.flatMap((rule) => rule.validation)).filter((item) => {
      const value = project[item.field as keyof ProjectJurisdictionInput];
      return typeof value === 'string' ? !value.trim() : value == null;
    }),
  };
}
