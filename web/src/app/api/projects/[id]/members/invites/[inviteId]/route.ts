import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { api, noContent, notFound } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** Függő meghívó visszavonása (csak a tulajdonos). */
export const DELETE = api<{ params: Promise<{ id: string; inviteId: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const p = await params;
  const project = await requireOwner(idParam(p.id), user.id);
  const inviteId = idParam(p.inviteId);
  const result = await db
    .delete(schema.projectInvites)
    .where(and(eq(schema.projectInvites.id, inviteId), eq(schema.projectInvites.projectId, project.id)));
  if (result[0].affectedRows === 0) throw notFound();
  return noContent();
});
