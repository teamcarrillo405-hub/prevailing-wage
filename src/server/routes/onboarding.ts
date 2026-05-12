import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { onboardingProfiles, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { insertSecurityEvent } from '../db/auditHelpers.js';

const ProviderSchema = z.enum(['quickbooks', 'adp', 'gusto', 'paychex', 'sage_300', 'sage_100', 'other', 'none']);

const OnboardingSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  hccMembershipNumber: z.string().trim().min(3).max(64),
  contractorRole: z.enum(['general_contractor', 'subcontractor', 'both']),
  companySize: z.enum(['1_10', '11_50', '51_200', '201_plus']),
  primaryStates: z.array(z.string().trim().length(2)).min(1).max(12),
  workTypes: z.array(z.enum(['federal_davis_bacon', 'state_prevailing_wage', 'dot', 'school_public_agency', 'private_mixed'])).min(1),
  payrollProvider: ProviderSchema,
  accountingProvider: z.enum(['quickbooks', 'sage_300', 'other', 'none']),
  projectManagementProvider: z.enum(['procore', 'other', 'none']),
  averageWeeklyWorkers: z.number().int().min(0).max(10000),
  usesSubcontractors: z.boolean(),
  usesApprentices: z.boolean(),
  fieldTrackingNeeded: z.boolean(),
});

type OnboardingInput = z.infer<typeof OnboardingSchema>;

export const onboardingRouter = Router();

function buildRecommendedNextSteps(input: OnboardingInput): string[] {
  const steps = [
    'Create your first public works project',
    'Confirm wage determination source, award date, state, county, and construction type',
    'Add workers and assign trade classifications before entering payroll',
  ];

  if (input.payrollProvider === 'quickbooks' || input.accountingProvider === 'quickbooks') {
    steps.push('Connect QuickBooks to import employees and time records');
  } else if (input.payrollProvider !== 'none') {
    steps.push(`Prepare ${providerLabel(input.payrollProvider)} payroll exports for weekly import`);
  } else {
    steps.push('Use manual payroll entry until a payroll system is connected');
  }

  if (input.projectManagementProvider === 'procore') {
    steps.push('Connect Procore to import project time entries');
  }

  if (input.usesSubcontractors || input.contractorRole !== 'subcontractor') {
    steps.push('Add subcontractors and track weekly CPR receipt');
  }

  if (input.usesApprentices) {
    steps.push('Enter apprenticeship program details and ratios before certified payroll submission');
  }

  if (input.fieldTrackingNeeded) {
    steps.push('Turn on field proof capture for GPS time punches and project photos');
  }

  if (input.primaryStates.some((state) => ['CA', 'WA', 'NY', 'IL', 'MA', 'NJ', 'MN', 'VA', 'TX'].includes(state))) {
    steps.push('Review state-specific certified payroll export fields for your first project');
  }

  return steps;
}

function providerLabel(provider: OnboardingInput['payrollProvider']) {
  const labels: Record<OnboardingInput['payrollProvider'], string> = {
    quickbooks: 'QuickBooks',
    adp: 'ADP',
    gusto: 'Gusto',
    paychex: 'Paychex',
    sage_300: 'Sage 300 CRE',
    sage_100: 'Sage 100',
    other: 'your payroll system',
    none: 'manual payroll',
  };
  return labels[provider];
}

onboardingRouter.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const [user] = await db
    .select({
      hccMembershipNumber: users.hccMembershipNumber,
      companyName: users.companyName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [profile] = await db
    .select()
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, userId))
    .limit(1);

  res.json({
    data: {
      user: {
        companyName: user?.companyName ?? null,
        hccMembershipNumber: user?.hccMembershipNumber ?? null,
      },
      profile: profile
        ? {
            ...profile,
            primaryStates: JSON.parse(profile.primaryStates) as string[],
            workTypes: JSON.parse(profile.workTypes) as string[],
            onboardingAnswers: JSON.parse(profile.onboardingAnswers) as OnboardingInput,
            recommendedNextSteps: JSON.parse(profile.recommendedNextSteps) as string[],
          }
        : null,
    },
  });
});

onboardingRouter.put('/', requireAuth, validate(OnboardingSchema), async (req, res) => {
  const userId = req.user!.userId;
  const body = req.body as OnboardingInput;
  const db = getDb();
  const now = new Date().toISOString();
  const recommendedNextSteps = buildRecommendedNextSteps(body);

  await db
    .update(users)
    .set({
      companyName: body.companyName,
      hccMembershipNumber: body.hccMembershipNumber,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  const values = {
    userId,
    contractorRole: body.contractorRole,
    companySize: body.companySize,
    primaryStates: JSON.stringify(body.primaryStates),
    workTypes: JSON.stringify(body.workTypes),
    payrollProvider: body.payrollProvider,
    accountingProvider: body.accountingProvider,
    projectManagementProvider: body.projectManagementProvider,
    averageWeeklyWorkers: body.averageWeeklyWorkers,
    usesSubcontractors: body.usesSubcontractors,
    usesApprentices: body.usesApprentices,
    fieldTrackingNeeded: body.fieldTrackingNeeded,
    onboardingAnswers: JSON.stringify(body),
    recommendedNextSteps: JSON.stringify(recommendedNextSteps),
    completedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .insert(onboardingProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: onboardingProfiles.userId,
      set: {
        contractorRole: values.contractorRole,
        companySize: values.companySize,
        primaryStates: values.primaryStates,
        workTypes: values.workTypes,
        payrollProvider: values.payrollProvider,
        accountingProvider: values.accountingProvider,
        projectManagementProvider: values.projectManagementProvider,
        averageWeeklyWorkers: values.averageWeeklyWorkers,
        usesSubcontractors: values.usesSubcontractors,
        usesApprentices: values.usesApprentices,
        fieldTrackingNeeded: values.fieldTrackingNeeded,
        onboardingAnswers: values.onboardingAnswers,
        recommendedNextSteps: values.recommendedNextSteps,
        completedAt: values.completedAt,
        updatedAt: values.updatedAt,
      },
    });

  void insertSecurityEvent({
    userId,
    eventType: 'onboarding_completed',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
    metadata: {
      contractorRole: body.contractorRole,
      payrollProvider: body.payrollProvider,
      accountingProvider: body.accountingProvider,
      projectManagementProvider: body.projectManagementProvider,
    },
  });

  res.json({ data: { completedAt: now, recommendedNextSteps } });
});

