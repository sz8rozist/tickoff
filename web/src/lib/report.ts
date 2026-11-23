import type { Project } from './access';
import type { Comment, Round } from './comments';
import { statusLabel } from './comments';

/**
 * Nyomtatható kör-riport (HTML, a böngészőből PDF-be menthető). Alapból ügyfélnek is átadható (nincsenek benne a belső
 * adatok: prioritás, címkék, felelős, selector); `internal` mellett a csapat belső változata készül. Minden szöveg
 * HTML-escape-elt, a riport nem tartalmaz scriptet.
 */

/** HTML-escape: a felhasználói szövegek sosem kerülhetnek jelölésként a riportba. */
export function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface ReportComment {
  comment: Comment;
  assigneeName: string | null;
  replies: { authorName: string; authorType: string; body: string; internal?: boolean }[];
}

const CSS = `
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111827;max-width:820px;margin:32px auto;padding:0 20px;line-height:1.5}
h1{margin:0;font-size:28px;letter-spacing:-.02em}.sub{margin:4px 0 20px;color:#64748b}
h2{font-size:15px;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #e3e5f3;word-break:break-all;color:#1d4ed8}
table.meta{border-collapse:collapse;margin-bottom:8px;font-size:14px}.meta th{text-align:left;padding:4px 18px 4px 0;color:#64748b;font-weight:600}
.c{border:1px solid #e3e5f3;border-left:4px solid #adb5bd;border-radius:10px;padding:10px 14px;margin:10px 0;page-break-inside:avoid}
.c.open{border-left-color:#f76707}.c.in_progress{border-left-color:#2563eb}.c.done{border-left-color:#16a34a}
.head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.n{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#eff6ff;font-size:12px;font-weight: 600}
.badge{margin-left:auto;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;background:#f1f5f9}
.body{margin:6px 0;white-space:pre-wrap}.muted{color:#6b7094}.small{font-size:12px}
.thread{margin:6px 0 0;padding-left:16px;border-left:2px solid #e3e5f3;list-style:none;font-size:14px}.thread li{margin:3px 0;white-space:pre-wrap}
.foot{margin-top:30px}@media print{body{margin:0;max-width:none}}
`;

export function renderReport(
  project: Project,
  round: Round,
  items: ReportComment[],
  internal: boolean,
  zone = process.env.TICKOFF_EXPORT_ZONE ?? 'Europe/Budapest',
): string {
  const date = (d: Date) => new Intl.DateTimeFormat('hu-HU', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const dateTime = (d: Date) => new Intl.DateTimeFormat('hu-HU', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
  const count = (s: string) => items.filter((i) => i.comment.status === s).length;

  let h = '<!doctype html><html lang="hu"><head><meta charset="utf-8">';
  h += '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">';
  h += `<title>Riport – ${esc(project.name)} – ${round.number}. kör</title><style>${CSS}</style></head><body>`;
  h += `<h1>${esc(project.name)}</h1>`;
  h += `<p class="sub">Visszajelzési riport · ${round.number}. kör${internal ? ' · belső változat' : ''}</p>`;

  h += `<table class="meta"><tr><th>Oldal</th><td>${esc(project.siteUrl)}</td></tr>`;
  h += `<tr><th>A kör kezdete</th><td>${date(round.createdAt)}</td></tr>`;
  h += round.closedAt ? `<tr><th>Lezárva</th><td>${date(round.closedAt)}</td></tr>` : '<tr><th>Állapot</th><td>nyitott</td></tr>';
  if (round.dueDate) h += `<tr><th>Határidő</th><td>${esc(round.dueDate)}</td></tr>`;
  if (round.approvedAt) h += `<tr><th>Jóváhagyás</th><td>${esc(round.approvedBy ?? 'az ügyfél')}, ${date(round.approvedAt)}</td></tr>`;
  h += `<tr><th>Összesítés</th><td>${items.length} visszajelzés: ${count('DONE')} kész, ${count('IN_PROGRESS')} folyamatban, ${count('OPEN')} nyitott</td></tr></table>`;

  if (items.length === 0) h += '<p>Ebben a körben nem érkezett visszajelzés.</p>';

  const byPage = new Map<string, ReportComment[]>();
  for (const item of items) byPage.set(item.comment.pageUrl, [...(byPage.get(item.comment.pageUrl) ?? []), item]);
  let n = 0;
  for (const [page, list] of byPage) {
    h += `<h2>${esc(page)}</h2>`;
    for (const { comment: c, assigneeName, replies } of list) {
      n++;
      h += `<section class="c ${c.status.toLowerCase()}"><div class="head"><span class="n">${n}</span><strong>${esc(c.authorName)}</strong> `;
      h += `<span class="muted">${dateTime(c.createdAt)}</span><span class="badge">${statusLabel(c.status)}${c.customerApprovedAt ? ' · elfogadva' : ''}</span></div>`;
      h += `<p class="body">${esc(c.body)}</p>`;
      if (internal) {
        h += `<p class="muted small">Prioritás: ${c.priority.toLowerCase()}`;
        if (c.labels) h += ` · Címkék: ${esc(c.labels.split(',').join(', '))}`;
        if (assigneeName) h += ` · Felelős: ${esc(assigneeName)}`;
        if (c.cssSelector) h += ` · Elem: ${esc(c.cssSelector)}`;
        h += '</p>';
      }
      if (replies.length > 0) {
        h += '<ul class="thread">';
        for (const r of replies) {
          h += `<li><strong>${esc(r.authorName)}</strong>${r.authorType === 'DESIGNER' ? ' <span class="muted">(csapat)</span>' : ''}${r.internal ? ' <span class="muted">(belső megjegyzés)</span>' : ''}: ${esc(r.body)}</li>`;
        }
        h += '</ul>';
      }
      h += '</section>';
    }
  }
  h += `<p class="foot muted small">Készült: ${dateTime(new Date())} · Nyomtatás vagy PDF mentés: Ctrl+P</p></body></html>`;
  return h;
}
