import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { unauthorized } from '../http';
import { verifyAccessToken } from './tokens';

export type User = typeof schema.users.$inferSelect;

/** A `Authorization: Bearer …` fejléc tokenje, vagy null. */
export function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/**
 * A kérést küldő bejelentkezett felhasználó. 401, ha nincs token, érvénytelen vagy lejárt, a felhasználó közben
 * törlődött, vagy a jelszava a token kiadása után változott (jelszó-visszaállítás után a régi bejelentkezések megszűnnek).
 */
export async function requireUser(req: NextRequest): Promise<User> {
  const token = bearerToken(req);
  if (!token) throw unauthorized();
  const claims = await verifyAccessToken(token);
  if (!claims) throw unauthorized();

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, claims.userId)).limit(1);
  if (!user) throw unauthorized();
  if (user.passwordChangedAt && claims.issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw unauthorized();
  }
  return user;
}
