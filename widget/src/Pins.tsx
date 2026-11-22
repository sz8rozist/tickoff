import { Fragment } from 'preact';
import { useEffect, useState } from 'react';
import type { WidgetComment } from './api';
import { areaRect } from './area';
import { ownToken } from './own';
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

/** A saját, nemrég küldött komment szerkesztése és visszavonása (a szerkesztési határidőn belül). */
function OwnActions({
  comment,
  onEdit,
  onWithdraw,
}: {
  comment: WidgetComment;
  onEdit: (body: string) => Promise<string | null>;
  onWithdraw: () => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (comment.status !== 'OPEN' || !ownToken(comment.id)) return null;

  async function run(action: () => Promise<string | null>, onOk?: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failure = await action();
    setBusy(false);
    if (failure) setError(failure);
    else onOk?.();
  }

  if (editing) {
    return (
      <form
        class="reply-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim() !== '') run(() => onEdit(body.trim()), () => setEditing(false));
        }}
      >
        <textarea value={body} maxLength={4000} aria-label="A komment szövege" autofocus onInput={(e) => setBody(e.currentTarget.value)} />
        {error && (
          <p class="err" role="alert">
            {error}
          </p>
        )}
        <div class="actions">
          <button type="button" class="btn small" disabled={busy} onClick={() => setEditing(false)}>
            Mégse
          </button>
          <button type="submit" class="btn small primary" disabled={busy || body.trim() === ''}>
            {busy ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div class="own">
      <button type="button" class="btn small" disabled={busy} onClick={() => setEditing(true)}>
        Szerkesztés
      </button>
      {comment.replies.length === 0 && (
        <button
          type="button"
          class="btn small"
          disabled={busy}
          onClick={() => (confirm ? run(onWithdraw) : setConfirm(true))}
        >
          {confirm ? 'Biztosan visszavonod?' : 'Visszavonás'}
        </button>
      )}
      {error && (
        <p class="err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * A "Kész" kommentnél az ügyfél elfogadhatja a javítást, vagy visszanyithatja (rövid indoklással).
 * Mindkét művelet hibaüzenettel tér vissza, vagy null-lal, ha sikerült.
 */
function ReviewActions({
  comment,
  defaultName,
  onApprove,
  onReopen,
}: {
  comment: WidgetComment;
  defaultName: string;
  onApprove: () => Promise<string | null>;
  onReopen: (authorName: string, reason: string) => Promise<string | null>;
}) {
  const [reopening, setReopening] = useState(false);
  const [name, setName] = useState(defaultName);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (comment.status !== 'DONE') return null;

  if (comment.approved) {
    return <div class="approved">✓ Elfogadva</div>;
  }

  async function run(action: () => Promise<string | null>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failure = await action();
    setBusy(false);
    if (failure) setError(failure);
  }

  if (reopening) {
    return (
      <form
        class="reply-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() !== '') run(() => onReopen(name.trim(), reason.trim()));
        }}
      >
        <input
          type="text"
          value={name}
          maxLength={120}
          placeholder="A neved"
          aria-label="A neved"
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <textarea
          value={reason}
          maxLength={4000}
          placeholder="Mi nem jó még? (nem kötelező)"
          aria-label="Indoklás"
          autofocus
          onInput={(e) => setReason(e.currentTarget.value)}
        />
        {error && (
          <p class="err" role="alert">
            {error}
          </p>
        )}
        <div class="actions">
          <button type="button" class="btn small" disabled={busy} onClick={() => setReopening(false)}>
            Mégse
          </button>
          <button type="submit" class="btn small primary" disabled={busy || name.trim() === ''}>
            {busy ? 'Küldés…' : 'Visszanyitás'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div class="review">
      <div class="review-q">Rendben van így?</div>
      <div class="review-btns">
        <button type="button" class="btn small primary" disabled={busy} onClick={() => run(onApprove)}>
          Elfogadom
        </button>
        <button type="button" class="btn small" disabled={busy} onClick={() => setReopening(true)}>
          Visszanyitom
        </button>
      </div>
      {error && (
        <p class="err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Pins({
  comments,
  inert,
  defaultName,
  onReply,
  onApprove,
  onReopen,
  onEdit,
  onWithdraw,
  openRequest,
}: {
  comments: WidgetComment[];
  inert: boolean;
  defaultName: string;
  /** Hibaüzenettel tér vissza, vagy null-lal, ha sikerült. */
  onReply: (commentId: number, authorName: string, body: string) => Promise<string | null>;
  onApprove: (commentId: number) => Promise<string | null>;
  onEdit: (commentId: number, body: string) => Promise<string | null>;
  onWithdraw: (commentId: number) => Promise<string | null>;
  onReopen: (commentId: number, authorName: string, reason: string) => Promise<string | null>;
  /** Kívülről kért megnyitás (a mélylinkből). Az `n` változása újra megnyitja ugyanazt a kommentet is. */
  openRequest: { id: number; n: number } | null;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    if (openRequest) setOpenId(openRequest.id);
  }, [openRequest]);

  // Oldalváltáskor a megnyitott komment eltűnhet a listából: ne nyíljon meg magától, ha később visszatérünk
  useEffect(() => {
    if (openId !== null && !comments.some((c) => c.id === openId)) setOpenId(null);
  }, [comments, openId]);

  return (
    <>
      {comments.map((c, i) => {
        const pos = pinPosition(c);
        if (!pos) return null;
        const isOpen = openId === c.id;
        // A kijelölt területet (ha van) a megnyitott kommentnél mutatjuk
        const el = isOpen && c.areaWidth !== null && c.areaHeight !== null ? resolve(c.cssSelector) : null;
        const area = el ? areaRect(el, c.posX ?? 0, c.posY ?? 0, c.areaWidth ?? 0, c.areaHeight ?? 0) : null;
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
            {area && <div class="hl area" style={{ left: area.left, top: area.top, width: area.width, height: area.height }} />}
            {isOpen && (
              <div class="pop" role="dialog" style={{ left: popLeft, top: popTop }}>
                <div class="meta">
                  {c.authorName} · {dateTime(c.createdAt)}
                  {c.edited && ' · szerkesztve'}
                </div>
                <div class="body">{c.body}</div>
                <div class="status">{STATUS_LABEL[c.status]}</div>
                <OwnActions comment={c} onEdit={(body) => onEdit(c.id, body)} onWithdraw={() => onWithdraw(c.id)} />
                <ReviewActions
                  comment={c}
                  defaultName={defaultName}
                  onApprove={() => onApprove(c.id)}
                  onReopen={(name, reason) => onReopen(c.id, name, reason)}
                />

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
