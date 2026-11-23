import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth/session';
import { randomHex } from '@/lib/crypto';
import { api, json, parseBody } from '@/lib/http';
import { ProjectBody } from '@/lib/schemas';
import { accessibleProjects, loadProjectDto, projectDto, statsFor } from '@/lib/projects';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/** A felhasználó saját és a hozzá meghívott projektjei, újabb elöl. */
export const GET = api(async (req) => {
  const user = await requireUser(req);
  const rows = await accessibleProjects(user.id);
  const stats = await statsFor(rows.map((r) => r.project.id));
  return json(rows.map((r) => projectDto(r.project, r.project.ownerId === user.id ? 'OWNER' : 'MEMBER', r.ownerName, stats.get(r.project.id))));
});

/** Új projekt. Minden projekt az 1. körrel indul, a kommentek körökhöz tartoznak. */
export const POST = api(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, ProjectBody);
  const projectId = await db.transaction(async (tx) => {
    const [result] = await tx.insert(schema.projects).values({
      ownerId: user.id,
      name: body.name,
      siteUrl: body.siteUrl,
      // 192 bites megosztó token (48 hex karakter): a widget ezzel azonosítja a projektet
      shareToken: randomHex(24),
    });
    await tx.insert(schema.rounds).values({ projectId: result.insertId, number: 1 });
    return result.insertId;
  });
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  return json(await loadProjectDto(project, user.id), 201);
});
