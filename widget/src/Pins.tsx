import { Fragment } from 'preact';
import { useState } from 'react';
import type { WidgetComment } from './api';
import { resolve } from './selector';

const STATUS_LABEL: Record<WidgetComment['status'], string> = {
  OPEN: 'Nyitott',
  IN_PROGRESS: 'Folyamatban',
  DONE: 'Kész',
};

const dateTime = (iso: string) => new Date(iso).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' });

/** A komment helye a viewportban: az elem bal felső sarka + a mentett százalékos eltolás. */
function pinPosition(c: WidgetComment): { x: number; y: number } | null {
  const el = resolve(c.cssSelector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  const x = r.left + (r.width * (c.posX ?? 0)) / 100;
  const y = r.top + (r.height * (c.posY ?? 0)) / 100;
  // A viewporton kívüli jelölést nem rajzoljuk ki.
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
  return { x, y };
}

/** Válasz-űrlap a felugró kártyában. */
function ReplyForm({
  defaultName,
  onSubmit,
}: {
  defaultName: string;
  onSubmit: (authorName: string, body: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" class="btn small" onClick={() => setOpen(true)}>
        Válasz
      </button>
    );
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (name.trim() === '' || body.trim() === '' || busy) return;
    setBusy(true);
    setError(null);
    const failure = await onSubmit(name.trim(), body.trim());
    setBusy(false);
    if (failure) {
      setError(failure);
    } else {
      setBody('');
      setOpen(false);
    }
  }

  return (
    <form class="reply-form" onSubmit={submit}>
      <input
        type="text"
        value={name}
        maxLength={120}
        placeholder="A neved"
        aria-label="A neved"
        onInput={(e) => setName(e.currentTarget.value)}
      />
      <textarea
        value={body}
        maxLength={4000}
        placeholder="Válasz írása…"
        aria-label="Válasz"
        autofocus
        onInput={(e) => setBody(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
        }}
      />
      {error && (
        <p class="err" role="alert">
          {error}
        </p>
      )}
      <div class="actions">
        <button type="button" class="btn small" disabled={busy} onClick={() => setOpen(false)}>
          Mégse
        </button>
        <button type="submit" class="btn small primary" disabled={busy || name.trim() === '' || body.trim() === ''}>
          {busy ? 'Küldés…' : 'Küldés'}
        </button>
      </div>
    </form>
  );
}

export function Pins({
  comments,
  inert,
  defaultName,
  onReply,
}: {
  comments: WidgetComment[];
  inert: boolean;
  defaultName: string;
  /** Hibaüzenettel tér vissza, vagy null-lal, ha sikerült. */
  onReply: (commentId: number, authorName: string, body: string) => Promise<string | null>;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <>
      {comments.map((c, i) => {
        const pos = pinPosition(c);
        if (!pos) return null;
        const isOpen = openId === c.id;
        // A felugró kártyát a viewporton belül tartjuk (a magasságát a CSS max-height korlátozza).
        const popLeft = Math.min(Math.max(8, pos.x + 16), window.innerWidth - 308);
        const popTop = Math.min(Math.max(8, pos.y - 12), Math.max(8, window.innerHeight - 220));
        return (
          <Fragment key={c.id}>
            <button
              class={`pin ${c.status}${inert ? ' inert' : ''}`}
              style={{ left: pos.x, top: pos.y }}
              aria-label={`${i + 1}. visszajelzés: ${c.authorName}`}
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : c.id)}
            >
              {i + 1}
            </button>
            {isOpen && (
              <div class="pop" role="dialog" style={{ left: popLeft, top: popTop }}>
                <div class="meta">
                  {c.authorName} · {dateTime(c.createdAt)}
                </div>
                <div class="body">{c.body}</div>
                <div class="status">{STATUS_LABEL[c.status]}</div>

                {c.replies.length > 0 && (
                  <div class="thread">
                    {c.replies.map((r) => (
                      <div class="reply" key={r.id}>
                        <div class="meta">
                          {r.authorName}
                          {r.authorType === 'DESIGNER' && <span class="badge">csapat</span>} · {dateTime(r.createdAt)}
                        </div>
                        <div class="body">{r.body}</div>
                      </div>
                    ))}
                  </div>
                )}

                <ReplyForm defaultName={defaultName} onSubmit={(name, body) => onReply(c.id, name, body)} />
              </div>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
