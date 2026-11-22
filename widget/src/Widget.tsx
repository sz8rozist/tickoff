import { useEffect, useMemo, useState } from 'react';
import { ApiError, createApi, type ProjectInfo, type RoundInfo, type WidgetComment } from './api';
import type { Config } from './config';
import { areaOf, areaRect, elementFor, rectBetween, type Rect } from './area';
import { Composer, type ComposerValues } from './Composer';
import { onNavigate } from './navigation';
import { Overview } from './Overview';
import { forgetOwn, ownToken, rememberOwn } from './own';
import { deepLinkTo, pageUrl, readFocusId, stripFocusParam } from './page';
import { Pins } from './Pins';
import { captureViewport } from './screenshot';
import { cssSelectorFor, resolve } from './selector';
import { styles } from './styles';
import { useTick } from './useTick';

type Mode = 'idle' | 'pick' | 'compose';

interface Target {
  el: Element;
  selector: string;
  /** A kattintás helye az elem méretének százalékában. */
  posX: number;
  posY: number;
  /** Kijelölt terület mérete az elem méretének százalékában (ha nem egyetlen pont/elem). */
  area?: { w: number; h: number };
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

const EMAIL_KEY = 'tickoff.email';

function savedEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveEmail(email: string) {
  try {
    if (email) localStorage.setItem(EMAIL_KEY, email);
    else localStorage.removeItem(EMAIL_KEY);
  } catch {
    /* privát mód: nem mentjük */
  }
}

/** A kijelölés doboza a viewportban: a terület, vagy (ha nincs) az egész elem. */
function targetBox(t: Target): Rect | null {
  if (t.area) return areaRect(t.el, t.posX, t.posY, t.area.w, t.area.h);
  const r = t.el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Érintőképernyős (durva mutatójú) eszköz-e: a feliratok és a kijelölés ehhez igazodnak. */
const touchDevice = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

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
  // A nyitott kör összes kommentje (minden oldalról); az aktuális oldaléi ebből származnak
  const [all, setAll] = useState<WidgetComment[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [hover, setHover] = useState<Element | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  // A húzás közben látszó kijelölő téglalap (viewport-koordináták)
  const [drag, setDrag] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Az aktuális "oldal": single-page alkalmazásban a History API-val változik, betöltés nélkül
  const [page, setPage] = useState(pageUrl);
  const comments = useMemo(() => all.filter((c) => c.pageUrl === page), [all, page]);
  // Az az oldal, amelynek a kommentjei be vannak töltve (a mélylink csak ezután dolgozhat)
  const [loadedPage, setLoadedPage] = useState<string | null>(null);

  // Mélylink a dashboardról: ?tickoff-comment=<id>. A komment helyére görget, kiemeli, és megnyitja a szálát.
  const [focusId, setFocusId] = useState<number | null>(readFocusId);
  const [spotlight, setSpotlight] = useState<Element | null>(null);
  const [openRequest, setOpenRequest] = useState<{ id: number; n: number } | null>(null);

  useEffect(() => {
    api
      .project()
      .then(setProject)
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

  // A mélylink paramétere ne maradjon a címsorban (előzmények, és ne kerüljön új kommentek URL-jébe)
  useEffect(() => {
    stripFocusParam();
  }, []);

  useEffect(() => onNavigate(() => setPage(pageUrl())), []);

  // Oldalváltáskor (új oldal, vagy single-page útvonalváltás): a félbehagyott kommentelés megszakad (a kiválasztott
  // elem már nem biztos, hogy létezik, és a komment rossz oldalhoz kerülne), a jelölések az új oldaléra cserélődnek.
  useEffect(() => {
    if (!busy) cancel();
  }, [page]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    api
      .comments()
      .then((list) => {
        if (!cancelled) {
          setAll(list);
          setLoadedPage(page);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadedPage(page);
      });
    return () => {
      cancelled = true;
    };
  }, [api, project, page]);

  // Mélylink feldolgozása, ha az oldal kommentjei megvannak. A single-page alkalmazások az elemeket késve rajzolhatják
  // ki, ezért rövid ideig újrapróbáljuk.
  useEffect(() => {
    if (focusId === null || loadedPage !== page) return;
    const comment = comments.find((c) => c.id === focusId);
    if (!comment) {
      setToast('Ez a visszajelzés ezen az oldalon már nem érhető el (lezárt kör vagy törölt komment).');
      setFocusId(null);
      return;
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      const el = resolve(comment.cssSelector);
      if (el) {
        window.clearInterval(timer);
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setOpenRequest({ id: comment.id, n: Date.now() });
        setSpotlight(el);
        setFocusId(null);
        window.setTimeout(() => setSpotlight(null), 4000);
      } else if (++tries > 20) {
        window.clearInterval(timer);
        setToast('Az elem már nem található az oldalon.');
        setFocusId(null);
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [focusId, loadedPage, page, comments]);

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
    // Húzással téglalap-területet is ki lehet jelölni; rövid mozgás (6 px alatt) sima kattintásnak számít.
    let start: { x: number; y: number } | null = null;
    let dragging = false;
    let swallowClick = false;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !pageTarget(e)) return;
      start = { x: e.clientX, y: e.clientY };
      dragging = false;
      e.preventDefault(); // ne kezdődjön szövegkijelölés
    };
    const onMove = (e: PointerEvent) => {
      setHover(pageTarget(e));
      if (start && (e.buttons & 1) !== 0) {
        if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) dragging = true;
        if (dragging) setDrag(rectBetween(start.x, start.y, e.clientX, e.clientY));
      }
    };
    const onUp = (e: PointerEvent) => {
      const s = start;
      start = null;
      if (!s || !dragging) return;
      dragging = false;
      setDrag(null);
      // A húzás utáni kattintás-eseményt elnyeljük, hogy az oldal saját kezelője ne fusson le
      swallowClick = true;
      window.setTimeout(() => {
        swallowClick = false;
      }, 0);
      const rect = rectBetween(s.x, s.y, e.clientX, e.clientY);
      const el = elementFor(rect, host);
      const a = areaOf(el, rect);
      setTarget({ el, selector: cssSelectorFor(el), posX: a.posX, posY: a.posY, area: { w: a.w, h: a.h } });
      setHover(null);
      setMode('compose');
    };
    const onClick = (e: MouseEvent) => {
      const el = pageTarget(e);
      if (!el) return;
      if (swallowClick) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
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

    // Pointer-események: egér, érintés és toll is ugyanígy működik
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    const prevCursor = document.documentElement.style.cursor;
    const prevTouch = document.documentElement.style.touchAction;
    document.documentElement.style.cursor = 'crosshair';
    // Érintőképernyőn a húzás ne görgesse az oldalt (a kijelölés alatt nem lehet görgetni; a Mégse gomb kilép)
    document.documentElement.style.touchAction = 'none';
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      document.documentElement.style.cursor = prevCursor;
      document.documentElement.style.touchAction = prevTouch;
      setHover(null);
      setDrag(null);
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

  const tick = useTick(comments.length > 0 || mode !== 'idle' || spotlight !== null);
  void tick; // a számláló változása újrarendereli a pozíció-függő elemeket

  function cancel() {
    setMode('idle');
    setTarget(null);
    setHover(null);
    setError(null);
  }

  /** Ugrás egy kommentre a listából: ugyanazon az oldalon görgetés + szál, másik oldalon betöltés mélylinkkel. */
  function goTo(c: WidgetComment) {
    setListOpen(false);
    if (c.pageUrl === page) {
      setFocusId(c.id);
      return;
    }
    const href = deepLinkTo(c.pageUrl, c.id);
    if (href) location.href = href;
  }

  function toggleList() {
    if (mode !== 'idle') return;
    setNotice(null);
    setListOpen((v) => !v);
  }

  function toggle() {
    setListOpen(false);
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
      saveEmail(values.email);
      const created = await api.createComment({
        authorName: values.authorName,
        body: values.body,
        pageUrl: pageUrl(),
        cssSelector: target.selector,
        posX: target.posX,
        posY: target.posY,
        areaWidth: target.area?.w,
        areaHeight: target.area?.h,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        customerEmail: values.email || undefined,
      });

      let shotOk = true;
      if (values.includeScreenshot) {
        const image = await captureViewport(targetBox(target) ?? undefined);
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

      rememberOwn(created.id, created.editToken, created.editableUntil);
      // Új komment érvénytelenítheti a kör jóváhagyását: a kör állapotát frissítjük
      api.project().then(setProject).catch(() => undefined);
      let failedFiles = 0;
      for (const file of values.files) {
        try {
          await api.uploadAttachment(created.id, file);
        } catch {
          failedFiles++;
        }
      }

      setToast(failedFiles > 0 ? `A visszajelzés elküldve, de ${failedFiles} kép csatolása nem sikerült.` : shotOk ? 'Köszönjük, a visszajelzés elküldve.' : 'A visszajelzés elküldve, de a képernyőképet nem sikerült csatolni.');
      setAll(await api.comments().catch(() => all));
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
      setAll(await api.comments().catch(() => all));
      return null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return 'Ehhez már nem lehet válaszolni (lezárt kör vagy betelt szál).';
      return sendError(e);
    }
  }

  /** A saját komment szövegének módosítása (a szerkesztési határidőn belül). */
  async function editComment(commentId: number, body: string): Promise<string | null> {
    const token = ownToken(commentId);
    if (!token) return 'A szerkesztési idő lejárt.';
    try {
      const updated = await api.editComment(commentId, token, body);
      setAll((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      return null;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 403)) {
        return 'A szerkesztési idő lejárt, vagy a komment már feldolgozás alatt áll.';
      }
      return sendError(e);
    }
  }

  /** A saját komment visszavonása (törlése), ha még nem válaszoltak rá. */
  async function withdrawComment(commentId: number): Promise<string | null> {
    const token = ownToken(commentId);
    if (!token) return 'A visszavonási idő lejárt.';
    try {
      await api.withdrawComment(commentId, token);
      forgetOwn(commentId);
      setAll((prev) => prev.filter((c) => c.id !== commentId));
      api.project().then(setProject).catch(() => undefined);
      setToast('A visszajelzést visszavontad.');
      return null;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 403)) {
        return 'Már nem vonható vissza (lejárt az idő, vagy válaszoltak rá).';
      }
      return sendError(e);
    }
  }

  /** Az ügyfél elfogadja a kész kommentet. */
  async function approveComment(commentId: number): Promise<string | null> {
    try {
      const updated = await api.approveComment(commentId);
      setAll((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      return null;
    } catch (e) {
      return e instanceof ApiError && e.status === 409
        ? 'Ez a visszajelzés közben megváltozott, frissítsd az oldalt.'
        : sendError(e);
    }
  }

  /** Az ügyfél visszanyitja a kész kommentet; a kör jóváhagyása ilyenkor megszűnik. */
  async function reopenComment(commentId: number, authorName: string, reason: string): Promise<string | null> {
    try {
      saveAuthor(authorName);
      const updated = await api.reopenComment(commentId, authorName, reason);
      setAll((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      api.project().then(setProject).catch(() => undefined);
      return null;
    } catch (e) {
      return e instanceof ApiError && e.status === 409
        ? 'Ez a visszajelzés közben megváltozott, frissítsd az oldalt.'
        : sendError(e);
    }
  }

  /** Az ügyfél jóváhagyja a kört. */
  async function approveRound(authorName: string): Promise<string | null> {
    try {
      saveAuthor(authorName);
      const round: RoundInfo = await api.approveRound(authorName);
      setProject((p) => (p ? { ...p, openRound: round } : p));
      setToast('Köszönjük, a kört jóváhagytad.');
      return null;
    } catch (e) {
      return e instanceof ApiError && e.status === 409
        ? 'Jóváhagyás előtt minden visszajelzésnek késznek kell lennie.'
        : sendError(e);
    }
  }

  if (fatal) return null;

  const hoverRect = mode === 'pick' && hover ? hover.getBoundingClientRect() : null;
  const targetRect = mode === 'compose' && target ? targetBox(target) : null;
  const spotRect = spotlight && spotlight.isConnected ? spotlight.getBoundingClientRect() : null;
  const box = (r: Rect) => ({ left: r.left, top: r.top, width: r.width, height: r.height });

  return (
    <>
      <style>{styles}</style>

      {project && (
        <Pins
          comments={comments}
          inert={mode === 'pick'}
          defaultName={savedAuthor()}
          onReply={reply}
          onApprove={approveComment}
          onEdit={editComment}
          onWithdraw={withdrawComment}
          onReopen={reopenComment}
          openRequest={openRequest}
        />
      )}

      {spotRect && <div class="hl spot" style={box(spotRect)} />}
      {hoverRect && <div class="hl" style={box(hoverRect)} />}
      {drag && <div class="hl area" style={box(drag)} />}
      {targetRect && <div class={target?.area ? 'hl area' : 'hl'} style={box(targetRect)} />}

      {mode === 'pick' && (
        <div class="banner">
          {touchDevice ? 'Koppints egy elemre, vagy húzz ujjal területet · Mégse: a gombbal' : 'Kattints egy elemre, vagy húzz egy téglalapot a területre · Esc: mégse'}
        </div>
      )}

      {mode === 'compose' && target && (
        <Composer
          selector={target.selector}
          defaultName={savedAuthor()}
          defaultEmail={savedEmail()}
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

      {listOpen && mode === 'idle' && (
        <Overview
          comments={all}
          currentPage={page}
          round={project?.openRound ?? null}
          defaultName={savedAuthor()}
          onGo={goTo}
          onClose={() => setListOpen(false)}
          onApproveRound={approveRound}
          loadHistory={api.history}
        />
      )}

      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}

      {project && (
        <div class="dock">
          {mode === 'idle' && (all.length > 0 || project?.openRound) && (
            <button class="fab ghost" onClick={toggleList} aria-expanded={listOpen}>
              Lista
              <span class="count">{all.length}</span>
            </button>
          )}
          <button class="fab" onClick={toggle}>
            {mode === 'idle' ? 'Visszajelzés' : 'Mégse'}
          </button>
        </div>
      )}
    </>
  );
}
