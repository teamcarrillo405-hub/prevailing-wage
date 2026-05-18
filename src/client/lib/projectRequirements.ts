import {
  assessProjectJurisdiction,
  deriveJurisdictionKind,
  type JurisdictionKind,
  type ProjectJurisdictionInput,
  type RuleItem,
  type ValidationItem,
} from '../../shared/jurisdictionRules';

export type { JurisdictionKind };

export type ProjectRequirementInput = ProjectJurisdictionInput;

export type RequiredFormItem = RuleItem;

export type SetupBlocker = ValidationItem;

export { assessProjectJurisdiction, deriveJurisdictionKind };

export function jurisdictionExplanation(project: ProjectRequirementInput): string {
  return assessProjectJurisdiction(project).explanation;
}

export function requiredFormsForProject(project: ProjectRequirementInput): RequiredFormItem[] {
  return assessProjectJurisdiction(project).forms;
}

export function setupBlockersForProject(project: ProjectRequirementInput): SetupBlocker[] {
  return assessProjectJurisdiction(project).validation;
}
