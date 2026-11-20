import { useEffect, useMemo, useState } from 'react';
import { ApiError, createApi, type ProjectInfo, type WidgetComment } from './api';
import type { Config } from './config';
import { Composer, type ComposerValues } from './Composer';
import { Pins } from './Pins';
import { captureViewport } from './screenshot';
import { cssSelectorFor } from './selector';
import { styles } from './styles';
import { useTick } from './useTick';

type Mode = 'idle' | 'pick' | 'compose';

interface Target {
  el: Element;
  selector: string;
  /** A kattintás helye az elem méretének százalékában. */
  posX: number;
  posY: number;
}

const AUTHOR_KEY = 'tickoff.author';

function savedAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveAuthor(name: string) {
  try {
    localStorage.setItem(AUTHOR_KEY, name);
  } catch {
    /* privát mód: nem mentjük */
  }
}

const pageUrl = () => location.origin + location.pathname + location.search;

const clampPct = (v: number) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0);

function sendError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return 'Jelenleg nincs nyitott visszajelzési kör.';
    if (e.status === 429) return 'Túl sok kérés érkezett tőled, várj egy kicsit, és próbáld újra.';
    if (e.status === 400) return 'Ellenőrizd az adatokat: a név és a szöveg kötelező.';
  }
  return 'Nem sikerült elküldeni, próbáld újra.';
}

export function Widget({ config, host }: { config: Config; host: HTMLElement }) {
  const api = useMemo(() => createApi(config), [config]);

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [fatal, setFatal] = useState(false);
  const [comments, setComments] = useState<WidgetComment[]>([]);
  const [mode, setMode] = useState<Mode>('idle');
  const [hover, setHover] = useState<Element | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .project()
      .then((p) => {
        setProject(p);
        return api.comments(pageUrl()).then(setComments);
      })
      .catch((e) => {
        // Rossz token (404) vagy nem engedélyezett origin (403): a vendégoldalon nem mutatunk hibát, csak a konzolban.
        const reason =
          e instanceof ApiError
            ? `HTTP ${e.status} (ellenőrizd a tokent és a projekt oldalának címét)`
            : 'a kérést a böngésző blokkolta vagy nem érhető el az API (CORS: az oldal origin-jének egyeznie kell a projektnél megadott címmel)';
        console.warn('[Tickoff] A widget nem indul el:', reason);
        setFatal(true);
      });
  }, [api]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Elemkiválasztás: az oldal eseményeit elkapjuk, de a widget saját felületére érkezőket békén hagyjuk.
  useEffect(() => {
    if (mode !== 'pick') return;

    const pageTarget = (e: Event): Element | null => {
      if (e.composedPath().includes(host)) return null;
      return e.target instanceof Element ? e.target : null;
    };
    const onMove = (e: MouseEvent) => setHover(pageTarget(e));
    const onClick = (e: MouseEvent) => {
      const el = pageTarget(e);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const r = el.getBoundingClientRect();
      setTarget({
        el,
        selector: cssSelectorFor(el),
        posX: r.width > 0 ? clampPct(((e.clientX - r.left) / r.width) * 100) : 0,
        posY: r.height > 0 ? clampPct(((e.clientY - r.top) / r.height) * 100) : 0,
      });
      setHover(null);
      setMode('compose');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    const prevCursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = 'crosshair';
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      document.documentElement.style.cursor = prevCursor;
      setHover(null);
    };
  }, [mode, host]);

  useEffect(() => {
    if (mode !== 'compose') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) cancel();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [mode, busy]);

  const tick = useTick(comments.length > 0 || mode !== 'idle');
  void tick; // a számláló változása újrarendereli a pozíció-függő elemeket

  function cancel() {
    setMode('idle');
    setTarget(null);
    setHover(null);
    setError(null);
  }

  function toggle() {
    if (mode !== 'idle') {
      if (!busy) cancel();
      return;
    }
    if (!project?.openRound) {
      setNotice('Jelenleg nincs nyitott visszajelzési kör, ezért most nem tudsz észrevételt küldeni.');
      return;
    }
    setNotice(null);
    setMode('pick');
  }

  async function submit(values: ComposerValues) {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      saveAuthor(values.authorName);
      const created = await api.createComment({
        authorName: values.authorName,
        body: values.body,
        pageUrl: pageUrl(),
        cssSelector: target.selector,
        posX: target.posX,
        posY: target.posY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });

      let shotOk = true;
      if (values.includeScreenshot) {
        const image = await captureViewport(target.el);
        shotOk = false;
        if (image) {
          try {
            await api.uploadScreenshot(created.id, image);
            shotOk = true;
          } catch {
            /* a komment már mentve van, a kép csak extra */
          }
        }
      }

      setToast(shotOk ? 'Köszönjük, a visszajelzés elküldve.' : 'A visszajelzés elküldve, de a képernyőképet nem sikerült csatolni.');
      setComments(await api.comments(pageUrl()).catch(() => comments));
      cancel();
    } catch (e) {
      setError(sendError(e));
    } finally {
      setBusy(false);
    }
  }

  /** Válasz egy kommentre. Hibaüzenettel tér vissza, vagy null-lal, ha sikerült. */
  async function reply(commentId: number, authorName: string, body: string): Promise<string | null> {
    try {
      saveAuthor(authorName);
      await api.createReply(commentId, { authorName, body });
      setComments(await api.comments(pageUrl()).catch(() => comments));
      return null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return 'Ehhez már nem lehet válaszolni (lezárt kör vagy betelt szál).';
      return sendError(e);
    }
  }

  if (fatal) return null;

  const hoverRect = mode === 'pick' && hover ? hover.getBoundingClientRect() : null;
  const targetRect = mode === 'compose' && target ? target.el.getBoundingClientRect() : null;
  const box = (r: DOMRect) => ({ left: r.left, top: r.top, width: r.width, height: r.height });

  return (
    <>
      <style>{styles}</style>

      {project && <Pins comments={comments} inert={mode === 'pick'} defaultName={savedAuthor()} onReply={reply} />}

      {hoverRect && <div class="hl" style={box(hoverRect)} />}
      {targetRect && <div class="hl" style={box(targetRect)} />}

      {mode === 'pick' && <div class="banner">Kattints arra az elemre, amihez megjegyzésed van · Esc: mégse</div>}

      {mode === 'compose' && target && (
        <Composer
          selector={target.selector}
          defaultName={savedAuthor()}
          busy={busy}
          error={error}
          onSubmit={submit}
          onCancel={cancel}
        />
      )}

      {notice && mode === 'idle' && (
        <div class="panel" role="status">
          <p style={{ margin: 0 }}>{notice}</p>
          <div class="actions">
            <button class="btn" onClick={() => setNotice(null)}>
              Rendben
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}

      {project && (
        <button class="fab" onClick={toggle}>
          {mode === 'idle' ? 'Visszajelzés' : 'Mégse'}
        </button>
      )}
    </>
  );
}
