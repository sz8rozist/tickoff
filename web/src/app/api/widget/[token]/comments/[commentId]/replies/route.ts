import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { quote, recordActivity } from '@/lib/activity';
import { replyDto, requireReplyRoom } from '@/lib/comments';
import { json, parseBody } from '@/lib/http';
import { customerReplyMail } from '@/lib/team-notifications';
import { publishWebhook, WebhookEvents } from '@/lib/webhooks';
import { openRoundComment, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

const Body = z.object({ authorName: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(4000) });

/** Válasz egy kommentre az ügyfél nevében. Csak a nyitott kör kommentjeire lehet válaszolni (409 különben). */
export const POST = widgetRoute('write', async ({ req, project, params }) => {
  const { comment } = await openRoundComment(project, idParam(params.commentId!));
  const body = await parseBody(req, Body);
  await requireReplyRoom(comment.id);

  const [result] = await db.insert(schema.replies).values({
    commentId: comment.id,
    authorName: body.authorName,
    authorType: 'CUSTOMER',
    body: body.body,
  });
  const [saved] = await db.select().from(schema.replies).where(eq(schema.replies.id, result.insertId)).limit(1);
  void customerReplyMail(project, comment, saved.authorName, saved.body);
  await recordActivity(project.id, 'CUSTOMER', saved.authorName, 'reply.customer', comment.id, `Válaszolt erre: ${quote(comment.body)}`);
  void publishWebhook(project, WebhookEvents.replyCreated,
    `[${project.name}] ${saved.authorName} válaszolt (${comment.pageUrl}):\n${saved.body.slice(0, 500)}`, comment, null);
  return json(replyDto(saved), 201);
});

export const OPTIONS = widgetPreflight;
