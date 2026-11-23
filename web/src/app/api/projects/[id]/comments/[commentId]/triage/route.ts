import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { quote, recordActivity } from '@/lib/activity';
import { commentDto, findProjectComment, normalizeLabels, reloadComment } from '@/lib/comments';
import { api, json, parseBody } from '@/lib/http';
import { teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

const Body = z.object({
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  labels: z.array(z.string().max(100)).max(10).nullish(),
});

/** Prioritás és címkék beállítása (belső rendezés, az ügyfél nem látja). A címkéket a szerver normalizálja. */
export const PUT = api<{ params: Promise<{ id: string; commentId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { user, project } = await teamContext(req, p.id);
  const { comment } = await findProjectComment(project.id, idParam(p.commentId));
  const body = await parseBody(req, Body);

  await db
    .update(schema.comments)
    .set({ priority: body.priority, labels: normalizeLabels(body.labels).join(',') })
    .where(eq(schema.comments.id, comment.id));
  if (comment.priority !== body.priority) {
    await recordActivity(project.id, 'USER', user.name, 'triaged', comment.id,
      `Prioritás: ${body.priority.toLowerCase()} – ${quote(comment.body)}`);
  }
  return json(await commentDto(await reloadComment(comment.id)));
});
