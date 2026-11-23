import { asc, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam, isTeamMember, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { api, conflict, HttpError, isDuplicateKey, json, parseBody } from '@/lib/http';
import { dashboardOrigin } from '@/lib/env';
import { isMailEnabled, sendMail } from '@/lib/mail';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Egy projektnek legfeljebb ennyi függő meghívója lehet (levélbombázás és adatszemét ellen). */
const MAX_PENDING_INVITES = 20;

type Ctx = { params: Promise<{ id: string }> };

const inviteDto = (i: { id: number; email: string; role: string; createdAt: Date }) => ({ id: i.id, email: i.email, role: i.role === 'VIEWER' ? 'VIEWER' : 'MEMBER', createdAt: i.createdAt });

/** A függő meghívók (csak a tulajdonos látja). */
export const GET = api<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  const rows = await db.select().from(schema.projectInvites).where(eq(schema.projectInvites.projectId, project.id)).orderBy(asc(schema.projectInvites.createdAt), asc(schema.projectInvites.id));
  return json(rows.map(inviteDto));
});

const Body = z.object({ email: z.email().max(255), role: z.enum(['MEMBER', 'VIEWER']).optional() });

/**
 * Meghívó még nem (megerősítetten) regisztrált kollégának: levelet kap, és ha ezzel a címmel regisztrál és megerősíti,
 * automatikusan tagja lesz a projektnek. Csak működő e-mail-küldés mellett használható (503 különben), és projektenként
 * legfeljebb 20 függő meghívó lehet.
 */
export const POST = api<Ctx>(async (req, { params }) => {
  limitByIp(req, LIMITS.invite);
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  const body = await parseBody(req, Body);
  const email = body.email.trim().toLowerCase();

  // 503: a kliens ebből tudja, hogy nem a kérés hibás, hanem a szerver nincs felkészítve levélküldésre
  if (!isMailEnabled()) throw new HttpError(503, 'Meghívó küldéséhez be kell állítani az e-mail-küldést (SMTP).');

  const [existingUser] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const alreadyIn = existingUser ? await isTeamMember(project, existingUser.id) : false;
  const pending = await db.select().from(schema.projectInvites).where(eq(schema.projectInvites.projectId, project.id));
  if (alreadyIn || pending.some((i) => i.email === email)) throw conflict('Őt már meghívtad, vagy már tagja a projektnek');
  const [{ total }] = await db.select({ total: count() }).from(schema.projectInvites).where(eq(schema.projectInvites.projectId, project.id));
  if (total >= MAX_PENDING_INVITES) throw conflict('Túl sok függő meghívó van, töröld a feleslegeseket');

  let inviteId: number;
  try {
    const [result] = await db.insert(schema.projectInvites).values({ projectId: project.id, email, invitedBy: user.id, role: body.role ?? 'MEMBER' });
    inviteId = result.insertId;
  } catch (e) {
    if (isDuplicateKey(e)) throw conflict('Őt már meghívtad, vagy már tagja a projektnek');
    throw e;
  }

  sendMail(
    email,
    `[Tickoff] Meghívó: ${project.name}`,
    `${user.name} meghívott a(z) „${project.name}” projekt visszajelzéseinek kezelésére a Tickoffban.\n\n` +
      `Regisztrálj erre az e-mail-címre, és erősítsd meg a címedet: ${dashboardOrigin()}/\n` +
      'A megerősítés után automatikusan csatlakozol a projekthez.\n\n' +
      'Ha nem ismered a meghívót, hagyd figyelmen kívül ezt a levelet.\n',
  );
  const [saved] = await db.select().from(schema.projectInvites).where(eq(schema.projectInvites.id, inviteId)).limit(1);
  return json(inviteDto(saved), 201);
});
