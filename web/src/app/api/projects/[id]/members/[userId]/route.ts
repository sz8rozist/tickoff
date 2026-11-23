import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam, requireMember } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { api, conflict, forbidden, noContent, notFound } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * Tag eltávolítása. A tulajdonos bárkit eltávolíthat, a tag csak saját magát (kilépés). A tulajdonos nem távolítható el:
 * ha nincs rá szükség, a projektet kell törölni. A kilépő vagy eltávolított tagra bízott kommentek felelős nélkül maradnak.
 */
export const DELETE = api<{ params: Promise<{ id: string; userId: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const p = await params;
  const projectId = idParam(p.id);
  const targetId = idParam(p.userId);
  const { project, role } = await requireMember(projectId, user.id);

  if (role === 'MEMBER' && targetId !== user.id) throw forbidden('Mást csak a projekt tulajdonosa távolíthat el');
  if (targetId === project.ownerId) throw conflict('A tulajdonos nem távolítható el. Ha nincs rá szükség, töröld a projektet.');

  const [member] = await db
    .select({ id: schema.projectMembers.id })
    .from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, targetId)))
    .limit(1);
  if (!member) throw notFound();

  await db.transaction(async (tx) => {
    await tx.delete(schema.projectMembers).where(eq(schema.projectMembers.id, member.id));
    const roundIds = (await tx.select({ id: schema.rounds.id }).from(schema.rounds).where(eq(schema.rounds.projectId, projectId))).map((r) => r.id);
    if (roundIds.length > 0) {
      await tx
        .update(schema.comments)
        .set({ assigneeId: null })
        .where(and(eq(schema.comments.assigneeId, targetId), inArray(schema.comments.roundId, roundIds)));
    }
  });
  return noContent();
});
