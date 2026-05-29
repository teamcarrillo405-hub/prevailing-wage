/**
 * Phase 127: Procore ERP adapter — implements IErpAdapter for Procore API.
 * Uses OAuth tokens from procoreService.getValidProcoreToken().
 * SSN is NEVER included in any payload — explicit inclusion list only.
 * Sequential DB writes only (SQLite single-writer constraint).
 */

import type { IErpAdapter, SyncResult } from './IErpAdapter.js';
import { getValidProcoreToken } from '../services/procoreService.js';
import { getDb } from '../db/index.js';
import { workers, integrationConnections, projects, projectMembers } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { logger } from '../logger.js';

interface ProcoreUser {
  id: number;
  name: string;
  employee_id?: string;
  title?: string;
}

export class ProcoreAdapter implements IErpAdapter {
  async pullWorkers(connectionId: string): Promise<SyncResult> {
    const db = getDb();

    const conn = (
      await db
        .select()
        .from(integrationConnections)
        .where(eq(integrationConnections.id, connectionId))
        .limit(1)
    )[0];
    if (!conn) return { recordsSynced: 0, errors: ['Connection not found'] };

    const tokens = await getValidProcoreToken(conn.userId);
    if (!tokens) return { recordsSynced: 0, errors: ['Procore not connected or token expired'] };

    const url = `https://api.procore.com/rest/v1.0/companies/${tokens.companyId}/users?filters[is_employee]=true&per_page=200`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      return {
        recordsSynced: 0,
        errors: [`Network error: ${err instanceof Error ? err.message : String(err)}`],
      };
    }

    if (!response.ok) {
      return { recordsSynced: 0, errors: [`Procore API error: HTTP ${response.status}`] };
    }

    const users_ = (await response.json()) as ProcoreUser[];
    let synced = 0;
    const errors: string[] = [];

    const userProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, conn.userId));

    for (const user of users_) {
      for (const proj of userProjects) {
        try {
          const extId = String(user.id);
          const existing = await db
            .select({ id: workers.id })
            .from(workers)
            .where(
              and(
                eq(workers.projectId, proj.id),
                eq(workers.erpSource, 'procore'),
                eq(workers.erpExternalId, extId)
              )
            )
            .limit(1);

          const now = new Date().toISOString();
          if (existing.length > 0) {
            await db
              .update(workers)
              .set({ name: user.name, updatedAt: now })
              .where(eq(workers.id, existing[0].id));
          } else {
            await db.insert(workers).values({
              id: randomUUID(),
              projectId: proj.id,
              name: user.name,
              erpExternalId: extId,
              erpSource: 'procore',
              createdAt: now,
              updatedAt: now,
            });
          }
          synced++;
        } catch (err) {
          errors.push(
            `Worker ${user.name}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    logger.info(
      { connectionId, synced, errors: errors.length },
      '[procore] pullWorkers complete'
    );
    return { recordsSynced: synced, errors };
  }

  async pullTimesheets(connectionId: string, since: Date): Promise<SyncResult> {
    const db = getDb();
    const conn = (
      await db
        .select()
        .from(integrationConnections)
        .where(eq(integrationConnections.id, connectionId))
        .limit(1)
    )[0];
    if (!conn) return { recordsSynced: 0, errors: ['Connection not found'] };

    const tokens = await getValidProcoreToken(conn.userId);
    if (!tokens) return { recordsSynced: 0, errors: ['Procore not connected'] };

    const sinceISO = since.toISOString().split('T')[0];
    const url = `https://api.procore.com/rest/v1.0/companies/${tokens.companyId}/time_entries?filters[created_at]=${sinceISO}&per_page=200`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
    } catch (err) {
      return {
        recordsSynced: 0,
        errors: [`Network error: ${err instanceof Error ? err.message : String(err)}`],
      };
    }

    // Handle rate limiting
    if (response.status === 429) {
      const resetHeader = response.headers.get('X-Rate-Limit-Reset');
      const waitSec = resetHeader
        ? Math.max(0, parseInt(resetHeader, 10) - Math.floor(Date.now() / 1000))
        : 60;
      logger.warn({ waitSec }, '[procore] rate limited — backing off');
      await new Promise<void>((r) => setTimeout(r, Math.min(waitSec * 1000, 60_000)));
      return { recordsSynced: 0, errors: [`Rate limited — retry after ${waitSec}s`] };
    }

    if (!response.ok) {
      return { recordsSynced: 0, errors: [`Procore API error: HTTP ${response.status}`] };
    }

    // Timesheet sync is a scaffold for Phase 128 — return empty for now
    return { recordsSynced: 0, errors: [] };
  }

  async pushComplianceStatus(connectionId: string, weekId: string): Promise<SyncResult> {
    // Phase 129 scaffold — compliance push to Procore custom fields
    logger.info({ connectionId, weekId }, '[procore] compliance push not yet implemented');
    return { recordsSynced: 0, errors: [] };
  }
}
