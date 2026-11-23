import { z } from 'zod';
import { verifyPassword } from '@/lib/auth/password';
import { conflict, forbidden, json, parseBody } from '@/lib/http';
import { limitByIp, limitByKey, LIMITS } from '@/lib/rate-limit';
import { widgetPreflight, widgetRoute } from '@/lib/widget';
import { issueWidgetAccess } from '@/lib/widget-access';

export const dynamic = 'force-dynamic';

const Body = z.object({ password: z.string().min(1).max(72) });

/**
 * A jelszóval védett widget feloldása: helyes jelszóra 12 órás hozzáférési tokent ad (X-Tickoff-Access fejléc). A találgatást
 * IP-nként és tokenenként is szigorú korlát fékezi. Védetlen projektnél nincs mit feloldani (409).
 */
export const POST = widgetRoute(
  'write',
  async ({ req, project, params }) => {
    limitByIp(req, LIMITS.widgetUnlockIp);
    limitByKey(params.token, LIMITS.widgetUnlockToken);
    if (!project.widgetPasswordHash) throw conflict('A widget nincs jelszóval védve');
    const body = await parseBody(req, Body);
    if (!(await verifyPassword(body.password, project.widgetPasswordHash))) throw forbidden('Hibás jelszó');
    return json({ accessToken: await issueWidgetAccess(project) });
  },
  { open: true },
);

export const OPTIONS = widgetPreflight;
