import { sendVerification } from '@/lib/auth/email-verification';
import { requireUser } from '@/lib/auth/session';
import { api, noContent } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Új megerősítő levél kérése (percenként legfeljebb egy megy el; megerősített fióknál nem történik semmi). */
export const POST = api(async (req) => {
  limitByIp(req, LIMITS.resendVerification);
  const user = await requireUser(req);
  await sendVerification(user.id);
  return noContent();
});
