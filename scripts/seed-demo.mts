import Database from 'better-sqlite3';
import argon2 from 'argon2';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || './data/prevailing-wage.db';
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@prevwage.local';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Password123!';
const DEMO_COMPANY = 'Demo Concrete QA LLC';
const DEMO_HCC = 'HCC-2026-DEMO';
const PROJECT_ID = 'demo-project-la-library-2026';
const WEEK1_ID = 'demo-week-2026-04-25';
const WEEK2_ID = 'demo-week-2026-05-02';
const SUB_ID = 'demo-sub-brightline-electric';
const WD_NUMBER = 'CA20260001';
const WD_REVISION = 0;
const PHOTOS_DIR = process.env.PHOTOS_DIR || './var/data/photos';
const SIGNATURES_DIR = process.env.SIGNATURES_DIR || './var/data/signatures';
const SUB_UPLOADS_DIR = process.env.SUB_UPLOADS_DIR || './var/data/subcontractor-cpr';
const DEMO_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

const now = new Date();
const nowIso = now.toISOString();
const cacheExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

type WorkerSeed = {
  id: string;
  name: string;
  ssnLast4: string;
  tradeUnion: string;
  street: string;
  city: string;
  zip: string;
  classificationId: string;
  tradeCode: 'CARP' | 'LAB' | 'OPER';
  tradeDescription: string;
  laborType: 'journeyworker' | 'apprentice' | 'foreman';
  apprenticePercent?: number;
  programName?: string;
  baseRate: number;
  fringeRate: number;
  providerWorkerId: string;
};

type EntrySeed = {
  id: string;
  weekId: string;
  worker: WorkerSeed;
  monSt?: number;
  tueSt?: number;
  wedSt?: number;
  thuSt?: number;
  friSt?: number;
  satSt?: number;
  sunSt?: number;
  monOt?: number;
  tueOt?: number;
  wedOt?: number;
  thuOt?: number;
  friOt?: number;
  satOt?: number;
  sunOt?: number;
  monDt?: number;
  tueDt?: number;
  wedDt?: number;
  thuDt?: number;
  friDt?: number;
  satDt?: number;
  sunDt?: number;
  ficaTax: number;
  federalIncomeTax: number;
  stateIncomeTax: number;
  sdiTax: number;
  deductionDues: number;
  deductionHealthWelfare?: number;
  deductionPension?: number;
  deductionTraining?: number;
  deductionOther?: number;
  deductionOtherDescription?: string | null;
  checkNumber: string;
  subcontractorId?: string | null;
};

function one<T>(sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

function run(sql: string, params: Record<string, unknown> | unknown[] = []) {
  db.prepare(sql).run(params as never);
}

function total(values: Array<number | undefined>) {
  return values.reduce((sum, value) => sum + (value ?? 0), 0);
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function gross(baseRate: number, fringeRate: number, straightTime: number, overtime = 0, doubleTime = 0) {
  const totalHours = straightTime + overtime + doubleTime;
  const totalWages = totalHours * baseRate
    + overtime * 0.5 * baseRate
    + doubleTime * baseRate
    + totalHours * fringeRate;
  return money(totalWages);
}

function net(grossWages: number, deductions: number) {
  return money(grossWages - deductions);
}

function fringeSplit(fringeRate: number) {
  return {
    fringeHealthWelfare: money(fringeRate * 0.52),
    fringePension: money(fringeRate * 0.32),
    fringeVacation: money(fringeRate * 0.11),
    fringeTraining: money(fringeRate * 0.05),
  };
}

const existingUser = one<{ id: string }>('SELECT id FROM users WHERE email = ?', [DEMO_EMAIL]);
const userId = existingUser?.id || 'demo-user-hcc-contractor';

function insertPayrollEntry(input: EntrySeed) {
  const st = total([input.monSt, input.tueSt, input.wedSt, input.thuSt, input.friSt, input.satSt, input.sunSt]);
  const ot = total([input.monOt, input.tueOt, input.wedOt, input.thuOt, input.friOt, input.satOt, input.sunOt]);
  const dt = total([input.monDt, input.tueDt, input.wedDt, input.thuDt, input.friDt, input.satDt, input.sunDt]);
  const grossWages = gross(input.worker.baseRate, input.worker.fringeRate, st, ot, dt);
  const deductions = money(
    input.ficaTax
    + input.federalIncomeTax
    + input.stateIncomeTax
    + input.sdiTax
    + input.deductionDues
    + (input.deductionHealthWelfare ?? 0)
    + (input.deductionPension ?? 0)
    + (input.deductionTraining ?? 0)
    + (input.deductionOther ?? 0),
  );
  const fringes = fringeSplit(input.worker.fringeRate);

  run(`
    INSERT INTO payroll_entries (
      id, payroll_week_id, worker_id, classification_id,
      mon_st, tue_st, wed_st, thu_st, fri_st, sat_st, sun_st,
      mon_ot, tue_ot, wed_ot, thu_ot, fri_ot, sat_ot, sun_ot,
      mon_dt, tue_dt, wed_dt, thu_dt, fri_dt, sat_dt, sun_dt,
      base_rate_snapshot, fringe_rate_snapshot,
      gross_wages, deductions, net_pay,
      fringe_health_welfare, fringe_pension, fringe_vacation, fringe_training,
      check_number, total_week_gross_wages,
      fica_tax, federal_income_tax, state_income_tax, sdi_tax,
      deduction_health_welfare, deduction_pension, deduction_training, deduction_dues,
      deduction_other, deduction_other_description,
      subcontractor_id,
      created_by_user_id, updated_by_user_id, created_at, updated_at
    ) VALUES (
      @id, @weekId, @workerId, @classificationId,
      @monSt, @tueSt, @wedSt, @thuSt, @friSt, @satSt, @sunSt,
      @monOt, @tueOt, @wedOt, @thuOt, @friOt, @satOt, @sunOt,
      @monDt, @tueDt, @wedDt, @thuDt, @friDt, @satDt, @sunDt,
      @baseRate, @fringeRate,
      @grossWages, @deductions, @netPay,
      @fringeHealthWelfare, @fringePension, @fringeVacation, @fringeTraining,
      @checkNumber, @grossWages,
      @ficaTax, @federalIncomeTax, @stateIncomeTax, @sdiTax,
      @deductionHealthWelfare, @deductionPension, @deductionTraining, @deductionDues,
      @deductionOther, @deductionOtherDescription,
      @subcontractorId,
      @userId, @userId, @nowIso, @nowIso
    )
  `, {
    id: input.id,
    weekId: input.weekId,
    workerId: input.worker.id,
    classificationId: input.worker.classificationId,
    monSt: input.monSt ?? 0,
    tueSt: input.tueSt ?? 0,
    wedSt: input.wedSt ?? 0,
    thuSt: input.thuSt ?? 0,
    friSt: input.friSt ?? 0,
    satSt: input.satSt ?? 0,
    sunSt: input.sunSt ?? 0,
    monOt: input.monOt ?? 0,
    tueOt: input.tueOt ?? 0,
    wedOt: input.wedOt ?? 0,
    thuOt: input.thuOt ?? 0,
    friOt: input.friOt ?? 0,
    satOt: input.satOt ?? 0,
    sunOt: input.sunOt ?? 0,
    monDt: input.monDt ?? 0,
    tueDt: input.tueDt ?? 0,
    wedDt: input.wedDt ?? 0,
    thuDt: input.thuDt ?? 0,
    friDt: input.friDt ?? 0,
    satDt: input.satDt ?? 0,
    sunDt: input.sunDt ?? 0,
    baseRate: input.worker.baseRate,
    fringeRate: input.worker.fringeRate,
    grossWages,
    deductions,
    netPay: net(grossWages, deductions),
    ...fringes,
    checkNumber: input.checkNumber,
    ficaTax: input.ficaTax,
    federalIncomeTax: input.federalIncomeTax,
    stateIncomeTax: input.stateIncomeTax,
    sdiTax: input.sdiTax,
    deductionHealthWelfare: input.deductionHealthWelfare ?? 0,
    deductionPension: input.deductionPension ?? 0,
    deductionTraining: input.deductionTraining ?? 0,
    deductionDues: input.deductionDues,
    deductionOther: input.deductionOther ?? 0,
    deductionOtherDescription: input.deductionOtherDescription ?? null,
    subcontractorId: input.subcontractorId ?? null,
    userId,
    nowIso,
  });
}

const passwordHash = await argon2.hash(DEMO_PASSWORD, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

const demoPng = Buffer.from(DEMO_PNG_BASE64, 'base64');
const projectPhotoRelativePath = 'project-photos/demo-project-gate.png';
const week1PhotoRelativePath = 'demo-week1-crew.png';
const week2PhotoRelativePath = 'demo-week2-correction-proof.png';
const signatureRelativePath = 'demo-signature.png';
const subWeek1UploadPath = 'brightline/demo-sub-cpr-week1.pdf';
const subWeek2UploadPath = 'brightline/demo-sub-cpr-week2.pdf';
fs.mkdirSync(path.join(PHOTOS_DIR, 'project-photos'), { recursive: true });
fs.mkdirSync(SIGNATURES_DIR, { recursive: true });
fs.mkdirSync(path.join(SUB_UPLOADS_DIR, 'brightline'), { recursive: true });
fs.writeFileSync(path.join(PHOTOS_DIR, projectPhotoRelativePath), demoPng);
fs.writeFileSync(path.join(PHOTOS_DIR, week1PhotoRelativePath), demoPng);
fs.writeFileSync(path.join(PHOTOS_DIR, week2PhotoRelativePath), demoPng);
fs.writeFileSync(path.join(SIGNATURES_DIR, signatureRelativePath), demoPng);
fs.writeFileSync(path.join(SUB_UPLOADS_DIR, subWeek1UploadPath), 'Demo subcontractor CPR package for week ending 2026-04-25\n');
fs.writeFileSync(path.join(SUB_UPLOADS_DIR, subWeek2UploadPath), 'Demo subcontractor CPR package for week ending 2026-05-02\n');

const workers: WorkerSeed[] = [
  {
    id: 'demo-worker-jose',
    name: 'Jose Martinez',
    ssnLast4: '1234',
    tradeUnion: 'Carpenters Local 213',
    street: '1420 Maple Ave',
    city: 'Los Angeles',
    zip: '90015',
    classificationId: 'demo-class-jose-carp',
    tradeCode: 'CARP',
    tradeDescription: 'Carpenter',
    laborType: 'journeyworker',
    baseRate: 44.15,
    fringeRate: 19.82,
    providerWorkerId: 'QBO-EMP-1001',
  },
  {
    id: 'demo-worker-elena',
    name: 'Elena Rivera',
    ssnLast4: '6789',
    tradeUnion: 'Laborers Local 300',
    street: '880 Grand Ave',
    city: 'Los Angeles',
    zip: '90017',
    classificationId: 'demo-class-elena-lab',
    tradeCode: 'LAB',
    tradeDescription: 'Laborer - Group 1',
    laborType: 'journeyworker',
    baseRate: 36.8,
    fringeRate: 17.25,
    providerWorkerId: 'QBO-EMP-1002',
  },
  {
    id: 'demo-worker-marco',
    name: 'Marco Chen',
    ssnLast4: '2468',
    tradeUnion: 'Operating Engineers Local 12',
    street: '215 Alameda St',
    city: 'Los Angeles',
    zip: '90012',
    classificationId: 'demo-class-marco-oper',
    tradeCode: 'OPER',
    tradeDescription: 'Operating Engineer - Group 3',
    laborType: 'journeyworker',
    baseRate: 52.4,
    fringeRate: 23.1,
    providerWorkerId: 'QBO-EMP-1003',
  },
  {
    id: 'demo-worker-ana',
    name: 'Ana Lopez',
    ssnLast4: '1357',
    tradeUnion: 'Carpenters Local 213',
    street: '660 Hope St',
    city: 'Los Angeles',
    zip: '90071',
    classificationId: 'demo-class-ana-carp-appr',
    tradeCode: 'CARP',
    tradeDescription: 'Carpenter Apprentice',
    laborType: 'apprentice',
    apprenticePercent: 65,
    programName: 'Southern California Carpenters JATC',
    baseRate: 28.7,
    fringeRate: 12.88,
    providerWorkerId: 'QBO-EMP-1004',
  },
  {
    id: 'demo-worker-sam',
    name: 'Sam Patel',
    ssnLast4: '8642',
    tradeUnion: 'Laborers Local 300',
    street: '900 Figueroa St',
    city: 'Los Angeles',
    zip: '90015',
    classificationId: 'demo-class-sam-lab-foreman',
    tradeCode: 'LAB',
    tradeDescription: 'Laborer Foreman',
    laborType: 'foreman',
    baseRate: 41.8,
    fringeRate: 17.25,
    providerWorkerId: 'QBO-EMP-1005',
  },
];

const entries: EntrySeed[] = [
  {
    id: 'demo-entry-jose-week1',
    weekId: WEEK1_ID,
    worker: workers[0],
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 8,
    ficaTax: 158.64,
    federalIncomeTax: 210,
    stateIncomeTax: 61.36,
    sdiTax: 28.14,
    deductionDues: 28,
    deductionPension: 15,
    checkNumber: '10401',
  },
  {
    id: 'demo-entry-elena-week1',
    weekId: WEEK1_ID,
    worker: workers[1],
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 8,
    ficaTax: 134.04,
    federalIncomeTax: 174,
    stateIncomeTax: 51.96,
    sdiTax: 23.78,
    deductionDues: 24,
    checkNumber: '10402',
  },
  {
    id: 'demo-entry-marco-week1',
    weekId: WEEK1_ID,
    worker: workers[2],
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 8,
    friOt: 2,
    ficaTax: 205.18,
    federalIncomeTax: 304,
    stateIncomeTax: 86.44,
    sdiTax: 36.38,
    deductionDues: 32,
    deductionHealthWelfare: 18,
    checkNumber: '10403',
  },
  {
    id: 'demo-entry-ana-week1',
    weekId: WEEK1_ID,
    worker: workers[3],
    monSt: 6,
    tueSt: 6,
    wedSt: 6,
    thuSt: 6,
    friSt: 6,
    ficaTax: 77.35,
    federalIncomeTax: 82,
    stateIncomeTax: 25.2,
    sdiTax: 13.72,
    deductionDues: 12,
    deductionTraining: 5,
    checkNumber: '10404',
  },
  {
    id: 'demo-entry-sam-week1',
    weekId: WEEK1_ID,
    worker: workers[4],
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 8,
    ficaTax: 146.44,
    federalIncomeTax: 198,
    stateIncomeTax: 59.2,
    sdiTax: 25.96,
    deductionDues: 27,
    checkNumber: '10405',
  },
  {
    id: 'demo-entry-jose-week2',
    weekId: WEEK2_ID,
    worker: workers[0],
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 8,
    satOt: 4,
    ficaTax: 178.34,
    federalIncomeTax: 246,
    stateIncomeTax: 72.5,
    sdiTax: 31.64,
    deductionDues: 31,
    deductionPension: 15,
    checkNumber: '10451',
  },
  {
    id: 'demo-entry-elena-week2',
    weekId: WEEK2_ID,
    worker: workers[1],
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 6,
    ficaTax: 127.3,
    federalIncomeTax: 160,
    stateIncomeTax: 48.42,
    sdiTax: 22.58,
    deductionDues: 23,
    checkNumber: '10452',
  },
  {
    id: 'demo-entry-marco-week2',
    weekId: WEEK2_ID,
    worker: workers[2],
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 8,
    satOt: 2,
    satDt: 2,
    ficaTax: 223.44,
    federalIncomeTax: 332,
    stateIncomeTax: 96.28,
    sdiTax: 39.6,
    deductionDues: 34,
    deductionHealthWelfare: 18,
    deductionOther: 20,
    deductionOtherDescription: 'Tool replacement repayment authorized by employee',
    checkNumber: '10453',
    subcontractorId: SUB_ID,
  },
  {
    id: 'demo-entry-ana-week2',
    weekId: WEEK2_ID,
    worker: workers[3],
    monSt: 6,
    tueSt: 6,
    wedSt: 6,
    thuSt: 6,
    friSt: 6,
    ficaTax: 77.35,
    federalIncomeTax: 82,
    stateIncomeTax: 25.2,
    sdiTax: 13.72,
    deductionDues: 12,
    deductionTraining: 5,
    checkNumber: '10454',
  },
  {
    id: 'demo-entry-sam-week2',
    weekId: WEEK2_ID,
    worker: workers[4],
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 8,
    friOt: 1,
    ficaTax: 153.28,
    federalIncomeTax: 210,
    stateIncomeTax: 62.1,
    sdiTax: 27.16,
    deductionDues: 27,
    checkNumber: '10455',
  },
];

const seed = db.transaction(() => {
  run('DELETE FROM copilot_interactions WHERE project_id = ?', [PROJECT_ID]);
  run('DELETE FROM payroll_provider_mappings WHERE project_id = ?', [PROJECT_ID]);
  run(`DELETE FROM payroll_imports WHERE payroll_week_id IN (?, ?)`, [WEEK1_ID, WEEK2_ID]);
  run('DELETE FROM subcontractor_cpr_weeks WHERE subcontractor_id = ?', [SUB_ID]);
  run('DELETE FROM subcontractor_certifications WHERE subcontractor_id = ?', [SUB_ID]);
  run('DELETE FROM week_photos WHERE project_id = ?', [PROJECT_ID]);
  run('DELETE FROM project_photos WHERE project_id = ?', [PROJECT_ID]);
  run('DELETE FROM contractor_signatures WHERE project_id = ?', [PROJECT_ID]);
  run('DELETE FROM audit_logs WHERE project_id = ?', [PROJECT_ID]);
  run('DELETE FROM projects WHERE id = ?', [PROJECT_ID]);

  if (existingUser) {
    run(`
      UPDATE users
      SET password_hash = @passwordHash,
          company_name = @companyName,
          hcc_membership_number = @hccMembershipNumber,
          plan_tier = 'starter',
          updated_at = @nowIso
      WHERE id = @userId
    `, { passwordHash, companyName: DEMO_COMPANY, hccMembershipNumber: DEMO_HCC, nowIso, userId });
  } else {
    run(`
      INSERT INTO users (
        id, email, password_hash, hcc_membership_number, company_name,
        created_at, updated_at, plan_tier, session_version
      ) VALUES (
        @userId, @email, @passwordHash, @hccMembershipNumber, @companyName,
        @nowIso, @nowIso, 'starter', 0
      )
    `, { userId, email: DEMO_EMAIL, passwordHash, hccMembershipNumber: DEMO_HCC, companyName: DEMO_COMPANY, nowIso });
  }

  const onboardingAnswers = {
    companyName: DEMO_COMPANY,
    hccMembershipNumber: DEMO_HCC,
    contractorRole: 'general_contractor',
    companySize: '11_50',
    primaryStates: ['CA'],
    workTypes: ['federal_davis_bacon', 'state_prevailing_wage'],
    payrollProvider: 'quickbooks',
    accountingProvider: 'quickbooks',
    projectManagementProvider: 'procore',
    averageWeeklyWorkers: 18,
    usesSubcontractors: true,
    usesApprentices: true,
    fieldTrackingNeeded: true,
  };

  run(`
    INSERT INTO onboarding_profiles (
      user_id, contractor_role, company_size, primary_states, work_types,
      payroll_provider, accounting_provider, project_management_provider,
      average_weekly_workers, uses_subcontractors, uses_apprentices, field_tracking_needed,
      onboarding_answers, recommended_next_steps, completed_at, created_at, updated_at
    ) VALUES (
      @userId, 'general_contractor', '11_50', '["CA"]', '["federal_davis_bacon","state_prevailing_wage"]',
      'quickbooks', 'quickbooks', 'procore',
      18, 1, 1, 1,
      @onboardingAnswers, @recommendedNextSteps, @nowIso, @nowIso, @nowIso
    )
    ON CONFLICT(user_id) DO UPDATE SET
      contractor_role = excluded.contractor_role,
      company_size = excluded.company_size,
      primary_states = excluded.primary_states,
      work_types = excluded.work_types,
      payroll_provider = excluded.payroll_provider,
      accounting_provider = excluded.accounting_provider,
      project_management_provider = excluded.project_management_provider,
      average_weekly_workers = excluded.average_weekly_workers,
      uses_subcontractors = excluded.uses_subcontractors,
      uses_apprentices = excluded.uses_apprentices,
      field_tracking_needed = excluded.field_tracking_needed,
      onboarding_answers = excluded.onboarding_answers,
      recommended_next_steps = excluded.recommended_next_steps,
      completed_at = excluded.completed_at,
      updated_at = excluded.updated_at
  `, {
    userId,
    onboardingAnswers: JSON.stringify(onboardingAnswers),
    recommendedNextSteps: JSON.stringify([
      'Review two submitted California payroll weeks',
      'Compare WH-347 and CA A-1-131 totals to source payroll entries',
      'Confirm subcontractor CPR evidence is received and compliant',
      'Export the audit evidence packet',
    ]),
    nowIso,
  });

  const existingWd = one<{ id: string }>(
    'SELECT id FROM wage_determinations WHERE wd_number = ? AND revision_number = ?',
    [WD_NUMBER, WD_REVISION],
  );
  const wageDeterminationId = existingWd?.id || 'demo-wd-ca-la-building-2026';

  if (existingWd) {
    run(`
      UPDATE wage_determinations
      SET source = 'federal-dol',
          state = 'CA',
          county = 'Los Angeles',
          construction_type = 'Building',
          publish_date = '2026-01-02',
          raw_document = @rawDocument,
          is_active = 1,
          cached_at = @nowIso,
          cache_expires_at = @cacheExpiresAt,
          updated_at = @nowIso,
          last_fetched_at = @nowIso
      WHERE id = @wageDeterminationId
    `, { rawDocument: 'Demo seed wage determination for Los Angeles Building construction.', nowIso, cacheExpiresAt, wageDeterminationId });
  } else {
    run(`
      INSERT INTO wage_determinations (
        id, source, wd_number, revision_number, state, county, construction_type,
        publish_date, raw_document, is_active, cached_at, cache_expires_at,
        created_at, updated_at, last_fetched_at
      ) VALUES (
        @wageDeterminationId, 'federal-dol', @wdNumber, @wdRevision, 'CA', 'Los Angeles', 'Building',
        '2026-01-02', @rawDocument, 1, @nowIso, @cacheExpiresAt,
        @nowIso, @nowIso, @nowIso
      )
    `, {
      wageDeterminationId,
      wdNumber: WD_NUMBER,
      wdRevision: WD_REVISION,
      rawDocument: 'Demo seed wage determination for Los Angeles Building construction.',
      nowIso,
      cacheExpiresAt,
    });
  }

  run('DELETE FROM wage_classifications WHERE wage_determination_id = ?', [wageDeterminationId]);
  const wageClasses = [
    ['demo-wc-carpenter', 'CARP', 'Carpenter', 'journeyworker', 44.15, 19.82],
    ['demo-wc-carpenter-apprentice', 'CARP', 'Carpenter Apprentice', 'apprentice', 28.7, 12.88],
    ['demo-wc-laborer', 'LAB', 'Laborer - Group 1', 'journeyworker', 36.8, 17.25],
    ['demo-wc-laborer-foreman', 'LAB', 'Laborer Foreman', 'foreman', 41.8, 17.25],
    ['demo-wc-operator', 'OPER', 'Operating Engineer - Group 3', 'journeyworker', 52.4, 23.1],
  ] as const;
  for (const [id, code, description, laborType, baseRate, fringeRate] of wageClasses) {
    run(`
      INSERT INTO wage_classifications (
        id, wage_determination_id, trade_code, trade_description, labor_type,
        base_rate, fringe_rate, total_rate, created_at
      ) VALUES (
        @id, @wageDeterminationId, @code, @description, @laborType,
        @baseRate, @fringeRate, @totalRate, @nowIso
      )
    `, { id, wageDeterminationId, code, description, laborType, baseRate, fringeRate, totalRate: baseRate + fringeRate, nowIso });
  }

  const projectSettings = {
    onboardingSetup: {
      payrollProvider: 'quickbooks',
      accountingProvider: 'quickbooks',
      projectManagementProvider: 'procore',
      usesSubcontractors: true,
      usesApprentices: true,
      fieldTrackingNeeded: true,
      averageWeeklyWorkers: 18,
      completedPromptKeys: ['field-proof', 'subcontractor-cpr', 'apprenticeship'],
      appliedAt: nowIso,
      lastAppliedAt: nowIso,
    },
    caPilot: {
      realisticSeededData: true,
      payrollWeeks: ['2026-04-25', '2026-05-02'],
      correctionScenario: 'Week 2 operating engineer Saturday double-time correction',
    },
  };

  run(`
    INSERT INTO projects (
      id, user_id, name, state, county, contract_type, award_date, funding_type,
      wd_identifier, wd_mod_number, wd_locked_at, status,
      cslb_license, wc_policy_number, contractor_fein, dir_project_id, awarding_agency, contract_number,
      project_settings, gps_clock_in_enabled, gps_latitude, gps_longitude, gps_radius_meters,
      created_at, updated_at
    ) VALUES (
      @projectId, @userId, 'Demo Library Renovation', 'CA', 'Los Angeles',
      'federal-davis-bacon', '2026-04-15', 'federal',
      @wdNumber, @wdRevision, @nowIso, 'active',
      '123456', 'WC-2026-789', '12-3456789', 'DIR-2026-000445', 'Los Angeles Public Library', 'HCC-DEMO-2026-001',
      @projectSettings, 1, 34.052235, -118.243683, 500,
      @nowIso, @nowIso
    )
  `, { projectId: PROJECT_ID, userId, wdNumber: WD_NUMBER, wdRevision: WD_REVISION, nowIso, projectSettings: JSON.stringify(projectSettings) });

  run(`
    INSERT INTO project_members (id, project_id, user_id, role, joined_at)
    VALUES ('demo-project-member-owner', @projectId, @userId, 'owner', @nowIso)
  `, { projectId: PROJECT_ID, userId, nowIso });

  run(`
    INSERT INTO contractor_signatures (
      id, project_id, uploaded_by, file_path, created_at, updated_at
    ) VALUES (
      'demo-contractor-signature', @projectId, @userId, @filePath, @nowIso, @nowIso
    )
  `, { projectId: PROJECT_ID, userId, filePath: signatureRelativePath, nowIso });

  run(`
    INSERT INTO project_wage_determinations (
      id, project_id, wage_determination_id, construction_type, is_primary, pinned_at, pinned_by_user_id
    ) VALUES (
      'demo-project-wd-pin', @projectId, @wageDeterminationId, 'Building', 1, @nowIso, @userId
    )
  `, { projectId: PROJECT_ID, wageDeterminationId, nowIso, userId });

  for (const worker of workers) {
    run(`
      INSERT INTO workers (
        id, project_id, name, ssn_last4, trade_union,
        address_street, address_city, address_state, address_zip,
        apprenticeship_program_name,
        is_active, created_at, updated_at
      ) VALUES (
        @id, @projectId, @name, @ssnLast4, @tradeUnion,
        @street, @city, 'CA', @zip,
        @programName,
        1, @nowIso, @nowIso
      )
    `, { ...worker, projectId: PROJECT_ID, nowIso, programName: worker.programName ?? null });

    run(`
      INSERT INTO worker_classifications (
        id, worker_id, project_id, trade_code, trade_description, labor_type,
        apprentice_percent, program_name,
        is_active, created_at
      ) VALUES (
        @classificationId, @id, @projectId, @tradeCode, @tradeDescription, @laborType,
        @apprenticePercent, @programName,
        1, @nowIso
      )
    `, {
      ...worker,
      projectId: PROJECT_ID,
      nowIso,
      apprenticePercent: worker.apprenticePercent ?? null,
      programName: worker.programName ?? null,
    });
  }

  run(`
    INSERT INTO subcontractors (
      id, project_id, name, license_number, contact_name, contact_email, address,
      dbe_classification, created_at
    ) VALUES (
      @subId, @projectId, 'Brightline Electrical LLC', 'CA-998877', 'Maya Singh',
      'maya.singh@example.com', '455 Alameda St, Los Angeles, CA 90013',
      'mbe', @nowIso
    )
  `, { subId: SUB_ID, projectId: PROJECT_ID, nowIso });

  run(`
    INSERT INTO subcontractor_certifications (
      id, subcontractor_id, cert_types, certifying_agency, cert_number, naics_codes,
      issue_date, expires_date, owner_race, owner_gender, personal_net_worth_usd,
      reevaluation_status, self_certified, document_path,
      uei, cage_code, sam_registration_status, sam_last_verified_at,
      created_at, updated_at
    ) VALUES (
      'demo-sub-cert-brightline-mbe', @subId, 'MBE', 'California Unified Certification Program',
      'CUCP-MBE-2026-4455', '238210',
      '2026-01-01', '2027-01-01', 'Asian', 'Female', 1260000,
      'cleared', 0, @documentPath,
      'DEMOUEI12345', '9DEMO', 'Active', @nowIso,
      @nowIso, @nowIso
    )
  `, { subId: SUB_ID, documentPath: subWeek1UploadPath, nowIso });

  const weeks = [
    [WEEK1_ID, '2026-04-25', 1, '2026-04-27', '2026-04-27T20:15:00.000Z'],
    [WEEK2_ID, '2026-05-02', 2, '2026-05-04', '2026-05-04T20:30:00.000Z'],
  ] as const;
  for (const [weekId, weekEndingDate, payrollNumber, submittedAt, caEcprSubmittedAt] of weeks) {
    run(`
      INSERT INTO payroll_weeks (
        id, project_id, week_ending_date, payroll_number, is_final,
        submitted_at, submitted_to, ca_ecpr_submitted_at, created_at, updated_at
      ) VALUES (
        @weekId, @projectId, @weekEndingDate, @payrollNumber, 0,
        @submittedAt, 'Contracting Officer - Demo', @caEcprSubmittedAt, @nowIso, @nowIso
      )
    `, { weekId, projectId: PROJECT_ID, weekEndingDate, payrollNumber, submittedAt, caEcprSubmittedAt, nowIso });
  }

  for (const [weekId, weekEndingDate] of [
    [WEEK1_ID, '2026-04-25'],
    [WEEK2_ID, '2026-05-02'],
  ] as const) {
    run(`
      INSERT INTO submit_ready_acknowledgements (
        id, payroll_week_id, issue_id, acknowledged_by_user_id, note, created_at
      ) VALUES (
        @id, @weekId, 'human-certification-review', @userId, @note, @nowIso
      )
    `, {
      id: `demo-submit-ready-ack-${weekId}`,
      weekId,
      userId,
      note: `Pilot reviewer signoff completed for week ending ${weekEndingDate}.`,
      nowIso,
    });
  }

  for (const entry of entries) {
    insertPayrollEntry(entry);
  }

  const importRows = [
    ['demo-import-qbo-week1', WEEK1_ID, 'quickbooks-time-demo-week1.csv', 5],
    ['demo-import-qbo-week2', WEEK2_ID, 'quickbooks-time-demo-week2-corrected.csv', 5],
  ] as const;
  for (const [id, weekId, filename, count] of importRows) {
    run(`
      INSERT INTO payroll_imports (
        id, payroll_week_id, imported_by_user_id, provider, source_filename,
        committed_count, unmatched_count, created_at
      ) VALUES (
        @id, @weekId, @userId, 'quickbooks', @filename,
        @count, 0, @nowIso
      )
    `, { id, weekId, userId, filename, count, nowIso });
  }

  for (const worker of workers) {
    run(`
      INSERT INTO payroll_provider_mappings (
        id, project_id, provider, provider_worker_id, worker_id, created_at
      ) VALUES (
        @id, @projectId, 'quickbooks', @providerWorkerId, @workerId, @nowIso
      )
    `, {
      id: `demo-qbo-map-${worker.id.replace('demo-worker-', '')}`,
      projectId: PROJECT_ID,
      providerWorkerId: worker.providerWorkerId,
      workerId: worker.id,
      nowIso,
    });
  }

  run(`
    INSERT INTO time_punches (
      id, project_id, worker_id, punch_type, punched_at,
      latitude, longitude, accuracy_meters, created_by, created_at
    ) VALUES
      ('demo-punch-jose-w1-in', @projectId, 'demo-worker-jose', 'in', '2026-04-20T14:58:00.000Z', 34.0523, -118.2437, 12, @userId, '2026-04-20T14:58:35.000Z'),
      ('demo-punch-jose-w1-out', @projectId, 'demo-worker-jose', 'out', '2026-04-20T23:05:00.000Z', 34.0522, -118.2438, 10, @userId, '2026-04-20T23:05:25.000Z'),
      ('demo-punch-marco-w2-in', @projectId, 'demo-worker-marco', 'in', '2026-05-02T14:00:00.000Z', 34.0524, -118.2436, 9, @userId, '2026-05-02T14:00:22.000Z'),
      ('demo-punch-marco-w2-out', @projectId, 'demo-worker-marco', 'out', '2026-05-03T00:15:00.000Z', 34.0524, -118.2436, 11, @userId, '2026-05-03T00:15:18.000Z'),
      ('demo-punch-ana-admin-correction', @projectId, 'demo-worker-ana', 'out', '2026-05-01T21:00:00.000Z', NULL, NULL, NULL, @userId, @nowIso)
  `, { projectId: PROJECT_ID, userId, nowIso });

  run(`
    INSERT INTO project_photos (
      id, project_id, uploaded_by, file_path, caption, taken_at,
      latitude, longitude, created_at
    ) VALUES (
      'demo-project-photo-gate', @projectId, @userId, @filePath,
      'North gate posted with project and prevailing wage notices.',
      '2026-04-20T15:10:00.000Z', 34.0523, -118.2437, @nowIso
    )
  `, { projectId: PROJECT_ID, userId, filePath: projectPhotoRelativePath, nowIso });

  const photoRows = [
    ['demo-week-photo-crew', WEEK1_ID, week1PhotoRelativePath, 'Crew location evidence for week ending 2026-04-25.', '2026-04-20T15:20:00.000Z'],
    ['demo-week-photo-correction', WEEK2_ID, week2PhotoRelativePath, 'Saturday operating engineer correction reviewed against field log.', '2026-05-02T18:25:00.000Z'],
  ] as const;
  for (const [id, weekId, filePath, caption, takenAt] of photoRows) {
    run(`
      INSERT INTO week_photos (
        id, project_id, payroll_week_id, uploaded_by, file_path, caption, taken_at,
        latitude, longitude, created_at
      ) VALUES (
        @id, @projectId, @weekId, @userId, @filePath,
        @caption, @takenAt, 34.0522, -118.2438, @nowIso
      )
    `, { id, projectId: PROJECT_ID, weekId, userId, filePath, caption, takenAt, nowIso });
  }

  const cprRows = [
    ['demo-sub-cpr-week1', '2026-04-25', '2026-04-28', subWeek1UploadPath, 'Received and compliant after reviewer check.'],
    ['demo-sub-cpr-week2', '2026-05-02', '2026-05-05', subWeek2UploadPath, 'Received and compliant; no open subcontractor blockers.'],
  ] as const;
  for (const [id, weekEndingDate, receivedDate, uploadPath, notes] of cprRows) {
    run(`
      INSERT INTO subcontractor_cpr_weeks (
        id, subcontractor_id, week_ending_date, received_date, is_compliant, notes,
        upload_token, upload_token_expires_at, uploaded_at, upload_path, created_at
      ) VALUES (
        @id, @subId, @weekEndingDate, @receivedDate, 1, @notes,
        @token, @uploadTokenExpiresAt, @receivedDate, @uploadPath, @nowIso
      )
    `, {
      id,
      subId: SUB_ID,
      weekEndingDate,
      receivedDate,
      notes,
      token: `${id}-upload-token`,
      uploadTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      uploadPath,
      nowIso,
    });
  }

  run(`
    INSERT INTO copilot_interactions (
      id, user_id, project_id, payroll_week_id, page_path,
      user_message, assistant_message, context_json, suggestions_json,
      model_used, latency_ms, created_at
    ) VALUES (
      'demo-copilot-week2-review', @userId, @projectId, @weekId, @pagePath,
      @userMessage, @assistantMessage, @contextJson, @suggestionsJson,
      'local-rules-demo', 42, @nowIso
    )
  `, {
    userId,
    projectId: PROJECT_ID,
    weekId: WEEK2_ID,
    pagePath: `/projects/${PROJECT_ID}/payroll/${WEEK2_ID}`,
    userMessage: 'Am I ready to submit the corrected California week?',
    assistantMessage: 'The correction is logged, payroll entries reconcile, WH-347 and CA A-1-131 data are populated, and subcontractor CPR evidence is compliant.',
    contextJson: JSON.stringify({
      projectName: 'Demo Library Renovation',
      weekEndingDate: '2026-05-02',
      submitReadyScore: 100,
      importReconciled: true,
      subcontractorCprOpen: false,
      correctionScenario: 'Operating engineer Saturday double-time correction',
    }),
    suggestionsJson: JSON.stringify([
      { id: 'open-ca-a1131', label: 'Preview CA A-1-131' },
      { id: 'open-evidence-packet', label: 'Export evidence packet' },
    ]),
    nowIso,
  });

  const auditRows = [
    ['demo-audit-project-created', 'project', PROJECT_ID, 'project.created', { name: 'Demo Library Renovation' }],
    ['demo-audit-wd-pinned', 'wage_determination', wageDeterminationId, 'wage_determination.pinned', { wdNumber: WD_NUMBER }],
    ['demo-audit-import-week1', 'payroll_import', 'demo-import-qbo-week1', 'payroll_import.committed', { provider: 'quickbooks', committedCount: 5, unmatchedCount: 0 }],
    ['demo-audit-week1-submitted', 'payroll_week', WEEK1_ID, 'payroll_week.submitted', { payrollNumber: 1, weekEnding: '2026-04-25', caEcprSubmittedAt: '2026-04-27T20:15:00.000Z' }],
    ['demo-audit-sub-cpr-week1', 'subcontractor_cpr', 'demo-sub-cpr-week1', 'subcontractor_cpr.approved', { subcontractor: 'Brightline Electrical LLC', weekEnding: '2026-04-25' }],
    ['demo-audit-import-week2', 'payroll_import', 'demo-import-qbo-week2', 'payroll_import.committed', { provider: 'quickbooks', committedCount: 5, unmatchedCount: 0 }],
    ['demo-audit-entry-corrected', 'payroll_entry', 'demo-entry-marco-week2', 'payroll_entry.corrected', { worker: 'Marco Chen', oldSatOt: 4, newSatOt: 2, newSatDt: 2, reason: 'California daily overtime/double-time correction from field log' }],
    ['demo-audit-week2-submitted', 'payroll_week', WEEK2_ID, 'payroll_week.submitted', { payrollNumber: 2, weekEnding: '2026-05-02', caEcprSubmittedAt: '2026-05-04T20:30:00.000Z' }],
    ['demo-audit-sub-cpr-week2', 'subcontractor_cpr', 'demo-sub-cpr-week2', 'subcontractor_cpr.approved', { subcontractor: 'Brightline Electrical LLC', weekEnding: '2026-05-02' }],
    ['demo-audit-reviewer-signoff', 'review', PROJECT_ID, 'review.approved', { reviewer: 'Contracting Officer - Demo', finding: 'Ready for pilot evidence packet review' }],
  ] as const;
  for (const [id, entityType, entityId, action, meta] of auditRows) {
    run(`
      INSERT INTO audit_logs (
        id, created_at, user_id, user_email, project_id, entity_type, entity_id, action, meta
      ) VALUES (
        @id, @nowIso, @userId, @email, @projectId, @entityType, @entityId, @action, @meta
      )
    `, { id, nowIso, userId, email: DEMO_EMAIL, projectId: PROJECT_ID, entityType, entityId, action, meta: JSON.stringify(meta) });
  }

  return { userId, wageDeterminationId };
});

const result = seed();

console.log('Demo California pilot seed complete');
console.log(`Database: ${dbPath}`);
console.log(`Login: ${DEMO_EMAIL}`);
console.log(`Password: ${DEMO_PASSWORD}`);
console.log(`Project ID: ${PROJECT_ID}`);
console.log(`Project URL: /projects/${PROJECT_ID}`);
console.log(`Payroll Week 1 ID: ${WEEK1_ID}`);
console.log(`Payroll Week 1 URL: /projects/${PROJECT_ID}/payroll/${WEEK1_ID}`);
console.log(`Payroll Week 2 ID: ${WEEK2_ID}`);
console.log(`Payroll Week 2 URL: /projects/${PROJECT_ID}/payroll/${WEEK2_ID}`);
console.log(`Evidence Packet CSV: /api/audit/${PROJECT_ID}/evidence-packet?format=csv`);
console.log(`Wage Determination ID: ${result.wageDeterminationId}`);
