import { logger } from '../logger.js';
// src/server/services/emailService.ts
// All email notifications for Phase 46+. Mirrors inviteService.ts lazy-init pattern exactly.
// All send functions are non-fatal per NFR-02: catch errors, log, never rethrow.
// Phase 151-03 additions: sendEmail() and sendSupportForward() for welcome/contact/violation wiring.
// Transport priority: SMTP (Google Workspace) → Resend → silent skip.

import { eq, isNull, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projectMembers, users, projects } from '../db/schema.js';
import type { ComplianceViolation, DeductionViolation, WeekViolation } from './complianceService.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface NotifSettings {
  notifyViolations: boolean;
  notifyDueSoon: boolean;
  dueSoonDays: number;
  notifyActivity: boolean;
  notifySubmission: boolean;
}

const DEFAULT_SETTINGS: NotifSettings = {
  notifyViolations: true,
  notifyDueSoon: true,
  dueSoonDays: 3,
  notifyActivity: true,
  notifySubmission: true,
};

// ── From address — env var with AVERO default ──────────────────────────────
const FROM_EMAIL = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? process.env.RESEND_FROM_EMAIL ?? 'notifications@averopw.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ── SMTP transport (Google Workspace / any SMTP) ───────────────────────────
// Activated when SMTP_HOST + SMTP_USER + SMTP_PASS are all set.

import nodemailer from 'nodemailer';

let _smtpTransport: nodemailer.Transporter | null = null;

function getSmtpTransport(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  if (!_smtpTransport) {
    _smtpTransport = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
  }
  return _smtpTransport;
}

// ── Resend lazy-init — fallback when SMTP not configured ───────────────────

let resendInstance: any = null;
async function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    const { Resend } = await import('resend');
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// ── Unified send — SMTP → Resend → skip ───────────────────────────────────

async function sendTransactional(
  to: string | string[],
  subject: string,
  html: string,
): Promise<void> {
  const recipients = Array.isArray(to) ? to : [to];

  // 1. Try SMTP (Google Workspace or any SMTP server)
  const smtp = getSmtpTransport();
  if (smtp) {
    await smtp.sendMail({ from: FROM_EMAIL, to: recipients.join(', '), subject, html });
    return;
  }

  // 2. Try Resend
  const resend = await getResend();
  if (resend) {
    const { error } = await resend.emails.send({ from: FROM_EMAIL, to: recipients, subject, html });
    if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
    return;
  }

  // 3. No transport configured — log and skip (non-fatal)
  logger.info('[email] no transport configured (set SMTP_HOST/SMTP_USER/SMTP_PASS or RESEND_API_KEY) — skipping');
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function getNotifSettings(rawSettings: string | null | undefined): NotifSettings {
  if (!rawSettings) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(rawSettings);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function getProjectMemberRows(projectId: string) {
  const db = getDb();
  return db
    .select({ userId: projectMembers.userId, role: projectMembers.role, email: users.email })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(and(eq(projectMembers.projectId, projectId), isNull(projectMembers.removedAt)));
}

async function getProjectSettings(projectId: string): Promise<NotifSettings> {
  const db = getDb();
  const [row] = await db
    .select({ projectSettings: projects.projectSettings })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return getNotifSettings(row?.projectSettings ?? null);
}

// ── NOTIF-01: Compliance violation email to all project members ──────────────

export async function sendViolationEmail(
  projectId: string,
  weekId: string,
  projectName: string,
  weekEndingDate: string,
  violations: ComplianceViolation[],
  weekViolations: WeekViolation[],
  deductionViolations: DeductionViolation[] = [],
): Promise<void> {
  try {
    const resend = await getResend();
    if (!resend) {
      logger.info('[email] RESEND_API_KEY not set — skipping violation notification');
      return;
    }

    const settings = await getProjectSettings(projectId);
    if (!settings.notifyViolations) return;

    const members = await getProjectMemberRows(projectId);
    const recipients = members.map((m: { userId: string; role: string; email: string }) => m.email).filter((e: string | null): e is string => !!e);
    if (!recipients.length) return;

    const allViolationCount = violations.length + weekViolations.length + deductionViolations.length;
    const weekUrl = `${APP_URL}/projects/${projectId}/payroll/${weekId}`;

    const violationRows = violations
      .map(
        v =>
          `<li>${v.workerName}: ${v.violationType === 'under-wage' ? 'Under-wage' : 'CWHSSA OT'} — expected $${v.expected.toFixed(2)}, actual $${v.actual.toFixed(2)} (delta: $${v.delta.toFixed(2)})</li>`,
      )
      .join('');
    const weekViolationRows = weekViolations.map(wv => `<li>${wv.detail}</li>`).join('');
    const deductionViolationRows = deductionViolations
      .map(
        v =>
          `<li>${v.workerName}: deductions $${v.deductions.toFixed(2)} are ${v.deductionPct}% of $${v.grossWages.toFixed(2)} gross wages</li>`,
      )
      .join('');

    await sendTransactional(
      recipients,
      `Compliance violation detected — ${projectName} (Week ending ${weekEndingDate})`,
      `
        <p>A compliance check on <strong>${projectName}</strong> for the week ending <strong>${weekEndingDate}</strong> detected <strong>${allViolationCount} violation(s)</strong>.</p>
        ${violations.length > 0 ? `<p>Entry violations:</p><ul>${violationRows}</ul>` : ''}
        ${weekViolations.length > 0 ? `<p>Week-level violations:</p><ul>${weekViolationRows}</ul>` : ''}
        ${deductionViolations.length > 0 ? `<p>Deduction violations:</p><ul>${deductionViolationRows}</ul>` : ''}
        <p><a href="${weekUrl}">Review payroll week</a></p>
        <p style="color:#888;font-size:12px">You are receiving this because you are a member of this project. Manage notification preferences in the project settings.</p>
      `,
    );
  } catch (err) {
    logger.error({ err: err }, '[email] violation notification failed:');
    // Non-fatal per NFR-02 — never rethrow
  }
}

// ── NOTIF-02: Payroll due-soon reminder to project owner ────────────────────
// Note: ownerEmail is passed directly by the caller (due-soon scan) rather than
// queried here, so this function requires no DB access.

export async function sendDueSoonEmail(
  projectId: string,
  projectName: string,
  ownerEmail: string,
  weekEndingDate: string,
  daysUntilDue: number,
  dueSoonDays: number,
): Promise<void> {
  try {
    const projectUrl = `${APP_URL}/projects/${projectId}`;
    await sendTransactional(
      ownerEmail,
      `Payroll due soon — ${projectName} (Week ending ${weekEndingDate})`,
      `
        <p>The payroll week ending <strong>${weekEndingDate}</strong> for project <strong>${projectName}</strong> is due in <strong>${daysUntilDue} day(s)</strong> and has not yet been submitted.</p>
        <p><a href="${projectUrl}">Go to project</a></p>
        <p style="color:#888;font-size:12px">You configured a ${dueSoonDays}-day reminder in project settings.</p>
      `,
    );
  } catch (err) {
    logger.error({ err: err }, '[email] due-soon notification failed:');
  }
}

// ── NOTIF-03: Team member activity notification to project owner ─────────────

export async function sendActivityEmail(
  projectId: string,
  projectName: string,
  actingUserId: string,
  actingUserEmail: string,
  activityDescription: string,
): Promise<void> {
  try {
    const members = await getProjectMemberRows(projectId);
    const ownerRow = members.find((m: { userId: string; role: string; email: string }) => m.role === 'owner');

    // NOTIF-03: skip if the acting user IS the owner (no self-notification)
    if (ownerRow?.userId === actingUserId) return;
    if (!ownerRow?.email) return;

    const settings = await getProjectSettings(projectId);
    if (!settings.notifyActivity) return;

    const projectUrl = `${APP_URL}/projects/${projectId}`;
    await sendTransactional(
      ownerRow.email,
      `Team activity on ${projectName}`,
      `
        <p>A team member (<strong>${actingUserEmail}</strong>) has made a change to <strong>${projectName}</strong>:</p>
        <p>${activityDescription}</p>
        <p><a href="${projectUrl}">View project</a></p>
        <p style="color:#888;font-size:12px">You are receiving this as the project owner.</p>
      `,
    );
  } catch (err) {
    logger.error({ err: err }, '[email] activity notification failed:');
  }
}

// ── NOTIF-05: Sub upload request — sent to sub contact on cpr-week creation ──

export async function sendSubUploadRequestEmail(opts: {
  toEmail: string;
  subName: string;
  projectName: string;
  weekEndingDate: string;
  uploadUrl: string;
}): Promise<void> {
  try {
    await sendTransactional(
      opts.toEmail,
      `Upload your certified payroll — ${opts.projectName} week ending ${opts.weekEndingDate}`,
      `
        <p>Hi ${opts.subName} team,</p>
        <p>Please upload your certified payroll report for the week ending <strong>${opts.weekEndingDate}</strong> on <strong>${opts.projectName}</strong>.</p>
        <p><a href="${opts.uploadUrl}" style="background:#b8860b;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">Upload Certified Payroll</a></p>
        <p>This link expires in 7 days.</p>
      `,
    );
  } catch (err) {
    logger.error({ err: err }, '[email] sendSubUploadRequestEmail failed:');
  }
}

// ── NOTIF-06: Sub CPR received — sent to project owner when sub uploads PDF ──

export async function sendSubCprReceivedEmail(opts: {
  projectId: string;
  projectName: string;
  subName: string;
  weekEndingDate: string;
}): Promise<void> {
  try {
    const memberRows = await getProjectMemberRows(opts.projectId);
    const owners = memberRows.filter((r: { userId: string; role: string; email: string }) => r.role === 'owner' && r.email);
    for (const owner of owners) {
      try {
        await sendTransactional(
          owner.email!,
          `CPR received — ${opts.subName} week ending ${opts.weekEndingDate}`,
          `
            <p><strong>${opts.subName}</strong> uploaded their certified payroll for the week ending <strong>${opts.weekEndingDate}</strong> on <strong>${opts.projectName}</strong>.</p>
            <p><a href="${APP_URL}/projects/${opts.projectId}">Review in dashboard →</a></p>
          `,
        );
      } catch (err) {
        logger.error({ err: err }, '[email] sendSubCprReceivedEmail failed:');
      }
    }
  } catch (err) {
    logger.error({ err: err }, '[email] sendSubCprReceivedEmail outer error:');
  }
}

// ── NOTIF-07: WD change alert to all active project members ────────────────

export async function sendWdChangedEmail(opts: {
  toEmail: string;
  projectName: string;
  wdNumber: string;
  oldRevision: number;
  newRevision: number;
}): Promise<void> {
  try {
    await sendTransactional(
      opts.toEmail,
      `Wage determination updated: ${opts.wdNumber}`,
      `<p>The wage determination <strong>${opts.wdNumber}</strong> for project <strong>${opts.projectName}</strong> has been updated from revision ${opts.oldRevision} to revision ${opts.newRevision}.</p><p>Please review your payroll entries for compliance.</p>`,
    );
  } catch (err) {
    logger.error({ err: err }, '[email] sendWdChangedEmail failed:');
  }
}

// ── NOTIF-08: Violation alert to project owners only (Task 6, v4.1) ────────
// Simpler per-recipient function — one call per owner. Keep send failures non-fatal.

export async function sendViolationAlertEmail(opts: {
  toEmail: string;
  projectName: string;
  weekEndingDate: string;
  violationSummary: string;
}): Promise<void> {
  try {
    await sendTransactional(
      opts.toEmail,
      `Payroll violation detected: ${opts.projectName} (week ending ${opts.weekEndingDate})`,
      `<p>A payroll compliance violation was detected for project <strong>${opts.projectName}</strong>, week ending <strong>${opts.weekEndingDate}</strong>.</p><p><strong>Summary:</strong> ${opts.violationSummary}</p><p>Please review and correct the payroll entries.</p>`,
    );
  } catch (err) {
    logger.error({ err: err }, '[email] sendViolationAlertEmail failed:');
  }
}

// ── Generic sendEmail() — used by welcome, contact forward, and violation alert ──
// Routes through sendTransactional (SMTP → Resend → skip). Never throws per NFR-02.

const SUPPORT_ADDRESS = process.env.EMAIL_SUPPORT ?? 'support@averopw.com';

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await sendTransactional(to, subject, html);
  } catch (err) {
    console.error('[emailService] send failed:', err);
  }
}

export async function sendSupportForward(from: string, name: string, subject: string, message: string): Promise<void> {
  const html = `<p><strong>From:</strong> ${name} &lt;${from}&gt;</p><p><strong>Subject:</strong> ${subject ?? '(none)'}</p><hr/><p>${message.replace(/\n/g, '<br/>')}</p>`;
  await sendEmail(SUPPORT_ADDRESS, `[Contact] ${subject ?? 'New message'}`, html);
}

// ── NOTIF-04: Submission confirmation to acting user ───────────────────────

export async function sendSubmissionConfirmationEmail(
  toEmail: string,
  projectName: string,
  agencyName: string,
  weekEndingDate: string,
  projectId: string,
): Promise<void> {
  try {
    const projectUrl = `${APP_URL}/projects/${projectId}`;
    await sendTransactional(
      toEmail,
      `Submission confirmed — ${agencyName} — ${projectName} (Week ending ${weekEndingDate})`,
      `
        <p>The payroll week ending <strong>${weekEndingDate}</strong> for <strong>${projectName}</strong> has been marked as submitted to <strong>${agencyName}</strong>.</p>
        <p><a href="${projectUrl}">View project</a></p>
      `,
    );
  } catch (err) {
    logger.error({ err: err }, '[email] submission confirmation failed:');
  }
}
