import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { repliesByComment } from '@/lib/comments';
import { json } from '@/lib/http';
import { MAX_HISTORY_ROUNDS, widgetCommentDto, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

/** A lezárt körök (legfeljebb a legutóbbi 10, legújabb elöl) kommentjei szálastul, csak olvasásra. */
export const GET = widgetRoute('read', async ({ project }) => {
  const rounds = await db.select().from(schema.rounds).where(eq(schema.rounds.projectId, project.id)).orderBy(asc(schema.rounds.number));
  const closed = rounds.filter((r) => r.status === 'CLOSED');
  const recent = closed.slice(Math.max(0, closed.length - MAX_HISTORY_ROUNDS)).reverse();

  const result = [];
  for (const r of recent) {
    const list = await db.select().from(schema.comments).where(eq(schema.comments.roundId, r.id)).orderBy(asc(schema.comments.createdAt), asc(schema.comments.id));
    const replies = await repliesByComment(list.map((c) => c.id));
    result.push({
      number: r.number,
      closedAt: r.closedAt,
      approved: r.approvedAt !== null,
      approvedBy: r.approvedBy,
      comments: list.map((c) => widgetCommentDto(c, replies.get(c.id) ?? [])),
    });
  }
  return json(result);
});

export const OPTIONS = widgetPreflight;
