import type { CommentStatus, WidgetComment } from './api';
import { displayPath } from './page';

const LABEL: Record<CommentStatus, string> = {
  OPEN: 'Nyitott',
  IN_PROGRESS: 'Folyamatban',
  DONE: 'Kész',
};

const snippet = (s: string) => (s.length > 90 ? s.slice(0, 90).trimEnd() + '…' : s);

/**
 * Az összes visszajelzés egy helyen: oldalak szerint csoportosítva, állapottal. Egy elemre kattintva a widget
 * odaugrik (ugyanazon az oldalon görget és megnyitja a szálat, másik oldalon betölti azt mélylinkkel).
 */
export function Overview({
  comments,
  currentPage,
  onGo,
  onClose,
}: {
  comments: WidgetComment[];
  currentPage: string;
  onGo: (c: WidgetComment) => void;
  onClose: () => void;
}) {
  const count = (s: CommentStatus) => comments.filter((c) => c.status === s).length;

  // Az aktuális oldal elöl, a többi az első komment időrendjében
  const byPage = new Map<string, WidgetComment[]>();
  for (const c of comments) byPage.set(c.pageUrl, [...(byPage.get(c.pageUrl) ?? []), c]);
  const pages = [...byPage.entries()].sort(([a], [b]) => Number(b === currentPage) - Number(a === currentPage));

  return (
    <div class="panel list" role="dialog" aria-label="Összes visszajelzés">
      <div class="list-head">
        <h2>Összes visszajelzés</h2>
        <button class="x" onClick={onClose} aria-label="Bezárás">
          ×
        </button>
      </div>

      {comments.length === 0 ? (
        <p class="empty">Még nincs visszajelzés ebben a körben.</p>
      ) : (
        <>
          <div class="chips">
            {(['OPEN', 'IN_PROGRESS', 'DONE'] as const).map((s) => (
              <span class="chip" key={s}>
                <i class={`dot ${s}`} />
                {LABEL[s]} {count(s)}
              </span>
            ))}
          </div>

          <div class="list-body">
            {pages.map(([url, items]) => (
              <section key={url}>
                <div class="page-title">
                  <span class="path" title={url}>
                    {displayPath(url)}
                  </span>
                  {url === currentPage && <span class="here">ez az oldal</span>}
                </div>
                {items.map((c) => (
                  <button class="item" key={c.id} onClick={() => onGo(c)}>
                    <i class={`dot ${c.status}`} title={LABEL[c.status]} />
                    <span class="txt">
                      <span class="who">
                        {c.authorName}
                        {c.replies.length > 0 && <span class="rc"> · {c.replies.length} válasz</span>}
                      </span>
                      <span class="snip">{snippet(c.body)}</span>
                    </span>
                    <span class="go" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
