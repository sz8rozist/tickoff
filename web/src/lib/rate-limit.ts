import type { NextRequest } from 'next/server';
import { rateLimitEnabled } from './env';
import { clientIp, HttpError } from './http';

/** Token-bucket korlát: `burst` kérés egyszerre, utána `perMinute` kérés percenként. */
export interface Limit {
  name: string;
  burst: number;
  perMinute: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * Memóriabeli kérésszám-korlát (egy folyamatra). A kulcsok száma korlátos: a legrégebben használtat dobjuk el, így egy
 * támadó sem tudja a memóriát feltölteni. Több példányos üzemeltetésnél közös tároló (pl. Redis) kellene.
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private maxKeys = 50_000) {}

  /** 0, ha a kérés mehet; különben a várakozási idő másodpercben (legalább 1). */
  tryAcquire(key: string, limit: Limit, now = Date.now()): number {
    const id = `${limit.name}:${key}`;
    const refillPerMs = limit.perMinute / 60_000;
    const existing = this.buckets.get(id);
    let tokens = limit.burst;
    if (existing) {
      tokens = Math.min(limit.burst, existing.tokens + (now - existing.updatedAt) * refillPerMs);
      this.buckets.delete(id); // újra beszúrva a legfrissebb helyre kerül (LRU)
    }
    let wait = 0;
    if (tokens >= 1) {
      tokens -= 1;
    } else {
      wait = Math.max(1, Math.ceil((1 - tokens) / refillPerMs / 1000));
    }
    this.buckets.set(id, { tokens, updatedAt: now });
    if (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) this.buckets.delete(oldest);
    }
    return wait;
  }
}

const shared = new RateLimiter();

/** A szabályok (a Java változat RateLimits osztályának megfelelői). */
export const LIMITS = {
  login: { name: 'login-ip', burst: 10, perMinute: 10 },
  register: { name: 'register-ip', burst: 5, perMinute: 5 },
  forgotPassword: { name: 'forgot-password-ip', burst: 5, perMinute: 5 },
  resetPassword: { name: 'reset-password-ip', burst: 10, perMinute: 10 },
  verifyEmail: { name: 'verify-email-ip', burst: 10, perMinute: 10 },
  resendVerification: { name: 'resend-verification-ip', burst: 5, perMinute: 5 },
  deleteAccount: { name: 'delete-account-ip', burst: 5, perMinute: 5 },
  invite: { name: 'invite-ip', burst: 20, perMinute: 20 },
  /** Címzettenként legfeljebb 10 levél egyszerre, utána percenként 1 (inbox- és SMTP-hírnév védelem). */
  notifyRecipient: { name: 'notify-recipient', burst: 10, perMinute: 1 },
  // Widget: durva IP-korlát minden kérésre; írás (komment, kép, válasz stb.); olvasás (projekt, kommentek)
  widgetCoarse: { name: 'widget-coarse-ip', burst: 200, perMinute: 300 },
  widgetWriteIp: { name: 'widget-write-ip', burst: 20, perMinute: 20 },
  widgetWriteToken: { name: 'widget-write-token', burst: 120, perMinute: 120 },
  widgetReadIp: { name: 'widget-read-ip', burst: 60, perMinute: 120 },
  widgetReadToken: { name: 'widget-read-token', burst: 120, perMinute: 600 },
  unsubscribe: { name: 'unsubscribe-ip', burst: 10, perMinute: 10 },
  // A teszt-webhook kimenő kérést indít a szerverről, ezért szigorúan korlátozzuk
  webhookTest: { name: 'webhook-test-ip', burst: 5, perMinute: 5 },
  apiV1: { name: 'api-v1-ip', burst: 60, perMinute: 60 },
  twoFactorUser: { name: 'two-factor-user', burst: 5, perMinute: 1 },
  login2fa: { name: 'login-2fa-ip', burst: 10, perMinute: 10 },
} satisfies Record<string, Limit>;

/** Nem dobó változat: igaz, ha a kérés mehet (a háttérben küldött értesítésekhez, ahol a túllépés csak kihagyást jelent). */
export function allow(key: string, limit: Limit): boolean {
  return shared.tryAcquire(key, limit) === 0;
}

/** IP-alapú korlát egy végponton: túllépésnél 429 és `Retry-After`. */
export function limitByIp(req: NextRequest, limit: Limit): void {
  if (!rateLimitEnabled()) return;
  const wait = shared.tryAcquire(clientIp(req), limit);
  if (wait > 0) {
    throw new HttpError(429, 'Túl sok kérés', { 'Retry-After': String(wait) });
  }
}

/** Tetszőleges kulcsú korlát (pl. fiókonként), amely magát a RateLimiter-t használja. */
export function limitByKey(key: string, limit: Limit): void {
  if (!rateLimitEnabled()) return;
  const wait = shared.tryAcquire(key, limit);
  if (wait > 0) throw new HttpError(429, 'Túl sok kérés', { 'Retry-After': String(wait) });
}
