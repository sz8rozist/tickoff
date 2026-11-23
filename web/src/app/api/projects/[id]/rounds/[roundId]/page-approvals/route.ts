import { idParam } from '@/lib/access';
import { api, json } from '@/lib/http';
import { listPageApprovals } from '@/lib/page-approvals';
import { findRound, teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

/** A kör oldalankénti jóváhagyásai (oldal, jóváhagyó neve); a csapat minden tagja láthatja. */
export const GET = api<{ params: Promise<{ id: string; roundId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { project } = await teamContext(req, p.id);
  const round = await findRound(project.id, idParam(p.roundId));
  return json(await listPageApprovals(round.id));
});
