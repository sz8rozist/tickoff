import { and, eq, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { idParam, requireMember, requireOwner } from './access';
import { forbidden } from './http';
import { requireUser } from './auth/session';
import { notFound } from './http';
import type { Round } from './comments';

/** A kérést küldő felhasználó és a projekt, ha a felhasználó a csapat tagja (tulajdonos vagy tag). */
export async function teamContext(req: NextRequest, projectIdParam: string) {
  const user = await requireUser(req);
  const { project, role } = await requireMember(idParam(projectIdParam), user.id);
  // A megtekintő csak olvashat: minden módosító kérés (nem GET/HEAD) 403
  if (role === 'VIEWER' && req.method !== 'GET' && req.method !== 'HEAD') throw forbidden('Megtekintő szerepkörrel nem módosíthatsz');
  return { user, project, role };
}

/** Mint a {@link teamContext}, de csak a tulajdonosnak. */
export async function ownerContext(req: NextRequest, projectIdParam: string) {
  const user = await requireUser(req);
  const project = await requireOwner(idParam(projectIdParam), user.id);
  return { user, project };
}

/** A kör, ha a projekthez tartozik; különben 404. */
export async function findRound(projectId: number, roundId: number): Promise<Round> {
  const [round] = await db.select().from(schema.rounds).where(and(eq(schema.rounds.id, roundId), eq(schema.rounds.projectId, projectId))).limit(1);
  if (!round) throw notFound();
  return round;
}

export interface RoundCounts {
  total: number;
  open: number;
}

/** A projekt köreinek kommentszámai: összes és nyitott (csak a "nyitott" státuszúak). */
export async function roundCounts(projectId: number): Promise<Map<number, RoundCounts>> {
  const rows = await db
    .select({
      roundId: schema.comments.roundId,
      total: sql<number>`count(*)`,
      open: sql<number>`coalesce(sum(case when ${schema.comments.status} = 'OPEN' then 1 else 0 end), 0)`,
    })
    .from(schema.comments)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.comments.roundId))
    .where(eq(schema.rounds.projectId, projectId))
    .groupBy(schema.comments.roundId);
  return new Map(rows.map((r) => [r.roundId, { total: Number(r.total), open: Number(r.open) }]));
}

export function roundDto(r: Round, counts?: RoundCounts) {
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    createdAt: r.createdAt,
    closedAt: r.closedAt,
    commentCount: counts?.total ?? 0,
    openCommentCount: counts?.open ?? 0,
    approvedAt: r.approvedAt,
    approvedBy: r.approvedBy,
    dueDate: r.dueDate,
  };
}
