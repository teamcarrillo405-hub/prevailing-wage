import { and, eq, isNull } from 'drizzle-orm';
import { projects, projectMembers } from '../db/schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema.js';

type DrizzleDb = BetterSQLite3Database<typeof schema>;
export type Project = typeof projects.$inferSelect;
export type ProjectRole = 'owner' | 'member' | 'auditor';

export async function assertProjectAccess(
  db: DrizzleDb,
  projectId: string,
  userId: string,
): Promise<{ project: Project; role: ProjectRole }> {
  const [row] = await db
    .select({ project: projects, role: projectMembers.role })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);

  if (row) return { project: row.project, role: row.role as ProjectRole };

  const [exists] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!exists) throw { status: 404, message: 'Project not found' };
  throw { status: 403, message: 'Access denied' };
}
