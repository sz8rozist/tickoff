import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { commentDtos } from '@/lib/comments';
import { api, json } from '@/lib/http';
import { findRound, teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

/** A kör kommentjei (régebbi elöl), válaszokkal és mellékletekkel. */
export const GET = api<{ params: Promise<{ id: string; roundId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { project } = await teamContext(req, p.id);
  const round = await findRound(project.id, idParam(p.roundId));
  const rows = await db.select().from(schema.comments).where(eq(schema.comments.roundId, round.id)).orderBy(asc(schema.comments.createdAt), asc(schema.comments.id));
  return json(await commentDtos(rows));
});
