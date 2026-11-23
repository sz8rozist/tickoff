import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth/session';
import { userDto } from '@/lib/auth/user-dto';
import { api, json, parseBody } from '@/lib/http';

export const dynamic = 'force-dynamic';

const Body = z.object({ frequency: z.enum(['OFF', 'DAILY', 'WEEKLY']) });

/** Az összefoglaló e-mail gyakorisága: OFF, DAILY (naponta reggel 8-kor) vagy WEEKLY (hétfőn). */
export const PATCH = api(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, Body);
  await db.update(schema.users).set({ digestFrequency: body.frequency }).where(eq(schema.users.id, user.id));
  return json(userDto({ ...user, digestFrequency: body.frequency }));
});
