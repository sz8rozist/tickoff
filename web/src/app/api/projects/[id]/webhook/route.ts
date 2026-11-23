import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { idParam, requireOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth/session';
import { randomHex } from '@/lib/crypto';
import { api, badRequest, json, parseBody } from '@/lib/http';
import { loadProjectDto } from '@/lib/projects';
import { validateWebhookUrl, WebhookUrlError } from '@/lib/webhook-url';

export const dynamic = 'force-dynamic';

const Body = z.object({ url: z.string().max(500).nullish() });

/**
 * A webhook beállítása vagy kikapcsolása (csak a tulajdonos). A cím csak nyilvános https-cím lehet (SSRF ellen); érvénytelen
 * címre 400. A titok (a kérések aláírásához) az első beállításkor jön létre, és megmarad. Üres cím kikapcsolja.
 */
export const PUT = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const project = await requireOwner(idParam((await params).id), user.id);
  const body = await parseBody(req, Body);
  const url = body.url && body.url.trim() !== '' ? body.url.trim() : null;

  let patch: { webhookUrl: string | null; webhookSecret: string | null };
  if (url === null) {
    patch = { webhookUrl: null, webhookSecret: null };
  } else {
    try {
      await validateWebhookUrl(url);
    } catch (e) {
      if (e instanceof WebhookUrlError) throw badRequest(e.message);
      throw e;
    }
    patch = { webhookUrl: url, webhookSecret: project.webhookSecret ?? randomHex(16) };
  }
  await db.update(schema.projects).set(patch).where(eq(schema.projects.id, project.id));
  return json(await loadProjectDto({ ...project, ...patch }, user.id));
});
