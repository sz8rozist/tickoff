import { createHmac } from 'node:crypto';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { Project } from './access';
import type { Comment, Round } from './comments';
import { allowPrivateWebhooks, isInternalAddress, validateWebhookUrl, WebhookUrlError } from './webhook-url';

/** A webhook-ként küldhető események. */
export const WebhookEvents = {
  commentCreated: 'comment.created',
  replyCreated: 'reply.created',
  commentReopened: 'comment.reopened',
  roundApproved: 'round.approved',
  test: 'test',
} as const;

/**
 * Webhook-kézbesítés. A tartalom úgy van összeállítva, hogy a Slack (`text`) és a Discord (`content`) bejövő webhookja is
 * közvetlenül elfogadja, saját fogadónak pedig a strukturált mezők (`event`, `project`, `comment`, `round`) szolgálnak.
 *
 * Biztonság (SSRF): a cím csak nyilvános lehet (lásd validateWebhookUrl), és a kapcsolódáskor feloldott címet is ellenőrizzük
 * (a `lookup` itt fut le, közvetlenül a csatlakozás előtt), így a DNS-rebinding (a név közben belső címre vált) nem működik.
 * Nincs átirányítás-követés, a kapcsolat és a válasz ideje korlátos, a válasz törzsét nem olvassuk. Újrapróbálkozás nincs:
 * a webhook "legjobb szándékú" értesítés. A cím gyakran titkot tartalmaz, ezért a naplóba sosem kerül.
 */

const TEXT_LIMIT = 1800; // a Discord 2000 karakteres korlátja alatt
const TIMEOUT_MS = 8000;
const MAX_IN_FLIGHT = 50;
let inFlight = 0;

export interface WebhookResult {
  ok: boolean;
  status: number;
  error: string | null;
}

export function webhookPayload(project: Project, event: string, text: string, comment: Comment | null, round: Round | null): string {
  const clipped = text.length <= TEXT_LIMIT ? text : text.slice(0, TEXT_LIMIT) + '…';
  return JSON.stringify({
    event,
    text: clipped,
    content: clipped,
    timestamp: new Date().toISOString(),
    project: { id: project.id, name: project.name },
    ...(comment ? { comment: { id: comment.id, author: comment.authorName, body: comment.body, pageUrl: comment.pageUrl, status: comment.status } } : {}),
    ...(round ? { round: { number: round.number } } : {}),
  });
}

/** HMAC-SHA256 hex: a fogadó ugyanezzel számolhatja ki a várt aláírást a nyers törzsből. */
export function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

/** Csatlakozáskor feloldott cím ellenőrzése: belső címre nem kapcsolódunk (kivéve fejlesztői módban). */
function safeLookup(allowPrivate: boolean): typeof dns.lookup {
  return ((hostname: string, options: dns.LookupOptions | number | undefined, callback: (...args: unknown[]) => void) => {
    const opts = typeof options === 'object' && options !== null ? options : {};
    dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = addresses as dns.LookupAddress[];
      if (!allowPrivate && list.some((a) => isInternalAddress(a.address))) {
        return callback(new Error('A webhook-cím nem mutathat belső hálózatra'));
      }
      if (opts.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  }) as typeof dns.lookup;
}

/** Egy kérés elküldése; sosem dob hibát, az eredményt adja vissza. */
export async function deliver(url: string, secret: string | null, event: string, body: string): Promise<WebhookResult> {
  const allowPrivate = allowPrivateWebhooks();
  let target: URL;
  try {
    target = await validateWebhookUrl(url, allowPrivate);
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof WebhookUrlError ? e.message : 'Érvénytelen webhook-cím' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    'User-Agent': 'Tickoff-Webhook',
    'X-Tickoff-Event': event,
  };
  if (secret) headers['X-Tickoff-Signature'] = `sha256=${signPayload(secret, body)}`;

  return new Promise<WebhookResult>((resolve) => {
    const lib = target.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: target.protocol,
        hostname: target.hostname.replace(/^\[|\]$/g, ''),
        port: target.port || undefined,
        path: target.pathname + target.search,
        method: 'POST',
        headers,
        lookup: safeLookup(allowPrivate),
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        res.resume(); // a törzset nem olvassuk, csak eldobjuk
        // Átirányítást nem követünk: egy átirányítás belső címre vihetne
        resolve(status >= 200 && status < 300 ? { ok: true, status, error: null } : { ok: false, status, error: `A fogadó HTTP ${status} választ adott` });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, error: 'A fogadó nem válaszolt időben' });
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message.includes('belső hálózatra') ? e.message : 'A fogadó nem érhető el' }));
    req.end(body);
  });
}

/** Esemény küldése a projekt webhookjára (ha van), a háttérben: a hívó nem vár a fogadóra, és a hiba nem bukatja el a kérést. */
export async function publishWebhook(project: Project, event: string, text: string, comment: Comment | null, round: Round | null): Promise<void> {
  const url = project.webhookUrl;
  if (!url) return;
  if (inFlight >= MAX_IN_FLIGHT) {
    console.warn('[webhook] A küldési sor megtelt, egy esemény elmaradt (projekt:', project.id, ')');
    return;
  }
  inFlight++;
  try {
    const result = await deliver(url, project.webhookSecret, event, webhookPayload(project, event, text, comment, round));
    if (!result.ok) console.warn(`[webhook] A kézbesítés nem sikerült (projekt: ${project.id}, esemény: ${event}): ${result.error}`);
  } finally {
    inFlight--;
  }
}

/** Teszt-üzenet küldése azonnal (a dashboardról kért ellenőrzés), az eredménnyel. */
export function sendTestWebhook(project: Project): Promise<WebhookResult> {
  const text = `Tickoff teszt: a(z) „${project.name}” projekt webhookja működik.`;
  return deliver(project.webhookUrl ?? '', project.webhookSecret, WebhookEvents.test, webhookPayload(project, WebhookEvents.test, text, null, null));
}
