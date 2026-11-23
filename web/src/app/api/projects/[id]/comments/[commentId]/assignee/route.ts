import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam, isTeamMember } from '@/lib/access';
import { quote, recordActivity } from '@/lib/activity';
import { commentDto, findProjectComment, reloadComment } from '@/lib/comments';
import { api, badRequest, json, parseBody } from '@/lib/http';
import { assigned } from '@/lib/notifications';
import { teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

const Body = z.object({ userId: z.number().int().positive().nullable() });

/**
 * Felelős kijelölése (vagy törlése, `userId: null`). Csak a projekt csapatának tagja lehet felelős (400 különben). Ha valaki
 * másra bíz egy kommentet, az értesítést kap e-mailben (ha nem kapcsolta ki).
 */
export const PUT = api<{ params: Promise<{ id: string; commentId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { user, project } = await teamContext(req, p.id);
  const { comment } = await findProjectComment(project.id, idParam(p.commentId));
  const body = await parseBody(req, Body);

  let assignee: typeof schema.users.$inferSelect | null = null;
  if (body.userId !== null) {
    if (!(await isTeamMember(project, body.userId))) throw badRequest('Csak a projekt tagja lehet felelős');
    [assignee = null] = await db.select().from(schema.users).where(eq(schema.users.id, body.userId)).limit(1);
    if (!assignee) throw badRequest('Ismeretlen felhasználó');
  }
  const changed = comment.assigneeId !== body.userId;
  await db.update(schema.comments).set({ assigneeId: body.userId }).where(eq(schema.comments.id, comment.id));
  const updated = await reloadComment(comment.id);

  if (changed) {
    await recordActivity(project.id, 'USER', user.name, 'assigned', comment.id,
      (assignee ? `Felelős: ${assignee.name} – ` : 'Levette a felelőst: ') + quote(comment.body));
    if (assignee && assignee.id !== user.id) assigned(project, updated, assignee, user.name);
  }
  return json(await commentDto(updated));
});
