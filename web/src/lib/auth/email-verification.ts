import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { randomToken, sha256 } from '../crypto';
import { dashboardOrigin } from '../env';
import { isMailEnabled, sendMail } from '../mail';

/**
 * Az e-mail-cím megerősítése: regisztrációkor levélben kapott, egyszer használatos linkkel.
 * - A token csak hash-ként van tárolva, 24 óráig érvényes; újabb kérés lecseréli (percenként legfeljebb egy levél).
 * - Megerősítéskor a címre szóló függő meghívók érvénybe lépnek: a felhasználó tagja lesz a projekteknek. Meghívó csak
 *   megerősített címen érvényesül, különben bárki a másik címével regisztrálva bejuthatna.
 * - Ha nincs e-mail-küldés beállítva, megerősítés nem lehetséges, ezért a fiók azonnal megbízható (senki nem reked ki,
 *   de a függő meghívók ilyenkor nem is küldhetők).
 */

const TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Megerősítő levelet küld (ha kell és lehet). Megerősített fióknál és a várakozási időn belül nem csinál semmit. */
export async function sendVerification(userId: number): Promise<void> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user || user.emailVerifiedAt) return;
  const now = new Date();

  if (!isMailEnabled()) {
    await db.transaction(async (tx) => {
      await tx.update(schema.users).set({ emailVerifiedAt: now, emailVerifyHash: null, emailVerifyExpiresAt: null }).where(eq(schema.users.id, userId));
      await acceptInvites(tx, userId, user.email);
    });
    return;
  }
  if (user.emailVerifySentAt && now.getTime() < user.emailVerifySentAt.getTime() + RESEND_COOLDOWN_MS) return;

  const raw = randomToken();
  await db
    .update(schema.users)
    .set({ emailVerifyHash: sha256(raw), emailVerifyExpiresAt: new Date(now.getTime() + TTL_MS), emailVerifySentAt: now })
    .where(eq(schema.users.id, userId));
  const link = `${dashboardOrigin()}/?verify-token=${raw}`;
  if (user.lang === 'en') {
    sendMail(
      user.email,
      'Tickoff: confirm your email address',
      `Hi ${user.name}!\n\nThank you for registering. To confirm your email address, open this link (valid for 24 hours):\n\n${link}\n\n` +
        'If you did not register, ignore this email.\n',
    );
    return;
  }
  sendMail(
    user.email,
    'Tickoff: erősítsd meg az e-mail-címed',
    `Szia ${user.name}!\n\n` +
      'Köszönjük a regisztrációt. Az e-mail-címed megerősítéséhez nyisd meg ezt a linket (24 óráig érvényes):\n\n' +
      `${link}\n\n` +
      'Ha nem te regisztráltál, hagyd figyelmen kívül ezt a levelet.\n',
  );
}

/** @returns igaz, ha a token érvényes volt és a cím megerősítve; hamis, ha ismeretlen vagy lejárt */
export async function verifyEmail(rawToken: string): Promise<boolean> {
  const now = new Date();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.emailVerifyHash, sha256(rawToken))).limit(1);
  if (!user || !user.emailVerifyExpiresAt || now.getTime() >= user.emailVerifyExpiresAt.getTime()) return false;
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ emailVerifiedAt: now, emailVerifyHash: null, emailVerifyExpiresAt: null }).where(eq(schema.users.id, user.id));
    await acceptInvites(tx, user.id, user.email);
  });
  return true;
}

/** A megerősített címre szóló meghívók beváltása: a felhasználó tagja lesz a projekteknek. */
async function acceptInvites(tx: Tx, userId: number, email: string): Promise<void> {
  const invites = await tx
    .select({ id: schema.projectInvites.id, projectId: schema.projectInvites.projectId, ownerId: schema.projects.ownerId })
    .from(schema.projectInvites)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.projectInvites.projectId))
    .where(eq(schema.projectInvites.email, email));
  for (const invite of invites) {
    if (invite.ownerId !== userId) {
      const [existing] = await tx
        .select({ id: schema.projectMembers.id })
        .from(schema.projectMembers)
        .where(and(eq(schema.projectMembers.projectId, invite.projectId), eq(schema.projectMembers.userId, userId)))
        .limit(1);
      if (!existing) await tx.insert(schema.projectMembers).values({ projectId: invite.projectId, userId });
    }
    await tx.delete(schema.projectInvites).where(eq(schema.projectInvites.id, invite.id));
  }
}
