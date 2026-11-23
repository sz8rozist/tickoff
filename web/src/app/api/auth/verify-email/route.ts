import { z } from 'zod';
import { verifyEmail } from '@/lib/auth/email-verification';
import { api, badRequest, noContent, parseBody } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

const Body = z.object({ token: z.string().trim().min(1).max(200) });

export const dynamic = 'force-dynamic';

/** A regisztrációkor kapott linkkel megerősíti az e-mail-címet. Érvénytelen vagy lejárt tokenre 400. */
export const POST = api(async (req) => {
  limitByIp(req, LIMITS.verifyEmail);
  const body = await parseBody(req, Body);
  if (!(await verifyEmail(body.token))) throw badRequest('Érvénytelen vagy lejárt link');
  return noContent();
});
