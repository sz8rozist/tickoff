import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { HttpError, badRequest, conflict, noContent } from '@/lib/http';
import { detectImage } from '@/lib/images';
import { saveScreenshot } from '@/lib/storage';
import { MAX_IMAGE_BYTES, openRoundComment, readLimited, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

/**
 * A komment képernyőképe: nyers PNG vagy JPEG a kérés törzsében, legfeljebb 3 MB → 204. 415 rossz típusra, 413 túl nagy
 * képre, 400, ha a tartalom nem kép (a fájl első bájtjait ellenőrizzük), 409, ha már van képe.
 */
export const POST = widgetRoute('write', async ({ req, project, params }) => {
  const { comment } = await openRoundComment(project, idParam(params.commentId!));
  if (comment.screenshotPath) throw conflict('A kommenthez már van képernyőkép');

  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'image/png' && type !== 'image/jpeg') throw new HttpError(415, 'Csak PNG vagy JPEG');

  const data = await readLimited(req, MAX_IMAGE_BYTES);
  const image = detectImage(data);
  // A tartalom dönt, nem a fejléc: a PNG fejlécű kérésben PNG, a JPEG fejlécűben JPEG kell legyen
  if (!image || (type === 'image/png') !== (image.extension === 'png') || (image.extension !== 'png' && image.extension !== 'jpg')) {
    throw badRequest('A tartalom nem érvényes kép');
  }
  const path = await saveScreenshot(project.id, comment.id, image.extension, data);
  await db.update(schema.comments).set({ screenshotPath: path }).where(eq(schema.comments.id, comment.id));
  return noContent();
});

export const OPTIONS = widgetPreflight;
