import { and, count, desc, eq, inArray, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Project, Role } from './access';

export interface ProjectStats {
  roundNumber: number | null;
  open: number;
  inProgress: number;
  done: number;
  approved: boolean;
}

const NO_STATS: ProjectStats = { roundNumber: null, open: 0, inProgress: 0, done: 0, approved: false };

/** A projektek nyitott körének összesítője (ahol nincs nyitott kör, nincs bejegyzés). Két lekérdezés, nem projektenként. */
export async function statsFor(projectIds: number[]): Promise<Map<number, ProjectStats>> {
  const result = new Map<number, ProjectStats>();
  if (projectIds.length === 0) return result;

  const openRounds = await db
    .select()
    .from(schema.rounds)
    .where(and(inArray(schema.rounds.projectId, projectIds), eq(schema.rounds.status, 'OPEN')));
  const counts = await db
    .select({ projectId: schema.rounds.projectId, status: schema.comments.status, total: count() })
    .from(schema.comments)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.comments.roundId))
    .where(and(inArray(schema.rounds.projectId, projectIds), eq(schema.rounds.status, 'OPEN')))
    .groupBy(schema.rounds.projectId, schema.comments.status);

  for (const round of openRounds) {
    const byStatus = (status: string) => counts.find((c) => c.projectId === round.projectId && c.status === status)?.total ?? 0;
    result.set(round.projectId, {
      roundNumber: round.number,
      open: byStatus('OPEN'),
      inProgress: byStatus('IN_PROGRESS'),
      done: byStatus('DONE'),
      approved: round.approvedAt !== null,
    });
  }
  return result;
}

/** A projekt API-ábrázolása. A webhook adatai (cím, titok) csak a tulajdonosnak látszanak: a cím gyakran titkot tartalmaz. */
export function projectDto(p: Project, role: Role, ownerName: string, stats?: ProjectStats) {
  const owner = role === 'OWNER';
  return {
    id: p.id,
    name: p.name,
    siteUrl: p.siteUrl,
    shareToken: p.shareToken,
    createdAt: p.createdAt,
    role,
    ownerName,
    webhookUrl: owner ? p.webhookUrl : null,
    webhookSecret: owner ? p.webhookSecret : null,
    stats: stats ?? NO_STATS,
    widgetColor: p.widgetColor,
    widgetPosition: p.widgetPosition,
    archivedAt: p.archivedAt,
    widgetLang: p.widgetLang,
  };
}

/** Egyetlen projekt DTO-ja a tulajdonos nevével és az összesítővel. */
export async function loadProjectDto(project: Project, userId: number) {
  const [owner] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, project.ownerId)).limit(1);
  const stats = (await statsFor([project.id])).get(project.id);
  return projectDto(project, project.ownerId === userId ? 'OWNER' : 'MEMBER', owner?.name ?? '', stats);
}

/** A felhasználó saját és a hozzá meghívott projektjei, újabb elöl. */
export async function accessibleProjects(userId: number) {
  const memberOf = db.select({ id: schema.projectMembers.projectId }).from(schema.projectMembers).where(eq(schema.projectMembers.userId, userId));
  return db
    .select({ project: schema.projects, ownerName: schema.users.name })
    .from(schema.projects)
    .innerJoin(schema.users, eq(schema.users.id, schema.projects.ownerId))
    .where(or(eq(schema.projects.ownerId, userId), inArray(schema.projects.id, memberOf)))
    .orderBy(desc(schema.projects.createdAt), desc(schema.projects.id));
}
