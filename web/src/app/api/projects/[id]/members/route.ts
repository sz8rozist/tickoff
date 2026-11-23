import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam, isTeamMember, requireMember, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { api, conflict, isDuplicateKey, json, notFound, parseBody } from '@/lib/http';
import { listMembers } from '@/lib/members';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** A tulajdonos és a tagok listája (a projekt minden tagja láthatja). A tulajdonos az első. */
export const GET = api<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { project } = await requireMember(idParam((await params).id), user.id);
  return json(await listMembers(project));
});

const AddBody = z.object({ email: z.email().max(255) });

/**
 * Tag meghívása e-mail-cím alapján (csak a tulajdonos). Csak megerősített fiók adható hozzá közvetlenül: egy meg nem
 * erősített fiók bárki lehet, aki a címet beírta. Ilyenkor (és ha nincs fiók) a kliens függő meghívót küld. Ebből a
 * végpontból a fiókok létezése kideríthető, ezért kérésszám-korlát védi.
 */
export const POST = api<Ctx>(async (req, { params }) => {
  limitByIp(req, LIMITS.invite);
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  const body = await parseBody(req, AddBody);
  const email = body.email.trim().toLowerCase();

  const [target] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!target || !target.emailVerifiedAt) throw notFound('Ezzel az e-mail címmel nincs megerősített fiók.');
  if (await isTeamMember(project, target.id)) throw conflict('Ő már tagja a projektnek');

  try {
    await db.insert(schema.projectMembers).values({ projectId: project.id, userId: target.id });
  } catch (e) {
    // Párhuzamos meghívás ugyanarra a felhasználóra: az egyedi index elkapja.
    if (isDuplicateKey(e)) throw conflict('Ő már tagja a projektnek');
    throw e;
  }
  return json({ userId: target.id, name: target.name, email: target.email, role: 'MEMBER' }, 201);
});
