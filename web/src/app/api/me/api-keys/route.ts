import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { createApiKey } from '@/lib/api-keys';
import { requireUser } from '@/lib/auth/session';
import { api, json, parseBody } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** A saját API-kulcsok kezelése (csak bejelentkezéssel; API-kulccsal nem érhető el). */
export const GET = api(async (req) => {
  const user = await requireUser(req);
  const keys = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.userId, user.id)).orderBy(desc(schema.apiKeys.id));
  return json(keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })));
});

const Body = z.object({ name: z.string().trim().min(1).max(80) });

/** Új kulcs. A teljes kulcs csak ebben a válaszban látható, később nem kérhető le. Legfeljebb 10 kulcs (409). */
export const POST = api(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, Body);
  const k = await createApiKey(user.id, body.name);
  return json({ id: k.id, name: body.name, prefix: k.prefix, createdAt: k.createdAt, key: k.key }, 201);
});
