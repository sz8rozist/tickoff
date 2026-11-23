import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** SHA-256 hex: a tokeneket csak hash-ként tároljuk. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Véletlen, URL-barát token (alapból 256 bit). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Véletlen hex-karakterlánc (a megadott bájtszámból). */
export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/** Időzítés-biztos szöveg-összehasonlítás. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
