import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { forbidden, notFound, badRequest } from './http';

export type Project = typeof schema.projects.$inferSelect;
export type Role = 'OWNER' | 'MEMBER' | 'VIEWER';

/**
 * A projektekhez való hozzáférés egy helyen. Három szerepkör van:
 * - OWNER (tulajdonos): mindent csinálhat, a projekt beállításait, a tokent és a tagokat is kezelheti.
 * - MEMBER (meghívott tag): a visszajelzéseket kezelheti (körök, kommentek, válaszok, export), de a projekt
 *   beállításaihoz, a tokenhez és a tagokhoz nem nyúlhat.
 * - VIEWER (megtekintő): mindent láthat, amit a tag, de semmit nem módosíthat (a saját kilépésén kívül).
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

/** A szerepkör a tulajdonos azonosítójából és a tagsági sor szerepköréből (null: nincs tagsági sor). */
export function toRole(ownerId: number, userId: number, memberRole: string | null): Role {
  if (ownerId === userId) return 'OWNER';
  return memberRole === 'VIEWER' ? 'VIEWER' : 'MEMBER';
}

/** A felhasználó szerepköre a projektben, vagy null, ha nem tag és nem tulajdonos. */
export async function roleIn(project: Project, userId: number): Promise<Role | null> {
  if (project.ownerId === userId) return 'OWNER';
  const [row] = await db
    .select({ role: schema.projectMembers.role })
    .from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, project.id), eq(schema.projectMembers.userId, userId)))
    .limit(1);
  return row ? toRole(project.ownerId, userId, row.role) : null;
}

export async function isTeamMember(project: Project, userId: number): Promise<boolean> {
  return (await roleIn(project, userId)) !== null;
}

/** A projekt, ha a felhasználó tag vagy tulajdonos. Nem hozzáférőnek 404. */
export async function requireMember(projectId: number, userId: number): Promise<{ project: Project; role: Role }> {
  const project = await loadProject(projectId);
  const role = await roleIn(project, userId);
  if (!role) throw notFound();
  return { project, role };
}

/** A projekt, ha a felhasználó a tulajdonosa. Tagnak 403, idegennek 404. */
export async function requireOwner(projectId: number, userId: number): Promise<Project> {
  const { project, role } = await requireMember(projectId, userId);
  if (role !== 'OWNER') throw forbidden('Ehhez csak a projekt tulajdonosa jogosult');
  return project;
}

/** Mint a requireMember, de a megtekintő szerepkör nem módosíthat: írásra 403. */
export async function requireWriter(projectId: number, userId: number): Promise<{ project: Project; role: Role }> {
  const ctx = await requireMember(projectId, userId);
  if (ctx.role === 'VIEWER') throw forbidden('Megtekintő szerepkörrel nem módosíthatsz');
  return ctx;
}

export { badRequest };
