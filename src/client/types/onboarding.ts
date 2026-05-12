export type ContractorRole = 'general_contractor' | 'subcontractor' | 'both';
export type CompanySize = '1_10' | '11_50' | '51_200' | '201_plus';
export type PayrollProvider = 'quickbooks' | 'adp' | 'gusto' | 'paychex' | 'sage_300' | 'sage_100' | 'other' | 'none';
export type AccountingProvider = 'quickbooks' | 'sage_300' | 'other' | 'none';
export type ProjectManagementProvider = 'procore' | 'other' | 'none';

export interface OnboardingAnswers {
  companyName: string;
  hccMembershipNumber: string;
  contractorRole: ContractorRole;
  companySize: CompanySize;
  primaryStates: string[];
  workTypes: string[];
  payrollProvider: PayrollProvider;
  accountingProvider: AccountingProvider;
  projectManagementProvider: ProjectManagementProvider;
  averageWeeklyWorkers: number;
  usesSubcontractors: boolean;
  usesApprentices: boolean;
  fieldTrackingNeeded: boolean;
}

export interface OnboardingProfile {
  completedAt: string;
  onboardingAnswers?: OnboardingAnswers;
  recommendedNextSteps?: string[];
}

export interface OnboardingResponse {
  data: {
    user: {
      companyName: string | null;
      hccMembershipNumber: string | null;
    };
    profile: OnboardingProfile | null;
  };
}
