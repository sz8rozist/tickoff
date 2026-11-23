import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { api, json, parseBody } from '@/lib/http';
import { loadProjectDto } from '@/lib/projects';

export const dynamic = 'force-dynamic';

const Body = z.object({ archived: z.boolean() });

/**
 * Projekt archiválása vagy visszaállítása (csak a tulajdonos). Archivált projektnél a widget leáll (az ügyfél nem lát és
 * nem küld semmit), a lista alapból elrejti, az adatok megmaradnak.
 */
export const PUT = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  const body = await parseBody(req, Body);
  const archivedAt = body.archived ? new Date() : null;
  await db.update(schema.projects).set({ archivedAt }).where(eq(schema.projects.id, project.id));
  return json(await loadProjectDto({ ...project, archivedAt }, user.id));
});
