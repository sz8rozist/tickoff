import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import { recordActivity } from '@/lib/activity';
import { conflict, isDuplicateKey, api, json } from '@/lib/http';
import { findRound, roundCounts, roundDto, teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const { project } = await teamContext(req, (await params).id);
  const counts = await roundCounts(project.id);
  const rows = await db.select().from(schema.rounds).where(eq(schema.rounds.projectId, project.id)).orderBy(asc(schema.rounds.number));
  return json(rows.map((r) => roundDto(r, counts.get(r.id))));
});

/**
 * Új kört csak akkor lehet nyitni, ha az előző le van zárva: egyszerre egy nyitott kör van. A `carryOver=true` az előző kör nem
 * kész kommentjeit az új körbe viszi (a widget csak a nyitott kör kommentjeit mutatja, így az ügyfélnek nem kell újra
 * beküldenie a még meg nem oldottakat).
 */
export const POST = api<Ctx>(async (req, { params }) => {
  const { user, project } = await teamContext(req, (await params).id);
  const carryOver = new URL(req.url).searchParams.get('carryOver') === 'true';

  const [latest] = await db.select().from(schema.rounds).where(eq(schema.rounds.projectId, project.id)).orderBy(desc(schema.rounds.number)).limit(1);
  if (latest && latest.status === 'OPEN') throw conflict('Előbb zárd le a nyitott kört');
  const number = latest ? latest.number + 1 : 1;

  let roundId: number;
  try {
    roundId = await db.transaction(async (tx) => {
      const [result] = await tx.insert(schema.rounds).values({ projectId: project.id, number });
      if (carryOver && latest) {
        await tx
          .update(schema.comments)
          .set({ roundId: result.insertId })
          .where(and(eq(schema.comments.roundId, latest.id), ne(schema.comments.status, 'DONE')));
      }
      return result.insertId;
    });
  } catch (e) {
    // Párhuzamos kérés ugyanazzal a sorszámmal: az egyedi index (projekt, sorszám) elkapja.
    if (isDuplicateKey(e)) throw conflict('A kör időközben létrejött');
    throw e;
  }
  await recordActivity(project.id, 'USER', user.name, 'round.opened', null,
    `Megnyitotta a ${number}. kört${carryOver ? ' (a nem kész kommentek átvitelével)' : ''}`);
  const round = await findRound(project.id, roundId);
  return json(roundDto(round, (await roundCounts(project.id)).get(roundId)), 201);
});
