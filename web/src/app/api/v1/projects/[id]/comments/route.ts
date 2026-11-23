import { and, asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam, requireMember } from '@/lib/access';
import { requireApiUser } from '@/lib/api-keys';
import { parseLabels } from '@/lib/comments';
import { api, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/**
 * A projekt kommentjei, kör és idő szerint rendezve, a belső részletek nélkül (nincs ügyfél-e-mail, token, webhook-cím).
 * Szűrhető `status` (OPEN, IN_PROGRESS, DONE) és `round` (a kör száma) szerint; `limit` (alapból 200, legfeljebb 500) és `offset`
 * lapoz. Nem hozzáférő projektre 404.
 */
export const GET = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { project } = await requireMember(idParam((await params).id), userId);
  const q = new URL(req.url).searchParams;

  const status = q.get('status');
  const round = q.get('round');
  const limit = Math.min(Math.max(Number(q.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number(q.get('offset') ?? 0) || 0, 0);

  const filters = [eq(schema.rounds.projectId, project.id)];
  if (status && ['OPEN', 'IN_PROGRESS', 'DONE'].includes(status)) filters.push(eq(schema.comments.status, status));
  if (round && Number.isInteger(Number(round))) filters.push(eq(schema.rounds.number, Number(round)));

  const rows = await db
    .select({
      comment: schema.comments,
      round: schema.rounds.number,
      assignee: schema.users.name,
      replyCount: sql<number>`(select count(*) from ${schema.replies} where ${schema.replies.commentId} = ${schema.comments.id})`,
    })
    .from(schema.comments)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.comments.roundId))
    .leftJoin(schema.users, eq(schema.users.id, schema.comments.assigneeId))
    .where(and(...filters))
    .orderBy(asc(schema.rounds.number), asc(schema.comments.createdAt), asc(schema.comments.id))
    .limit(limit)
    .offset(offset);

  return json(
    rows.map(({ comment: c, round: n, assignee, replyCount }) => ({
      id: c.id,
      projectId: project.id,
      round: n,
      pageUrl: c.pageUrl,
      cssSelector: c.cssSelector,
      author: c.authorName,
      body: c.body,
      status: c.status,
      priority: c.priority,
      labels: parseLabels(c.labels),
      assignee: assignee ?? null,
      approvedByCustomer: c.customerApprovedAt !== null,
      replyCount: Number(replyCount),
      createdAt: c.createdAt,
    })),
  );
});
