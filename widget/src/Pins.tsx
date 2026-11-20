import { Fragment } from 'preact';
import { useState } from 'react';
import type { WidgetComment } from './api';
import { resolve } from './selector';

const STATUS_LABEL: Record<WidgetComment['status'], string> = {
  OPEN: 'Nyitott',
  IN_PROGRESS: 'Folyamatban',
  DONE: 'Kész',
};

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

export function Pins({ comments, inert }: { comments: WidgetComment[]; inert: boolean }) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <>
      {comments.map((c, i) => {
        const pos = pinPosition(c);
        if (!pos) return null;
        const isOpen = openId === c.id;
        // A felugró kártyát a viewporton belül tartjuk.
        const popLeft = Math.min(Math.max(8, pos.x + 16), window.innerWidth - 268);
        const popTop = Math.min(Math.max(8, pos.y - 12), window.innerHeight - 140);
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
                  {c.authorName} · {new Date(c.createdAt).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                <div class="body">{c.body}</div>
                <div class="status">{STATUS_LABEL[c.status]}</div>
              </div>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
