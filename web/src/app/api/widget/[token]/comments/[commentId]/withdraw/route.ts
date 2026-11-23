import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { quote, recordActivity } from '@/lib/activity';
import { conflict, noContent, parseBody } from '@/lib/http';
import { deleteStored } from '@/lib/storage';
import { ownComment, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

const Body = z.object({ editToken: z.string().min(1).max(64) });

/** A komment visszavonása (törlése) az ügyfél által: ugyanazzal a határidővel és titokkal, és csak válasz nélkül. */
export const POST = widgetRoute('write', async ({ req, project, params }) => {
  const body = await parseBody(req, Body);
  const { comment } = await ownComment(project, idParam(params.commentId!), body.editToken);
  const [reply] = await db.select({ id: schema.replies.id }).from(schema.replies).where(eq(schema.replies.commentId, comment.id)).limit(1);
  if (reply) throw conflict('Válaszolt rá valaki, ezért már nem vonható vissza');

  const files = await db.select({ path: schema.attachments.path }).from(schema.attachments).where(eq(schema.attachments.commentId, comment.id));
  await recordActivity(project.id, 'CUSTOMER', comment.authorName, 'comment.withdrawn', null, `Visszavonta a visszajelzését: ${quote(comment.body)}`);
  await db.delete(schema.comments).where(eq(schema.comments.id, comment.id));
  await deleteStored(comment.screenshotPath);
  await Promise.all(files.map((f) => deleteStored(f.path)));
  return noContent();
});

export const OPTIONS = widgetPreflight;
