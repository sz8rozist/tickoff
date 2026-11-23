import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Project, Role } from './access';

export interface MemberDto {
  userId: number;
  name: string;
  email: string;
  role: Role;
}

/** A tulajdonos és a tagok listája; a tulajdonos az első, a tagok a csatlakozás sorrendjében. */
export async function listMembers(project: Project): Promise<MemberDto[]> {
  const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, project.ownerId)).limit(1);
  const members = await db
    .select({ userId: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.projectMembers.role })
    .from(schema.projectMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.projectMembers.userId))
    .where(eq(schema.projectMembers.projectId, project.id))
    .orderBy(asc(schema.projectMembers.id));
  const result: MemberDto[] = [];
  if (owner) result.push({ userId: owner.id, name: owner.name, email: owner.email, role: 'OWNER' });
  for (const m of members) result.push({ ...m, role: m.role === 'VIEWER' ? 'VIEWER' : 'MEMBER' });
  return result;
}
