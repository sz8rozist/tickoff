import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { quote, recordActivity } from '@/lib/activity';
import { repliesByComment } from '@/lib/comments';
import { randomHex, sha256 } from '@/lib/crypto';
import { badRequest, conflict, json, parseBody } from '@/lib/http';
import { newCommentMail } from '@/lib/team-notifications';
import { publishWebhook, WebhookEvents } from '@/lib/webhooks';
import { EDIT_WINDOW_MS, openRound, sameOrigin, widgetCommentDto, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

/** A nyitott kör kommentjei (opcionálisan egy oldalra szűrve), hogy a widget ki tudja rajzolni a jelöléseket és a listát. */
export const GET = widgetRoute('read', async ({ req, project }) => {
  const round = await openRound(project);
  if (!round) return json([]);
  const pageUrl = new URL(req.url).searchParams.get('pageUrl');
  const rows = await db
    .select()
    .from(schema.comments)
    .where(pageUrl === null ? eq(schema.comments.roundId, round.id) : and(eq(schema.comments.roundId, round.id), eq(schema.comments.pageUrl, pageUrl)))
    .orderBy(asc(schema.comments.createdAt), asc(schema.comments.id));
  const replies = await repliesByComment(rows.map((c) => c.id));
  return json(rows.map((c) => widgetCommentDto(c, replies.get(c.id) ?? [])));
});

const Coord = z.number().min(0).max(1_000_000).nullish();

const Body = z.object({
  authorName: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4000),
  pageUrl: z.string().trim().min(1).max(1000),
  cssSelector: z.string().max(1000).nullish(),
  posX: Coord,
  posY: Coord,
  // A kijelölt terület mérete (az elem méretének százalékában); csak együtt értelmes
  areaWidth: Coord,
  areaHeight: Coord,
  viewportWidth: z.number().int().min(1).max(20000).nullish(),
  viewportHeight: z.number().int().min(1).max(20000).nullish(),
  // Opcionális: ide megy az értesítés, ha a csapat válaszol. Nem kerül vissza a widgetnek.
  customerEmail: z.email().max(254).nullish().or(z.literal('')),
});

/** Komment mentése a nyitott körbe → 201 (a szerkesztési titokkal és határidővel). 409, ha nincs nyitott kör. */
export const POST = widgetRoute('write', async ({ req, project }) => {
  const body = await parseBody(req, Body);
  const round = await openRound(project);
  if (!round) throw conflict('Nincs nyitott kör');
  if (!sameOrigin(body.pageUrl, project.siteUrl)) throw badRequest('Az oldal nem a projekthez tartozik');

  const email = body.customerEmail ? body.customerEmail.trim() : null;
  const editToken = randomHex(16);
  const userAgent = req.headers.get('user-agent');
  const hasArea = body.areaWidth != null && body.areaHeight != null;

  const commentId = await db.transaction(async (tx) => {
    const [result] = await tx.insert(schema.comments).values({
      roundId: round.id,
      authorName: body.authorName,
      body: body.body,
      pageUrl: body.pageUrl,
      cssSelector: body.cssSelector && body.cssSelector.trim() !== '' ? body.cssSelector.trim() : null,
      posX: body.posX ?? null,
      posY: body.posY ?? null,
      areaWidth: hasArea ? body.areaWidth! : null,
      areaHeight: hasArea ? body.areaHeight! : null,
      viewportWidth: body.viewportWidth ?? null,
      viewportHeight: body.viewportHeight ?? null,
      // A user agentet a fejlécből vesszük, nem a kliens által küldött törzsből
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
      customerEmail: email,
      notifyToken: email ? randomHex(16) : null,
      editTokenHash: sha256(editToken),
    });
    // Új, még nem kész komment: a kör korábbi jóváhagyása már nem érvényes
    await tx.update(schema.rounds).set({ approvedAt: null, approvedBy: null }).where(eq(schema.rounds.id, round.id));
    return result.insertId;
  });

  const [saved] = await db.select().from(schema.comments).where(eq(schema.comments.id, commentId)).limit(1);
  await recordActivity(project.id, 'CUSTOMER', saved.authorName, 'comment.created', saved.id, `Új visszajelzés: ${quote(saved.body)}`);
  void newCommentMail(project, saved);
  void publishWebhook(project, WebhookEvents.commentCreated,
    `[${project.name}] Új visszajelzés ${saved.authorName} tollából (${saved.pageUrl}):\n${saved.body.slice(0, 500)}`, saved, null);

  return json({ ...widgetCommentDto(saved, []), editToken, editableUntil: new Date(saved.createdAt.getTime() + EDIT_WINDOW_MS) }, 201);
});

export const OPTIONS = widgetPreflight;
