import { and, eq } from 'drizzle-orm';
import { projects, projectMembers } from '../db/schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema.js';

type DrizzleDb = BetterSQLite3Database<typeof schema>;
export type Project = typeof projects.$inferSelect;

export async function assertProjectAccess(
  db: DrizzleDb,
  projectId: string,
  userId: string,
): Promise<Project> {
  // Step 1: membership check — fast path if member found
  const [row] = await db
    .select({ project: projects })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);

  if (row) return row.project;

  // Step 2: distinguish 404 from 403
  const [exists] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!exists) throw { status: 404, message: 'Project not found' };
  throw { status: 403, message: 'Access denied' };
}
