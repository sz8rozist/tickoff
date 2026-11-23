import { and, eq, isNull, lt, or } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { randomToken, sha256 } from './crypto';
import { requireUser } from './auth/session';
import { bearerToken } from './auth/session';
import { conflict, unauthorized } from './http';
import { LIMITS, limitByIp } from './rate-limit';

/**
 * API-kulcsok a nyilvános, csak olvasható API-hoz (`/api/v1`). A kulcs 256 bit véletlen (`tk_` előtaggal), a teljes értékét
 * csak a létrehozáskor látja a felhasználó; az adatbázisban az SHA-256 hash-e van (a kulcs nagy entrópiája miatt a gyors hash
 * elég). Felhasználónként legfeljebb 10 kulcs lehet. A kulcs a létrehozója jogaival dolgozik.
 */

export const KEY_PREFIX = 'tk_';
export const MAX_KEYS = 10;
/** A "legutóbb használva" időt legfeljebb ilyen sűrűn írjuk (ne legyen írás minden kérésnél). */
const TOUCH_INTERVAL_MS = 60 * 1000;

export async function createApiKey(userId: number, name: string): Promise<{ id: number; key: string; prefix: string; createdAt: Date }> {
  const existing = await db.select({ id: schema.apiKeys.id }).from(schema.apiKeys).where(eq(schema.apiKeys.userId, userId)).limit(MAX_KEYS);
  if (existing.length >= MAX_KEYS) throw conflict(`Legfeljebb ${MAX_KEYS} API-kulcs lehet`);
  const key = KEY_PREFIX + randomToken(32);
  const prefix = key.slice(0, 8);
  const createdAt = new Date();
  const [result] = await db.insert(schema.apiKeys).values({ userId, name: name.trim(), prefix, keyHash: sha256(key), createdAt });
  return { id: result.insertId, key, prefix, createdAt };
}

/** A kulcshoz tartozó felhasználó azonosítója, ha a kulcs érvényes. */
async function authenticateKey(rawKey: string): Promise<number | null> {
  if (!rawKey.startsWith(KEY_PREFIX) || rawKey.length > 100) return null;
  const [key] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, sha256(rawKey))).limit(1);
  if (!key) return null;
  const now = new Date();
  if (!key.lastUsedAt || now.getTime() > key.lastUsedAt.getTime() + TOUCH_INTERVAL_MS) {
    await db
      .update(schema.apiKeys)
      .set({ lastUsedAt: now })
      .where(and(eq(schema.apiKeys.id, key.id), or(isNull(schema.apiKeys.lastUsedAt), lt(schema.apiKeys.lastUsedAt, new Date(now.getTime() - TOUCH_INTERVAL_MS)))));
  }
  return key.userId;
}

/**
 * A nyilvános API hitelesítése: `Authorization: Bearer tk_…` (API-kulcs), vagy a bejelentkezési token (JWT). A kulcs csak az
 * `/api/v1` végpontokon fogadható el: máshol a `requireUser` a `tk_` tokent nem fogadja el. IP-nként 60 kérés/perc.
 */
export async function requireApiUser(req: NextRequest): Promise<number> {
  limitByIp(req, LIMITS.apiV1);
  const token = bearerToken(req);
  if (token?.startsWith(KEY_PREFIX)) {
    const userId = await authenticateKey(token);
    if (userId === null) throw unauthorized('Érvénytelen API-kulcs');
    return userId;
  }
  return (await requireUser(req)).id;
}
