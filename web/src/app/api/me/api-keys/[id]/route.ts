import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { api, noContent, notFound } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const DELETE = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const result = await db.delete(schema.apiKeys).where(and(eq(schema.apiKeys.id, idParam((await params).id)), eq(schema.apiKeys.userId, user.id)));
  if (result[0].affectedRows === 0) throw notFound();
  return noContent();
});
