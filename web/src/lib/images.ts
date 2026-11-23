/**
 * Képtípus felismerése a fájl első bájtjaiból. A kliens által küldött Content-Type nem megbízható, ezért a tartalom dönt.
 * Csak rasztergrafikus formátumok engedélyezettek: SVG nincs közöttük (a script futtatható lenne benne).
 */

export interface ImageType {
  extension: 'png' | 'jpg' | 'gif' | 'webp';
  contentType: string;
}

function starts(d: Uint8Array, offset: number, ...expected: (number | string)[]): boolean {
  if (d.length < offset + expected.length) return false;
  return expected.every((e, i) => d[offset + i] === (typeof e === 'string' ? e.charCodeAt(0) : e));
}

export function detectImage(d: Uint8Array): ImageType | null {
  if (starts(d, 0, 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a)) return { extension: 'png', contentType: 'image/png' };
  if (starts(d, 0, 0xff, 0xd8, 0xff)) return { extension: 'jpg', contentType: 'image/jpeg' };
  if (starts(d, 0, 'G', 'I', 'F', '8') && d.length > 5 && (d[4] === 0x37 || d[4] === 0x39) && d[5] === 0x61) {
    return { extension: 'gif', contentType: 'image/gif' };
  }
  // WebP: "RIFF" <4 bájt méret> "WEBP"
  if (starts(d, 0, 'R', 'I', 'F', 'F') && starts(d, 8, 'W', 'E', 'B', 'P')) return { extension: 'webp', contentType: 'image/webp' };
  return null;
}
