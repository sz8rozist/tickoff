/** Téglalap a viewport koordinátáiban. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Két pont által kifeszített téglalap (a húzás iránya mindegy). */
export function rectBetween(x0: number, y0: number, x1: number, y1: number): Rect {
  return { left: Math.min(x0, x1), top: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

/**
 * A legkisebb elem, amely az egész téglalapot tartalmazza: a kijelölés ehhez az elemhez kötődik, így a terület az
 * elrendezés változásakor (pl. más képernyőméreten) az elemmel együtt mozog. Ha nincs ilyen, a törzs (body).
 */
export function elementFor(rect: Rect, host: HTMLElement): Element {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let el: Element | null = document.elementFromPoint(cx, cy);
  if (!el || el === host || host.contains(el)) el = document.body;
  const tolerance = 1;
  while (el && el !== document.body && el !== document.documentElement) {
    const r = el.getBoundingClientRect();
    if (
      r.left <= rect.left + tolerance &&
      r.top <= rect.top + tolerance &&
      r.right >= rect.left + rect.width - tolerance &&
      r.bottom >= rect.top + rect.height - tolerance
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return document.body;
}

/** A terület elhelyezkedése az elemhez viszonyítva, az elem méretének százalékában. */
export function areaOf(el: Element, rect: Rect): { posX: number; posY: number; w: number; h: number } {
  const r = el.getBoundingClientRect();
  const pct = (v: number, total: number) => (total > 0 ? clamp((v / total) * 100, 0, 100) : 0);
  return {
    posX: pct(rect.left - r.left, r.width),
    posY: pct(rect.top - r.top, r.height),
    w: pct(rect.width, r.width),
    h: pct(rect.height, r.height),
  };
}

/** A mentett (százalékos) terület visszaszámolása viewport-koordinátákra az elem aktuális helyzete alapján. */
export function areaRect(el: Element, posX: number, posY: number, w: number, h: number): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    left: r.left + (r.width * posX) / 100,
    top: r.top + (r.height * posY) / 100,
    width: (r.width * w) / 100,
    height: (r.height * h) / 100,
  };
}
