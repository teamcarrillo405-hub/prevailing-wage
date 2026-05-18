import { chromium, type Browser, type Page, type Route } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'output', 'ui-audit');
const auditPort = Number(process.env.UI_AUDIT_PORT ?? 4307);
const baseUrl = process.env.UI_AUDIT_BASE_URL ?? `http://127.0.0.1:${auditPort}`;
const projectId = 'audit-project';
const weekId = 'audit-week-1';
const workerId = 'audit-worker-1';

type SectionResult = {
  name: string;
  path: string;
  viewport: string;
  score: number;
  issues: string[];
  screenshot: string;
};

type RouteTarget = {
  name: string;
  path: string;
  public?: boolean;
};

const desktop = { width: 1440, height: 960, label: 'desktop' };
const mobile = { width: 390, height: 844, label: 'mobile' };

const routes: RouteTarget[] = [
  { name: 'Public landing', path: '/', public: true },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Project list', path: '/dashboard' },
  { name: 'Project home', path: `/projects/${projectId}` },
  { name: 'Settings', path: `/projects/${projectId}/settings` },
  { name: 'Wage determination', path: '/wages' },
  { name: 'Workers', path: `/projects/${projectId}/workers` },
  { name: 'Payroll week', path: `/projects/${projectId}/payroll/${weekId}` },
  { name: 'Imports', path: `/projects/${projectId}/payroll/${weekId}` },
  { name: 'Evidence', path: `/projects/${projectId}/activity` },
  { name: 'Forms', path: `/projects/${projectId}/payroll/${weekId}` },
  { name: 'Submissions', path: `/projects/${projectId}/activity` },
  { name: 'Subcontractors', path: `/projects/${projectId}` },
  { name: 'Field clock', path: `/projects/${projectId}/field` },
  { name: 'Reports', path: `/projects/${projectId}/reports` },
  { name: 'Reviewer/auditor views', path: `/projects/${projectId}/activity` },
];

const project = {
  id: projectId,
  name: 'Audit Demo Library Renovation',
  projectName: 'Audit Demo Library Renovation',
  status: 'active',
  state: 'CA',
  city: 'Oakland',
  county: 'Alameda',
  address: '100 Main St',
  awardingAgency: 'City of Oakland',
  agencyName: 'City of Oakland',
  contractNumber: 'PW-2026-001',
  contractType: 'state-prevailing',
  fundingType: 'mixed',
  fundingSource: 'state_local',
  wdIdentifier: 'CA20250001',
  dirProjectId: 'PW20260001',
  jurisdiction: 'layered',
  jurisdictionType: 'layered',
  wageDeterminationSource: 'California DIR',
  localOrdinance: 'Oakland local review required',
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
  reportSchedule: 'weekly',
  gpsRequired: true,
  gpsClockInEnabled: true,
  projectSettings: null,
  apprenticeshipRequirements: null,
};

const worker = {
  id: workerId,
  firstName: 'Maria',
  lastName: 'Santos',
  name: 'Maria Santos',
  classification: 'Laborer',
  baseRate: 45,
  fringeRate: 18,
  email: 'maria.audit@example.com',
  active: true,
  classifications: [
    { id: 'worker-class-1', tradeCode: 'LAB', tradeDescription: 'Laborer', laborType: 'journeyworker', baseRate: 45, fringeRate: 18 },
  ],
};

const week = {
  id: weekId,
  projectId,
  payrollNumber: 1,
  weekEndingDate: '2026-05-09',
  submittedAt: null,
  status: 'draft',
  contractorSignedAt: null,
  entries: [
    {
      id: 'audit-entry-1',
      workerId,
      classification: 'Laborer',
      regularHours: 32,
      overtimeHours: 8,
      doubleTimeHours: 0,
      baseRateSnapshot: 45,
      fringeRateSnapshot: 18,
      grossWages: 1620,
      deductions: 210,
      totalDeductions: 210,
      netPay: 1410,
      employerContributions: 120,
      cashFringePaid: 80,
      hourlyFringeCredit: 18,
    },
  ],
};

const payrollRows = week.entries.map(entry => ({ entry, worker }));

function bodyFor(urlText: string) {
  const url = new URL(urlText);
  const pathname = url.pathname;

  if (pathname === '/api/auth/me') {
    return { data: { user: { id: 'audit-user', email: 'audit@example.com', companyName: 'Audit Builders', onboardingCompletedAt: '2026-05-16T00:00:00.000Z' } } };
  }
  if (pathname === '/api/payroll/due-soon') {
    return [{ weekId, projectId, projectName: project.name, weekEndingDate: week.weekEndingDate, payrollNumber: 1, status: 'due-soon', daysUntil: 3 }];
  }
  if (pathname === '/api/projects') return { data: { projects: [project] } };
  if (pathname === `/api/projects/${projectId}`) return { data: { project } };
  if (pathname === `/api/projects/${projectId}/workers`) return { data: { workers: [worker] } };
  if (pathname.includes('/workers/search')) return { data: { workers: [worker] } };
  if (pathname === `/api/projects/${projectId}/wage-classifications`) {
    return { data: { classifications: [{ id: 'class-1', classification: 'Laborer', baseRate: 45, fringeRate: 18 }], hasWd: true, wdNumber: 'CA20250001', state: 'CA', county: 'Alameda' } };
  }
  if (pathname === `/api/payroll/projects/${projectId}/weeks`) return { weeks: [week] };
  if (pathname === `/api/payroll/weeks/${weekId}`) return { week, project, entries: payrollRows };
  if (pathname === `/api/projects/${projectId}/wage-determinations`) {
    return {
      pins: [
        {
          wageDeterminationId: 'wd-audit-1',
          constructionType: 'Building',
          isPrimary: true,
          pinnedAt: '2026-05-16T00:00:00.000Z',
          pinnedByUserId: 'audit-user',
          source: 'DIR',
          wdNumber: 'CA20250001',
          revisionNumber: 1,
          state: 'CA',
          county: 'Alameda',
          wdConstructionType: 'Building',
          publishDate: '2026-01-01T00:00:00.000Z',
          cachedAt: '2026-05-16T00:00:00.000Z',
          cacheExpiresAt: '2026-06-15T00:00:00.000Z',
          lastFetchedAt: '2026-05-16T00:00:00.000Z',
        },
      ],
    };
  }
  if (pathname === `/api/projects/${projectId}/subcontractors`) {
    return {
      data: {
        subcontractors: [
          {
            id: 'sub-1',
            projectId,
            name: 'Brightline Electrical LLC',
            licenseNumber: 'CA-EL-1001',
            contactName: 'Jordan Lee',
            contactEmail: null,
            address: '200 Telegraph Ave, Oakland, CA',
            status: 'pending',
            dbeClassification: 'none',
            createdAt: '2026-05-16T00:00:00.000Z',
            certSummary: { certCount: 0, isCertified: false, hasExpiredCert: false, hasSuspendedCert: false, hasPendingCert: false },
          },
        ],
      },
    };
  }
  if (pathname === `/api/projects/${projectId}/subcontractor-cpr-queue`) {
    return {
      data: {
        queue: [
          {
            subcontractorId: 'sub-1',
            subcontractorName: 'Brightline Electrical LLC',
            contactEmail: null,
            weekId: 'sub-cpr-week-1',
            payrollWeekId: weekId,
            payrollNumber: 1,
            weekEndingDate: week.weekEndingDate,
            receivedDate: null,
            isCompliant: null,
            status: 'not-received',
            daysLate: 7,
            notes: null,
            uploadToken: null,
            uploadTokenExpiresAt: null,
            uploadedAt: null,
            nextAction: 'Add a contact email and send the first upload request.',
          },
        ],
        summary: { total: 1, overdue: 0, notReceived: 1, nonCompliant: 0, readyToRequest: 0 },
      },
    };
  }
  if (pathname.startsWith('/api/compliance/projects/summary')) {
    return { projects: [{ id: projectId, status: 'review', violationCount: 0, unsubmittedWeekEndingDates: [week.weekEndingDate] }] };
  }
  if (pathname === `/api/compliance/${weekId}`) return { violations: [], warnings: [], summary: { status: 'ready' } };
  if (pathname === `/api/compliance/${weekId}/submit-ready`) {
    return {
      weekId,
      projectId,
      score: 96,
      status: 'ready',
      headline: 'This payroll week is ready for certified payroll export.',
      blockers: 0,
      warnings: 0,
      passes: 5,
      issues: [
        {
          id: 'entries-ready',
          category: 'payroll',
          severity: 'pass',
          title: 'Payroll entries ready',
          detail: 'All payroll rows include hours, rates, deductions, and worker assignments.',
        },
      ],
      summary: {
        entryCount: 1,
        totalHours: 40,
        grossWages: 1620,
        complianceIssueCount: 0,
        exportFormat: 'WH-347 + CA A-1-131',
      },
    };
  }
  if (pathname === `/api/payroll/import/reconciliation/${weekId}`) {
    return {
      data: {
        weekId,
        projectId,
        status: 'reconciled',
        latestImport: {
          id: 'import-audit-1',
          provider: 'manual_csv',
          sourceFilename: 'audit-payroll.csv',
          committedCount: 1,
          unmatchedCount: 0,
          createdAt: '2026-05-16T00:00:00.000Z',
        },
        summary: {
          entryCount: 1,
          totalHours: 40,
          grossWages: 1620,
          grossDeltaTotal: 0,
          netDeltaTotal: 0,
          payDeltaReviewCount: 0,
          payDeltaReviewed: true,
          zeroRateCount: 0,
          missingPayCount: 0,
          providerMappingCount: 1,
          sourceDetailCompleteCount: 1,
          sourceDetailMissingCount: 0,
          sourceCoverage: {
            grossPay: 1,
            netPay: 1,
            totalDeductions: 1,
            taxBreakdown: 1,
            deductionBreakdown: 1,
            fringeBreakdown: 1,
            checkNumber: 1,
          },
          sourceFieldGaps: [],
          itemizedDeductionMismatchCount: 0,
          netPayMismatchCount: 0,
          fringeMismatchCount: 0,
          automationConfidenceScore: 98,
          automationExceptionCount: 0,
        },
        automation: {
          confidenceScore: 98,
          confidenceLabel: 'ready',
          automationMode: 'mapped_provider_import',
          importedRows: 1,
          mappedWorkers: 1,
          exceptionCount: 0,
          reviewOnlyChangedRowsReady: true,
          priorWeekDeltaModeReady: true,
          deductionAutomation: {
            status: 'complete',
            totalRows: 1,
            itemizedRows: 1,
            taxRows: 1,
            mismatchCount: 0,
          },
          fringeAutomation: {
            status: 'complete',
            totalRows: 1,
            itemizedRows: 1,
            mismatchCount: 0,
          },
          providerAutomation: {
            provider: 'manual_csv',
            status: 'mapping_ready',
            liveSyncAvailable: false,
            setupSteps: [
              {
                id: 'worker-mapping',
                label: 'Worker mapping retained',
                status: 'complete',
                detail: 'The imported worker is mapped to the project worker record.',
              },
            ],
            missingCapabilities: [],
          },
          changedRowReview: {
            mode: 'exceptions_only',
            status: 'reviewed',
            acknowledgementIssueId: 'payroll-automation-exceptions',
            currentRows: 1,
            priorWeekRows: 1,
            changedRows: 0,
            unchangedRows: 1,
            newRows: 0,
            removedRows: 0,
            exceptionRows: 0,
            reviewRows: [],
          },
          reviewAcknowledgement: {
            automationExceptionsReviewed: true,
            changedRowsReviewed: true,
            blockingExceptionCount: 0,
            reviewableExceptionCount: 0,
            unreviewedExceptionCount: 0,
          },
          nextBestAction: {
            id: 'export-ready',
            label: 'Export certified payroll',
            status: 'ready',
            detail: 'All imported payroll source fields are reconciled and ready for WH-347 and CA A-1-131 review.',
            target: 'submission',
          },
          tasks: [
            {
              id: 'source-detail',
              label: 'Payroll source detail verified',
              status: 'complete',
              detail: 'Gross, net, deductions, fringe, and check number fields are present.',
              target: 'deductions',
            },
          ],
        },
        providerGuide: {
          label: 'CSV',
          requiredColumns: ['worker_name', 'classification', 'gross_pay', 'net_pay', 'check_number'],
          notes: ['Keep payroll register values as the source of truth for taxes and deductions.'],
        },
        issues: [
          {
            id: 'reconciled',
            severity: 'pass',
            title: 'Import reconciled',
            detail: 'Payroll register totals match certified payroll entries.',
            nextAction: 'Continue to export readiness.',
          },
        ],
      },
    };
  }
  if (pathname === `/api/export/state-readiness/${weekId}`) {
    return {
      data: {
        state: 'CA',
        label: 'California',
        status: 'production_pilot',
        statusLabel: 'Production pilot',
        launchDecision: 'enabled',
        nextGate: 'Continue verifying DIR identifiers before submission.',
        ready: true,
        supportedExports: ['WH-347 PDF', 'CA A-1-131 PDF', 'CA eCPR XML'],
        requiredFields: [
          { key: 'awardingAgency', label: 'Awarding agency', present: true, valid: true },
          { key: 'contractNumber', label: 'Contract number', present: true, valid: true },
          { key: 'dirProjectId', label: 'DIR project ID', present: true, valid: true },
        ],
        missingFields: [],
        invalidFields: [],
      },
    };
  }
  if (pathname === `/api/audit/${projectId}/evidence-summary`) {
    return {
      data: {
        requirements: [
          { key: 'payroll_submissions', label: 'Payroll submissions', required: 2, collected: 2, status: 'complete' },
          { key: 'audit_trail', label: 'Project audit trail', required: 1, collected: 3, status: 'complete' },
          { key: 'photo_evidence', label: 'Photo evidence', required: 1, collected: 1, status: 'complete' },
          { key: 'gps_time_punches', label: 'GPS time punches', required: 1, collected: 1, status: 'complete' },
        ],
        weeks: [{ weekId, weekEndingDate: week.weekEndingDate, submitted: false, weekPhotoCount: 1, timePunchCount: 1, readyForPacket: true }],
        missingEvidence: [],
        readyForPacket: true,
        payrollWeekCount: 1,
        submittedWeekCount: 0,
        unsubmittedWeekCount: 1,
        auditEventCount: 3,
        latestAuditAt: '2026-05-16T00:00:00.000Z',
      },
    };
  }
  if (pathname.startsWith(`/api/audit/${projectId}`)) return { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 };
  if (pathname === `/api/projects/${projectId}/signature`) return { data: { signature: null } };
  if (pathname === `/api/projects/${projectId}/photos`) return { data: { photos: [] } };
  if (pathname === `/api/projects/${projectId}/weeks/${weekId}/photos`) return { data: { photos: [] } };
  if (pathname === '/api/mfa/status') return { data: { enabled: false, backupCodesRemaining: 0 } };
  if (pathname === '/api/team') return { data: { isOwner: true, members: [] } };
  if (pathname === '/api/onboarding') return { data: { checklist: [], completedCount: 5, totalCount: 7 } };
  if (pathname.startsWith('/api/dashboard/projects')) return { projects: [{ ...project, violationCount: 0, unsubmittedWeekEndingDates: [week.weekEndingDate], readinessStatus: 'ready' }] };
  if (pathname === '/api/dashboard/summary') return { activeProjects: 1, openViolations: 0, weeksDueThisWeek: 1 };
  if (pathname === '/api/dashboard/contractor-actions') return { actions: [] };
  if (pathname === '/api/dashboard/economic-impact') {
    return {
      data: {
        hoursSaved: 4,
        payrollAtRisk: 0,
        workersCovered: 5,
        totalWagesByCraft: [{ trade: 'Laborer', totalWages: 1620, workerCount: 1, projectCount: 1 }],
        localHirePercent: 100,
        apprenticePercent: 25,
        stateBreakdown: [{ state: 'CA', projectCount: 1, workerCount: 1, totalWages: 1620 }],
        totalWagesPaid: 1620,
        complianceTrend: [{ weekLabel: 'May 9', violations: 0, compliant: 1 }],
        topViolatingProjects: [],
        wageVarianceByTrade: [{ trade: 'Laborer', avgRate: 45, minRate: 45, maxRate: 45, deviation: 0 }],
        overtimeExposure: [{ projectId, projectName: project.name, dtHours: 0, otHours: 8, estimatedPremium: 180 }],
        apprenticeshipProgress: [{ trade: 'Laborer', required: 25, actual: 25, gap: 0 }],
        submissionPunctuality: { onTime: 1, late: 0, missing: 0, percentOnTime: 100 },
        weeklyWageBurn: [{ weekLabel: 'May 9', wages: 1620, workers: 1 }],
        fringeVsBaseWage: { fringe: 720, base: 1800, fringePercent: 28.57 },
        projectRankings: [{ projectId, projectName: project.name, totalWages: 1620, workers: 1, compliance: 100 }],
      },
    };
  }
  if (pathname === '/api/dashboard/at-risk') return { projects: [] };
  if (pathname === '/api/reports/compliance-summary') return { rows: [] };
  if (pathname === `/api/reports/${projectId}/hours-pivot`) return { pivot: [] };
  if (pathname === `/api/reports/${projectId}/fringe-summary`) return { rows: [] };
  if (pathname.startsWith(`/api/reports/${projectId}/pay-history`)) return { rows: [] };
  if (pathname === `/api/reports/${projectId}/fringe-breakdown`) return { rows: [] };
  if (pathname === `/api/reports/${projectId}/dbe-participation`) {
    return { projectId, totalHours: 40, byClassification: { dbe: { hours: 0, pct: 0 }, mbe: { hours: 0, pct: 0 }, wbe: { hours: 0, pct: 0 }, sdvosb: { hours: 0, pct: 0 }, uncertified: { hours: 40, pct: 100 } }, byWeek: [] };
  }
  if (pathname === '/api/integrations/qbo/status') return { data: { connected: false } };
  if (pathname === '/api/integrations/procore/status') return { data: { connected: false } };
  if (pathname === '/api/sso/config') return { data: null };
  if (pathname === '/api/security/overview') return { data: { controls: [], events: [] } };
  if (pathname === '/api/keys' || pathname === '/api/webhooks') return { data: [] };
  if (pathname === '/api/compliance/methodology') return { data: { sections: [] } };
  if (pathname.startsWith('/api/time-punches')) return { data: { punches: [], openPunch: null } };
  if (pathname.startsWith('/api/photos')) return { data: { photos: [] } };
  if (pathname.startsWith('/api/copilot')) return { data: { interactions: [], items: [] } };

  return { data: {}, weeks: [], projects: [], rows: [], actions: [] };
}

async function mockApi(route: Route) {
  if (route.request().method() !== 'GET') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bodyFor(route.request().url())) });
}

function startVite(): ChildProcessWithoutNullStreams {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm', 'run', 'dev:client', '--', '--host', '127.0.0.1', '--port', String(auditPort), '--strictPort']
    : ['run', 'dev:client', '--', '--host', '127.0.0.1', '--port', String(auditPort), '--strictPort'];
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', data => process.stdout.write(`[vite] ${data}`));
  child.stderr.on('data', data => process.stderr.write(`[vite] ${data}`));
  return child;
}

function stopProcessTree(child: ChildProcessWithoutNullStreams) {
  if (!child.pid) return;
  child.stdout.destroy();
  child.stderr.destroy();
  if (process.platform === 'win32') {
    spawnSync('powershell.exe', ['-NoProfile', '-Command', `Stop-Process -Id ${child.pid} -Force -ErrorAction SilentlyContinue`], { stdio: 'ignore', timeout: 5_000 });
    const netstat = spawnSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 5_000 });
    const pids = new Set(
      (netstat.stdout || '')
        .split(/\r?\n/)
        .filter(line => line.includes(`:${auditPort}`) && line.includes('LISTENING'))
        .map(line => line.trim().split(/\s+/).at(-1))
        .filter((pid): pid is string => Boolean(pid) && /^\d+$/.test(pid)),
    );
    for (const pid of pids) {
      spawnSync('powershell.exe', ['-NoProfile', '-Command', `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`], { stdio: 'ignore', timeout: 5_000 });
    }
  } else {
    child.kill('SIGTERM');
  }
}

async function waitForApp(timeoutMs = 45_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function auditPage(page: Page, target: RouteTarget, viewport: typeof desktop): Promise<SectionResult> {
  const issues: string[] = [];
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleMessages.push(msg.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const response = await page.goto(`${baseUrl}${target.path}`, { waitUntil: 'networkidle', timeout: 30_000 });
  if (!response || response.status() >= 400) issues.push(`Route returned ${response?.status() ?? 'no response'}`);

  const metrics = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const interactive = Array.from(document.querySelectorAll('button, a, input, select, textarea'))
      .filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && el.getClientRects().length > 0
          && el.getAttribute('aria-hidden') !== 'true';
      });
    const unlabeledElements = interactive.filter(el => {
      const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '';
      const text = (el.textContent || '').trim();
      const title = el.getAttribute('title') || '';
      const id = el.getAttribute('id');
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() ?? '' : '';
      return !aria.trim() && !text && !title && !label;
    });
    const buttons = Array.from(document.querySelectorAll('button'));
    const disabledPrimaryElements = buttons.filter(button => button.disabled && /submit|save|export|download|continue|next/i.test(button.textContent || button.getAttribute('aria-label') || ''));
    const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(el => (el.textContent || '').trim()).filter(Boolean);
    const duplicates = headings.filter((heading, index) => headings.indexOf(heading) !== index);
    const primaryActions = Array.from(document.querySelectorAll('button, a')).filter(el => /save|export|download|submit|continue|create|add|review|fix/i.test(el.textContent || el.getAttribute('aria-label') || ''));

    return {
      title: document.title,
      textLength: body.innerText.trim().length,
      horizontalOverflow: html.scrollWidth > html.clientWidth + 2,
      overflowPixels: html.scrollWidth - html.clientWidth,
      unlabeled: unlabeledElements.length,
      unlabeledSamples: unlabeledElements.slice(0, 5).map(el => {
        const id = el.getAttribute('id');
        const name = el.tagName.toLowerCase();
        const type = el.getAttribute('type');
        const placeholder = el.getAttribute('placeholder');
        const cls = (el.getAttribute('class') || '').split(/\s+/).slice(0, 3).join('.');
        return [name, type && `type=${type}`, id && `#${id}`, placeholder && `placeholder=${placeholder}`, cls && `.${cls}`].filter(Boolean).join(' ');
      }),
      disabledPrimary: disabledPrimaryElements.length,
      disabledPrimarySamples: disabledPrimaryElements.slice(0, 5).map(button => (button.textContent || button.getAttribute('aria-label') || '').trim()),
      duplicateHeadings: Array.from(new Set(duplicates)).slice(0, 5),
      primaryActionCount: primaryActions.length,
      viewportHeight: window.innerHeight,
      documentHeight: html.scrollHeight,
    };
  });

  if (metrics.textLength < 80) issues.push('Page rendered very little visible content');
  if (metrics.horizontalOverflow) issues.push(`Horizontal overflow by ${metrics.overflowPixels}px`);
  if (metrics.unlabeled > 0) issues.push(`${metrics.unlabeled} interactive controls lack accessible names: ${metrics.unlabeledSamples.join('; ')}`);
  if (metrics.disabledPrimary > 0) issues.push(`${metrics.disabledPrimary} primary-looking actions are disabled: ${metrics.disabledPrimarySamples.join('; ')}`);
  if (metrics.primaryActionCount === 0 && !target.public) issues.push('No primary workflow action detected');
  if (metrics.duplicateHeadings.length > 2) issues.push(`Repeated panel headings: ${metrics.duplicateHeadings.join(', ')}`);
  if (viewport.label === 'mobile' && metrics.documentHeight > metrics.viewportHeight * 10) issues.push('Mobile page is unusually long or dense');
  for (const message of consoleMessages.slice(0, 3)) issues.push(`Console error: ${message}`);
  for (const message of pageErrors.slice(0, 3)) issues.push(`Page error: ${message}`);

  const screenshotName = `${target.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${viewport.label}.png`;
  const screenshotPath = path.join(outputDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const score = Math.max(0, 10 - issues.length);
  return {
    name: target.name,
    path: target.path,
    viewport: viewport.label,
    score,
    issues,
    screenshot: path.relative(root, screenshotPath),
  };
}

async function run() {
  await mkdir(outputDir, { recursive: true });
  const vite = startVite();
  let browser: Browser | undefined;

  try {
    await waitForApp();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route('**/api/**', mockApi);

    const results: SectionResult[] = [];
    for (const target of routes) {
      for (const viewport of [desktop, mobile]) {
        const page = await context.newPage();
        results.push(await auditPage(page, target, viewport));
        await page.close();
      }
    }

    const lowestScore = Math.min(...results.map(result => result.score));
    const notTen = results.filter(result => result.score < 10).map(result => ({
      name: result.name,
      viewport: result.viewport,
      score: result.score,
      issues: result.issues,
      screenshot: result.screenshot,
    }));
    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      routeCount: routes.length,
      sectionCount: results.length,
      lowestScore,
      notTen,
      results,
    };
    const reportPath = path.join(outputDir, 'full-ui-audit.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(JSON.stringify({
      lowestScore,
      notTen,
      evidencePath: path.relative(root, reportPath),
    }, null, 2));

    const exitCode = notTen.length > 0 ? 1 : 0;
    stopProcessTree(vite);
    await Promise.race([
      browser?.close() ?? Promise.resolve(),
      new Promise(resolve => setTimeout(resolve, 5_000)),
    ]);
    process.exit(exitCode);
  } finally {
    stopProcessTree(vite);
    await Promise.race([
      browser?.close() ?? Promise.resolve(),
      new Promise(resolve => setTimeout(resolve, 5_000)),
    ]);
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
