import { requireApiUser } from '@/lib/api-keys';
import { api, json } from '@/lib/http';
import { accessibleProjects } from '@/lib/projects';

export const dynamic = 'force-dynamic';

/** A kulcs tulajdonosának projektjei (a sajátjai és a hozzá meghívottak). */
export const GET = api(async (req) => {
  const userId = await requireApiUser(req);
  const rows = await accessibleProjects(userId);
  return json(rows.map(({ project: p }) => ({ id: p.id, name: p.name, siteUrl: p.siteUrl, archived: p.archivedAt !== null, createdAt: p.createdAt })));
});
