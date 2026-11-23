import { and, count, eq, gt, isNull, lt } from 'drizzle-orm';
import { db, schema } from '@/db';
import { randomToken, sha256 } from '../crypto';
import { dashboardOrigin } from '../env';
import { isMailEnabled, sendMail } from '../mail';
import { hashPassword } from './password';

/**
 * Jelszó-visszaállítás e-mailben küldött, egyszer használatos linkkel.
 * - A link tokenjét csak hash-ként tároljuk, 1 óráig érvényes, használat után (vagy újabb kérésre) érvénytelen.
 * - A kérés válasza nem árulja el, hogy létezik-e a fiók.
 * - Egy fiókra óránként legfeljebb 3 levél megy (levélbombázás ellen).
 * - Sikeres visszaállítás után a fiók korábbi bejelentkezései is érvénytelenek (passwordChangedAt).
 */

const TTL_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;

/** Visszaállító levelet küld, ha van ilyen fiók. A hívó mindenképp ugyanazt a választ adja. */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!isMailEnabled()) return;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user) return;
  const now = new Date();

  const [{ recent }] = await db
    .select({ recent: count() })
    .from(schema.passwordResetTokens)
    .where(and(eq(schema.passwordResetTokens.userId, user.id), gt(schema.passwordResetTokens.createdAt, new Date(now.getTime() - HOUR_MS))));
  if (recent >= MAX_REQUESTS_PER_HOUR) return;

  // Az újabb kérés érvényteleníti a korábbi, még fel nem használt linkeket (a sorok megmaradnak a számláláshoz)
  await db
    .update(schema.passwordResetTokens)
    .set({ usedAt: now })
    .where(and(eq(schema.passwordResetTokens.userId, user.id), isNull(schema.passwordResetTokens.usedAt)));
  await db.delete(schema.passwordResetTokens).where(lt(schema.passwordResetTokens.createdAt, new Date(now.getTime() - WEEK_MS)));

  const raw = randomToken();
  await db.insert(schema.passwordResetTokens).values({
    userId: user.id,
    tokenHash: sha256(raw),
    expiresAt: new Date(now.getTime() + TTL_MS),
  });

  sendMail(
    user.email,
    'Tickoff: jelszó-visszaállítás',
    `Szia ${user.name}!\n\n` +
      'Jelszó-visszaállítást kértek a Tickoff fiókodhoz. Az új jelszó megadásához nyisd meg ezt a linket ' +
      '(egy óráig érvényes, és csak egyszer használható):\n\n' +
      `${dashboardOrigin()}/?reset-token=${raw}\n\n` +
      'Ha nem te kérted, hagyd figyelmen kívül ezt a levelet: a jelszavad nem változik.\n',
  );
}

/** @returns igaz, ha a token érvényes volt, és az új jelszó beállítva; hamis, ha ismeretlen, lejárt vagy használt */
export async function resetPassword(rawToken: string, newPassword: string): Promise<boolean> {
  const now = new Date();
  const [token] = await db
    .select()
    .from(schema.passwordResetTokens)
    .where(eq(schema.passwordResetTokens.tokenHash, sha256(rawToken)))
    .limit(1);
  if (!token || token.usedAt !== null || token.expiresAt.getTime() <= now.getTime()) return false;

  const passwordHash = await hashPassword(newPassword);
  const ok = await db.transaction(async (tx) => {
    // A token felhasználása feltételes: két párhuzamos kérés közül csak az egyik "nyerhet"
    const used = await tx
      .update(schema.passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(schema.passwordResetTokens.id, token.id), isNull(schema.passwordResetTokens.usedAt)));
    if (used[0].affectedRows !== 1) throw new TokenAlreadyUsed();
    await tx.update(schema.users).set({ passwordHash, passwordChangedAt: now }).where(eq(schema.users.id, token.userId));
    await tx
      .update(schema.passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(schema.passwordResetTokens.userId, token.userId), isNull(schema.passwordResetTokens.usedAt)));
    return true;
  }).catch((e) => {
    if (e instanceof TokenAlreadyUsed) return false;
    throw e;
  });
  return ok;
}

class TokenAlreadyUsed extends Error {}
