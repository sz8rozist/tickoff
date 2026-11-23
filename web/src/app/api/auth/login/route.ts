import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { dummyPasswordHash, verifyPassword } from '@/lib/auth/password';
import { issueAccessToken, issueChallenge } from '@/lib/auth/tokens';
import { userDto } from '@/lib/auth/user-dto';
import { api, json, parseBody, unauthorized } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

const Body = z.object({ email: z.string().min(1), password: z.string().min(1) });

export const dynamic = 'force-dynamic';

/**
 * Belépés. Bekapcsolt kétlépcsős belépésnél nincs még munkamenet: egy rövid életű kihívást kap a kliens, amit a
 * hitelesítő alkalmazás kódjával együtt kell beküldeni (a második lépés végpontja a biztonsági fázisban készül).
 */
export const POST = api(async (req) => {
  limitByIp(req, LIMITS.login);
  const body = await parseBody(req, Body);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email.trim().toLowerCase())).limit(1);

  // Nem létező felhasználónál is számolunk egy hash-t: a válaszidő nem árulja el, hogy létezik-e az e-mail
  const ok = await verifyPassword(body.password, user ? user.passwordHash : await dummyPasswordHash());
  if (!user || !ok) throw unauthorized('Hibás e-mail vagy jelszó');

  if (user.totpEnabledAt) {
    return json({ token: null, user: null, twoFactorRequired: true, challenge: await issueChallenge(user.id) });
  }
  return json({ token: await issueAccessToken(user.id), user: userDto(user), twoFactorRequired: false, challenge: null });
});
