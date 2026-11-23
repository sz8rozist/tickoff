import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { api, json, parseBody } from '@/lib/http';
import { loadProjectDto } from '@/lib/projects';

export const dynamic = 'force-dynamic';

const Body = z.object({ password: z.string().min(4).max(72).nullable() });

/**
 * A widget jelszavas védelme (csak a tulajdonos): jelszó megadása bekapcsolja, null kikapcsolja. A jelszó cseréje vagy
 * törlése az ügyfelek addig kiadott hozzáférési tokenjeit is érvényteleníti. A jelszót csak hash-ként tároljuk, és a
 * dashboard sem kapja vissza.
 */
export const PUT = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  const body = await parseBody(req, Body);
  const hash = body.password === null ? null : await hashPassword(body.password);
  await db.update(schema.projects).set({ widgetPasswordHash: hash }).where(eq(schema.projects.id, project.id));
  return json(await loadProjectDto({ ...project, widgetPasswordHash: hash }, user.id));
});
