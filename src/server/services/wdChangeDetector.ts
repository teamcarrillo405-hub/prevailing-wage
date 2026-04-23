// src/server/services/wdChangeDetector.ts
// WD change detector — scans for expired wageDeterminations cache entries and
// notifies all active project members whose projects reference those WDs.
// Called on a daily cron from index.ts (NOTIF-07).

import { getDb } from '../db/index.js';
import { wageDeterminations, projects, projectMembers, users } from '../db/schema.js';
import { lt, eq, and, isNull } from 'drizzle-orm';
import { sendWdChangedEmail } from './emailService.js';

export async function checkWdChanges(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  // Find all WD cache entries whose cacheExpiresAt is in the past
  const expiredWds = await db
    .select()
    .from(wageDeterminations)
    .where(lt(wageDeterminations.cacheExpiresAt, now));

  if (expiredWds.length === 0) {
    console.log('[wd-detector] No expired WD cache entries found');
    return;
  }

  console.log(`[wd-detector] Found ${expiredWds.length} expired WD cache entries`);

  for (const wd of expiredWds) {
    // Find active projects that reference this WD number
    const affectedProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(
        and(
          eq(projects.wdIdentifier, wd.wdNumber),
          eq(projects.status, 'active'),
        ),
      );

    for (const project of affectedProjects) {
      // Get all non-removed members of this project
      const members = await db
        .select({ email: users.email })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(
          and(
            eq(projectMembers.projectId, project.id),
            isNull(projectMembers.removedAt),
          ),
        );

      for (const member of members) {
        if (member.email) {
          await sendWdChangedEmail({
            toEmail: member.email,
            projectName: project.name,
            wdNumber: wd.wdNumber,
            oldRevision: wd.revisionNumber,
            newRevision: wd.revisionNumber, // same revision — alerting on cache expiry
          }).catch((err) => console.error('[wd-detector] sendWdChangedEmail failed:', err));
        }
      }
    }

    // Advance the cache expiry by 24 hours so we do not re-alert until next day
    const newCachedAt = new Date().toISOString();
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db
      .update(wageDeterminations)
      .set({ cachedAt: newCachedAt, cacheExpiresAt: newExpiry })
      .where(eq(wageDeterminations.id, wd.id));
  }

  console.log('[wd-detector] Done');
}
