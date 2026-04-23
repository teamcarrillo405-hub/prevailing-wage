// src/server/services/emailService.ts
// All email notifications for Phase 46. Mirrors inviteService.ts lazy-init pattern exactly.
// All send functions are non-fatal per NFR-02: catch errors, log, never rethrow.

import { eq, isNull, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projectMembers, users, projects } from '../db/schema.js';
import type { ComplianceViolation, WeekViolation } from './complianceService.js';

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

// ── Resend lazy-init — mirrors inviteService.ts exactly ─────────────────────

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
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

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
): Promise<void> {
  try {
    const resend = await getResend();
    if (!resend) {
      console.log('[email] RESEND_API_KEY not set — skipping violation notification');
      return;
    }

    const settings = await getProjectSettings(projectId);
    if (!settings.notifyViolations) return;

    const members = await getProjectMemberRows(projectId);
    const recipients = members.map((m: { userId: string; role: string; email: string }) => m.email).filter((e: string | null): e is string => !!e);
    if (!recipients.length) return;

    const allViolationCount = violations.length + weekViolations.length;
    const weekUrl = `${APP_URL}/projects/${projectId}/payroll/${weekId}`;

    const violationRows = violations
      .map(
        v =>
          `<li>${v.workerName}: ${v.violationType === 'under-wage' ? 'Under-wage' : 'CWHSSA OT'} — expected $${v.expected.toFixed(2)}, actual $${v.actual.toFixed(2)} (delta: $${v.delta.toFixed(2)})</li>`,
      )
      .join('');
    const weekViolationRows = weekViolations.map(wv => `<li>${wv.detail}</li>`).join('');

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipients,
      subject: `Compliance violation detected — ${projectName} (Week ending ${weekEndingDate})`,
      html: `
        <p>A compliance check on <strong>${projectName}</strong> for the week ending <strong>${weekEndingDate}</strong> detected <strong>${allViolationCount} violation(s)</strong>.</p>
        ${violations.length > 0 ? `<p>Entry violations:</p><ul>${violationRows}</ul>` : ''}
        ${weekViolations.length > 0 ? `<p>Week-level violations:</p><ul>${weekViolationRows}</ul>` : ''}
        <p><a href="${weekUrl}">Review payroll week</a></p>
        <p style="color:#888;font-size:12px">You are receiving this because you are a member of this project. Manage notification preferences in the project settings.</p>
      `,
    });
    if (error) {
      console.error('[email] violation notification Resend error:', error);
    }
  } catch (err) {
    console.error('[email] violation notification failed:', err);
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
    const resend = await getResend();
    if (!resend) {
      console.log('[email] RESEND_API_KEY not set — skipping due-soon notification');
      return;
    }

    const projectUrl = `${APP_URL}/projects/${projectId}`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [ownerEmail],
      subject: `Payroll due soon — ${projectName} (Week ending ${weekEndingDate})`,
      html: `
        <p>The payroll week ending <strong>${weekEndingDate}</strong> for project <strong>${projectName}</strong> is due in <strong>${daysUntilDue} day(s)</strong> and has not yet been submitted.</p>
        <p><a href="${projectUrl}">Go to project</a></p>
        <p style="color:#888;font-size:12px">You configured a ${dueSoonDays}-day reminder in project settings.</p>
      `,
    });
    if (error) {
      console.error('[email] due-soon notification Resend error:', error);
    }
  } catch (err) {
    console.error('[email] due-soon notification failed:', err);
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
    const resend = await getResend();
    if (!resend) {
      console.log('[email] RESEND_API_KEY not set — skipping activity notification');
      return;
    }

    const members = await getProjectMemberRows(projectId);
    const ownerRow = members.find((m: { userId: string; role: string; email: string }) => m.role === 'owner');

    // NOTIF-03: skip if the acting user IS the owner (no self-notification)
    if (ownerRow?.userId === actingUserId) return;

    if (!ownerRow?.email) return;

    const settings = await getProjectSettings(projectId);
    if (!settings.notifyActivity) return;

    const projectUrl = `${APP_URL}/projects/${projectId}`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [ownerRow.email],
      subject: `Team activity on ${projectName}`,
      html: `
        <p>A team member (<strong>${actingUserEmail}</strong>) has made a change to <strong>${projectName}</strong>:</p>
        <p>${activityDescription}</p>
        <p><a href="${projectUrl}">View project</a></p>
        <p style="color:#888;font-size:12px">You are receiving this as the project owner.</p>
      `,
    });
    if (error) {
      console.error('[email] activity notification Resend error:', error);
    }
  } catch (err) {
    console.error('[email] activity notification failed:', err);
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
    const resend = await getResend();
    if (!resend) {
      console.log('[email] RESEND_API_KEY not set — skipping sub upload request');
      return;
    }
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [opts.toEmail],
      subject: `Upload your certified payroll — ${opts.projectName} week ending ${opts.weekEndingDate}`,
      html: `
        <p>Hi ${opts.subName} team,</p>
        <p>Please upload your certified payroll report for the week ending <strong>${opts.weekEndingDate}</strong> on <strong>${opts.projectName}</strong>.</p>
        <p><a href="${opts.uploadUrl}" style="background:#b8860b;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">Upload Certified Payroll</a></p>
        <p>This link expires in 7 days.</p>
      `,
    });
    if (error) console.error('[email] sendSubUploadRequestEmail Resend error:', error);
  } catch (err) {
    console.error('[email] sendSubUploadRequestEmail failed:', err);
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
    const resend = await getResend();
    if (!resend) {
      console.log('[email] RESEND_API_KEY not set — skipping sub CPR received notification');
      return;
    }
    const memberRows = await getProjectMemberRows(opts.projectId);
    const owners = memberRows.filter((r: { userId: string; role: string; email: string }) => r.role === 'owner' && r.email);
    for (const owner of owners) {
      try {
        const { error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: owner.email!,
          subject: `CPR received — ${opts.subName} week ending ${opts.weekEndingDate}`,
          html: `
            <p><strong>${opts.subName}</strong> uploaded their certified payroll for the week ending <strong>${opts.weekEndingDate}</strong> on <strong>${opts.projectName}</strong>.</p>
            <p><a href="${APP_URL}/projects/${opts.projectId}">Review in dashboard →</a></p>
          `,
        });
        if (error) console.error('[email] sendSubCprReceivedEmail Resend error:', error);
      } catch (err) {
        console.error('[email] sendSubCprReceivedEmail failed:', err);
      }
    }
  } catch (err) {
    console.error('[email] sendSubCprReceivedEmail outer error:', err);
  }
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
    const resend = await getResend();
    if (!resend) {
      console.log('[email] RESEND_API_KEY not set — skipping submission confirmation');
      return;
    }

    const projectUrl = `${APP_URL}/projects/${projectId}`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject: `Submission confirmed — ${agencyName} — ${projectName} (Week ending ${weekEndingDate})`,
      html: `
        <p>The payroll week ending <strong>${weekEndingDate}</strong> for <strong>${projectName}</strong> has been marked as submitted to <strong>${agencyName}</strong>.</p>
        <p><a href="${projectUrl}">View project</a></p>
      `,
    });
    if (error) {
      console.error('[email] submission confirmation Resend error:', error);
    }
  } catch (err) {
    console.error('[email] submission confirmation failed:', err);
  }
}
