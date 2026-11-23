import { count, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { badRequest, conflict, json } from '@/lib/http';
import { detectImage } from '@/lib/images';
import { saveAttachment } from '@/lib/storage';
import { MAX_ATTACHMENTS_PER_COMMENT, MAX_IMAGE_BYTES, openRoundComment, readLimited, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

/**
 * Melléklet a nyitott kör kommentjéhez: nyers kép (PNG, JPEG, GIF vagy WebP) a kérés törzsében, legfeljebb 3 MB, kommentenként
 * legfeljebb 5. A típust a tartalom dönti el, nem a fejléc. 409, ha már van 5 melléklet; 413 túl nagy kép; 400 nem kép.
 */
export const POST = widgetRoute('write', async ({ req, project, params }) => {
  const { comment } = await openRoundComment(project, idParam(params.commentId!));
  const [{ total }] = await db.select({ total: count() }).from(schema.attachments).where(eq(schema.attachments.commentId, comment.id));
  if (total >= MAX_ATTACHMENTS_PER_COMMENT) throw conflict('Ehhez a kommenthez már nem csatolható több kép');

  const data = await readLimited(req, MAX_IMAGE_BYTES);
  const image = detectImage(data);
  if (!image) throw badRequest('Csak PNG, JPEG, GIF vagy WebP kép csatolható');

  const path = await saveAttachment(project.id, comment.id, image.extension, data);
  const [result] = await db.insert(schema.attachments).values({ commentId: comment.id, path, contentType: image.contentType, sizeBytes: data.length });
  return json({ id: result.insertId, contentType: image.contentType, size: data.length }, 201);
});

export const OPTIONS = widgetPreflight;
