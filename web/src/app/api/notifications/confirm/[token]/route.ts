import { and, eq, isNull } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { api } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

type Lang = 'hu' | 'en';

const TEXT = {
  hu: {
    askTitle: 'E-mail-cím megerősítése',
    askBody: 'Erősítsd meg, hogy ezen a címen értesítést szeretnél kapni a visszajelzésedről (válaszról, elkészült javításról).',
    askButton: 'Megerősítés',
    doneTitle: 'Megerősítve',
    doneBody: 'Köszönjük! Ezentúl ezen a címen értesítünk a visszajelzésed állapotáról. Ha a link érvénytelen vagy már felhasználták, nincs további teendőd.',
  },
  en: {
    askTitle: 'Confirm your email address',
    askBody: 'Please confirm that you want to receive notifications about your feedback (replies, finished fixes) at this address.',
    askButton: 'Confirm',
    doneTitle: 'Confirmed',
    doneBody: 'Thank you! We will now notify you about your feedback at this address. If the link was invalid or already used, there is nothing more to do.',
  },
} as const;

function page(lang: Lang, state: 'ask' | 'done'): string {
  const t = TEXT[lang];
  const title = state === 'ask' ? t.askTitle : t.doneTitle;
  const body = state === 'ask' ? t.askBody : t.doneBody;
  const form = state === 'ask' ? `<form method="post"><button type="submit">${t.askButton}</button></form>` : '';
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f8fafc;color:#111827}
main{max-width:420px;padding:32px;margin:16px;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(17,24,39,.12)}
h1{margin:0 0 8px;font-size:20px}p{margin:0 0 16px;color:#64748b;line-height:1.5}
button{font:inherit;font-weight:500;background:#2563eb;color:#fff;border:0;border-radius:10px;padding:10px 18px;cursor:pointer}</style></head>
<body><main><h1>${title}</h1><p>${body}</p>${form}</main></body></html>`;
}

const HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

async function findComment(token: string) {
  if (token.length !== 32) return null;
  const [found] = await db
    .select({ id: schema.comments.id, lang: schema.projects.widgetLang })
    .from(schema.comments)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.comments.roundId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.rounds.projectId))
    .where(eq(schema.comments.notifyToken, token))
    .limit(1);
  return found ?? null;
}

/**
 * Az ügyfél címének megerősítése. A levélben szereplő link csak megerősítő oldalt nyit (GET nem módosít semmit), így a
 * levélkezelők és víruskeresők előolvasása nem erősíti meg a címet; a gomb POST-ot küld. A válasz akkor is ugyanaz az
 * egyszerű oldal, ha a token érvénytelen (nem derül ki, hogy létezik-e).
 */
export const GET = api<{ params: Promise<{ token: string }> }>(async (req: NextRequest, { params }) => {
  limitByIp(req, LIMITS.confirmEmail);
  const found = await findComment((await params).token);
  return new Response(page(found?.lang === 'en' ? 'en' : 'hu', 'ask'), { headers: HEADERS });
});

export const POST = api<{ params: Promise<{ token: string }> }>(async (req: NextRequest, { params }) => {
  limitByIp(req, LIMITS.confirmEmail);
  const found = await findComment((await params).token);
  if (found) {
    await db
      .update(schema.comments)
      .set({ customerEmailVerifiedAt: new Date() })
      .where(and(eq(schema.comments.id, found.id), isNull(schema.comments.customerEmailVerifiedAt)));
  }
  return new Response(page(found?.lang === 'en' ? 'en' : 'hu', 'done'), { headers: HEADERS });
});
