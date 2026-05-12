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
const WEEK_ID = 'demo-week-2026-04-25';
const SUB_ID = 'demo-sub-brightline-electric';
const WD_NUMBER = 'CA20260001';
const WD_REVISION = 0;
const PHOTOS_DIR = process.env.PHOTOS_DIR || './var/data/photos';
const SIGNATURES_DIR = process.env.SIGNATURES_DIR || './var/data/signatures';
const DEMO_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

const now = new Date();
const nowIso = now.toISOString();
const cacheExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

function one<T>(sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

function run(sql: string, params: Record<string, unknown> | unknown[] = []) {
  db.prepare(sql).run(params as never);
}

function gross(baseRate: number, fringeRate: number, straightTime: number, overtime = 0, doubleTime = 0) {
  const totalHours = straightTime + overtime + doubleTime;
  const total = totalHours * baseRate
    + overtime * 0.5 * baseRate
    + doubleTime * baseRate
    + totalHours * fringeRate;
  return Math.round(total * 100) / 100;
}

function net(grossWages: number, deductions: number) {
  return Math.round((grossWages - deductions) * 100) / 100;
}

const existingUser = one<{ id: string }>('SELECT id FROM users WHERE email = ?', [DEMO_EMAIL]);
const userId = existingUser?.id || 'demo-user-hcc-contractor';

function insertPayrollEntry(input: {
  id: string;
  weekId: string;
  workerId: string;
  classificationId: string;
  monSt: number;
  tueSt: number;
  wedSt: number;
  thuSt: number;
  friSt: number;
  baseRate: number;
  fringeRate: number;
  deductions: number;
  ficaTax: number;
  federalIncomeTax: number;
  stateIncomeTax: number;
}) {
  const st = input.monSt + input.tueSt + input.wedSt + input.thuSt + input.friSt;
  const grossWages = gross(input.baseRate, input.fringeRate, st);
  run(`
    INSERT INTO payroll_entries (
      id, payroll_week_id, worker_id, classification_id,
      mon_st, tue_st, wed_st, thu_st, fri_st, sat_st, sun_st,
      mon_ot, tue_ot, wed_ot, thu_ot, fri_ot, sat_ot, sun_ot,
      mon_dt, tue_dt, wed_dt, thu_dt, fri_dt, sat_dt, sun_dt,
      base_rate_snapshot, fringe_rate_snapshot,
      gross_wages, deductions, net_pay,
      fica_tax, federal_income_tax, state_income_tax,
      fringe_health_welfare, fringe_pension, fringe_vacation, fringe_training,
      created_by_user_id, updated_by_user_id, created_at, updated_at
    ) VALUES (
      @id, @weekId, @workerId, @classificationId,
      @monSt, @tueSt, @wedSt, @thuSt, @friSt, 0, 0,
      0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0,
      @baseRate, @fringeRate,
      @grossWages, @deductions, @netPay,
      @ficaTax, @federalIncomeTax, @stateIncomeTax,
      @fringeHealthWelfare, @fringePension, @fringeVacation, @fringeTraining,
      @userId, @userId, @nowIso, @nowIso
    )
  `, {
    ...input,
    grossWages,
    netPay: net(grossWages, input.deductions),
    fringeHealthWelfare: input.fringeRate,
    fringePension: 0,
    fringeVacation: 0,
    fringeTraining: 0,
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
const weekPhotoRelativePath = 'demo-week1-crew.png';
const signatureRelativePath = 'demo-signature.png';
fs.mkdirSync(path.join(PHOTOS_DIR, 'project-photos'), { recursive: true });
fs.mkdirSync(SIGNATURES_DIR, { recursive: true });
fs.writeFileSync(path.join(PHOTOS_DIR, projectPhotoRelativePath), demoPng);
fs.writeFileSync(path.join(PHOTOS_DIR, weekPhotoRelativePath), demoPng);
fs.writeFileSync(path.join(SIGNATURES_DIR, signatureRelativePath), demoPng);

const seed = db.transaction(() => {
  run('DELETE FROM copilot_interactions WHERE project_id = ?', [PROJECT_ID]);
  run('DELETE FROM payroll_provider_mappings WHERE project_id = ?', [PROJECT_ID]);
  run('DELETE FROM payroll_imports WHERE payroll_week_id = ?', [WEEK_ID]);
  run('DELETE FROM subcontractor_cpr_weeks WHERE subcontractor_id = ?', [SUB_ID]);
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
    usesApprentices: false,
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
      18, 1, 0, 1,
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
      'Review seeded WH-347 payroll week',
      'Open import reconciliation and submit-ready checks',
      'Use the subcontractor CPR chase board to send an upload request',
      'Export the audit-ready evidence packet',
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
    ['demo-wc-carpenter', 'CARP', 'Carpenter', 44.15, 19.82],
    ['demo-wc-laborer', 'LAB', 'Laborer - Group 1', 36.80, 17.25],
    ['demo-wc-operator', 'OPER', 'Operating Engineer - Group 3', 52.40, 23.10],
  ] as const;
  for (const [id, code, description, baseRate, fringeRate] of wageClasses) {
    run(`
      INSERT INTO wage_classifications (
        id, wage_determination_id, trade_code, trade_description, labor_type,
        base_rate, fringe_rate, total_rate, created_at
      ) VALUES (
        @id, @wageDeterminationId, @code, @description, 'journeyworker',
        @baseRate, @fringeRate, @totalRate, @nowIso
      )
    `, { id, wageDeterminationId, code, description, baseRate, fringeRate, totalRate: baseRate + fringeRate, nowIso });
  }

  const projectSettings = {
    onboardingSetup: {
      payrollProvider: 'quickbooks',
      accountingProvider: 'quickbooks',
      projectManagementProvider: 'procore',
      usesSubcontractors: true,
      usesApprentices: false,
      fieldTrackingNeeded: true,
      averageWeeklyWorkers: 18,
      completedPromptKeys: ['field-proof'],
      appliedAt: nowIso,
      lastAppliedAt: nowIso,
    },
  };

  run(`
    INSERT INTO projects (
      id, user_id, name, state, county, contract_type, award_date, funding_type,
      wd_identifier, wd_mod_number, wd_locked_at, status,
      cslb_license, wc_policy_number, contractor_fein, awarding_agency, contract_number,
      project_settings, gps_clock_in_enabled, gps_latitude, gps_longitude, gps_radius_meters,
      created_at, updated_at
    ) VALUES (
      @projectId, @userId, 'Demo Library Renovation', 'CA', 'Los Angeles',
      'federal-davis-bacon', '2026-04-15', 'federal',
      @wdNumber, @wdRevision, @nowIso, 'active',
      '123456', 'WC-2026-789', '12-3456789', 'Los Angeles Public Library', 'HCC-DEMO-2026-001',
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

  const workerRows = [
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
    },
  ];

  for (const worker of workerRows) {
    run(`
      INSERT INTO workers (
        id, project_id, name, ssn_last4, trade_union,
        address_street, address_city, address_state, address_zip,
        is_active, created_at, updated_at
      ) VALUES (
        @id, @projectId, @name, @ssnLast4, @tradeUnion,
        @street, @city, 'CA', @zip,
        1, @nowIso, @nowIso
      )
    `, { ...worker, projectId: PROJECT_ID, nowIso });

    run(`
      INSERT INTO worker_classifications (
        id, worker_id, project_id, trade_code, trade_description, labor_type,
        is_active, created_at
      ) VALUES (
        @classificationId, @id, @projectId, @tradeCode, @tradeDescription, 'journeyworker',
        1, @nowIso
      )
    `, { ...worker, projectId: PROJECT_ID, nowIso });
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
    INSERT INTO payroll_weeks (
      id, project_id, week_ending_date, payroll_number, is_final,
      submitted_at, submitted_to, created_at, updated_at
    ) VALUES (
      @weekId, @projectId, '2026-04-25', 1, 0,
      '2026-04-27', 'Contracting Officer - Demo', @nowIso, @nowIso
    )
  `, { weekId: WEEK_ID, projectId: PROJECT_ID, nowIso });

  insertPayrollEntry({
    id: 'demo-entry-jose-week1',
    weekId: WEEK_ID,
    workerId: 'demo-worker-jose',
    classificationId: 'demo-class-jose-carp',
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 8,
    baseRate: 44.15,
    fringeRate: 19.82,
    deductions: 430,
    ficaTax: 158.64,
    federalIncomeTax: 210,
    stateIncomeTax: 61.36,
  });

  insertPayrollEntry({
    id: 'demo-entry-elena-week1',
    weekId: WEEK_ID,
    workerId: 'demo-worker-elena',
    classificationId: 'demo-class-elena-lab',
    monSt: 8,
    tueSt: 8,
    wedSt: 8,
    thuSt: 8,
    friSt: 8,
    baseRate: 36.80,
    fringeRate: 17.25,
    deductions: 360,
    ficaTax: 134.04,
    federalIncomeTax: 174,
    stateIncomeTax: 51.96,
  });

  run(`
    INSERT INTO payroll_imports (
      id, payroll_week_id, imported_by_user_id, provider, source_filename,
      committed_count, unmatched_count, created_at
    ) VALUES (
      'demo-import-qbo-week1', @weekId, @userId, 'quickbooks', 'quickbooks-time-demo-week1.csv',
      2, 0, @nowIso
    )
  `, { weekId: WEEK_ID, userId, nowIso });

  run(`
    INSERT INTO payroll_provider_mappings (
      id, project_id, provider, provider_worker_id, worker_id, created_at
    ) VALUES
      ('demo-qbo-map-jose', @projectId, 'quickbooks', 'QBO-EMP-1001', 'demo-worker-jose', @nowIso),
      ('demo-qbo-map-elena', @projectId, 'quickbooks', 'QBO-EMP-1002', 'demo-worker-elena', @nowIso)
  `, { projectId: PROJECT_ID, nowIso });

  run(`
    INSERT INTO time_punches (
      id, project_id, worker_id, punch_type, punched_at,
      latitude, longitude, accuracy_meters, created_by, created_at
    ) VALUES
      ('demo-punch-jose-in', @projectId, 'demo-worker-jose', 'in', '2026-04-20T14:58:00.000Z', 34.0523, -118.2437, 12, @userId, @nowIso),
      ('demo-punch-jose-out', @projectId, 'demo-worker-jose', 'out', '2026-04-20T23:05:00.000Z', 34.0522, -118.2438, 10, @userId, @nowIso)
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

  run(`
    INSERT INTO week_photos (
      id, project_id, payroll_week_id, uploaded_by, file_path, caption, taken_at,
      latitude, longitude, created_at
    ) VALUES (
      'demo-week-photo-crew', @projectId, @weekId, @userId, @filePath,
      'Crew location evidence for week ending 2026-04-25.',
      '2026-04-20T15:20:00.000Z', 34.0522, -118.2438, @nowIso
    )
  `, { projectId: PROJECT_ID, weekId: WEEK_ID, userId, filePath: weekPhotoRelativePath, nowIso });

  run(`
    INSERT INTO subcontractor_cpr_weeks (
      id, subcontractor_id, week_ending_date, received_date, is_compliant, notes,
      upload_token, upload_token_expires_at, uploaded_at, upload_path, created_at
    ) VALUES (
      'demo-sub-cpr-week1', @subId, '2026-04-25', NULL, NULL,
      'Seeded as missing so the CPR chase board has an action to send.',
      'demo-sub-upload-token-week1', @uploadTokenExpiresAt, NULL, NULL, @nowIso
    )
  `, {
    subId: SUB_ID,
    uploadTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    nowIso,
  });

  run(`
    INSERT INTO copilot_interactions (
      id, user_id, project_id, payroll_week_id, page_path,
      user_message, assistant_message, context_json, suggestions_json,
      model_used, latency_ms, created_at
    ) VALUES (
      'demo-copilot-week1-review', @userId, @projectId, @weekId, @pagePath,
      @userMessage, @assistantMessage, @contextJson, @suggestionsJson,
      'local-rules-demo', 42, @nowIso
    )
  `, {
    userId,
    projectId: PROJECT_ID,
    weekId: WEEK_ID,
    pagePath: `/projects/${PROJECT_ID}/payroll/${WEEK_ID}`,
    userMessage: 'Am I ready to submit this week?',
    assistantMessage: 'Your payroll entries reconcile and the WH-347 packet is ready. The remaining demo action is to chase the subcontractor CPR upload.',
    contextJson: JSON.stringify({
      projectName: 'Demo Library Renovation',
      weekEndingDate: '2026-04-25',
      submitReadyScore: 100,
      importReconciled: true,
      subcontractorCprOpen: true,
    }),
    suggestionsJson: JSON.stringify([
      { id: 'open-evidence-packet', label: 'Export evidence packet' },
      { id: 'send-sub-cpr-request', label: 'Send subcontractor CPR request' },
    ]),
    nowIso,
  });

  const auditRows = [
    ['demo-audit-project-created', 'project', PROJECT_ID, 'project.created', { name: 'Demo Library Renovation' }],
    ['demo-audit-wd-pinned', 'wage_determination', wageDeterminationId, 'wage_determination.pinned', { wdNumber: WD_NUMBER }],
    ['demo-audit-import-committed', 'payroll_import', 'demo-import-qbo-week1', 'payroll_import.committed', { provider: 'quickbooks', committedCount: 2 }],
    ['demo-audit-week-submitted', 'payroll_week', WEEK_ID, 'payroll_week.submitted', { payrollNumber: 1, weekEnding: '2026-04-25' }],
    ['demo-audit-sub-cpr-requested', 'subcontractor_cpr', 'demo-sub-cpr-week1', 'subcontractor_cpr.requested', { subcontractor: 'Brightline Electrical LLC' }],
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

console.log('Demo seed complete');
console.log(`Database: ${dbPath}`);
console.log(`Login: ${DEMO_EMAIL}`);
console.log(`Password: ${DEMO_PASSWORD}`);
console.log(`Project ID: ${PROJECT_ID}`);
console.log(`Project URL: /projects/${PROJECT_ID}`);
console.log(`Payroll Week ID: ${WEEK_ID}`);
console.log(`Payroll Week URL: /projects/${PROJECT_ID}/payroll/${WEEK_ID}`);
console.log(`Evidence Packet CSV: /api/audit/${PROJECT_ID}/evidence-packet?format=csv`);
console.log(`Wage Determination ID: ${result.wageDeterminationId}`);
