import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam, loadProject, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { api, conflict, json } from '@/lib/http';
import { listMembers } from '@/lib/members';

export const dynamic = 'force-dynamic';

/**
 * A projekt átadása egy meglévő tagnak (csak a tulajdonos). Az új tulajdonos mindent megkap, a régi tulajdonos tag marad
 * (a visszaadást csak az új tulajdonos kezdeményezheti). A válasz a tagok frissített listája.
 */
export const POST = api<{ params: Promise<{ id: string; userId: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const p = await params;
  const projectId = idParam(p.id);
  const targetId = idParam(p.userId);
  const project = await requireOwner(projectId, user.id);

  const [target] = await db
    .select({ id: schema.projectMembers.id })
    .from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, targetId)))
    .limit(1);
  if (!target) throw conflict('A projektet csak a projekt egyik tagjának adhatod át');

  await db.transaction(async (tx) => {
    await tx.update(schema.projects).set({ ownerId: targetId }).where(eq(schema.projects.id, projectId));
    await tx.delete(schema.projectMembers).where(eq(schema.projectMembers.id, target.id));
    await tx.insert(schema.projectMembers).values({ projectId, userId: project.ownerId });
  });
  return json(await listMembers(await loadProject(projectId)));
});
