import { conflict, api, json } from '@/lib/http';
import { LIMITS, limitByIp } from '@/lib/rate-limit';
import { ownerContext } from '@/lib/team';
import { sendTestWebhook } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

/** Teszt-üzenet a beállított webhookra (csak a tulajdonos); az eredményt azonnal visszaadja. IP-nként 5/perc. */
export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  limitByIp(req, LIMITS.webhookTest);
  const { project } = await ownerContext(req, (await params).id);
  if (!project.webhookUrl) throw conflict('Nincs beállított webhook');
  return json(await sendTestWebhook(project));
});
