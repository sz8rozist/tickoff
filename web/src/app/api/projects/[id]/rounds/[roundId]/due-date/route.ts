import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { api, badRequest, conflict, json, parseBody } from '@/lib/http';
import { findRound, roundCounts, roundDto, teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

const Body = z.object({ dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ÉÉÉÉ-HH-NN dátum kell').nullable() });

/**
 * A nyitott kör határidejének beállítása vagy törlése (`dueDate: null`). Tájékoztató jellegű: az ügyfél a widgetben látja, de
 * a lejárta nem zárja le a kört. Egy napnál régebbi dátum nem adható meg.
 */
export const PUT = api<{ params: Promise<{ id: string; roundId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { project } = await teamContext(req, p.id);
  const round = await findRound(project.id, idParam(p.roundId));
  const body = await parseBody(req, Body);
  if (round.status === 'CLOSED') throw conflict('Lezárt körnek nincs határideje');
  if (body.dueDate !== null) {
    const date = new Date(body.dueDate + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) throw badRequest('Érvénytelen dátum');
    if (date.getTime() < Date.now() - 2 * 24 * 60 * 60 * 1000) throw badRequest('A határidő nem lehet a múltban');
  }
  await db.update(schema.rounds).set({ dueDate: body.dueDate }).where(eq(schema.rounds.id, round.id));
  return json(roundDto({ ...round, dueDate: body.dueDate }, (await roundCounts(project.id)).get(round.id)));
});
