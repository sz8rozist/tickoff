import { z } from 'zod';
import { requestPasswordReset } from '@/lib/auth/password-reset';
import { api, noContent, parseBody } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

const Body = z.object({ email: z.email().max(255) });

export const dynamic = 'force-dynamic';

/**
 * Visszaállító link kérése. A válasz mindig ugyanaz (204), akár van ilyen fiók, akár nincs, és akár működik az
 * e-mail-küldés, akár nem: a végpontból így nem derül ki, kinek van fiókja.
 */
export const POST = api(async (req) => {
  limitByIp(req, LIMITS.forgotPassword);
  const body = await parseBody(req, Body);
  await requestPasswordReset(body.email);
  return noContent();
});
