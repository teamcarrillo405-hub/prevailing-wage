import { logger } from '../logger.js';
// src/server/services/wdChangeDetector.ts
// WD change detector — scans for expired wageDeterminations cache entries and
// notifies all active project members whose projects reference those WDs.
// Called on a daily cron from index.ts (NOTIF-07).

import { getDb } from '../db/index.js';
import { wageDeterminations, projects, projectMembers, users, wdRevisionLog } from '../db/schema.js';
import { lt, eq, and, isNull, gt } from 'drizzle-orm';
import { sendWdChangedEmail } from './emailService.js';

export async function checkWdChanges(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  // Single JOIN query: expired WDs → active projects → non-removed members
  const rows = await db
    .select({
      wdId: wageDeterminations.id,
      wdNumber: wageDeterminations.wdNumber,
      revisionNumber: wageDeterminations.revisionNumber,
      memberEmail: users.email,
    })
    .from(wageDeterminations)
    .innerJoin(
      projects,
      and(
        eq(projects.wdIdentifier, wageDeterminations.wdNumber),
        eq(projects.status, 'active'),
      ),
    )
    .innerJoin(
      projectMembers,
      and(
        eq(projectMembers.projectId, projects.id),
        isNull(projectMembers.removedAt),
      ),
    )
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(lt(wageDeterminations.cacheExpiresAt, now));

  if (rows.length === 0) {
    logger.info('[wd-detector] No expired WD cache entries found (or none with active project members)');
    return;
  }

  // Group by WD id — collect distinct member emails per WD
  const wdMap = new Map<string, { wdNumber: string; revisionNumber: number; emails: string[] }>();
  for (const row of rows) {
    const existing = wdMap.get(row.wdId);
    if (existing) {
      if (row.memberEmail && !existing.emails.includes(row.memberEmail)) {
        existing.emails.push(row.memberEmail);
      }
    } else {
      wdMap.set(row.wdId, {
        wdNumber: row.wdNumber,
        revisionNumber: row.revisionNumber,
        emails: row.memberEmail ? [row.memberEmail] : [],
      });
    }
  }

  logger.info(`[wd-detector] Found ${wdMap.size} expired WD cache entries; sending notifications`);

  // Send emails — failure is non-fatal
  for (const [, wd] of wdMap) {
    for (const email of wd.emails) {
      await sendWdChangedEmail({
        toEmail: email,
        projectName: wd.wdNumber, // one WD may span multiple projects; use WD number as label
        wdNumber: wd.wdNumber,
        oldRevision: wd.revisionNumber,
        newRevision: wd.revisionNumber, // alerting on cache expiry, not a revision bump
      }).catch((err) => logger.error({ err: err }, '[wd-detector] sendWdChangedEmail failed:'));
    }
  }

  // COMP-07: surface revision bumps detected by the weekly sync
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentRevisions = await db
    .select({
      wdId: wdRevisionLog.wdId,
      oldRevision: wdRevisionLog.oldRevision,
      newRevision: wdRevisionLog.newRevision,
      changeSummary: wdRevisionLog.changeSummary,
      wdNumber: wageDeterminations.wdNumber,
    })
    .from(wdRevisionLog)
    .innerJoin(wageDeterminations, eq(wdRevisionLog.wdId, wageDeterminations.id))
    .where(gt(wdRevisionLog.detectedAt, oneDayAgo))
    .all();

  if (recentRevisions.length > 0) {
    logger.info(`[wd-detector] Found ${recentRevisions.length} revision log entries in last 24h`);

    for (const rev of recentRevisions) {
      // Find emails for projects linked to this WD
      const projectRows = await db
        .select({ memberEmail: users.email })
        .from(wageDeterminations)
        .innerJoin(projects, eq(projects.wdIdentifier, wageDeterminations.wdNumber))
        .innerJoin(projectMembers, and(
          eq(projectMembers.projectId, projects.id),
          isNull(projectMembers.removedAt),
        ))
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(wageDeterminations.id, rev.wdId))
        .all();

      const emailSet = new Set<string>();
      for (const row of projectRows) {
        if (row.memberEmail) emailSet.add(row.memberEmail);
      }
      for (const email of emailSet) {
        await sendWdChangedEmail({
          toEmail: email,
          projectName: rev.wdNumber,
          wdNumber: rev.wdNumber,
          oldRevision: rev.oldRevision,
          newRevision: rev.newRevision,
        }).catch((err) => logger.error({ err }, '[wd-detector] revision bump email failed'));
      }
    }
  }

  // Advance cache expiry by 24 h for all expired WDs in a single pass
  const newCachedAt = new Date().toISOString();
  const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const allExpiredIds = [...wdMap.keys()];
  for (const wdId of allExpiredIds) {
    await db
      .update(wageDeterminations)
      .set({ cachedAt: newCachedAt, cacheExpiresAt: newExpiry })
      .where(eq(wageDeterminations.id, wdId));
  }

  logger.info('[wd-detector] Done');
}
