import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { repliesByComment } from '@/lib/comments';
import { api } from '@/lib/http';
import { renderReport } from '@/lib/report';
import { findRound, teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

/**
 * Nyomtatható kör-riport (HTML, a böngészőből PDF-be menthető). Alapból ügyfélnek is átadható; `internal=true` mellett a
 * csapat belső változata készül (prioritás, címkék, felelős, selector is).
 */
export const GET = api<{ params: Promise<{ id: string; roundId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { project } = await teamContext(req, p.id);
  const round = await findRound(project.id, idParam(p.roundId));
  const internal = new URL(req.url).searchParams.get('internal') === 'true';

  const rows = await db
    .select({ comment: schema.comments, assignee: schema.users.name })
    .from(schema.comments)
    .leftJoin(schema.users, eq(schema.users.id, schema.comments.assigneeId))
    .where(eq(schema.comments.roundId, round.id))
    .orderBy(asc(schema.comments.createdAt), asc(schema.comments.id));
  const replies = await repliesByComment(rows.map((r) => r.comment.id), internal);
  const html = renderReport(
    project,
    round,
    rows.map((r) => ({ comment: r.comment, assigneeName: r.assignee, replies: replies.get(r.comment.id) ?? [] })),
    internal,
  );
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
});
