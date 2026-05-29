/**
 * Phase 129: Vista by Viewpoint ERP adapter — file-based import from a configured directory.
 * Reads CSV/TXT employee export files; parses with Vista-specific column mapping.
 * SSN is NEVER included in any payload — explicit inclusion list only.
 * Sequential DB writes only (SQLite single-writer constraint).
 */

import type { IErpAdapter, SyncResult } from './IErpAdapter.js';
import { getDb } from '../db/index.js';
import { integrationConnections, workers, projects, projectMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../logger.js';

interface VistaEmployee {
  id: string;
  name: string;
}

function parseVistaEmployeeCSV(content: string): VistaEmployee[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const employees: VistaEmployee[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });

    const id = row['employee'] || row['emp'] || row['id'];
    const name = row['name'] || row['employee name'] || row['fullname'];

    if (id && name) employees.push({ id, name });
  }
  return employees;
}

export class VistaAdapter implements IErpAdapter {
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

    const cfg = conn.filePathConfig
      ? (JSON.parse(conn.filePathConfig) as { importDir?: string })
      : {};
    if (!cfg.importDir) return { recordsSynced: 0, errors: ['Import directory not configured'] };

    let files: string[];
    try {
      files = (await readdir(cfg.importDir)).filter((f) => /\.(csv|txt)$/i.test(f));
    } catch {
      return {
        recordsSynced: 0,
        errors: [`Cannot read import directory: ${cfg.importDir}`],
      };
    }

    let synced = 0;
    const errors: string[] = [];

    const userProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, conn.userId));

    for (const file of files) {
      const filePath = join(cfg.importDir, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const employees = parseVistaEmployeeCSV(content);

        for (const emp of employees) {
          for (const proj of userProjects) {
            try {
              const existing = await db
                .select({ id: workers.id })
                .from(workers)
                .where(
                  and(
                    eq(workers.projectId, proj.id),
                    eq(workers.erpSource, 'vista'),
                    eq(workers.erpExternalId, emp.id)
                  )
                )
                .limit(1);

              const now = new Date().toISOString();
              if (existing.length > 0) {
                await db
                  .update(workers)
                  .set({ name: emp.name, updatedAt: now })
                  .where(eq(workers.id, existing[0].id));
              } else {
                await db.insert(workers).values({
                  id: randomUUID(),
                  projectId: proj.id,
                  name: emp.name,
                  erpExternalId: emp.id,
                  erpSource: 'vista',
                  createdAt: now,
                  updatedAt: now,
                });
              }
              synced++;
            } catch (err) {
              errors.push(
                `Employee ${emp.name}: ${err instanceof Error ? err.message : String(err)}`
              );
            }
          }
        }
      } catch (err) {
        errors.push(`File ${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logger.info({ connectionId, synced, errors: errors.length }, '[vista] pullWorkers complete');
    return { recordsSynced: synced, errors };
  }

  async pullTimesheets(connectionId: string, since: Date): Promise<SyncResult> {
    logger.info({ connectionId, since: since.toISOString() }, '[vista] timesheet pull (Phase 133 scaffold)');
    return { recordsSynced: 0, errors: [] };
  }

  async pushComplianceStatus(connectionId: string, weekId: string): Promise<SyncResult> {
    logger.info(
      { connectionId, weekId },
      '[vista] compliance push — checking pending actions (Phase 133 scaffold)'
    );
    return { recordsSynced: 0, errors: [] };
  }
}
