import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { quote, recordActivity } from '@/lib/activity';
import { changeStatus, repliesByComment, requireReplyRoom } from '@/lib/comments';
import { conflict, json, parseBody } from '@/lib/http';
import { reopenedMail } from '@/lib/team-notifications';
import { publishWebhook, WebhookEvents } from '@/lib/webhooks';
import { openRoundComment, widgetCommentDto, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

const Body = z.object({ authorName: z.string().trim().min(1).max(120), reason: z.string().max(4000).nullish() });

/** Az ügyfél visszanyitja a "Kész" kommentet (pl. mert a javítás nem jó): a szálba bejegyzés kerül, a csapat értesítést kap. */
export const POST = widgetRoute('write', async ({ req, project, params }) => {
  const { comment, round } = await openRoundComment(project, idParam(params.commentId!));
  const body = await parseBody(req, Body);
  if (comment.status !== 'DONE') throw conflict('Csak kész visszajelzést lehet visszanyitni');
  await requireReplyRoom(comment.id);

  const reason = body.reason && body.reason.trim() !== '' ? body.reason.trim() : null;
  await changeStatus(comment, round, 'OPEN');
  await db.insert(schema.replies).values({
    commentId: comment.id,
    authorName: body.authorName,
    authorType: 'CUSTOMER',
    body: reason ? `Visszanyitva: ${reason}` : 'Visszanyitva.',
  });
  const [updated] = await db.select().from(schema.comments).where(eq(schema.comments.id, comment.id)).limit(1);
  void reopenedMail(project, updated, body.authorName, reason);
  await recordActivity(project.id, 'CUSTOMER', body.authorName, 'comment.reopened', comment.id, `Visszanyitotta a kész visszajelzést: ${quote(comment.body)}`);
  void publishWebhook(project, WebhookEvents.commentReopened,
    `[${project.name}] ${body.authorName} újranyitotta a kész visszajelzést (${comment.pageUrl}):\n${comment.body.slice(0, 500)}${reason ? `\nIndoklás: ${reason.slice(0, 300)}` : ''}`,
    updated, null);
  const replies = await repliesByComment([comment.id]);
  return json(widgetCommentDto(updated, replies.get(comment.id) ?? []));
});

export const OPTIONS = widgetPreflight;
