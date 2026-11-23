import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { enable } from '@/lib/auth/two-factor';
import { api, badRequest, json, parseBody } from '@/lib/http';

export const dynamic = 'force-dynamic';

const Body = z.object({ code: z.string().trim().min(1).max(40) });

/** Bekapcsolás a hitelesítő alkalmazás első kódjával; a válasz az egyszeri helyreállító kódokat tartalmazza. Hibás kódra 400. */
export const POST = api(async (req) => {
  const user = await requireUser(req);
  const body = await parseBody(req, Body);
  const codes = await enable(user.id, body.code);
  if (!codes) throw badRequest('Hibás kód');
  return json({ recoveryCodes: codes });
});
