import { toCanvas } from 'html-to-image';
import type { Rect } from './area';
import { HOST_ID } from './config';

const MAX_BYTES = 3 * 1024 * 1024; // a szerver korlátja
const TIMEOUT_MS = 10_000;

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Képet készít az aktuális nézetről (viewport), és piros kerettel kiemeli a kiválasztott elemet vagy területet.
 * Best effort: bármilyen hiba (pl. idegen domainről érkező kép, időtúllépés) esetén null-t ad.
 *
 * Korlát: a scroll-pozíciót eltolással kezeljük, ezért görgetett oldalon a `position: fixed` elemek
 * (pl. rögzített fejléc) elcsúszhatnak a képen.
 */
export async function captureViewport(highlight?: Rect): Promise<Blob | null> {
  try {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const render = toCanvas(document.documentElement, {
      width,
      height,
      pixelRatio: 1,
      cacheBust: true,
      style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`, transformOrigin: 'top left' },
      // A widget saját felülete ne kerüljön a képre.
      filter: (node) => !(node instanceof Element && node.id === HOST_ID),
    });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS));
    const canvas = await Promise.race([render, timeout]);

    if (highlight) {
      const r = { left: highlight.left, top: highlight.top, width: highlight.width, height: highlight.height };
      const ctx = canvas.getContext('2d');
      if (ctx && r.width > 0 && r.height > 0) {
        ctx.fillStyle = 'rgba(229, 57, 53, 0.12)';
        ctx.fillRect(r.left, r.top, r.width, r.height);
        // Kétszínű keret (fehér + piros), hogy piros vagy fehér elemen és háttéren is látsszon.
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 7;
        ctx.strokeRect(r.left - 2, r.top - 2, r.width + 4, r.height + 4);
        ctx.strokeStyle = '#e53935';
        ctx.lineWidth = 3;
        ctx.strokeRect(r.left - 2, r.top - 2, r.width + 4, r.height + 4);
      }
    }

    let blob = await toBlob(canvas, 'image/png');
    if (blob && blob.size > MAX_BYTES) {
      blob = await toBlob(canvas, 'image/jpeg', 0.8);
    }
    return blob && blob.size <= MAX_BYTES ? blob : null;
  } catch (e) {
    console.warn('[Tickoff] A képernyőkép készítése nem sikerült:', e);
    return null;
  }
}
