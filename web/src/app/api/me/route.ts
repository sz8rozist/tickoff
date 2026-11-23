import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { verifyPassword } from '@/lib/auth/password';
import { requireUser } from '@/lib/auth/session';
import { userDto } from '@/lib/auth/user-dto';
import { api, forbidden, json, noContent, parseBody } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';
import { deleteProjectFiles } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export const GET = api(async (req) => {
  return json(userDto(await requireUser(req)));
});

const Settings = z.object({ notifyEmail: z.boolean().optional(), lang: z.enum(['hu', 'en']).optional() });

/** Beállítások: az e-mail értesítések be- és kikapcsolása, a felület és a levelek nyelve. */
export const PATCH = api(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, Settings);
  const changes = {
    ...(body.notifyEmail === undefined ? {} : { notifyEmail: body.notifyEmail }),
    ...(body.lang === undefined ? {} : { lang: body.lang }),
  };
  if (Object.keys(changes).length > 0) await db.update(schema.users).set(changes).where(eq(schema.users.id, user.id));
  return json(userDto({ ...user, ...changes }));
});

const DeleteBody = z.object({ password: z.string().min(1) });

/** A fiók törlése a jelszóval megerősítve: a saját projektek (és fájljaik) is törlődnek. Nem visszavonható. */
export const DELETE = api(async (req) => {
  limitByIp(req, LIMITS.deleteAccount);
  const user = await requireUser(req);
  const body = await parseBody(req, DeleteBody);
  if (!(await verifyPassword(body.password, user.passwordHash))) throw forbidden('Hibás jelszó');

  const owned = await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.ownerId, user.id));
  // A projektek, körök, kommentek, tagságok törlését az adatbázis idegen kulcsai (ON DELETE CASCADE / SET NULL) végzik
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  await Promise.all(owned.map((p) => deleteProjectFiles(p.id)));
  return noContent();
});
