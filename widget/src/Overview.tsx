import { useEffect, useState } from 'react';
import type { CommentStatus, HistoryRound, RoundInfo, WidgetComment } from './api';
import { displayPath } from './page';

const LABEL: Record<CommentStatus, string> = {
  OPEN: 'Nyitott',
  IN_PROGRESS: 'Folyamatban',
  DONE: 'Kész',
};

const snippet = (s: string) => (s.length > 90 ? s.slice(0, 90).trimEnd() + '…' : s);
const date = (iso: string) => new Date(iso).toLocaleDateString('hu-HU');

type Tab = 'current' | 'history';

/**
 * Az összes visszajelzés egy helyen. Az "Aktuális kör" fül oldalak szerint csoportosítva mutatja a kommenteket
 * (egy elemre kattintva a widget odaugrik), és itt hagyhatja jóvá az ügyfél a kört. A "Korábbi körök" fül a lezárt
 * köröket mutatja, csak olvasásra.
 */
export function Overview({
  comments,
  currentPage,
  round,
  defaultName,
  onGo,
  onClose,
  onApproveRound,
  loadHistory,
}: {
  comments: WidgetComment[];
  currentPage: string;
  round: RoundInfo | null;
  defaultName: string;
  onGo: (c: WidgetComment) => void;
  onClose: () => void;
  /** Hibaüzenettel tér vissza, vagy null-lal, ha sikerült. */
  onApproveRound: (authorName: string) => Promise<string | null>;
  loadHistory: () => Promise<HistoryRound[]>;
}) {
  const [tab, setTab] = useState<Tab>('current');
  const [history, setHistory] = useState<HistoryRound[] | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);

  // A korábbi köröket csak akkor töltjük le, ha megnyitják a fület
  useEffect(() => {
    if (tab !== 'history' || history) return;
    setHistoryFailed(false);
    loadHistory().then(setHistory).catch(() => setHistoryFailed(true));
  }, [tab, history, loadHistory]);

  return (
    <div class="panel list" role="dialog" aria-label="Összes visszajelzés">
      <div class="list-head">
        <h2>Visszajelzések</h2>
        <button class="x" onClick={onClose} aria-label="Bezárás">
          ×
        </button>
      </div>

      <div class="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'current'} class={tab === 'current' ? 'on' : ''} onClick={() => setTab('current')}>
          {round ? `${round.number}. kör` : 'Aktuális kör'}
        </button>
        <button role="tab" aria-selected={tab === 'history'} class={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
          Korábbi körök
        </button>
      </div>

      {tab === 'current' ? (
        <Current
          comments={comments}
          currentPage={currentPage}
          round={round}
          defaultName={defaultName}
          onGo={onGo}
          onApproveRound={onApproveRound}
        />
      ) : (
        <History history={history} failed={historyFailed} />
      )}
    </div>
  );
}

function Dot({ status }: { status: CommentStatus }) {
  return <i class={`dot ${status}`} title={LABEL[status]} />;
}

function Current({
  comments,
  currentPage,
  round,
  defaultName,
  onGo,
  onApproveRound,
}: {
  comments: WidgetComment[];
  currentPage: string;
  round: RoundInfo | null;
  defaultName: string;
  onGo: (c: WidgetComment) => void;
  onApproveRound: (authorName: string) => Promise<string | null>;
}) {
  const count = (s: CommentStatus) => comments.filter((c) => c.status === s).length;
  const allDone = comments.length > 0 && comments.every((c) => c.status === 'DONE');

  // Az aktuális oldal elöl, a többi az első komment időrendjében
  const byPage = new Map<string, WidgetComment[]>();
  for (const c of comments) byPage.set(c.pageUrl, [...(byPage.get(c.pageUrl) ?? []), c]);
  const pages = [...byPage.entries()].sort(([a], [b]) => Number(b === currentPage) - Number(a === currentPage));

  if (comments.length === 0) {
    return <p class="empty">Még nincs visszajelzés ebben a körben.</p>;
  }

  return (
    <>
      <div class="chips">
        {(['OPEN', 'IN_PROGRESS', 'DONE'] as const).map((s) => (
          <span class="chip" key={s}>
            <Dot status={s} />
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
                <Dot status={c.status} />
                <span class="txt">
                  <span class="who">
                    {c.authorName}
                    {c.approved && <span class="ok"> · elfogadva ✓</span>}
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

      <RoundApproval round={round} allDone={allDone} defaultName={defaultName} onApprove={onApproveRound} />
    </>
  );
}

/** A kör jóváhagyása: csak akkor kínáljuk fel, ha minden visszajelzés kész. */
function RoundApproval({
  round,
  allDone,
  defaultName,
  onApprove,
}: {
  round: RoundInfo | null;
  allDone: boolean;
  defaultName: string;
  onApprove: (authorName: string) => Promise<string | null>;
}) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!round) return null;

  if (round.approved) {
    return (
      <div class="approval done" role="status">
        ✓ Jóváhagyva{round.approvedBy ? `: ${round.approvedBy}` : ''}. Köszönjük!
      </div>
    );
  }

  if (!allDone) {
    return <div class="approval muted">A kör jóváhagyható, ha minden visszajelzés kész.</div>;
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (name.trim() === '' || busy) return;
    setBusy(true);
    setError(null);
    const failure = await onApprove(name.trim());
    setBusy(false);
    if (failure) setError(failure);
  }

  return (
    <form class="approval" onSubmit={submit}>
      <p class="hint">Minden visszajelzés kész. Ha elégedett vagy, hagyd jóvá a kört.</p>
      <div class="row">
        <input
          type="text"
          value={name}
          maxLength={120}
          placeholder="A neved"
          aria-label="A neved"
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button type="submit" class="btn primary small" disabled={busy || name.trim() === ''}>
          {busy ? 'Küldés…' : 'Kör jóváhagyása'}
        </button>
      </div>
      {error && (
        <p class="err" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function History({ history, failed }: { history: HistoryRound[] | null; failed: boolean }) {
  if (failed) return <p class="empty">A korábbi körök betöltése nem sikerült.</p>;
  if (!history) return <p class="empty">Betöltés…</p>;
  if (history.length === 0) return <p class="empty">Még nincs lezárt kör.</p>;

  return (
    <div class="list-body history">
      {history.map((r) => (
        <section key={r.number}>
          <div class="page-title">
            <span class="round-title">{r.number}. kör</span>
            <span class="muted-s">lezárva: {date(r.closedAt)}</span>
            {r.approved && <span class="here">jóváhagyva{r.approvedBy ? `: ${r.approvedBy}` : ''}</span>}
          </div>
          {r.comments.length === 0 && <p class="empty-s">Nem volt visszajelzés.</p>}
          {r.comments.map((c) => (
            <div class="item static" key={c.id}>
              <Dot status={c.status} />
              <span class="txt">
                <span class="who">
                  {c.authorName}
                  <span class="rc"> · {displayPath(c.pageUrl)}</span>
                </span>
                <span class="snip">{snippet(c.body)}</span>
                {c.replies.length > 0 && (
                  <span class="last-reply">
                    {c.replies[c.replies.length - 1].authorName}: {snippet(c.replies[c.replies.length - 1].body)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
