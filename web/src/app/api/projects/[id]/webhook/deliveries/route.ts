import { api, json } from '@/lib/http';
import { ownerContext } from '@/lib/team';
import { recentDeliveries } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

/** A webhook legutóbbi kézbesítései (csak a tulajdonos): esemény, eredmény, próbálkozások száma, utolsó hiba. */
export const GET = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { project } = await ownerContext(req, (await params).id);
  const rows = await recentDeliveries(project.id);
  return json(
    rows.map((d) => ({
      id: d.id,
      event: d.event,
      ok: d.ok,
      attempts: d.attempts,
      status: d.lastStatus,
      error: d.lastError,
      createdAt: d.createdAt.toISOString(),
    })),
  );
});
