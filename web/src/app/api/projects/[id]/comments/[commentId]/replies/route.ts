import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { quote, recordActivity } from '@/lib/activity';
import { findProjectComment, replyDto, requireReplyRoom } from '@/lib/comments';
import { api, json, parseBody } from '@/lib/http';
import { listMembers } from '@/lib/members';
import { designerReply, mentioned } from '@/lib/notifications';
import { teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

const Body = z.object({ body: z.string().trim().min(1).max(4000), internal: z.boolean().optional() });

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
    internal: body.internal ?? false,
  });
  const [saved] = await db.select().from(schema.replies).where(eq(schema.replies.id, result.insertId)).limit(1);
  const internal = body.internal ?? false;
  // Belső megjegyzésről az ügyfél semmilyen értesítést nem kap
  if (!internal) designerReply(project, comment, user.name, body.body);
  mentioned(project, comment, await listMembers(project), user, body.body, internal);
  await recordActivity(project.id, 'USER', user.name, internal ? 'reply.note' : 'reply.team', comment.id, `${internal ? 'Belső megjegyzés ehhez' : 'Válaszolt erre'}: ${quote(comment.body)}`);
  return json(replyDto(saved), 201);
});
