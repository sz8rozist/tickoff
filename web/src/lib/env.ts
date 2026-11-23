/**
 * A beállítások (környezeti változók) egy helyen. Az értékek hívásonként olvasódnak, így a build nem rögzíti őket.
 */

const DEV_SECRET_MARKER = 'dev-only-secret';
const MIN_SECRET_LENGTH = 32;

export function dashboardOrigin(): string {
  return (process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export function registrationEnabled(): boolean {
  return (process.env.TICKOFF_REGISTRATION_ENABLED ?? 'true') !== 'false';
}

/** A JWT aláírásának titka. Élesben a fejlesztői alapérték nem használható (ahogy a Java változatban sem). */
export function jwtSecret(): Uint8Array {
  const secret = process.env.TICKOFF_JWT_SECRET ?? 'dev-only-secret-change-me-in-production-32b';
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`A TICKOFF_JWT_SECRET legalább ${MIN_SECRET_LENGTH} karakter hosszú kell legyen (HS256)`);
  }
  if (process.env.NODE_ENV === 'production' && secret.includes(DEV_SECRET_MARKER)) {
    throw new Error('A fejlesztői JWT-titok élesben nem használható: állíts be egy saját TICKOFF_JWT_SECRET-et');
  }
  return new TextEncoder().encode(secret);
}

/** A bejelentkezési token élettartama másodpercben (alapból 12 óra). */
export function jwtTtlSeconds(): number {
  return Number(process.env.TICKOFF_JWT_TTL_SECONDS ?? 12 * 3600);
}

export function storageDir(): string {
  return process.env.TICKOFF_STORAGE_DIR ?? './data/screenshots';
}

export function rateLimitEnabled(): boolean {
  return (process.env.TICKOFF_RATE_LIMIT_ENABLED ?? 'true') !== 'false';
}
