import { and, desc, eq, lt } from 'drizzle-orm';
import { db, schema } from '@/db';

/**
 * A tevékenységnapló írása. A napló nem a kritikus út része: a régi (180 napnál idősebb) bejegyzéseket időnként, a
 * rögzítés mellékhatásaként töröljük, külön ütemező nélkül.
 */

const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const EXCERPT = 80;

export type ActorType = 'USER' | 'CUSTOMER';

export async function recordActivity(
  projectId: number,
  actorType: ActorType,
  actorName: string,
  event: string,
  commentId: number | null,
  summary: string,
): Promise<void> {
  await db.insert(schema.activity).values({
    projectId,
    actorType,
    actorName: actorName.slice(0, 120),
    event,
    commentId,
    summary: summary.length > 500 ? summary.slice(0, 499) + '…' : summary,
  });
  // Ritkán takarítunk (kb. minden 50. bejegyzésnél), hogy a napló mérete korlátos maradjon
  if (Math.random() < 1 / 50) {
    await db.delete(schema.activity).where(and(eq(schema.activity.projectId, projectId), lt(schema.activity.createdAt, new Date(Date.now() - RETENTION_MS))));
  }
}

/** A komment rövid, egysoros idézete a naplóhoz. */
export function quote(body: string): string {
  const text = body.replace(/\s+/g, ' ').trim();
  return '„' + (text.length <= EXCERPT ? text : text.slice(0, EXCERPT).trim() + '…') + '”';
}

/** A projekt naplója, újabb elöl; a `before` az utolsó kapott bejegyzés azonosítója (lapozáshoz). */
export async function listActivity(projectId: number, before: number | null, limit = 50) {
  const where = before === null ? eq(schema.activity.projectId, projectId) : and(eq(schema.activity.projectId, projectId), lt(schema.activity.id, before));
  const rows = await db.select().from(schema.activity).where(where).orderBy(desc(schema.activity.id)).limit(limit);
  return rows.map((e) => ({
    id: e.id,
    actorType: e.actorType,
    actorName: e.actorName,
    event: e.event,
    commentId: e.commentId,
    summary: e.summary,
    createdAt: e.createdAt,
  }));
}
