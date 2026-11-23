import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { statusLabel, repliesByComment } from '@/lib/comments';
import { CsvWriter, slug } from '@/lib/csv';
import { api, notFound } from '@/lib/http';
import { findRound, teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

const ZONE = () => process.env.TICKOFF_EXPORT_ZONE ?? 'Europe/Budapest';

function formatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: ZONE(), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * A projekt kommentjeinek exportja CSV-ben (magyar Excelhez: pontosvessző, UTF-8 BOM). A `roundId` megadásával egyetlen kör
 * kommentjei kerülnek bele.
 */
export const GET = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { project } = await teamContext(req, (await params).id);
  const roundParam = new URL(req.url).searchParams.get('roundId');
  let roundNumber: number | null = null;
  let roundFilter: number | null = null;
  if (roundParam !== null) {
    const round = await findRound(project.id, Number(roundParam)).catch(() => {
      throw notFound();
    });
    roundFilter = round.id;
    roundNumber = round.number;
  }

  const rows = await db
    .select({ comment: schema.comments, roundNumber: schema.rounds.number, assignee: schema.users.name })
    .from(schema.comments)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.comments.roundId))
    .leftJoin(schema.users, eq(schema.users.id, schema.comments.assigneeId))
    .where(eq(schema.rounds.projectId, project.id))
    .orderBy(asc(schema.rounds.number), asc(schema.comments.createdAt), asc(schema.comments.id));
  const exported = rows.filter((r) => roundFilter === null || r.comment.roundId === roundFilter);
  const replies = await repliesByComment(exported.map((r) => r.comment.id), true);

  const fmt = formatter();
  const csv = new CsvWriter().row([
    'Kör', 'Oldal', 'Szerző', 'Szöveg', 'Státusz', 'Elem (selector)', 'Viewport', 'Böngésző', 'Létrehozva', 'Válaszok', 'Felelős', 'Prioritás', 'Címkék',
  ]);
  for (const { comment: c, roundNumber: n, assignee } of exported) {
    csv.row([
      String(n),
      c.pageUrl,
      c.authorName,
      c.body,
      statusLabel(c.status),
      c.cssSelector ?? '',
      c.viewportWidth !== null && c.viewportHeight !== null ? `${c.viewportWidth}x${c.viewportHeight}` : '',
      c.userAgent ?? '',
      fmt.format(c.createdAt),
      // A szál egy cellában, időrendben: "Név (csapat): szöveg" sorokban
      (replies.get(c.id) ?? []).map((r) => `${r.authorName}${r.authorType === 'DESIGNER' ? (r.internal ? ' (belső)' : ' (csapat)') : ''}: ${r.body}`).join('\n'),
      assignee ?? '',
      c.priority,
      c.labels.split(',').filter(Boolean).join(', '),
    ]);
  }

  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONE(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, '');
  const filename = `tickoff-${slug(project.name)}${roundNumber !== null ? `-kor${roundNumber}` : ''}-${today}.csv`;
  return new Response(new Uint8Array(csv.toBuffer()), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});
