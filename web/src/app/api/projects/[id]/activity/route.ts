import { api, json } from '@/lib/http';
import { listActivity } from '@/lib/activity';
import { teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

/** A projekt tevékenységnaplója a csapat tagjainak (újabb elöl, 50-esével lapozható: a `before` az utolsó kapott azonosító). */
export const GET = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { project } = await teamContext(req, (await params).id);
  const before = new URL(req.url).searchParams.get('before');
  const id = before === null ? null : Number(before);
  return json(await listActivity(project.id, id !== null && Number.isInteger(id) ? id : null));
});
