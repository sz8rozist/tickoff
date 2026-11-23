import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { forbidden, notFound, badRequest } from './http';

export type Project = typeof schema.projects.$inferSelect;
export type Role = 'OWNER' | 'MEMBER';

/**
 * A projektekhez való hozzáférés egy helyen. Két szerepkör van:
 * - OWNER (tulajdonos): mindent csinálhat, a projekt beállításait, a tokent és a tagokat is kezelheti.
 * - MEMBER (meghívott tag): a visszajelzéseket kezelheti (körök, kommentek, válaszok, export), de a projekt
 *   beállításaihoz, a tokenhez és a tagokhoz nem nyúlhat.
 * Aki nem tulajdonos és nem tag, annak a projekt nem létezik (404), hogy ne derüljön ki a létezése.
 */

/** Az útvonalból érkező azonosító egész számként; érvénytelen értékre 404 (a projekt úgysem létezhet). */
export function idParam(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw notFound();
  return n;
}

export async function loadProject(projectId: number): Promise<Project> {
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  if (!project) throw notFound();
  return project;
}

export async function isTeamMember(project: Project, userId: number): Promise<boolean> {
  if (project.ownerId === userId) return true;
  const [row] = await db
    .select({ id: schema.projectMembers.id })
    .from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, project.id), eq(schema.projectMembers.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export function roleOf(project: Project, userId: number): Role {
  return project.ownerId === userId ? 'OWNER' : 'MEMBER';
}

/** A projekt, ha a felhasználó tag vagy tulajdonos. Nem hozzáférőnek 404. */
export async function requireMember(projectId: number, userId: number): Promise<{ project: Project; role: Role }> {
  const project = await loadProject(projectId);
  if (!(await isTeamMember(project, userId))) throw notFound();
  return { project, role: roleOf(project, userId) };
}

/** A projekt, ha a felhasználó a tulajdonosa. Tagnak 403, idegennek 404. */
export async function requireOwner(projectId: number, userId: number): Promise<Project> {
  const { project, role } = await requireMember(projectId, userId);
  if (role !== 'OWNER') throw forbidden('Ehhez csak a projekt tulajdonosa jogosult');
  return project;
}

export { badRequest };
