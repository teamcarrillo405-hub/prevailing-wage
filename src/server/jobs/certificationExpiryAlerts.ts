import { logger } from '../logger.js';
// src/server/jobs/certificationExpiryAlerts.ts
// DBE-03: Daily scan for certifications expiring in 90, 60, or 30 days.
// Sends email to all active project owners. Best-effort — never rethrows.

import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  subcontractorCertifications,
  subcontractors,
  projectMembers,
  users,
} from '../db/schema.js';

// ── Lazy-init Resend (mirrors emailService.ts pattern) ─────────────────────

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

// ── Main job ───────────────────────────────────────────────────────────────

export async function runCertificationExpiryAlerts(): Promise<void> {
  const db = getDb();
  const resend = await getResend();

  if (!resend) {
    logger.info('[cert-expiry] RESEND_API_KEY not set — skipping certification expiry alerts');
    return;
  }

  const today = new Date();
  const thresholds = [90, 60, 30]; // days before expiry to alert

  for (const days of thresholds) {
    const alertDate = new Date(today);
    alertDate.setDate(alertDate.getDate() + days);
    const alertDateStr = alertDate.toISOString().slice(0, 10); // YYYY-MM-DD

    // Find certs expiring on exactly this target date.
    // Exact-day match prevents duplicate sends for certs that appeared in a prior run.
    const expiringCerts = await db
      .select({
        certId: subcontractorCertifications.id,
        certTypes: subcontractorCertifications.certTypes,
        expiresDate: subcontractorCertifications.expiresDate,
        subName: subcontractors.name,
        projectId: subcontractors.projectId,
      })
      .from(subcontractorCertifications)
      .innerJoin(subcontractors, eq(subcontractorCertifications.subcontractorId, subcontractors.id))
      .where(eq(subcontractorCertifications.expiresDate, alertDateStr));

    if (expiringCerts.length === 0) continue;

    logger.info({ days, count: expiringCerts.length, alertDate: alertDateStr }, '[cert-expiry] found expiring certs');

    for (const cert of expiringCerts) {
      // Find all active owners of this project
      const owners = await db
        .select({ email: users.email })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(
          and(
            eq(projectMembers.projectId, cert.projectId),
            eq(projectMembers.role, 'owner'),
            isNull(projectMembers.removedAt),
          ),
        );

      const projectUrl = `${APP_URL}/projects/${cert.projectId}`;

      for (const owner of owners) {
        if (!owner.email) continue;
        try {
          const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [owner.email],
            subject: `${cert.certTypes} certification for ${cert.subName} expires in ${days} days`,
            html: `
              <p>The <strong>${cert.certTypes}</strong> certification for subcontractor <strong>${cert.subName}</strong> expires on <strong>${cert.expiresDate}</strong>.</p>
              <p>Action required: Request a renewed certificate from the subcontractor and update their certification record to avoid CPR submission blocks.</p>
              <p><a href="${projectUrl}">View project &rarr;</a></p>
              <p style="color:#888;font-size:12px">You are receiving this as a project owner.</p>
            `,
          });
          if (error) {
            logger.error({ err: error, certId: cert.certId }, '[cert-expiry] Resend error');
          }
        } catch (err) {
          logger.error({ err, certId: cert.certId }, '[cert-expiry] send failed');
          // Best-effort per NFR-02 — never rethrow
        }
      }
    }
  }

  logger.info('[cert-expiry] scan complete');
}
