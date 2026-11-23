import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { issueAccessToken, verifyChallenge } from '@/lib/auth/tokens';
import { verifyLogin } from '@/lib/auth/two-factor';
import { userDto } from '@/lib/auth/user-dto';
import { api, json, parseBody, unauthorized } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({ challenge: z.string().min(1).max(2000), code: z.string().min(1).max(40) });

/** A belépés második lépése: a kihívás és a hitelesítő alkalmazás (vagy egy helyreállító) kódja. Hibás kódra 401, túl sok próbára 429. */
export const POST = api(async (req) => {
  limitByIp(req, LIMITS.login2fa);
  const body = await parseBody(req, Body);
  const userId = await verifyChallenge(body.challenge);
  if (userId === null) throw unauthorized('Érvénytelen vagy lejárt kihívás');
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user || !user.totpEnabledAt) throw unauthorized('Érvénytelen vagy lejárt kihívás');
  if (!(await verifyLogin(userId, body.code))) throw unauthorized('Hibás kód');
  return json({ token: await issueAccessToken(userId), user: userDto(user) });
});
