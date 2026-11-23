import { and, count, eq, gt, inArray, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import { dashboardOrigin } from './env';
import { isMailEnabled, sendMail } from './mail';
import { accessibleProjects, statsFor } from './projects';

/**
 * Napi vagy heti összefoglaló e-mail a felhasználóknak, akik kérték: a napi minden nap, a heti hétfőn megy (reggel 8-kor, a
 * beállított időzónában, lásd a scheduler). Csak akkor küldünk levelet, ha van mit mondani (nyitott vagy új visszajelzés,
 * jóváhagyott kör), hogy ne legyen üres levél. Az archivált projektek kimaradnak.
 */

const MIN_GAP_MS = 20 * 60 * 60 * 1000; // újraindítás után sem megy ki kétszer ugyanazon a napon

function zone(): string {
  return process.env.TICKOFF_EXPORT_ZONE ?? 'Europe/Budapest';
}

/** A hét napja a beállított időzónában ("Mon", "Tue", ...). */
export function weekdayIn(now: Date, tz = zone()): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
}

/** Elküldi a mai napon esedékes összefoglalókat. @returns a kiküldött levelek száma */
export async function sendDueDigests(now = new Date()): Promise<number> {
  if (!isMailEnabled()) return 0;
  const monday = weekdayIn(now) === 'Mon';
  const users = await db.select().from(schema.users).where(ne(schema.users.digestFrequency, 'OFF'));
  let sent = 0;
  for (const user of users) {
    const weekly = user.digestFrequency === 'WEEKLY';
    if (weekly && !monday) continue;
    if (user.digestLastSentAt && now.getTime() - user.digestLastSentAt.getTime() < MIN_GAP_MS) continue;
    const since = user.digestLastSentAt ?? new Date(now.getTime() - (weekly ? 7 : 1) * 24 * 60 * 60 * 1000);
    const en = user.lang === 'en';
    const text = await composeDigest(user.id, user.name, since, en);
    if (text) {
      sendMail(user.email, en ? '[Tickoff] Summary of your projects' : '[Tickoff] Összefoglaló a projektjeidről', text);
      await db.update(schema.users).set({ digestLastSentAt: now }).where(eq(schema.users.id, user.id));
      sent++;
    }
  }
  return sent;
}

/** A levél szövege, vagy null, ha nincs mit mondani. */
export async function composeDigest(userId: number, userName: string, since: Date, en = false): Promise<string | null> {
  const active = (await accessibleProjects(userId)).map((r) => r.project).filter((p) => p.archivedAt === null);
  if (active.length === 0) return null;
  const ids = active.map((p) => p.id);

  const stats = await statsFor(ids);
  const fresh = new Map(
    (
      await db
        .select({ projectId: schema.rounds.projectId, total: count() })
        .from(schema.comments)
        .innerJoin(schema.rounds, eq(schema.rounds.id, schema.comments.roundId))
        .where(and(inArray(schema.rounds.projectId, ids), gt(schema.comments.createdAt, since)))
        .groupBy(schema.rounds.projectId)
    ).map((r) => [r.projectId, r.total]),
  );
  const openRounds = new Map(
    (await db.select().from(schema.rounds).where(and(inArray(schema.rounds.projectId, ids), eq(schema.rounds.status, 'OPEN')))).map((r) => [r.projectId, r]),
  );

  let body = '';
  for (const p of active) {
    const s = stats.get(p.id);
    const news = fresh.get(p.id) ?? 0;
    const open = s?.open ?? 0;
    const inProgress = s?.inProgress ?? 0;
    const approved = s?.approved ?? false;
    if (open === 0 && inProgress === 0 && news === 0 && !approved) continue;

    body += en
      ? `• ${p.name}\n  ${open} open, ${inProgress} in progress${news > 0 ? `, ${news} new recently` : ''}\n`
      : `• ${p.name}\n  ${open} nyitott, ${inProgress} folyamatban${news > 0 ? `, ${news} új az utóbbi időben` : ''}\n`;
    if (approved && s?.roundNumber != null) body += en ? `  The customer approved round ${s.roundNumber}: you can close it.\n` : `  Az ügyfél jóváhagyta a ${s.roundNumber}. kört: lezárhatod.\n`;
    const due = openRounds.get(p.id)?.dueDate;
    if (due) body += en ? `  Due: ${due}\n` : `  Határidő: ${due}\n`;
    body += '\n';
  }
  if (body === '') return null;
  return en
    ? `Hi ${userName}!\n\nHere is where your projects stand:\n\n${body}Open: ${dashboardOrigin()}/\n\n` +
        'You receive this summary because you asked for it in Tickoff. You can change the frequency or turn it off in Settings.\n'
    : `Szia ${userName}!\n\nÍgy állnak a projektjeid:\n\n${body}Megnyitás: ${dashboardOrigin()}/\n\n` +
        'Ezt az összefoglalót azért kapod, mert a Tickoffban kérted. A gyakoriságot a Beállításokban módosíthatod vagy kapcsolhatod ki.\n';
}
