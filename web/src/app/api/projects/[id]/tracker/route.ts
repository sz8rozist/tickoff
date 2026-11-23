import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { api, badRequest, json, parseBody } from '@/lib/http';
import { loadProjectDto } from '@/lib/projects';
import { isValidTrackerTemplate } from '@/lib/tracker';

export const dynamic = 'force-dynamic';

const Body = z.object({ url: z.string().max(500).nullish() });

/**
 * A hibajegy-követő beállítása (csak a tulajdonos): egy https URL-sablon, amelyben a {title}, {body} és {url} helyére a
 * komment adatai kerülnek. A szerver nem hív meg semmit: a dashboard a kitöltött címet nyitja meg a böngészőben, így
 * nincs tárolt kulcs és nincs kimenő kérés. GitHub, Linear, Jira és bármilyen más követő beállítható. Üres cím kikapcsolja.
 */
export const PUT = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  const body = await parseBody(req, Body);
  const url = body.url && body.url.trim() !== '' ? body.url.trim() : null;
  if (url !== null && !isValidTrackerTemplate(url)) {
    throw badRequest('A sablon https:// kezdetű legyen, és tartalmazza a {title} helyőrzőt');
  }
  await db.update(schema.projects).set({ trackerUrl: url }).where(eq(schema.projects.id, project.id));
  return json(await loadProjectDto({ ...project, trackerUrl: url }, user.id));
});
