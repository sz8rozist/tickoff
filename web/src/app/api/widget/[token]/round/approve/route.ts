import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { recordActivity } from '@/lib/activity';
import { conflict, json, parseBody } from '@/lib/http';
import { roundApprovedMail } from '@/lib/team-notifications';
import { publishWebhook, WebhookEvents } from '@/lib/webhooks';
import { openRound, roundInfo, widgetPreflight, widgetRoute } from '@/lib/widget';

export const dynamic = 'force-dynamic';

const Body = z.object({ authorName: z.string().trim().min(1).max(120) });

/** Az ügyfél jóváhagyja a nyitott kört: csak akkor, ha van komment, és mind kész (409 különben). */
export const POST = widgetRoute('write', async ({ req, project }) => {
  const body = await parseBody(req, Body);
  const round = await openRound(project);
  if (!round) throw conflict('Nincs nyitott kör');
  const list = await db.select({ status: schema.comments.status }).from(schema.comments).where(eq(schema.comments.roundId, round.id));
  if (list.length === 0 || list.some((c) => c.status !== 'DONE')) {
    throw conflict('Jóváhagyás előtt minden visszajelzésnek késznek kell lennie');
  }
  const approvedAt = new Date();
  await db.update(schema.rounds).set({ approvedAt, approvedBy: body.authorName }).where(eq(schema.rounds.id, round.id));
  const approved = { ...round, approvedAt, approvedBy: body.authorName };
  void roundApprovedMail(project, approved, body.authorName);
  await recordActivity(project.id, 'CUSTOMER', body.authorName, 'round.approved', null, `Jóváhagyta a ${round.number}. kört`);
  void publishWebhook(project, WebhookEvents.roundApproved,
    `[${project.name}] ${body.authorName} jóváhagyta a ${round.number}. kört: minden visszajelzés kész.`, null, approved);
  return json(roundInfo(approved));
});

export const OPTIONS = widgetPreflight;
