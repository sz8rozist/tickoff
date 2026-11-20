const MAX_CLASSES = 2;

function isStableClass(c: string): boolean {
  // A generált, hash-szerű vagy állapotot jelző osztályokat kihagyjuk (pl. "css-1x2y3z", "is-active").
  return /^[a-zA-Z_-][\w-]{0,39}$/.test(c) && !/\d{3,}/.test(c) && !/^(is|has|js)-/.test(c) && !c.startsWith('tickoff');
}

function esc(s: string): string {
  return CSS.escape(s);
}

function count(selector: string): number {
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

function segment(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const classes = [...el.classList].filter(isStableClass).slice(0, MAX_CLASSES);
  let seg = tag + classes.map((c) => '.' + esc(c)).join('');

  const parent = el.parentElement;
  if (parent) {
    const same = [...parent.children].filter((s) => s.matches(seg));
    if (same.length > 1) {
      // A testvérek között nem egyedi: a pontos pozíciót is megadjuk.
      seg += `:nth-child(${[...parent.children].indexOf(el) + 1})`;
    }
  }
  return seg;
}

/**
 * Az elemhez egy lehetőleg rövid, az oldalon egyedi CSS-selectort készít. Felülről lefelé építi az utat,
 * és megáll, amint a selector egyedi. Ha nem sikerül egyedit találni, a legjobb közelítést adja vissza.
 */
export function cssSelectorFor(el: Element): string {
  if (el.id && count('#' + esc(el.id)) === 1) {
    return '#' + esc(el.id);
  }

  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    if (node.id && count('#' + esc(node.id)) === 1) {
      parts.unshift('#' + esc(node.id));
      break;
    }
    parts.unshift(segment(node));
    const candidate = parts.join(' > ');
    if (count(candidate) === 1 && document.querySelector(candidate) === el) {
      return candidate;
    }
    node = node.parentElement;
  }
  return parts.join(' > ');
}

/** A selector által megtalált elem, vagy null (érvénytelen selector, vagy az elem már nincs az oldalon). */
export function resolve(selector: string | null): Element | null {
  if (!selector) return null;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}
