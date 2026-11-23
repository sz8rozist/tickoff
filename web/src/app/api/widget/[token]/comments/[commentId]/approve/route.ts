import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { quote, recordActivity } from '@/lib/activity';
import { repliesByComment } from '@/lib/comments';
import { conflict, json } from '@/lib/http';
import { openRoundComment, widgetCommentDto, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

/** Az ügyfél elfogadja a "Kész" kommentet. 409, ha a komment nem kész, vagy lezárt körhöz tartozik. */
export const POST = widgetRoute('write', async ({ project, params }) => {
  const { comment } = await openRoundComment(project, idParam(params.commentId!));
  if (comment.status !== 'DONE') throw conflict('Csak kész visszajelzést lehet elfogadni');
  const customerApprovedAt = new Date();
  await db.update(schema.comments).set({ customerApprovedAt }).where(eq(schema.comments.id, comment.id));
  await recordActivity(project.id, 'CUSTOMER', comment.authorName, 'comment.approved', comment.id, `Az ügyfél elfogadta a javítást: ${quote(comment.body)}`);
  const replies = await repliesByComment([comment.id]);
  return json(widgetCommentDto({ ...comment, customerApprovedAt }, replies.get(comment.id) ?? []));
});

export const OPTIONS = widgetPreflight;
