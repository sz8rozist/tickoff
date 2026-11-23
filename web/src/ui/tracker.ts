import type { Comment } from './api';

/** A hibajegy címe: a komment első sora, legfeljebb 80 karakterben. */
function issueTitle(c: Comment): string {
  const line = c.body.trim().split('\n')[0].replace(/\s+/g, ' ');
  return line.length <= 80 ? line : line.slice(0, 79) + '…';
}

/** A hibajegy leírása: a komment szövege és a hozzá tartozó környezeti adatok (oldal, elem, nézet). */
function issueBody(c: Comment, link: string | null): string {
  const lines = [c.body.trim(), '', `Oldal: ${c.pageUrl}`, `Beküldte: ${c.authorName}`];
  if (c.cssSelector) lines.push(`Elem: ${c.cssSelector}`);
  if (c.viewportWidth && c.viewportHeight) lines.push(`Nézet: ${c.viewportWidth}×${c.viewportHeight}`);
  if (link) lines.push(`Megnyitás az oldalon: ${link}`);
  return lines.join('\n');
}

/**
 * A hibajegy-követő sablonjának kitöltése egy kommenttel: a {title}, {body} és {url} helyére a (URL-kódolt) adatok kerülnek.
 * A kitöltött címet a böngésző nyitja meg, a szerver nem hív meg semmit.
 */
export function fillTracker(template: string, c: Comment, link: string | null): string {
  const values: Record<string, string> = { title: issueTitle(c), body: issueBody(c, link), url: link ?? c.pageUrl };
  return template.replace(/\{(title|body|url)\}/g, (_m, key: string) => encodeURIComponent(values[key]));
}
