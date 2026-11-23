import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';
import type { Project } from './access';
import { sha256 } from './crypto';
import { jwtSecret } from './env';
import { HttpError } from './http';

/**
 * Jelszavas widget-hozzáférés. Ha a projektnek van widget-jelszava, a widget végpontjai csak érvényes hozzáférési tokennel
 * (X-Tickoff-Access fejléc) válaszolnak; a tokent a jelszó megadása után kapja a widget (POST /unlock). A token a projektre
 * szól, 12 óráig érvényes, és a jelszó cseréjekor érvényét veszti (a jelszó-hash ujjlenyomata benne van). A felhasználói
 * bejelentkezési tokenektől külön kibocsátó és cél miatt nem összetéveszthető.
 */

export const WIDGET_ACCESS_HEADER = 'X-Tickoff-Access';
const TTL_SECONDS = 12 * 60 * 60;
const ISSUER = 'tickoff-widget';

const fingerprint = (hash: string) => sha256(hash).slice(0, 16);

export async function issueWidgetAccess(project: Project): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ purpose: 'widget-access', pv: fingerprint(project.widgetPasswordHash ?? '') })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setSubject(String(project.id))
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .sign(jwtSecret());
}

/** Igaz, ha a projekt nincs jelszóval védve, vagy a kérés érvényes hozzáférési tokent hordoz. */
export async function isWidgetUnlocked(req: NextRequest, project: Project): Promise<boolean> {
  if (!project.widgetPasswordHash) return true;
  const token = req.headers.get(WIDGET_ACCESS_HEADER);
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ['HS256'], issuer: ISSUER });
    return payload.purpose === 'widget-access' && payload.sub === String(project.id) && payload.pv === fingerprint(project.widgetPasswordHash);
  } catch {
    return false;
  }
}

/** 401, ha a védett widget nincs feloldva. */
export async function requireWidgetAccess(req: NextRequest, project: Project): Promise<void> {
  if (!(await isWidgetUnlocked(req, project))) throw new HttpError(401, 'A widget jelszóval védett');
}
