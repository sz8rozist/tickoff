import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Nem létező felhasználónál is ezzel számolunk, így a válaszidő nem árulja el, hogy létezik-e az e-mail.
 * Lustán készül (az első bejelentkezési kísérletnél), hogy az indulást ne lassítsa.
 */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= bcrypt.hash('tickoff-dummy-password', ROUNDS);
  return dummyHash;
}
