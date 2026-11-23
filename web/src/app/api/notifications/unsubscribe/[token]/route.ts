import { and, eq, inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { api } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const PAGE = (lang: 'hu' | 'en') => {
  const hu = lang === 'hu';
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${hu ? 'Leiratkozás' : 'Unsubscribed'}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f6fb;color:#1f2140}
main{max-width:420px;padding:32px;margin:16px;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(31,33,64,.12)}
h1{margin:0 0 8px;font-size:20px}p{margin:0;color:#5a5f86;line-height:1.5}</style></head>
<body><main><h1>${hu ? 'Leiratkoztál' : 'You have been unsubscribed'}</h1>
<p>${hu
    ? 'Erre az e-mail-címre többé nem küldünk értesítést ehhez a visszajelzéshez. Ha a link már korábban felhasználásra került, nincs további teendőd.'
    : 'We will no longer send notifications to this email address for this feedback. If the link was already used, there is nothing more to do.'}</p></main></body></html>`;
};

/**
 * Leiratkozás az ügyfélnek küldött értesítésekről. A levélben szereplő link titka azonosít egy kommentet; a link megnyitása
 * törli a hozzá tartozó e-mail-címet. A válasz mindig ugyanaz az egyszerű oldal, akár volt ilyen feliratkozás, akár nem
 * (érvénytelen vagy már felhasznált link); a nyelv a projekt beállítása szerinti.
 */
export const GET = api<{ params: Promise<{ token: string }> }>(async (req: NextRequest, { params }) => {
  limitByIp(req, LIMITS.unsubscribe);
  const { token } = await params;
  let lang: 'hu' | 'en' = 'hu';
  if (token.length === 32) {
    const [found] = await db
      .select({ id: schema.comments.id, lang: schema.projects.widgetLang, projectId: schema.projects.id, email: schema.comments.customerEmail })
      .from(schema.comments)
      .innerJoin(schema.rounds, eq(schema.rounds.id, schema.comments.roundId))
      .innerJoin(schema.projects, eq(schema.projects.id, schema.rounds.projectId))
      .where(eq(schema.comments.notifyToken, token))
      .limit(1);
    if (found) {
      lang = found.lang === 'en' ? 'en' : 'hu';
      await db.update(schema.comments).set({ customerEmail: null, notifyToken: null }).where(eq(schema.comments.id, found.id));
      // Ugyanez a cím a projekt többi kommentjén is: a leiratkozás az ügyfélre vonatkozik a projektben, nem egy kommentre
      if (found.email) {
        const roundIds = (await db.select({ id: schema.rounds.id }).from(schema.rounds).where(eq(schema.rounds.projectId, found.projectId))).map((r) => r.id);
        if (roundIds.length > 0) {
          await db
            .update(schema.comments)
            .set({ customerEmail: null, notifyToken: null })
            .where(and(inArray(schema.comments.roundId, roundIds), eq(schema.comments.customerEmail, found.email)));
        }
      }
    }
  }
  return new Response(PAGE(lang), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
});
