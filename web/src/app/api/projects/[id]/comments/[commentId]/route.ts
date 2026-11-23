import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { quote, recordActivity } from '@/lib/activity';
import { changeStatus, commentDto, findProjectComment, reloadComment, statusLabel } from '@/lib/comments';
import { api, json, noContent, parseBody } from '@/lib/http';
import { commentDone } from '@/lib/notifications';
import { deleteStored } from '@/lib/storage';
import { teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; commentId: string }> };

const Body = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']) });

/** Státuszváltás. A "Kész"-re váltásról az e-mailt kérő ügyfél értesítést kap. */
export const PATCH = api<Ctx>(async (req, { params }) => {
  const p = await params;
  const { user, project } = await teamContext(req, p.id);
  const { comment, round } = await findProjectComment(project.id, idParam(p.commentId));
  const body = await parseBody(req, Body);

  const before = comment.status;
  await changeStatus(comment, round, body.status);
  const updated = await reloadComment(comment.id);
  if (before !== body.status) {
    await recordActivity(project.id, 'USER', user.name, 'status.changed', comment.id,
      `${statusLabel(before)} → ${statusLabel(body.status)}: ${quote(comment.body)}`);
    if (body.status === 'DONE') commentDone(project, updated);
  }
  return json(await commentDto(updated));
});

/** A komment törlése (a képernyőképével, mellékleteivel és válaszaival együtt). */
export const DELETE = api<Ctx>(async (req, { params }) => {
  const p = await params;
  const { user, project } = await teamContext(req, p.id);
  const { comment } = await findProjectComment(project.id, idParam(p.commentId));
  const files = await db.select({ path: schema.attachments.path }).from(schema.attachments).where(eq(schema.attachments.commentId, comment.id));

  await recordActivity(project.id, 'USER', user.name, 'comment.deleted', null, `Törölte a visszajelzést: ${quote(comment.body)}`);
  await db.delete(schema.comments).where(eq(schema.comments.id, comment.id));
  // A képek a fájlrendszerben vannak: az adatbázis-törlés után külön töröljük
  await deleteStored(comment.screenshotPath);
  await Promise.all(files.map((f) => deleteStored(f.path)));
  return noContent();
});
