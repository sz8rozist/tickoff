import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { recordActivity } from '@/lib/activity';
import { idParam } from '@/lib/access';
import { api, conflict, json } from '@/lib/http';
import { roundSummaryToCustomers } from '@/lib/notifications';
import { findRound, roundCounts, roundDto, teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

export const POST = api<{ params: Promise<{ id: string; roundId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { user, project } = await teamContext(req, p.id);
  const round = await findRound(project.id, idParam(p.roundId));
  if (round.status === 'CLOSED') throw conflict('A kör már le van zárva');
  const closedAt = new Date();
  await db.update(schema.rounds).set({ status: 'CLOSED', closedAt }).where(eq(schema.rounds.id, round.id));
  void roundSummaryToCustomers(project, round);
  await recordActivity(project.id, 'USER', user.name, 'round.closed', null, `Lezárta a ${round.number}. kört`);
  return json(roundDto({ ...round, status: 'CLOSED', closedAt }, (await roundCounts(project.id)).get(round.id)));
});
