import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { randomHex } from '@/lib/crypto';
import { api, json } from '@/lib/http';
import { loadProjectDto } from '@/lib/projects';

export const dynamic = 'force-dynamic';

/**
 * Új megosztó token generálása (csak a tulajdonos). A régi azonnal érvénytelen, ezért a vele beágyazott widgetek leállnak,
 * amíg az új tokent be nem írják az oldalba. Akkor hasznos, ha a token illetéktelenhez került.
 */
export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  const shareToken = randomHex(24);
  await db.update(schema.projects).set({ shareToken }).where(eq(schema.projects.id, project.id));
  return json(await loadProjectDto({ ...project, shareToken }, user.id));
});
