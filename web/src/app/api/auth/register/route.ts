import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { sendVerification } from '@/lib/auth/email-verification';
import { hashPassword } from '@/lib/auth/password';
import { issueAccessToken } from '@/lib/auth/tokens';
import { userDto } from '@/lib/auth/user-dto';
import { registrationEnabled } from '@/lib/env';
import { api, conflict, forbidden, isDuplicateKey, json, parseBody } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

const Body = z.object({
  email: z.email().max(255),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(120),
  lang: z.enum(['hu', 'en']).optional(),
});

export const dynamic = 'force-dynamic';

/** Regisztráció: 201 + munkamenet. Megerősítő levél megy (SMTP nélkül a fiók azonnal megbízható). */
export const POST = api(async (req) => {
  limitByIp(req, LIMITS.register);
  // Éles üzemben a saját fiók(ok) létrehozása után lezárható a nyilvános regisztráció.
  if (!registrationEnabled()) throw forbidden('A regisztráció le van tiltva');
  const body = await parseBody(req, Body);
  const email = body.email.trim().toLowerCase();

  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing) throw conflict('Ezzel az e-mail címmel már van fiók');

  let userId: number;
  try {
    const [result] = await db.insert(schema.users).values({ email, passwordHash: await hashPassword(body.password), name: body.name, lang: body.lang ?? 'hu' });
    userId = result.insertId;
  } catch (e) {
    // Párhuzamos regisztráció ugyanarra az e-mailre: az egyedi index elkapja.
    if (isDuplicateKey(e)) throw conflict('Ezzel az e-mail címmel már van fiók');
    throw e;
  }

  await sendVerification(userId);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return json({ token: await issueAccessToken(userId), user: userDto(user) }, 201);
});
