import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { recordActivity } from '@/lib/activity';
import { sha256 } from '@/lib/crypto';
import { conflict, isDuplicateKey, json, parseBody } from '@/lib/http';
import { publishWebhook, WebhookEvents } from '@/lib/webhooks';
import { openRound, roundInfoFull, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

const Body = z.object({ authorName: z.string().trim().min(1).max(120), pageUrl: z.string().min(1).max(1000) });

/**
 * Az ügyfél jóváhagyja egy oldal visszajelzéseit a nyitott körben: csak akkor, ha az oldalnak van kommentje, és mind kész
 * (409 különben). A teljes kör jóváhagyása ettől független marad. Ismételt jóváhagyás nem hiba (a kör állapotát adja vissza).
 */
export const POST = widgetRoute('write', async ({ req, project }) => {
  const body = await parseBody(req, Body);
  const round = await openRound(project);
  if (!round) throw conflict('Nincs nyitott kör');
  const list = await db
    .select({ status: schema.comments.status })
    .from(schema.comments)
    .where(and(eq(schema.comments.roundId, round.id), eq(schema.comments.pageUrl, body.pageUrl)));
  if (list.length === 0 || list.some((c) => c.status !== 'DONE')) {
    throw conflict('Jóváhagyás előtt az oldal minden visszajelzésének késznek kell lennie');
  }
  try {
    await db.insert(schema.pageApprovals).values({ roundId: round.id, pageUrl: body.pageUrl, pageHash: sha256(body.pageUrl), approvedBy: body.authorName });
    await recordActivity(project.id, 'CUSTOMER', body.authorName, 'page.approved', null, `Jóváhagyta az oldalt: ${body.pageUrl}`);
    void publishWebhook(project, WebhookEvents.pageApproved, `[${project.name}] ${body.authorName} jóváhagyta az oldalt: ${body.pageUrl}`, null, round);
  } catch (e) {
    if (!isDuplicateKey(e)) throw e;
  }
  return json(await roundInfoFull(round));
});

export const OPTIONS = widgetPreflight;
