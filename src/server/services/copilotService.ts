import { randomUUID } from 'crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import {
  copilotInteractions,
  onboardingProfiles,
  payrollEntries,
  payrollImports,
  payrollWeeks,
  projectMembers,
  projectWageDeterminations,
  projects,
  users,
  wageClassifications,
  wageDeterminations,
  workerClassifications,
  workers,
} from '../db/schema.js';
import { assertProjectAccess } from '../utils/assertProjectAccess.js';
import { calculateCertifiedPayrollPay } from './calculations.js';
import { computeCompliance } from './complianceService.js';
import { computeSubmitReady } from './submitReadyService.js';

const MODEL = process.env.COPILOT_MODEL || 'claude-3-5-haiku-20241022';
const LOCAL_MODEL = 'prevwage-copilot-rules-v1';
const MAX_VISIBLE_FIELDS = 30;
const MAX_FIELD_VALUE_LENGTH = 180;

export const copilotVisibleFieldSchema = z.object({
  label: z.string().max(120).optional(),
  name: z.string().max(120).optional(),
  type: z.string().max(40).optional(),
  value: z.string().max(500).optional(),
});

export const copilotPageContextSchema = z.object({
  pageLabel: z.string().max(120).optional(),
  routeKind: z.string().max(80).optional(),
  sectionLabel: z.string().max(120).optional(),
  hash: z.string().max(120).optional(),
  visibleHeadings: z.array(z.string().max(140)).max(12).optional(),
  primaryActions: z.array(z.string().max(120)).max(12).optional(),
  alerts: z.array(z.string().max(240)).max(12).optional(),
});

export const copilotChatSchema = z.object({
  message: z.string().min(2).max(2000),
  pagePath: z.string().max(300).optional(),
  projectId: z.string().optional(),
  payrollWeekId: z.string().optional(),
  visibleFields: z.array(copilotVisibleFieldSchema).max(80).optional(),
  pageContext: copilotPageContextSchema.optional(),
});

export const copilotPrepareActionSchema = z.object({
  actionId: z.string().min(2).max(120),
  pagePath: z.string().max(300).optional(),
  projectId: z.string().optional(),
  payrollWeekId: z.string().optional(),
  visibleFields: z.array(copilotVisibleFieldSchema).max(80).optional(),
  pageContext: copilotPageContextSchema.optional(),
});

export const copilotAcknowledgeActionSchema = z.object({
  actionId: z.string().min(2).max(120),
  title: z.string().min(2).max(200),
  decision: z.enum(['reviewed', 'rejected']),
  pagePath: z.string().max(300).optional(),
  projectId: z.string().optional(),
  payrollWeekId: z.string().optional(),
  pageContext: copilotPageContextSchema.optional(),
});

export const copilotApplyActionSchema = z.object({
  actionId: z.enum(['prepare-missing-wd', 'review-week-violations', 'prepare-import-review']),
  confirm: z.literal(true),
  pagePath: z.string().max(300).optional(),
  projectId: z.string().optional(),
  payrollWeekId: z.string().optional(),
  pageContext: copilotPageContextSchema.optional(),
});

export interface CopilotSuggestion {
  id: string;
  title: string;
  description: string;
  actionType: 'review' | 'navigate' | 'prepare_fix' | 'none';
  target?: string;
}

export interface CopilotPreparedAction {
  id: string;
  actionId: string;
  status: 'draft_review' | 'reviewed' | 'rejected';
  title: string;
  summary: string;
  findings: string[];
  proposedSteps: string[];
  warnings: string[];
  approvalRequired: boolean;
  applySupported: boolean;
  applyLabel?: string;
  targetRoute?: string;
}

export interface CopilotCitation {
  id: string;
  label: string;
  source: 'project' | 'wage_determination' | 'payroll_week' | 'compliance' | 'import' | 'onboarding' | 'export';
  detail: string;
}

export interface CopilotReadinessItem {
  id: string;
  label: string;
  status: 'complete' | 'warning' | 'blocked' | 'not_started';
  detail: string;
  actionId?: string;
}

export interface CopilotStateSnapshot {
  projectId: string | null;
  payrollWeekId: string | null;
  readinessScore: number;
  readinessStatus: 'setup_incomplete' | 'wd_missing' | 'payroll_empty' | 'violations_blocking' | 'ready_for_review' | 'ready_to_export' | 'filed_or_archived';
  headline: string;
  items: CopilotReadinessItem[];
  citations: CopilotCitation[];
  suggestedActions: CopilotSuggestion[];
}

export interface CopilotResponse {
  answer: string;
  nextSteps: string[];
  warnings: string[];
  suggestions: CopilotSuggestion[];
  citations: CopilotCitation[];
  readiness?: CopilotStateSnapshot;
  confidence: number;
  modelUsed: string;
  interactionId: string;
}

type CopilotContext = Awaited<ReturnType<typeof buildCopilotContext>>;

let anthropicClient: { messages: { create: (opts: any) => Promise<any> } } | null = null;

async function getAnthropicClient(): Promise<{ messages: { create: (opts: any) => Promise<any> } }> {
  if (!anthropicClient) {
    const AnthropicModule = await import('@anthropic-ai/sdk');
    const AnthropicClass = AnthropicModule.default ?? AnthropicModule;
    anthropicClient = new AnthropicClass({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function parseJsonArray<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sanitizeVisibleFields(fields: z.infer<typeof copilotVisibleFieldSchema>[] | undefined) {
  const blocked = /(ssn|social|password|secret|token|key|bank|routing|account)/i;
  return (fields ?? [])
    .filter((field) => {
      const haystack = `${field.label ?? ''} ${field.name ?? ''} ${field.type ?? ''}`;
      return !blocked.test(haystack);
    })
    .slice(0, MAX_VISIBLE_FIELDS)
    .map((field) => ({
      label: field.label ?? null,
      name: field.name ?? null,
      type: field.type ?? null,
      value: (field.value ?? '').slice(0, MAX_FIELD_VALUE_LENGTH),
    }));
}

function sanitizePageContext(pageContext: z.infer<typeof copilotPageContextSchema> | undefined) {
  if (!pageContext) return null;
  const cleanText = (value: string | undefined, max: number) => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const cleanList = (values: string[] | undefined, maxItems: number, maxChars: number) =>
    (values ?? [])
      .map((value) => cleanText(value, maxChars))
      .filter(Boolean)
      .slice(0, maxItems);

  return {
    pageLabel: cleanText(pageContext.pageLabel, 120) || null,
    routeKind: cleanText(pageContext.routeKind, 80) || null,
    sectionLabel: cleanText(pageContext.sectionLabel, 120) || null,
    hash: cleanText(pageContext.hash, 120) || null,
    visibleHeadings: cleanList(pageContext.visibleHeadings, 10, 140),
    primaryActions: cleanList(pageContext.primaryActions, 10, 120),
    alerts: cleanList(pageContext.alerts, 10, 240),
  };
}

function totalHours(entry: typeof payrollEntries.$inferSelect) {
  return [
    entry.monSt, entry.tueSt, entry.wedSt, entry.thuSt, entry.friSt, entry.satSt, entry.sunSt,
    entry.monOt, entry.tueOt, entry.wedOt, entry.thuOt, entry.friOt, entry.satOt, entry.sunOt,
    entry.monDt, entry.tueDt, entry.wedDt, entry.thuDt, entry.friDt, entry.satDt, entry.sunDt,
  ].reduce((sum, value) => sum + (value ?? 0), 0);
}

function entryPayMath(entry: typeof payrollEntries.$inferSelect) {
  const straightTimeHours = [
    entry.monSt, entry.tueSt, entry.wedSt, entry.thuSt, entry.friSt, entry.satSt, entry.sunSt,
  ].reduce((sum, value) => sum + (value ?? 0), 0);
  const overtimeHours = [
    entry.monOt, entry.tueOt, entry.wedOt, entry.thuOt, entry.friOt, entry.satOt, entry.sunOt,
  ].reduce((sum, value) => sum + (value ?? 0), 0);
  const doubleTimeHours = [
    entry.monDt, entry.tueDt, entry.wedDt, entry.thuDt, entry.friDt, entry.satDt, entry.sunDt,
  ].reduce((sum, value) => sum + (value ?? 0), 0);
  const pay = calculateCertifiedPayrollPay({
    baseRate: entry.baseRateSnapshot,
    fringeRate: entry.fringeRateSnapshot,
    straightTimeHours,
    overtimeHours,
    doubleTimeHours,
  });
  const grossWages = Math.round(pay.totalWeeklyCost * 100) / 100;
  const netPay = Math.round((grossWages - (entry.deductions ?? 0)) * 100) / 100;
  return { grossWages, netPay };
}

function buildBaseCitations(context: CopilotContext): CopilotCitation[] {
  const citations: CopilotCitation[] = [];

  if (context.project) {
    citations.push({
      id: 'project-location',
      label: 'Project location',
      source: 'project',
      detail: `${context.project.name}: ${context.project.county}, ${context.project.state}`,
    });
    citations.push({
      id: 'project-contract-type',
      label: 'Contract type',
      source: 'project',
      detail: context.project.contractType,
    });
    if (context.project.wdIdentifier) {
      citations.push({
        id: 'project-wd-lock',
        label: 'Locked wage determination',
        source: 'wage_determination',
        detail: `${context.project.wdIdentifier}${context.project.wdModNumber != null ? ` revision ${context.project.wdModNumber}` : ''}`,
      });
    }
  }

  if (context.payrollWeek) {
    citations.push({
      id: 'payroll-week',
      label: 'Payroll week',
      source: 'payroll_week',
      detail: `Payroll #${context.payrollWeek.payrollNumber}, week ending ${context.payrollWeek.weekEndingDate}`,
    });
  }

  if (context.weekSummary?.compliance) {
    citations.push({
      id: 'compliance-result',
      label: 'Compliance engine',
      source: 'compliance',
      detail: `${context.weekSummary.compliance.totalViolations} issue(s): ${context.weekSummary.compliance.wageViolations} wage, ${context.weekSummary.compliance.weekViolations} week-level, ${context.weekSummary.compliance.deductionViolations} deduction.`,
    });
  }

  if (context.onboarding) {
    citations.push({
      id: 'onboarding-profile',
      label: 'Onboarding profile',
      source: 'onboarding',
      detail: `${context.onboarding.contractorRole}; payroll provider ${context.onboarding.payrollProvider ?? 'not set'}`,
    });
  }

  return citations;
}

export async function buildCopilotContext(input: {
  userId: string;
  pagePath?: string;
  projectId?: string;
  payrollWeekId?: string;
  visibleFields?: z.infer<typeof copilotVisibleFieldSchema>[];
  pageContext?: z.infer<typeof copilotPageContextSchema>;
}) {
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      companyName: users.companyName,
      hccMembershipNumber: users.hccMembershipNumber,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  const [onboarding] = await db
    .select()
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, input.userId))
    .limit(1);

  let projectId = input.projectId;
  let payrollWeek: typeof payrollWeeks.$inferSelect | null = null;

  if (input.payrollWeekId) {
    const [week] = await db
      .select()
      .from(payrollWeeks)
      .where(eq(payrollWeeks.id, input.payrollWeekId))
      .limit(1);
    if (week) {
      payrollWeek = week;
      if (projectId && week.projectId !== projectId) {
        const err = new Error('Payroll week does not belong to the selected project') as Error & { status?: number };
        err.status = 400;
        throw err;
      }
      projectId = projectId ?? week.projectId;
    }
  }

  let project: typeof projects.$inferSelect | null = null;
  let projectRole: string | null = null;
  let projectSummary = null as null | {
    workerCount: number;
    classificationCount: number;
    payrollWeekCount: number;
    recentWeeks: Array<{ id: string; payrollNumber: number; weekEndingDate: string; submittedAt: string | null }>;
    wageDeterminations: Array<{ wdNumber: string; revisionNumber: number; county: string | null; constructionType: string | null }>;
  };
  let weekSummary = null as null | {
    entryCount: number;
    totalHours: number;
    grossWages: number;
    compliance: {
      hasViolations: boolean;
      totalViolations: number;
      wageViolations: number;
      weekViolations: number;
      deductionViolations: number;
      examples: string[];
    } | null;
  };

  if (projectId) {
    const access = await assertProjectAccess(db, projectId, input.userId);
    project = access.project;
    projectRole = access.role;

    const workerRows = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.projectId, projectId));
    const classRows = await db
      .select({ id: workerClassifications.id })
      .from(workerClassifications)
      .where(eq(workerClassifications.projectId, projectId));
    const weekRows = await db
      .select()
      .from(payrollWeeks)
      .where(eq(payrollWeeks.projectId, projectId))
      .orderBy(desc(payrollWeeks.weekEndingDate))
      .limit(5);
    const wdRows = await db
      .select({
        wdNumber: wageDeterminations.wdNumber,
        revisionNumber: wageDeterminations.revisionNumber,
        county: wageDeterminations.county,
        constructionType: wageDeterminations.constructionType,
      })
      .from(wageDeterminations)
      .where(
        and(
          eq(wageDeterminations.state, project.state),
          eq(wageDeterminations.isActive, true),
        ),
      )
      .limit(5);

    projectSummary = {
      workerCount: workerRows.length,
      classificationCount: classRows.length,
      payrollWeekCount: weekRows.length,
      recentWeeks: weekRows.map((week: typeof payrollWeeks.$inferSelect) => ({
        id: week.id,
        payrollNumber: week.payrollNumber,
        weekEndingDate: week.weekEndingDate,
        submittedAt: week.submittedAt,
      })),
      wageDeterminations: wdRows,
    };
  } else if (input.pageContext?.routeKind !== 'dashboard') {
    const [membership] = await db
      .select({ project: projects })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(and(eq(projectMembers.userId, input.userId), isNull(projectMembers.removedAt)))
      .orderBy(desc(projects.updatedAt))
      .limit(1);
    project = membership?.project ?? null;
  }

  if (payrollWeek) {
    const entryRows = await db
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.payrollWeekId, payrollWeek.id));
    const compliance = await computeCompliance(db, payrollWeek.id);
    const examples = [
      ...(compliance?.violations ?? []).slice(0, 3).map((v) => `${v.workerName}: ${v.violationType}`),
      ...(compliance?.weekViolations ?? []).slice(0, 2).map((v) => v.detail),
      ...(compliance?.deductionViolations ?? []).slice(0, 2).map((v) => `${v.workerName}: deduction ratio ${v.deductionPct.toFixed(1)}%`),
    ];

    weekSummary = {
      entryCount: entryRows.length,
      totalHours: entryRows.reduce((sum: number, entry: typeof payrollEntries.$inferSelect) => sum + totalHours(entry), 0),
      grossWages: entryRows.reduce((sum: number, entry: typeof payrollEntries.$inferSelect) => sum + (entry.grossWages ?? 0), 0),
      compliance: compliance
        ? {
            hasViolations: compliance.hasViolations,
            totalViolations: compliance.violations.length + compliance.weekViolations.length + compliance.deductionViolations.length,
            wageViolations: compliance.violations.length,
            weekViolations: compliance.weekViolations.length,
            deductionViolations: compliance.deductionViolations.length,
            examples,
          }
        : null,
    };
  }

  return {
    user: user
      ? {
          companyName: user.companyName,
          hasHccMembershipNumber: Boolean(user.hccMembershipNumber),
        }
      : null,
    onboarding: onboarding
      ? {
          contractorRole: onboarding.contractorRole,
          companySize: onboarding.companySize,
          primaryStates: parseJsonArray<string[]>(onboarding.primaryStates, []),
          workTypes: parseJsonArray<string[]>(onboarding.workTypes, []),
          payrollProvider: onboarding.payrollProvider,
          accountingProvider: onboarding.accountingProvider,
          projectManagementProvider: onboarding.projectManagementProvider,
          usesSubcontractors: onboarding.usesSubcontractors,
          usesApprentices: onboarding.usesApprentices,
          recommendedNextSteps: parseJsonArray<string[]>(onboarding.recommendedNextSteps, []),
        }
      : null,
    page: {
      path: input.pagePath ?? null,
      context: sanitizePageContext(input.pageContext),
      visibleFields: sanitizeVisibleFields(input.visibleFields),
    },
    project: project
      ? {
          id: project.id,
          name: project.name,
          state: project.state,
          county: project.county,
          contractType: project.contractType,
          fundingType: project.fundingType,
          wdIdentifier: project.wdIdentifier,
          wdModNumber: project.wdModNumber,
          role: projectRole,
          isIraIijaProject: project.isIraIijaProject,
        }
      : null,
    projectSummary,
    payrollWeek: payrollWeek
      ? {
          id: payrollWeek.id,
          payrollNumber: payrollWeek.payrollNumber,
          weekEndingDate: payrollWeek.weekEndingDate,
          submittedAt: payrollWeek.submittedAt,
          isFinal: payrollWeek.isFinal,
        }
      : null,
    weekSummary,
  };
}

function buildLocalResponse(message: string, context: CopilotContext, readiness?: CopilotStateSnapshot): Omit<CopilotResponse, 'modelUsed' | 'interactionId'> {
  const lower = message.toLowerCase();
  const suggestions: CopilotSuggestion[] = [];
  const warnings: string[] = [];
  const nextSteps: string[] = [];

  if (!context.onboarding) {
    suggestions.push({
      id: 'complete-onboarding',
      title: 'Complete onboarding',
      description: 'Onboarding lets PrevWage preselect payroll provider, state forms, subcontractor tracking, and project defaults.',
      actionType: 'navigate',
      target: '/onboarding',
    });
    nextSteps.push('Complete onboarding so the Copilot can tailor guidance to your business.');
  }

  if (context.page.context?.pageLabel) {
    nextSteps.push(`You are on ${context.page.context.pageLabel}${context.page.context.sectionLabel ? `, section ${context.page.context.sectionLabel}` : ''}.`);
  }

  if (context.weekSummary?.compliance?.hasViolations) {
    warnings.push(`${context.weekSummary.compliance.totalViolations} compliance issue(s) are currently detected for this payroll week.`);
    nextSteps.push('Open the payroll week compliance panel and review under-wage, overtime, deduction, and apprentice warnings before export.');
    suggestions.push({
      id: 'review-week-violations',
      title: 'Prepare violation review',
      description: context.weekSummary.compliance.examples[0] ?? 'Compliance issues need review before certified payroll submission.',
      actionType: 'prepare_fix',
    });
  }

  if (context.project && !context.project.wdIdentifier && context.project.contractType === 'federal-davis-bacon') {
    warnings.push('This federal project does not show a locked wage determination identifier.');
    nextSteps.push('Use Wage Lookup or the project wage determination panel to pin the correct WD before payroll entry.');
    suggestions.push({
      id: 'prepare-missing-wd',
      title: 'Prepare WD setup',
      description: 'Create a checklist to lock the right federal wage determination before payroll is filed.',
      actionType: 'prepare_fix',
    });
  }

  if (lower.includes('quickbooks') || lower.includes('import')) {
    nextSteps.push('Verify worker mappings after import, then confirm each classification and rate snapshot before committing payroll entries.');
    suggestions.push({
      id: 'prepare-import-review',
      title: 'Prepare import review',
      description: 'Draft a payroll import review plan for worker mappings, classifications, hours, and rates.',
      actionType: 'prepare_fix',
    });
  }

  if (lower.includes('classification') || lower.includes('trade')) {
    nextSteps.push('Use AI Classification Assist for a trade suggestion, then confirm against the project WD and your contract scope.');
    suggestions.push({
      id: 'classification-assist',
      title: 'Open AI Classification Assist',
      description: 'Get an auditable Davis-Bacon trade suggestion from a task description.',
      actionType: 'navigate',
      target: '/classification-assist',
    });
  }

  if (context.project) {
    suggestions.push({
      id: 'prepare-certified-payroll-readiness',
      title: 'Prepare filing readiness',
      description: 'Build a certified payroll readiness checklist for this project or payroll week.',
      actionType: 'prepare_fix',
    });
  }

  if (nextSteps.length === 0) {
    nextSteps.push('Confirm the project, payroll week, worker classification, wage determination, hours, gross wages, deductions, and export form.');
  }

  const answer = context.project
    ? `I can help with ${context.project.name}. Based on the current context, the safest next move is to review the active project/payroll data and fix any missing WD, classification, wage, overtime, deduction, or apprentice items before filing.`
    : 'I can help you set up a project, import payroll, check wage determinations, diagnose violations, and prepare certified payroll. Select a project or payroll week for more specific guidance.';

  return {
    answer,
    nextSteps: nextSteps.slice(0, 5),
    warnings,
    suggestions: suggestions.slice(0, 4),
    citations: buildBaseCitations(context),
    readiness,
    confidence: context.project || context.onboarding ? 0.72 : 0.55,
  };
}

const SYSTEM_PROMPT = `You are PrevWage Copilot, a Davis-Bacon and certified payroll workflow assistant for construction contractors.

Your job:
- Help users finish setup, wage determination lookup, worker classification, payroll import, compliance review, WH-347/state CPR export, subcontractor CPR tracking, and audit readiness.
- Use only the provided app context. Do not invent hidden records.
- Use page.context to understand the user's current screen, visible section, alerts, and available actions before giving navigation or form guidance.
- Be practical and specific. Explain the next action in contractor language.
- Never provide legal advice. Say when human review is required.
- Never claim you changed data. You are advisory unless a user explicitly approves a future tool action.
- Treat payroll, SSNs, wage determinations, and worker data as sensitive.

Return ONLY valid JSON:
{
  "answer": "2-5 sentence direct answer",
  "nextSteps": ["short action step"],
  "warnings": ["risk or blocker"],
  "suggestions": [
    {
      "id": "stable-id",
      "title": "short title",
      "description": "what this does",
      "actionType": "review|navigate|prepare_fix|none",
      "target": "optional route or entity"
    }
  ],
  "citations": [
    {
      "id": "stable-id",
      "label": "short label",
      "source": "project|wage_determination|payroll_week|compliance|import|onboarding|export",
      "detail": "specific source detail from context"
    }
  ],
  "confidence": 0.0
}`;

function normalizeAiResponse(raw: unknown): Omit<CopilotResponse, 'modelUsed' | 'interactionId'> {
  const parsed = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const nextSteps = Array.isArray(parsed.nextSteps) ? parsed.nextSteps.filter((x): x is string => typeof x === 'string') : [];
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter((x): x is string => typeof x === 'string') : [];
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
        .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
        .slice(0, 5)
        .map((item, idx): CopilotSuggestion => {
          const actionType: CopilotSuggestion['actionType'] =
            item.actionType === 'navigate' || item.actionType === 'prepare_fix' || item.actionType === 'none'
              ? item.actionType
              : 'review';
          return {
            id: typeof item.id === 'string' ? item.id : `suggestion-${idx + 1}`,
            title: typeof item.title === 'string' ? item.title : 'Review recommendation',
            description: typeof item.description === 'string' ? item.description : '',
            actionType,
            target: typeof item.target === 'string' ? item.target : undefined,
          };
        })
    : [];
  const citations = Array.isArray(parsed.citations)
    ? parsed.citations
        .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
        .slice(0, 8)
        .map((item, idx): CopilotCitation => {
          const source: CopilotCitation['source'] =
            item.source === 'project' ||
            item.source === 'wage_determination' ||
            item.source === 'payroll_week' ||
            item.source === 'compliance' ||
            item.source === 'import' ||
            item.source === 'onboarding' ||
            item.source === 'export'
              ? item.source
              : 'project';
          return {
            id: typeof item.id === 'string' ? item.id : `citation-${idx + 1}`,
            label: typeof item.label === 'string' ? item.label : 'Source',
            source,
            detail: typeof item.detail === 'string' ? item.detail : '',
          };
        })
    : [];
  return {
    answer: typeof parsed.answer === 'string' ? parsed.answer : 'I could not produce a reliable answer from the available context.',
    nextSteps: nextSteps.slice(0, 6),
    warnings: warnings.slice(0, 5),
    suggestions,
    citations,
    confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
  };
}

function readinessStatusFromItems(items: CopilotReadinessItem[], payrollSubmitted: boolean): CopilotStateSnapshot['readinessStatus'] {
  if (payrollSubmitted) return 'filed_or_archived';
  if (items.some((item) => item.id === 'wd-lock' && item.status === 'blocked')) return 'wd_missing';
  if (items.some((item) => item.id === 'payroll-entries' && item.status === 'not_started')) return 'payroll_empty';
  if (items.some((item) => item.id === 'compliance-review' && item.status === 'blocked')) return 'violations_blocking';
  if (items.some((item) => item.status === 'blocked' || item.status === 'not_started')) return 'setup_incomplete';
  if (items.some((item) => item.status === 'warning')) return 'ready_for_review';
  return 'ready_to_export';
}

function scoreReadiness(items: CopilotReadinessItem[]) {
  if (items.length === 0) return 0;
  const points = items.reduce((sum, item) => {
    if (item.status === 'complete') return sum + 1;
    if (item.status === 'warning') return sum + 0.55;
    return sum;
  }, 0);
  return Math.round((points / items.length) * 100);
}

function exportLabelForState(state: string | null | undefined) {
  switch ((state ?? '').toUpperCase()) {
    case 'CA': return 'CA A-1-131 / eCPR XML';
    case 'WA': return 'WA F700-065 / L&I XML';
    case 'NY': return 'NY PW-12 / MPWR XML';
    case 'IL': return 'IL certified transcript';
    case 'MA': return 'MA DLS certified payroll';
    case 'NJ': return 'NJ MW-562';
    case 'TX': return 'TX CPR';
    default: return 'Federal WH-347';
  }
}

export async function buildCopilotStateSnapshot(input: {
  userId: string;
  pagePath?: string;
  projectId?: string;
  payrollWeekId?: string;
  visibleFields?: z.infer<typeof copilotVisibleFieldSchema>[];
  pageContext?: z.infer<typeof copilotPageContextSchema>;
}): Promise<CopilotStateSnapshot> {
  const context = await buildCopilotContext(input);
  const db = getDb();
  const projectId = context.project?.id ?? null;
  const payrollWeekId = context.payrollWeek?.id ?? null;
  const items: CopilotReadinessItem[] = [];
  const citations = buildBaseCitations(context);
  const suggestedActions: CopilotSuggestion[] = [];
  const submitReady = payrollWeekId ? await computeSubmitReady(db, payrollWeekId) : null;

  if (!context.onboarding) {
    items.push({
      id: 'onboarding',
      label: 'Business onboarding',
      status: 'warning',
      detail: 'Onboarding is incomplete, so Copilot cannot preselect all contractor defaults or import prompts.',
      actionId: 'complete-onboarding',
    });
    suggestedActions.push({
      id: 'complete-onboarding',
      title: 'Complete onboarding',
      description: 'Add contractor role, payroll provider, trades, states, and import preferences.',
      actionType: 'navigate',
      target: '/onboarding',
    });
  } else {
    items.push({
      id: 'onboarding',
      label: 'Business onboarding',
      status: 'complete',
      detail: `Profile set for ${context.onboarding.contractorRole}; payroll provider ${context.onboarding.payrollProvider ?? 'not set'}.`,
    });
  }

  if (!context.project) {
    items.push({
      id: 'project',
      label: 'Project selected',
      status: 'not_started',
      detail: 'Select or create a project before Copilot can assess WD, classifications, payroll, and filing readiness.',
    });
    suggestedActions.push({
      id: 'open-projects',
      title: 'Open projects',
      description: 'Go to the project dashboard.',
      actionType: 'navigate',
      target: '/dashboard',
    });
    return {
      projectId: null,
      payrollWeekId: null,
      readinessScore: scoreReadiness(items),
      readinessStatus: 'setup_incomplete',
      headline: 'Select a project to start a readiness review.',
      items,
      citations,
      suggestedActions,
    };
  }

  items.push({
    id: 'project',
    label: 'Project selected',
    status: 'complete',
    detail: `${context.project.name} in ${context.project.county}, ${context.project.state}.`,
  });

  const pinnedWds = projectId
    ? await db
        .select({
          wdNumber: wageDeterminations.wdNumber,
          revisionNumber: wageDeterminations.revisionNumber,
          source: wageDeterminations.source,
          constructionType: projectWageDeterminations.constructionType,
          isPrimary: projectWageDeterminations.isPrimary,
          pinnedAt: projectWageDeterminations.pinnedAt,
        })
        .from(projectWageDeterminations)
        .innerJoin(wageDeterminations, eq(projectWageDeterminations.wageDeterminationId, wageDeterminations.id))
        .where(eq(projectWageDeterminations.projectId, projectId))
        .limit(8)
    : [];

  if (context.project.contractType === 'federal-davis-bacon' && !context.project.wdIdentifier) {
    items.push({
      id: 'wd-lock',
      label: 'Wage determination lock',
      status: 'blocked',
      detail: 'Federal Davis-Bacon project has no locked WD number/modification.',
      actionId: 'prepare-missing-wd',
    });
    suggestedActions.push({
      id: 'prepare-missing-wd',
      title: 'Prepare WD setup',
      description: 'Create a checklist to lock the correct federal WD before payroll filing.',
      actionType: 'prepare_fix',
    });
  } else {
    items.push({
      id: 'wd-lock',
      label: 'Wage determination lock',
      status: pinnedWds.length > 0 || context.project.wdIdentifier ? 'complete' : 'warning',
      detail: context.project.wdIdentifier
        ? `${context.project.wdIdentifier}${context.project.wdModNumber != null ? ` revision ${context.project.wdModNumber}` : ''}`
        : 'No WD lock is required for this project type, but confirm project wage source before payroll.',
    });
  }

  for (const wd of pinnedWds.slice(0, 3)) {
    citations.push({
      id: `pinned-wd-${wd.wdNumber}-${wd.revisionNumber}`,
      label: wd.isPrimary ? 'Primary pinned WD' : 'Pinned WD',
      source: 'wage_determination',
      detail: `${wd.wdNumber} revision ${wd.revisionNumber}; ${wd.constructionType ?? 'construction type not set'}; pinned ${wd.pinnedAt}.`,
    });
  }

  const workerCount = context.projectSummary?.workerCount ?? 0;
  const classificationCount = context.projectSummary?.classificationCount ?? 0;
  items.push({
    id: 'workers',
    label: 'Workers',
    status: workerCount > 0 ? 'complete' : 'not_started',
    detail: workerCount > 0 ? `${workerCount} worker(s) attached to the project.` : 'No workers are attached to the project.',
  });
  items.push({
    id: 'classifications',
    label: 'Classifications',
    status: classificationCount > 0 ? 'complete' : 'not_started',
    detail: classificationCount > 0 ? `${classificationCount} classification record(s) attached.` : 'No project classifications are attached.',
    actionId: classificationCount > 0 ? undefined : 'classification-assist',
  });

  if (!context.payrollWeek) {
    items.push({
      id: 'payroll-week',
      label: 'Payroll week',
      status: 'not_started',
      detail: 'Select or create a payroll week before certified payroll readiness can be completed.',
    });
  } else {
    items.push({
      id: 'payroll-week',
      label: 'Payroll week',
      status: 'complete',
      detail: `Payroll #${context.payrollWeek.payrollNumber}, week ending ${context.payrollWeek.weekEndingDate}.`,
    });
  }

  const entryCount = context.weekSummary?.entryCount ?? 0;
  if (context.payrollWeek) {
    items.push({
      id: 'payroll-entries',
      label: 'Payroll entries',
      status: entryCount > 0 ? 'complete' : 'not_started',
      detail: entryCount > 0
        ? `${entryCount} payroll entr${entryCount === 1 ? 'y' : 'ies'}, ${context.weekSummary?.totalHours.toFixed(1) ?? '0.0'} total hours.`
        : 'This payroll week has no entries.',
      actionId: entryCount > 0 ? undefined : 'prepare-import-review',
    });

    const importRows = payrollWeekId
      ? await db
          .select()
          .from(payrollImports)
          .where(eq(payrollImports.payrollWeekId, payrollWeekId))
          .orderBy(desc(payrollImports.createdAt))
          .limit(3)
      : [];
    items.push({
      id: 'import-review',
      label: 'Import review',
      status: importRows.length > 0
        ? importRows.some((row: typeof payrollImports.$inferSelect) => row.unmatchedCount > 0) ? 'warning' : 'complete'
        : 'warning',
      detail: importRows.length > 0
        ? `${importRows[0].provider} import committed ${importRows[0].committedCount}; unmatched ${importRows[0].unmatchedCount}.`
        : 'No payroll import audit exists for this week; manual entry may still be valid.',
      actionId: 'prepare-import-review',
    });
    if (importRows[0]) {
      citations.push({
        id: `import-${importRows[0].id}`,
        label: 'Latest payroll import',
        source: 'import',
        detail: `${importRows[0].provider}; ${importRows[0].sourceFilename ?? 'no filename'}; ${importRows[0].committedCount} committed, ${importRows[0].unmatchedCount} unmatched.`,
      });
    }

    const compliance = context.weekSummary?.compliance;
    items.push({
      id: 'compliance-review',
      label: 'Compliance review',
      status: compliance?.hasViolations ? 'blocked' : entryCount > 0 ? 'complete' : 'not_started',
      detail: compliance
        ? compliance.hasViolations
          ? `${compliance.totalViolations} issue(s) block clean filing.`
          : 'No wage, overtime, deduction, or week-level issue detected for this context.'
        : 'Compliance has not run for this week.',
      actionId: compliance?.hasViolations ? 'review-week-violations' : undefined,
    });
    if (compliance?.hasViolations) {
      suggestedActions.push({
        id: 'review-week-violations',
        title: 'Prepare violation review',
        description: 'Build a review plan for blocking payroll week compliance issues.',
        actionType: 'prepare_fix',
      });
    }

    if (submitReady) {
      items.push({
        id: 'submit-ready-score',
        label: 'Submit-ready score',
        status: submitReady.blockers > 0 ? 'blocked' : submitReady.warnings > 0 ? 'warning' : 'complete',
        detail: `${submitReady.score}/100. ${submitReady.blockers} blocker(s), ${submitReady.warnings} warning(s).`,
        actionId: submitReady.blockers > 0 ? 'prepare-certified-payroll-readiness' : undefined,
      });
      citations.push({
        id: 'submit-ready',
        label: 'Submit-ready preflight',
        source: 'compliance',
        detail: `${submitReady.status}: ${submitReady.headline}`,
      });
      const firstActionable = submitReady.issues.find((issue) => issue.severity !== 'pass' && issue.actionId);
      if (firstActionable?.actionId && !suggestedActions.some((action) => action.id === firstActionable.actionId)) {
        suggestedActions.push({
          id: firstActionable.actionId,
          title: firstActionable.title,
          description: firstActionable.detail,
          actionType: 'prepare_fix',
        });
      }
    }

    items.push({
      id: 'export-readiness',
      label: 'Export readiness',
      status: entryCount > 0 && !compliance?.hasViolations ? 'complete' : 'blocked',
      detail: `${exportLabelForState(context.project.state)} should be generated only after setup and compliance are clean.`,
      actionId: 'prepare-certified-payroll-readiness',
    });
    citations.push({
      id: 'export-format',
      label: 'Export format',
      source: 'export',
      detail: exportLabelForState(context.project.state),
    });
  }

  if (!suggestedActions.some((action) => action.id === 'prepare-certified-payroll-readiness')) {
    suggestedActions.push({
      id: 'prepare-certified-payroll-readiness',
      title: 'Prepare filing readiness',
      description: 'Build a certified payroll readiness checklist for this context.',
      actionType: 'prepare_fix',
    });
  }

  const readinessScore = scoreReadiness(items);
  const readinessStatus = readinessStatusFromItems(items, Boolean(context.payrollWeek?.submittedAt));
  const headline =
    readinessStatus === 'ready_to_export'
      ? 'This payroll context is ready for final human review and export.'
      : readinessStatus === 'violations_blocking'
        ? 'Compliance issues are blocking clean certified payroll filing.'
        : readinessStatus === 'wd_missing'
          ? 'Lock the wage determination before payroll filing.'
          : readinessStatus === 'payroll_empty'
            ? 'Add or import payroll entries to continue.'
            : readinessStatus === 'filed_or_archived'
              ? 'This payroll week has already been submitted or archived.'
              : 'Setup is still incomplete for launch-quality payroll filing.';

  return {
    projectId,
    payrollWeekId,
    readinessScore,
    readinessStatus,
    headline,
    items,
    citations: citations.slice(0, 10),
    suggestedActions: suggestedActions.slice(0, 6),
  };
}

export async function runCopilotChat(input: {
  userId: string;
  message: string;
  pagePath?: string;
  projectId?: string;
  payrollWeekId?: string;
  visibleFields?: z.infer<typeof copilotVisibleFieldSchema>[];
  pageContext?: z.infer<typeof copilotPageContextSchema>;
}): Promise<CopilotResponse> {
  const startedAt = Date.now();
  const context = await buildCopilotContext(input);
  const readiness = await buildCopilotStateSnapshot({
    userId: input.userId,
    pagePath: input.pagePath,
    projectId: context.project?.id ?? input.projectId,
    payrollWeekId: context.payrollWeek?.id ?? input.payrollWeekId,
    visibleFields: input.visibleFields,
    pageContext: input.pageContext,
  });
  let modelUsed = LOCAL_MODEL;
  let response: Omit<CopilotResponse, 'modelUsed' | 'interactionId'>;

  if (!process.env.ANTHROPIC_API_KEY) {
    response = buildLocalResponse(input.message, context, readiness);
  } else {
    const client = await getAnthropicClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            userQuestion: input.message,
            context,
            readiness,
          }),
        },
      ],
    });
    const rawText =
      Array.isArray(message.content) && message.content[0]?.type === 'text'
        ? message.content[0].text
        : '{}';
    response = normalizeAiResponse(JSON.parse(rawText));
    response = {
      ...response,
      citations: response.citations.length > 0 ? response.citations : buildBaseCitations(context),
      readiness,
    };
    modelUsed = MODEL;
  }

  const interactionId = randomUUID();
  const latencyMs = Date.now() - startedAt;
  const db = getDb();
  await db.insert(copilotInteractions).values({
    id: interactionId,
    userId: input.userId,
    projectId: context.project?.id ?? null,
    payrollWeekId: context.payrollWeek?.id ?? null,
    pagePath: input.pagePath ?? null,
    userMessage: input.message,
    assistantMessage: response.answer,
    contextJson: JSON.stringify(context),
    suggestionsJson: JSON.stringify(response.suggestions),
    modelUsed,
    latencyMs,
    createdAt: new Date().toISOString(),
  });

  return {
    ...response,
    modelUsed,
    interactionId,
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function findApplicablePinnedWd(projectId: string) {
  const db = getDb();
  const rows = db
    .select({
      wageDeterminationId: projectWageDeterminations.wageDeterminationId,
      isPrimary: projectWageDeterminations.isPrimary,
      wdNumber: wageDeterminations.wdNumber,
      revisionNumber: wageDeterminations.revisionNumber,
      constructionType: projectWageDeterminations.constructionType,
      pinnedAt: projectWageDeterminations.pinnedAt,
    })
    .from(projectWageDeterminations)
    .innerJoin(wageDeterminations, eq(projectWageDeterminations.wageDeterminationId, wageDeterminations.id))
    .where(eq(projectWageDeterminations.projectId, projectId))
    .all();

  return rows.find((row: typeof rows[number]) => row.isPrimary) ?? (rows.length === 1 ? rows[0] : null);
}

function lockProjectToPinnedWd(projectId: string, wd: NonNullable<ReturnType<typeof findApplicablePinnedWd>>) {
  getDb()
    .update(projects)
    .set({
      wdIdentifier: wd.wdNumber,
      wdModNumber: wd.revisionNumber,
      wdLockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(projects.id, projectId))
    .run();
}

function assertMutablePayrollWeek(context: CopilotContext) {
  if (!context.project || !context.payrollWeek) {
    const err = new Error('Select a project payroll week before applying this Copilot action') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  if (context.payrollWeek.submittedAt) {
    const err = new Error('This payroll week has already been submitted and cannot be changed by Copilot') as Error & { status?: number };
    err.status = 409;
    throw err;
  }
}

async function recomputePayrollWeekPay(payrollWeekId: string) {
  const db = getDb();
  const now = new Date().toISOString();
  const entries = await db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.payrollWeekId, payrollWeekId));
  let changedCount = 0;

  for (const entry of entries) {
    const computed = entryPayMath(entry);
    const grossChanged = Math.abs((entry.grossWages ?? -1) - computed.grossWages) > 0.005;
    const netChanged = Math.abs((entry.netPay ?? -1) - computed.netPay) > 0.005;
    if (!grossChanged && !netChanged) continue;

    await db
      .update(payrollEntries)
      .set({
        grossWages: computed.grossWages,
        netPay: computed.netPay,
        updatedAt: now,
      })
      .where(eq(payrollEntries.id, entry.id));
    changedCount += 1;
  }

  return { inspectedCount: entries.length, changedCount };
}

async function refreshZeroRateSnapshotsFromPinnedWd(projectId: string, payrollWeekId: string) {
  const db = getDb();
  const pinnedWd = findApplicablePinnedWd(projectId);
  if (!pinnedWd) {
    const err = new Error('Pin exactly one WD or mark one pinned WD as primary before Copilot can refresh rate snapshots') as Error & { status?: number };
    err.status = 409;
    throw err;
  }

  const rates = await db
    .select({
      tradeCode: wageClassifications.tradeCode,
      baseRate: wageClassifications.baseRate,
      fringeRate: wageClassifications.fringeRate,
    })
    .from(wageClassifications)
    .where(eq(wageClassifications.wageDeterminationId, pinnedWd.wageDeterminationId));
  const rateByTrade = new Map<string, typeof rates[number]>(
    rates.map((rate: typeof rates[number]) => [rate.tradeCode, rate]),
  );
  const rows = await db
    .select({
      entry: payrollEntries,
      tradeCode: workerClassifications.tradeCode,
    })
    .from(payrollEntries)
    .innerJoin(workerClassifications, eq(payrollEntries.classificationId, workerClassifications.id))
    .where(eq(payrollEntries.payrollWeekId, payrollWeekId));

  const now = new Date().toISOString();
  let changedCount = 0;
  let unmatchedCount = 0;

  for (const row of rows) {
    const entry = row.entry;
    if (entry.baseRateSnapshot !== 0 || entry.fringeRateSnapshot !== 0) continue;
    const rate = rateByTrade.get(row.tradeCode);
    if (!rate) {
      unmatchedCount += 1;
      continue;
    }

    const computedEntry = {
      ...entry,
      baseRateSnapshot: rate.baseRate,
      fringeRateSnapshot: rate.fringeRate,
    };
    const computed = entryPayMath(computedEntry);
    await db
      .update(payrollEntries)
      .set({
        baseRateSnapshot: rate.baseRate,
        fringeRateSnapshot: rate.fringeRate,
        grossWages: computed.grossWages,
        netPay: computed.netPay,
        updatedAt: now,
      })
      .where(eq(payrollEntries.id, entry.id));
    changedCount += 1;
  }

  return {
    inspectedCount: rows.length,
    changedCount,
    unmatchedCount,
    wdNumber: pinnedWd.wdNumber,
    revisionNumber: pinnedWd.revisionNumber,
  };
}

function buildPreparedAction(actionId: string, context: CopilotContext): CopilotPreparedAction {
  const id = randomUUID();
  const projectName = context.project?.name ?? 'this project';
  const findings: string[] = [];
  const proposedSteps: string[] = [];
  const warnings: string[] = [];
  let applySupported = false;
  let applyLabel: string | undefined;

  if (!context.onboarding) {
    findings.push('Onboarding is not complete, so payroll provider, trade defaults, subcontractor tracking, and state preferences may be missing.');
    proposedSteps.push('Complete onboarding before relying on import prompts or project defaults.');
  }

  if (context.project && !context.project.wdIdentifier && context.project.contractType === 'federal-davis-bacon') {
    findings.push('The project is marked federal Davis-Bacon but no wage determination identifier is locked on the project.');
    const pinnedWd = findApplicablePinnedWd(context.project.id);
    if (pinnedWd) {
      findings.push(`A ${pinnedWd.isPrimary ? 'primary ' : ''}pinned WD is available: ${pinnedWd.wdNumber} revision ${pinnedWd.revisionNumber}.`);
      proposedSteps.push('Review the pinned WD details, then approve Copilot to lock this project to that already-pinned WD.');
      applySupported = actionId === 'prepare-missing-wd';
      applyLabel = `Lock ${pinnedWd.wdNumber} revision ${pinnedWd.revisionNumber}`;
    } else {
      proposedSteps.push('Open the project wage determination panel and select the federal WD for the project state, county, and construction type.');
      warnings.push('Copilot cannot lock a WD until exactly one WD is pinned or one pinned WD is marked primary.');
    }
    warnings.push('Do not export certified payroll until the wage determination and modification are confirmed.');
  }

  if (context.projectSummary?.workerCount === 0) {
    findings.push('No workers are attached to the project.');
    proposedSteps.push('Add or import workers before creating payroll entries.');
  }

  if (context.projectSummary?.classificationCount === 0) {
    findings.push('No worker classifications are attached to the project.');
    proposedSteps.push('Add classifications from the locked wage determination before payroll entry.');
  }

  if (context.weekSummary?.entryCount === 0) {
    findings.push('The selected payroll week has no payroll entries.');
    proposedSteps.push('Import payroll or add entries, then rerun compliance review before export.');
  }

  if (context.weekSummary?.compliance?.hasViolations) {
    const compliance = context.weekSummary.compliance;
    findings.push(`${compliance.totalViolations} compliance issue(s) are currently detected: ${compliance.wageViolations} wage, ${compliance.weekViolations} week-level, and ${compliance.deductionViolations} deduction issue(s).`);
    findings.push(...compliance.examples.map((example) => `Example: ${example}`));
    proposedSteps.push('Open each violation, verify the classification/rate snapshot, then correct the payroll entry or document the exception.');
    warnings.push('A payroll week with unresolved violations should not be filed as clean.');
    if (actionId === 'review-week-violations' && context.payrollWeek && !context.payrollWeek.submittedAt && compliance.wageViolations > 0) {
      proposedSteps.push('Approve Copilot to recompute gross and net pay from the saved daily hours, current rate snapshots, and deductions.');
      applySupported = true;
      applyLabel = 'Recompute week gross/net pay';
    }
  }

  if (actionId === 'prepare-import-review') {
    proposedSteps.push('Compare imported worker names or provider IDs against PrevWage workers before committing entries.');
    proposedSteps.push('Confirm every imported line has a classification, straight/overtime hours, gross wages, deductions, and rate snapshot.');
    warnings.push('Imports can look complete while still carrying unmapped trades or stale wage rates.');
    if (context.project && context.payrollWeek && !context.payrollWeek.submittedAt) {
      proposedSteps.push('If imported entries have zero rate snapshots, approve Copilot to fill matching trade-code rates from the pinned WD and recompute pay.');
      applySupported = true;
      applyLabel = 'Fill zero rates from pinned WD';
    }
  }

  if (actionId === 'classification-assist') {
    proposedSteps.push('Use Classification Assist with the actual task description, tools used, and site activity.');
    proposedSteps.push('Compare the suggested trade against the project wage determination and contract scope.');
    warnings.push('AI classification suggestions must be confirmed by a responsible payroll/compliance reviewer.');
  }

  if (actionId === 'prepare-certified-payroll-readiness') {
    proposedSteps.push('Confirm project setup, WD/modification, workers, classifications, payroll entries, deductions, compliance results, signer, and export format.');
    proposedSteps.push('Generate the certified payroll export only after every blocking issue is cleared or documented.');
  }

  if (findings.length === 0) {
    findings.push('No blocking issue was detected from the current Copilot context.');
    proposedSteps.push('Run a final review of project setup, wage determination, classifications, payroll entries, compliance, and export settings.');
  }

  const titleByAction: Record<string, string> = {
    'review-week-violations': 'Payroll Violation Review Plan',
    'prepare-missing-wd': 'Wage Determination Setup Plan',
    'prepare-import-review': 'Payroll Import Review Plan',
    'classification-assist': 'Classification Review Plan',
    'prepare-certified-payroll-readiness': 'Certified Payroll Readiness Plan',
  };

  return {
    id,
    actionId,
    status: 'draft_review',
    title: titleByAction[actionId] ?? 'Copilot Prepared Review Plan',
    summary: `Prepared a review plan for ${projectName}. This is a draft checklist only; it has not changed payroll, classifications, wage determinations, or filing data.`,
    findings: unique(findings).slice(0, 8),
    proposedSteps: unique(proposedSteps).slice(0, 8),
    warnings: unique(warnings).slice(0, 5),
    approvalRequired: true,
    applySupported,
    applyLabel,
    targetRoute: context.project ? `/projects/${context.project.id}` : undefined,
  };
}

export async function prepareCopilotAction(input: {
  userId: string;
  actionId: string;
  pagePath?: string;
  projectId?: string;
  payrollWeekId?: string;
  visibleFields?: z.infer<typeof copilotVisibleFieldSchema>[];
  pageContext?: z.infer<typeof copilotPageContextSchema>;
}): Promise<CopilotPreparedAction> {
  const startedAt = Date.now();
  const context = await buildCopilotContext(input);
  const preparedAction = buildPreparedAction(input.actionId, context);
  const interactionId = randomUUID();

  await getDb().insert(copilotInteractions).values({
    id: interactionId,
    userId: input.userId,
    projectId: context.project?.id ?? null,
    payrollWeekId: context.payrollWeek?.id ?? null,
    pagePath: input.pagePath ?? null,
    userMessage: `[prepare-action:${input.actionId}]`,
    assistantMessage: preparedAction.summary,
    contextJson: JSON.stringify(context),
    suggestionsJson: JSON.stringify(preparedAction),
    modelUsed: `${LOCAL_MODEL}:prepared-action`,
    latencyMs: Date.now() - startedAt,
    createdAt: new Date().toISOString(),
  });

  return preparedAction;
}

export async function acknowledgeCopilotAction(input: {
  userId: string;
  actionId: string;
  title: string;
  decision: 'reviewed' | 'rejected';
  pagePath?: string;
  projectId?: string;
  payrollWeekId?: string;
  pageContext?: z.infer<typeof copilotPageContextSchema>;
}): Promise<{ status: 'reviewed' | 'rejected'; message: string }> {
  const context = await buildCopilotContext({
    userId: input.userId,
    pagePath: input.pagePath,
    projectId: input.projectId,
    payrollWeekId: input.payrollWeekId,
    pageContext: input.pageContext,
  });

  const message =
    input.decision === 'reviewed'
      ? `Marked "${input.title}" as reviewed. No payroll, wage determination, classification, or filing data was changed.`
      : `Rejected "${input.title}". No payroll, wage determination, classification, or filing data was changed.`;

  await getDb().insert(copilotInteractions).values({
    id: randomUUID(),
    userId: input.userId,
    projectId: context.project?.id ?? null,
    payrollWeekId: context.payrollWeek?.id ?? null,
    pagePath: input.pagePath ?? null,
    userMessage: `[${input.decision}-action:${input.actionId}] ${input.title}`,
    assistantMessage: message,
    contextJson: JSON.stringify(context),
    suggestionsJson: JSON.stringify({
      actionId: input.actionId,
      title: input.title,
      decision: input.decision,
      status: input.decision,
    }),
    modelUsed: `${LOCAL_MODEL}:action-lifecycle`,
    latencyMs: 0,
    createdAt: new Date().toISOString(),
  });

  return { status: input.decision, message };
}

export async function applyCopilotAction(input: {
  userId: string;
  actionId: string;
  confirm: true;
  pagePath?: string;
  projectId?: string;
  payrollWeekId?: string;
  pageContext?: z.infer<typeof copilotPageContextSchema>;
}): Promise<{ applied: boolean; message: string; readiness: CopilotStateSnapshot }> {
  const startedAt = Date.now();
  const context = await buildCopilotContext({
    userId: input.userId,
    pagePath: input.pagePath,
    projectId: input.projectId,
    payrollWeekId: input.payrollWeekId,
    pageContext: input.pageContext,
  });

  if (!context.project) {
    const err = new Error('Select a project before applying a Copilot action') as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  if (!['prepare-missing-wd', 'review-week-violations', 'prepare-import-review'].includes(input.actionId)) {
    const err = new Error('This Copilot action does not support automatic apply yet') as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  let message: string;
  let mutation: string;
  let mutationDetails: Record<string, unknown>;

  if (input.actionId === 'prepare-missing-wd') {
    if (context.project.wdIdentifier) {
      const err = new Error('This project already has a locked wage determination') as Error & { status?: number };
      err.status = 409;
      throw err;
    }

    const pinnedWd = findApplicablePinnedWd(context.project.id);
    if (!pinnedWd) {
      const err = new Error('Pin exactly one WD or mark one pinned WD as primary before Copilot can lock it') as Error & { status?: number };
      err.status = 409;
      throw err;
    }

    lockProjectToPinnedWd(context.project.id, pinnedWd);
    message = `Applied approved action: locked ${context.project.name} to ${pinnedWd.wdNumber} revision ${pinnedWd.revisionNumber}.`;
    mutation = 'project.wd_lock';
    mutationDetails = {
      wdNumber: pinnedWd.wdNumber,
      revisionNumber: pinnedWd.revisionNumber,
    };
  } else if (input.actionId === 'review-week-violations') {
    assertMutablePayrollWeek(context);
    const result = await recomputePayrollWeekPay(context.payrollWeek!.id);
    message = `Applied approved action: recomputed gross/net pay for ${result.changedCount} of ${result.inspectedCount} payroll entr${result.inspectedCount === 1 ? 'y' : 'ies'}.`;
    mutation = 'payroll_week.recompute_pay';
    mutationDetails = result;
  } else {
    assertMutablePayrollWeek(context);
    const result = await refreshZeroRateSnapshotsFromPinnedWd(context.project.id, context.payrollWeek!.id);
    message = `Applied approved action: filled zero rate snapshots for ${result.changedCount} of ${result.inspectedCount} payroll entr${result.inspectedCount === 1 ? 'y' : 'ies'} from ${result.wdNumber} revision ${result.revisionNumber}.`;
    mutation = 'payroll_week.fill_zero_rates';
    mutationDetails = result;
  }

  const readiness = await buildCopilotStateSnapshot({
    userId: input.userId,
    pagePath: input.pagePath,
    projectId: context.project.id,
    payrollWeekId: input.payrollWeekId,
    pageContext: input.pageContext,
  });

  await getDb().insert(copilotInteractions).values({
    id: randomUUID(),
    userId: input.userId,
    projectId: context.project.id,
    payrollWeekId: context.payrollWeek?.id ?? null,
    pagePath: input.pagePath ?? null,
    userMessage: `[apply-action:${input.actionId}] confirm=true`,
    assistantMessage: message,
    contextJson: JSON.stringify({
      before: context,
      afterReadiness: readiness,
    }),
    suggestionsJson: JSON.stringify({
      actionId: input.actionId,
      applied: true,
      mutation,
      ...mutationDetails,
    }),
    modelUsed: `${LOCAL_MODEL}:approved-mutation`,
    latencyMs: Date.now() - startedAt,
    createdAt: new Date().toISOString(),
  });

  return { applied: true, message, readiness };
}
