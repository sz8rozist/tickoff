/**
 * Egyszerű CSV-író magyar Excelhez: pontosvessző elválasztó, UTF-8 BOM (különben az ékezetek elromlanak), CRLF sorvég.
 * A cellák védettek a CSV-injection ellen: az "=", "+", "-", "@" jellel kezdődő szöveget Excel képletként értelmezné,
 * ezért aposztróf kerül elé.
 */

const SEPARATOR = ';';
const NEWLINE = '\r\n';

export function csvCell(value: string | null | undefined): string {
  if (!value) return '';
  let v = value;
  const first = v[0];
  if (first === '=' || first === '+' || first === '-' || first === '@' || first === '\t' || first === '\r') v = "'" + v;
  const needsQuotes = v.includes(SEPARATOR) || v.includes('"') || v.includes('\n') || v.includes('\r');
  return needsQuotes ? '"' + v.replace(/"/g, '""') + '"' : v;
}

export class CsvWriter {
  private out = '';

  row(cells: (string | null | undefined)[]): this {
    this.out += cells.map(csvCell).join(SEPARATOR) + NEWLINE;
    return this;
  }

  /** UTF-8 bájtok BOM-mal. */
  toBuffer(): Buffer {
    return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(this.out, 'utf8')]);
  }
}

/** Fájlnévbarát, ékezet nélküli név a projektnévből. */
export function slug(name: string): string {
  const ascii = name.normalize('NFD').replace(/\p{M}+/gu, '');
  const s = ascii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s === '') return 'projekt';
  return s.length > 40 ? s.slice(0, 40).replace(/-+$/, '') : s;
}
