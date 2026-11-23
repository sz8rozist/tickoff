import { jwtVerify, SignJWT } from 'jose';
import { jwtSecret, jwtTtlSeconds } from '../env';

/** A kétlépcsős belépés "kihívás" tokenjének célja: ez a token API-hívásra nem jó. */
export const CHALLENGE_PURPOSE = 'two-factor';
const CHALLENGE_TTL_SECONDS = 5 * 60;

export interface AccessClaims {
  userId: number;
  /** A token kiadásának ideje (másodperc, epoch). */
  issuedAt: number;
}

/** Bejelentkezési (hozzáférési) token: HS256, a subject a felhasználó azonosítója. */
export async function issueAccessToken(userId: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('tickoff')
    .setSubject(String(userId))
    .setIssuedAt(now)
    .setExpirationTime(now + jwtTtlSeconds())
    .sign(jwtSecret());
}

/** A hozzáférési token ellenőrzése. A kihívás tokent (purpose claim) elutasítja. Érvénytelen tokenre null. */
export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ['HS256'], issuer: 'tickoff' });
    if (payload.purpose !== undefined) return null;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || typeof payload.iat !== 'number') return null;
    return { userId, issuedAt: payload.iat };
  } catch {
    return null;
  }
}

/** A jelszó ellenőrzése után kiadott, 5 percig érvényes kihívás a második lépéshez. */
export async function issueChallenge(userId: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ purpose: CHALLENGE_PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('tickoff')
    .setSubject(String(userId))
    .setIssuedAt(now)
    .setExpirationTime(now + CHALLENGE_TTL_SECONDS)
    .sign(jwtSecret());
}

/** A kihívásból a felhasználó azonosítója, ha érvényes és lejáratlan. */
export async function verifyChallenge(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ['HS256'], issuer: 'tickoff' });
    if (payload.purpose !== CHALLENGE_PURPOSE) return null;
    const userId = Number(payload.sub);
    return Number.isInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}
