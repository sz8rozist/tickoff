import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam, requireMember, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { api, json, noContent, parseBody } from '@/lib/http';
import { loadProjectDto } from '@/lib/projects';
import { deleteProjectFiles } from '@/lib/storage';
import { ProjectBody } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { project } = await requireMember(idParam((await params).id), user.id);
  return json(await loadProjectDto(project, user.id));
});

/** A projekt beállításait csak a tulajdonos módosíthatja. */
export const PUT = api<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  const body = await parseBody(req, ProjectBody);
  await db.update(schema.projects).set({ name: body.name, siteUrl: body.siteUrl }).where(eq(schema.projects.id, project.id));
  return json(await loadProjectDto({ ...project, name: body.name, siteUrl: body.siteUrl }, user.id));
});

/** A projekt törlése (csak a tulajdonos): a tagok számára is megszűnik. */
export const DELETE = api<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  // A körök, kommentek és tagságok törlését az adatbázis ON DELETE CASCADE-je végzi
  await db.delete(schema.projects).where(eq(schema.projects.id, project.id));
  // A képernyőképek a fájlrendszerben vannak: azokat külön kell törölni
  await deleteProjectFiles(project.id);
  return noContent();
});
