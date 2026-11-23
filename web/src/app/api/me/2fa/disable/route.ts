import { z } from 'zod';
import { verifyPassword } from '@/lib/auth/password';
import { requireUser } from '@/lib/auth/session';
import { disable } from '@/lib/auth/two-factor';
import { api, badRequest, forbidden, noContent, parseBody } from '@/lib/http';

export const dynamic = 'force-dynamic';

const Body = z.object({ password: z.string().min(1), code: z.string().trim().min(1).max(40) });

/** Kikapcsolás a jelszóval és egy érvényes kóddal (hitelesítő vagy helyreállító). Hibás jelszóra 403, hibás kódra 400. */
export const POST = api(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, Body);
  if (!(await verifyPassword(body.password, user.passwordHash))) throw forbidden('Hibás jelszó');
  if (!(await disable(user.id, body.code))) throw badRequest('Hibás kód');
  return noContent();
});
