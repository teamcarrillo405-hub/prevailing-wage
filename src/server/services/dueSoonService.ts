// src/server/services/dueSoonService.ts
// NOTIF-02: Daily scan to send payroll due-soon reminders to project owners.
// Registered as a cron job in index.ts inside app.listen() callback.
// Per NFR-02: individual project failures are caught and logged — scan never aborts.

import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, projectMembers, users } from '../db/schema.js';
import { listPayrollWeeks } from './payrollService.js';
import { sendDueSoonEmail, getNotifSettings } from './emailService.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns number of days from `today` until `targetDate`.
 * Positive = target is in the future; negative = target is past; 0 = due today.
 * Both params must be YYYY-MM-DD ISO strings.
 */
export function dateDiffDays(today: string, targetDate: string): number {
  const todayMs = new Date(today + 'T00:00:00.000Z').getTime();
  const targetMs = new Date(targetDate + 'T00:00:00.000Z').getTime();
  return Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}

// ── Main scan ─────────────────────────────────────────────────────────────

/**
 * Scans all active projects and sends a due-soon payroll reminder to the
 * project owner when the latest unsubmitted week falls within the configured
 * `dueSoonDays` threshold.
 *
 * Dedup: stores `lastDueSoonNotifiedAt` (ISO date) in `projectSettings` JSON
 * to prevent duplicate sends if the server restarts within the same day.
 *
 * Non-fatal: per-project errors are caught individually so one bad project
 * does not abort the full scan.
 */
export async function runDueSoonScan(): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Fetch all active projects
  const activeProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.status, 'active'));

  for (const project of activeProjects) {
    try {
      // Check notification preference
      const settings = getNotifSettings(project.projectSettings);
      if (!settings.notifyDueSoon) continue;

      // Dedup: skip if we already sent a reminder today
      const rawParsed: Record<string, unknown> = project.projectSettings
        ? JSON.parse(project.projectSettings)
        : {};
      if (rawParsed.lastDueSoonNotifiedAt === today) continue;

      // Find the most recent unsubmitted payroll week
      const allWeeks = await listPayrollWeeks(project.id);
      // listPayrollWeeks returns DESC order; find the first unsubmitted one
      const unsubmitted = allWeeks.find((w: { submittedAt: string | null | undefined }) => !w.submittedAt);
      if (!unsubmitted) continue;

      const daysUntilDue = dateDiffDays(today, unsubmitted.weekEndingDate);

      // Send only if within the [0, dueSoonDays] window
      if (daysUntilDue < 0 || daysUntilDue > settings.dueSoonDays) continue;

      // Look up the project owner's email
      const memberRows = await db
        .select({ userId: projectMembers.userId, role: projectMembers.role, email: users.email })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(and(
          eq(projectMembers.projectId, project.id),
          isNull(projectMembers.removedAt),
        ));

      const ownerRow = memberRows.find((r: { userId: string; role: string; email: string }) => r.role === 'owner');
      if (!ownerRow?.email) continue;

      // Send the reminder email
      await sendDueSoonEmail(
        project.id,
        project.name,
        ownerRow.email,
        unsubmitted.weekEndingDate,
        daysUntilDue,
        settings.dueSoonDays,
      );

      // Update dedup flag — read-modify-write to preserve all sibling keys
      const updatedSettings = { ...rawParsed, lastDueSoonNotifiedAt: today };
      const now = new Date().toISOString();
      await db
        .update(projects)
        .set({ projectSettings: JSON.stringify(updatedSettings), updatedAt: now })
        .where(eq(projects.id, project.id));

      console.log(
        `[due-soon] Sent reminder for project ${project.id} (${project.name}), ` +
        `week ending ${unsubmitted.weekEndingDate}, ${daysUntilDue} day(s) until due`,
      );
    } catch (projectErr) {
      // Per NFR-02: individual project failures must not abort the full scan
      console.error(`[due-soon] Error processing project ${project.id}:`, projectErr);
    }
  }
}
