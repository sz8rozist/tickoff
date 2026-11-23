import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { quote, recordActivity } from '@/lib/activity';
import { repliesByComment } from '@/lib/comments';
import { conflict, json, parseBody } from '@/lib/http';
import { ownComment, widgetCommentDto, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

const Body = z.object({ body: z.string().trim().min(1).max(4000), editToken: z.string().min(1).max(64) });

/**
 * A komment szövegének módosítása az ügyfél által: a létrehozás utáni 10 percben, a komment szerkesztési titkával, amíg a
 * komment nyitott. A dashboardon "szerkesztve" jelzés látszik.
 */
export const POST = widgetRoute('write', async ({ req, project, params }) => {
  const body = await parseBody(req, Body);
  const { comment } = await ownComment(project, idParam(params.commentId!), body.editToken);
  if (comment.status !== 'OPEN') throw conflict('A feldolgozás alatt álló komment már nem szerkeszthető');

  const editedAt = new Date();
  await db.update(schema.comments).set({ body: body.body, editedAt }).where(eq(schema.comments.id, comment.id));
  const updated = { ...comment, body: body.body, editedAt };
  await recordActivity(project.id, 'CUSTOMER', comment.authorName, 'comment.edited', comment.id, `Módosította a visszajelzését: ${quote(body.body)}`);
  const replies = await repliesByComment([comment.id]);
  return json(widgetCommentDto(updated, replies.get(comment.id) ?? []));
});

export const OPTIONS = widgetPreflight;
