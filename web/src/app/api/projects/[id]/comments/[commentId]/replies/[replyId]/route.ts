import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { findProjectComment } from '@/lib/comments';
import { api, noContent, notFound } from '@/lib/http';
import { teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

export const DELETE = api<{ params: Promise<{ id: string; commentId: string; replyId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { project } = await teamContext(req, p.id);
  const { comment } = await findProjectComment(project.id, idParam(p.commentId));
  const result = await db
    .delete(schema.replies)
    .where(and(eq(schema.replies.id, idParam(p.replyId)), eq(schema.replies.commentId, comment.id)));
  if (result[0].affectedRows === 0) throw notFound();
  return noContent();
});
