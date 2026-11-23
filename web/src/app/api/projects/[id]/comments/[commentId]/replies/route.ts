import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { quote, recordActivity } from '@/lib/activity';
import { findProjectComment, replyDto, requireReplyRoom } from '@/lib/comments';
import { api, json, parseBody } from '@/lib/http';
import { designerReply } from '@/lib/notifications';
import { teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

const Body = z.object({ body: z.string().trim().min(1).max(4000) });

/** Válasz a kommentre a csapat nevében (lezárt kör kommentjére is). Egy kommenthez legfeljebb 200 válasz fűzhető. */
export const POST = api<{ params: Promise<{ id: string; commentId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { user, project } = await teamContext(req, p.id);
  const { comment } = await findProjectComment(project.id, idParam(p.commentId));
  const body = await parseBody(req, Body);
  await requireReplyRoom(comment.id);

  const [result] = await db.insert(schema.replies).values({
    commentId: comment.id,
    authorName: user.name,
    authorType: 'DESIGNER',
    userId: user.id,
    body: body.body,
  });
  const [saved] = await db.select().from(schema.replies).where(eq(schema.replies.id, result.insertId)).limit(1);
  designerReply(project, comment, user.name, body.body);
  await recordActivity(project.id, 'USER', user.name, 'reply.team', comment.id, `Válaszolt erre: ${quote(comment.body)}`);
  return json(replyDto(saved), 201);
});
