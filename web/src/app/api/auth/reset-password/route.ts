import { z } from 'zod';
import { resetPassword } from '@/lib/auth/password-reset';
import { api, badRequest, noContent, parseBody } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

const Body = z.object({ token: z.string().trim().min(1).max(200), password: z.string().min(8).max(72) });

export const dynamic = 'force-dynamic';

/** Új jelszó beállítása az e-mailben kapott tokennel. Érvénytelen, lejárt vagy már használt tokenre 400. */
export const POST = api(async (req) => {
  limitByIp(req, LIMITS.resetPassword);
  const body = await parseBody(req, Body);
  if (!(await resetPassword(body.token, body.password))) throw badRequest('Érvénytelen vagy lejárt link');
  return noContent();
});
