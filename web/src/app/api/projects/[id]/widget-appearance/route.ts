import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { api, badRequest, json, parseBody } from '@/lib/http';
import { loadProjectDto } from '@/lib/projects';
import { hasEnoughContrastWithWhite } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

const Body = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '#rrggbb szín kell').nullable(),
  position: z.enum(['RIGHT', 'LEFT']),
  lang: z.enum(['hu', 'en']).nullish(),
});

/**
 * A widget megjelenése és nyelve (csak a tulajdonos): márkaszín, a gombok oldala, nyelv. Túl világos színt elutasítunk
 * (400), mert a gombokon fehér szöveg van, és olvashatatlan lenne.
 */
export const PUT = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  const body = await parseBody(req, Body);
  const color = body.color === null ? null : body.color.toLowerCase();
  if (color !== null && !hasEnoughContrastWithWhite(color)) throw badRequest('Túl világos szín: a gombokon fehér szöveg van');
  const patch = { widgetColor: color, widgetPosition: body.position, widgetLang: body.lang ?? 'hu' };
  await db.update(schema.projects).set(patch).where(eq(schema.projects.id, project.id));
  return json(await loadProjectDto({ ...project, ...patch }, user.id));
});
