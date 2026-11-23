import { randomBytes } from 'node:crypto';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import { sha256 } from '../crypto';
import { conflict } from '../http';
import { LIMITS, limitByKey } from '../rate-limit';
import type { User } from './session';
import { newSecret, otpauthUri, verifyCode } from './totp';

/**
 * Kétlépcsős belépés (TOTP) kezelése: bekapcsolás (titok + megerősítő kód), belépéskori ellenőrzés, kikapcsolás.
 * - Egy kód csak egyszer használható (a legutóbb elfogadott időszeletnél nem újabb kód elutasítva): lehallgatott kóddal nem
 *   lehet újra belépni.
 * - 8 helyreállító kód készül (egyszer használatosak, csak a hash-ük van tárolva), ha elvész a telefon.
 * - A találgatás ellen felhasználónként 5 próbálkozás egyszerre, utána percenként 1 (429).
 */

const ISSUER = 'Tickoff';
const RECOVERY_CODES = 8;

function attempt(userId: number): void {
  limitByKey(String(userId), LIMITS.twoFactorUser);
}

/** A helyreállító kód hash-e (kisbetűs, szóköz nélküli alakból). */
function hashRecovery(code: string): string {
  return sha256(code.toLowerCase().replace(/\s+/g, ''));
}

function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODES }, () => {
    const hex = randomBytes(5).toString('hex'); // 10 hex karakter
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
}

async function loadUser(userId: number): Promise<User> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) throw conflict('Ismeretlen felhasználó');
  return user;
}

/** Új titkot készít a felhasználónak (még nincs bekapcsolva: a megerősítő kód után él). */
export async function startSetup(user: User): Promise<{ secret: string; otpauthUri: string }> {
  if (user.totpEnabledAt) throw conflict('A kétlépcsős belépés már be van kapcsolva');
  const secret = newSecret();
  await db.update(schema.users).set({ totpSecret: secret }).where(eq(schema.users.id, user.id));
  return { secret, otpauthUri: otpauthUri(ISSUER, user.email, secret) };
}

/** Megerősíti a beállítást a kóddal, bekapcsolja, és visszaadja az egyszeri helyreállító kódokat (null: hibás kód). */
export async function enable(userId: number, code: string): Promise<string[] | null> {
  const user = await loadUser(userId);
  if (user.totpEnabledAt || !user.totpSecret) throw conflict('Nincs megerősítésre váró beállítás');
  attempt(userId);
  const step = verifyCode(user.totpSecret, code);
  if (step < 0) return null;
  const recovery = newRecoveryCodes();
  await db
    .update(schema.users)
    .set({ totpEnabledAt: new Date(), totpLastStep: step, totpRecoveryHashes: recovery.map(hashRecovery).join(',') })
    .where(eq(schema.users.id, userId));
  return recovery;
}

/** Belépéskori ellenőrzés: TOTP-kód vagy helyreállító kód. Igaz, ha elfogadva. A túl sok próbálkozás 429-et dob. */
export async function verifyLogin(userId: number, codeOrRecovery: string): Promise<boolean> {
  attempt(userId);
  return check(await loadUser(userId), codeOrRecovery);
}

async function check(user: User, codeOrRecovery: string): Promise<boolean> {
  const candidate = (codeOrRecovery ?? '').trim();
  if (!user.totpSecret) return false;
  if (/^\d{6}$/.test(candidate)) {
    const step = verifyCode(user.totpSecret, candidate);
    if (step < 0) return false;
    // A már felhasznált vagy régebbi időszelet nem fogadható el újra (feltételes frissítés: párhuzamos kérés sem nyerhet)
    const result = await db
      .update(schema.users)
      .set({ totpLastStep: step })
      .where(and(eq(schema.users.id, user.id), or(isNull(schema.users.totpLastStep), lt(schema.users.totpLastStep, step))));
    return result[0].affectedRows === 1;
  }
  return consumeRecoveryCode(user, candidate);
}

async function consumeRecoveryCode(user: User, candidate: string): Promise<boolean> {
  const stored = user.totpRecoveryHashes;
  if (!stored) return false;
  const hash = hashRecovery(candidate);
  const hashes = stored.split(',');
  if (!hashes.includes(hash)) return false;
  const remaining = hashes.filter((h) => h !== hash).join(',');
  // Optimista zárolás: csak akkor írjuk át, ha közben nem változott (egy kód kétszer nem használható fel)
  const result = await db
    .update(schema.users)
    .set({ totpRecoveryHashes: remaining })
    .where(and(eq(schema.users.id, user.id), eq(schema.users.totpRecoveryHashes, stored)));
  return result[0].affectedRows === 1;
}

/** Kikapcsolás: a jelszót a hívó ellenőrzi, itt a kódot (TOTP vagy helyreállító). Igaz, ha kikapcsolva. */
export async function disable(userId: number, codeOrRecovery: string): Promise<boolean> {
  const user = await loadUser(userId);
  if (!user.totpEnabledAt) return true;
  attempt(userId);
  if (!(await check(user, codeOrRecovery))) return false;
  await db
    .update(schema.users)
    .set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryHashes: null })
    .where(eq(schema.users.id, userId));
  return true;
}
