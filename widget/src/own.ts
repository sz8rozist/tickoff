/**
 * Az ügyfél saját, nemrég küldött kommentjei. A szerver a komment létrehozásakor ad egy szerkesztési titkot, amellyel
 * rövid ideig módosítható vagy visszavonható a komment (fiók nélkül). A titkot a böngésző őrzi, a határidő után
 * eldobjuk.
 */
const KEY = 'tickoff.own';

type Own = Record<string, { token: string; until: number }>;

function read(): Own {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Own;
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v && typeof v.token === 'string' && v.until > now));
  } catch {
    return {};
  }
}

function write(own: Own) {
  try {
    localStorage.setItem(KEY, JSON.stringify(own));
  } catch {
    /* privát mód: a szerkesztés csak az oldal újratöltéséig lenne elérhető, ezért nem mentjük */
  }
}

export function rememberOwn(commentId: number, token: string | null | undefined, untilIso: string | null | undefined) {
  if (!token || !untilIso) return;
  const until = Date.parse(untilIso);
  if (!Number.isFinite(until)) return;
  write({ ...read(), [commentId]: { token, until } });
}

/** A komment szerkesztési titka, ha még érvényes (a saját komment, a határidőn belül). */
export function ownToken(commentId: number): string | null {
  return read()[commentId]?.token ?? null;
}

export function forgetOwn(commentId: number) {
  const own = read();
  delete own[commentId];
  write(own);
}
