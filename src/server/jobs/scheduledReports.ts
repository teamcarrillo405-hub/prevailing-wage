import { logger } from '../logger.js';
// src/server/jobs/scheduledReports.ts
// NOTIF-06 (Phase 86): Daily scan that dispatches compliance report emails per project.
// Cadence: daily / weekly (Monday UTC) / monthly (1st of month UTC).
// Dedup via projectSettings.lastReportSentAt — set only after Resend returns no error.
// Per NFR-02: individual project failures never abort the full scan.

import { eq, and, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import { projects, projectMembers, users } from '../db/schema.js';
import { listPayrollWeeks } from '../services/payrollService.js';
import { computeCompliance } from '../services/complianceService.js';
import { dateDiffDays } from '../services/dueSoonService.js';

// ── Lazy-init Resend (mirrors certificationExpiryAlerts.ts:17-25) ──────────

let resendInstance: any = null;
async function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    const { Resend } = await import('resend');
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@hccprevailingwage.com';
const APP_URL    = process.env.APP_URL    || 'http://localhost:3000';

// ── Types ──────────────────────────────────────────────────────────────────

interface ReportSettings {
  reportSchedule: 'daily' | 'weekly' | 'monthly' | 'off';
  reportEmail: string;
  reportUnsubscribeToken?: string;
  lastReportSentAt?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseReportSettings(raw: string | null | undefined): ReportSettings {
  const DEFAULT: ReportSettings = { reportSchedule: 'off', reportEmail: '' };
  if (!raw) return DEFAULT;
  try {
    const parsed = JSON.parse(raw);
    return {
      reportSchedule: parsed.reportSchedule ?? 'off',
      reportEmail: parsed.reportEmail ?? '',
      reportUnsubscribeToken: parsed.reportUnsubscribeToken,
      lastReportSentAt: parsed.lastReportSentAt,
    };
  } catch {
    return DEFAULT;
  }
}

/**
 * Returns true if a report should be dispatched today for the given cadence.
 * Uses UTC day/date to avoid timezone-dependent shift (Pitfall 5 from RESEARCH).
 */
function shouldSendToday(schedule: ReportSettings['reportSchedule'], now: Date): boolean {
  if (schedule === 'off') return false;
  if (schedule === 'daily') return true;
  if (schedule === 'weekly') return now.getUTCDay() === 1;   // Monday
  if (schedule === 'monthly') return now.getUTCDate() === 1; // 1st of month
  return false;
}

// ── Main job ───────────────────────────────────────────────────────────────

/**
 * Scans all active projects and dispatches a compliance summary email to
 * projects whose reportSchedule cadence matches today's UTC date.
 *
 * - Skips projects with reportSchedule='off' (or missing/null settings).
 * - Deduplicates same-day re-runs via projectSettings.lastReportSentAt.
 * - Falls back to project owner email when reportEmail is blank.
 * - Generates or reuses reportUnsubscribeToken on first successful send.
 * - Sets lastReportSentAt ONLY after Resend confirms no error (retry-safe).
 * - Individual project errors are caught — per NFR-02, one failure never
 *   aborts the full scan.
 */
export async function runScheduledReports(): Promise<void> {
  const db = getDb();
  const resend = await getResend();

  if (!resend) {
    logger.info('[scheduled-reports] RESEND_API_KEY not set — skipping scheduled report dispatch');
    return;
  }

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10); // YYYY-MM-DD

  const activeProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.status, 'active'));

  for (const project of activeProjects) {
    try {
      const settings = parseReportSettings(project.projectSettings);

      // 1. Cadence gate
      if (!shouldSendToday(settings.reportSchedule, today)) continue;

      // 2. Dedup gate (same-day cron re-run protection)
      if (settings.lastReportSentAt === todayISO) continue;

      // 3. Resolve recipient email — fallback to project owner when reportEmail is blank
      let recipient = settings.reportEmail;
      let isFallback = false;
      if (!recipient) {
        const owners = await db
          .select({ email: users.email })
          .from(projectMembers)
          .innerJoin(users, eq(projectMembers.userId, users.id))
          .where(
            and(
              eq(projectMembers.projectId, project.id),
              eq(projectMembers.role, 'owner'),
              isNull(projectMembers.removedAt),
            ),
          );
        if (owners[0]?.email) {
          recipient = owners[0].email;
          isFallback = true;
        }
      }
      if (!recipient) {
        logger.warn({ projectId: project.id }, '[scheduled-reports] no recipient — skipping');
        continue;
      }

      // 4. Assemble compliance summary across all payroll weeks
      const allWeeks = await listPayrollWeeks(project.id);
      const totalWeeks = allWeeks.length;
      let compliantCount = 0;
      let openViolations = 0;

      for (const w of allWeeks) {
        const result = await computeCompliance(db as any, w.id);
        if (!result) continue;
        if (!result.hasViolations) {
          compliantCount += 1;
        } else {
          openViolations += result.violations.length + result.weekViolations.length;
        }
      }

      const complianceRate = totalWeeks > 0
        ? Math.round((compliantCount / totalWeeks) * 100)
        : 100;

      // Weeks with no submittedAt whose weekEndingDate falls within the next 7 days
      const dueIn7 = allWeeks.filter((w: { submittedAt: string | null | undefined; weekEndingDate: string }) => {
        if (w.submittedAt) return false;
        const d = dateDiffDays(todayISO, w.weekEndingDate);
        return d >= 0 && d <= 7;
      }).length;

      // 5. Generate or reuse unsubscribe token (self-sufficient if 86-02 hasn't run yet)
      const rawParsed: Record<string, unknown> = project.projectSettings
        ? (() => {
            try {
              return JSON.parse(project.projectSettings!);
            } catch {
              return {};
            }
          })()
        : {};

      let token = (rawParsed.reportUnsubscribeToken as string) || '';
      if (!token) {
        token = randomUUID();
      }

      const projectUrl = `${APP_URL}/projects/${project.id}`;
      const unsubUrl   = `${APP_URL}/api/notifications/unsubscribe?token=${token}`;

      // 6. Build and send dual-format email via Resend
      const subject = `Compliance Report — ${project.name}`;

      const fallbackNote = isFallback
        ? `<p style="color:#888;font-size:12px">Sending to ${recipient} (project owner). Change in Project Settings.</p>`
        : '';

      const html = `
        <h2 style="font-family:Inter,Arial,sans-serif">${project.name} — Compliance Report</h2>
        <ul>
          <li>Compliance rate: <strong>${complianceRate}%</strong> (${compliantCount}/${totalWeeks} weeks)</li>
          <li>Open violations: <strong>${openViolations}</strong></li>
          <li>Payroll weeks due in next 7 days: <strong>${dueIn7}</strong></li>
        </ul>
        <p><a href="${projectUrl}">View project &rarr;</a></p>
        ${fallbackNote}
        <p style="color:#888;font-size:11px">
          You are receiving this because scheduled reports are enabled for this project.
          <a href="${unsubUrl}">Unsubscribe</a>
        </p>
      `;

      const text = [
        `${project.name} — Compliance Report`,
        ``,
        `Compliance rate: ${complianceRate}% (${compliantCount}/${totalWeeks} weeks)`,
        `Open violations: ${openViolations}`,
        `Payroll weeks due in next 7 days: ${dueIn7}`,
        ``,
        `View project: ${projectUrl}`,
        ``,
        `Unsubscribe: ${unsubUrl}`,
      ].join('\n');

      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to:   [recipient],
        subject,
        html,
        text,
      });

      if (error) {
        logger.error({ err: error, projectId: project.id }, '[scheduled-reports] Resend error');
        // Do NOT update lastReportSentAt — failed send should retry on next cron tick
        continue;
      }

      // 7. Read-modify-write projectSettings: record dedup flag + persist token
      //    Merge into rawParsed to preserve ALL sibling keys (notifyViolations,
      //    lastDueSoonNotifiedAt, GPS settings, NY form data, etc.)
      const updatedSettings = {
        ...rawParsed,
        reportUnsubscribeToken: token,
        lastReportSentAt: todayISO,
      };

      await db
        .update(projects)
        .set({
          projectSettings: JSON.stringify(updatedSettings),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, project.id));

      logger.info(
        { projectId: project.id, schedule: settings.reportSchedule, recipient },
        '[scheduled-reports] sent compliance report',
      );
    } catch (projectErr) {
      // Per NFR-02 — one bad project must never abort the full scan
      logger.error({ err: projectErr, projectId: project.id }, '[scheduled-reports] project failed');
    }
  }

  logger.info('[scheduled-reports] scan complete');
}
