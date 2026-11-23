import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Időalapú egyszer használatos kódok (TOTP, RFC 6238): HMAC-SHA1, 30 másodperces időszelet, 6 jegyű kód. Az authenticator
 * alkalmazások (Google Authenticator, Authy, 1Password stb.) ezt a változatot használják.
 */

const STEP_SECONDS = 30;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Új véletlen titok (160 bit), base32-ben. */
export function newSecret(): string {
  return base32Encode(randomBytes(20));
}

export function base32Encode(data: Buffer): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of data) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const c of clean) {
    const v = BASE32.indexOf(c);
    if (v < 0) throw new Error('Érvénytelen base32 karakter');
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A 6 jegyű kód az adott időszeletre. */
export function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = ((hash[offset] & 0x7f) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

/**
 * Ellenőrzi a kódot az aktuális és a szomszédos időszeletre (±1: az órák kis eltérése miatt). A találat időszeletét adja
 * vissza, vagy -1-et, ha nincs egyezés.
 */
export function verifyCode(secret: string, candidate: string, nowMs = Date.now()): number {
  if (!/^\d{6}$/.test(candidate)) return -1;
  const current = Math.floor(nowMs / 1000 / STEP_SECONDS);
  for (let step = current - 1; step <= current + 1; step++) {
    const expected = Buffer.from(codeAt(secret, step));
    const given = Buffer.from(candidate);
    if (expected.length === given.length && timingSafeEqual(expected, given)) return step;
  }
  return -1;
}

/** Az authenticator alkalmazás számára beolvasható cím (QR-kódba kerül). */
export function otpauthUri(issuer: string, account: string, secret: string): string {
  return (
    `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`
  );
}
