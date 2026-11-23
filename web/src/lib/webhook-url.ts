import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * A webhook-cím ellenőrzése. A címet a felhasználó adja, a szerver pedig kéréseket küld rá, ezért (SSRF ellen) csak
 * nyilvános címre mutathat: https, nincs benne név/jelszó, és a név minden feloldott címe nyilvános (nem loopback,
 * nem privát, nem link-local, nem a belső hálózat). A fejlesztői környezet engedélyezheti a privát címeket
 * (TICKOFF_WEBHOOK_ALLOW_PRIVATE=true), éles üzemben ez ki van kapcsolva.
 *
 * A feloldást minden küldés előtt újra el kell végezni, mert a DNS közben megváltozhatott; a küldő nem követ átirányítást.
 */

export function allowPrivateWebhooks(): boolean {
  return process.env.TICKOFF_WEBHOOK_ALLOW_PRIVATE === 'true';
}

export class WebhookUrlError extends Error {}

/** A cím (URL), vagy {@link WebhookUrlError} magyar üzenettel. */
export async function validateWebhookUrl(raw: string, allowPrivate = allowPrivateWebhooks()): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new WebhookUrlError('Érvénytelen webhook-cím');
  }
  const https = url.protocol === 'https:';
  if (!https && !(allowPrivate && url.protocol === 'http:')) {
    throw new WebhookUrlError('A webhook-cím https:// kezdetű legyen');
  }
  if (!url.hostname) throw new WebhookUrlError('Érvénytelen webhook-cím');
  if (url.username || url.password) {
    throw new WebhookUrlError('A webhook-cím ne tartalmazzon felhasználónevet vagy jelszót');
  }
  if (!allowPrivate) {
    // Az URL-ben a szögletes zárójeles IPv6-cím hostname-je zárójelekkel jön
    const host = url.hostname.replace(/^\[|\]$/g, '');
    let addresses: string[];
    if (isIP(host)) {
      addresses = [host];
    } else {
      try {
        addresses = (await lookup(host, { all: true })).map((a) => a.address);
      } catch {
        throw new WebhookUrlError('A webhook-cím neve nem oldható fel');
      }
    }
    if (addresses.length === 0) throw new WebhookUrlError('A webhook-cím neve nem oldható fel');
    if (addresses.some(isInternalAddress)) throw new WebhookUrlError('A webhook-cím nem mutathat belső hálózatra');
  }
  return url;
}

/** Nem nyilvános cím: loopback, privát, link-local, többesküldéses, nem útválasztható. */
export function isInternalAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return isInternalV4(address.split('.').map(Number));
  if (kind === 6) return isInternalV6(address.toLowerCase());
  return true; // ismeretlen alak: biztonságosan belsőnek vesszük
}

function isInternalV4([a, b, c]: number[]): boolean {
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // privát
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // megosztott címtér (CGNAT)
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) || // privát
    (a === 192 && b === 168) || // privát
    (a === 192 && b === 0 && c === 0) || // IETF protokoll-kiosztások
    (a === 198 && (b === 18 || b === 19)) || // teljesítménymérő tartomány
    a >= 224 // többesküldéses, fenntartott, broadcast
  );
}

function isInternalV6(addr: string): boolean {
  // IPv4-be ágyazott címek (::ffff:a.b.c.d): az IPv4-szabályok érvényesek
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isInternalV4(mapped[1].split('.').map(Number));
  const hextets = expandV6(addr);
  if (!hextets) return true;
  const first = hextets[0];
  return (
    hextets.every((h) => h === 0) || // ::
    (hextets.slice(0, 7).every((h) => h === 0) && hextets[7] === 1) || // ::1
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (first & 0xfe00) === 0xfc00 || // fc00::/7 egyedi helyi
    (first & 0xff00) === 0xff00 // ff00::/8 többesküldéses
  );
}

/** Az IPv6-cím 8 db 16 bites csoportra bontva, vagy null, ha nem értelmezhető. */
function expandV6(addr: string): number[] | null {
  let a = addr;
  // Az utolsó IPv4-es rész (pl. ::1.2.3.4) két csoporttá alakítva
  const v4 = a.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const n = v4.slice(1).map(Number);
    a = a.replace(v4[0], ((n[0] << 8) | n[1]).toString(16) + ':' + ((n[2] << 8) | n[3]).toString(16));
  }
  const halves = a.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return null;
  const groups = halves.length === 1 ? head : [...head, ...Array(missing).fill('0'), ...tail];
  const nums = groups.map((g) => parseInt(g, 16));
  return nums.some((n) => Number.isNaN(n)) ? null : nums;
}
