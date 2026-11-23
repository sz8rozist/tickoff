import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomHex } from './crypto';
import { storageDir } from './env';

/**
 * A képernyőképek és mellékletek tárolója: fájlrendszer, a projekt azonosítója szerinti almappákban. Az útvonalakat
 * kizárólag számokból és generált nevekből építjük, a feloldás pedig a tároló mappáján belül marad (path traversal ellen).
 */

function base(): string {
  return path.resolve(storageDir());
}

/** A tárolóhoz viszonyított útvonal abszolút alakja; a tárolón kívüli útvonalra hibát dob. */
export function resolveStored(relative: string): string {
  const root = base();
  const full = path.resolve(root, relative);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error('Érvénytelen útvonal');
  return full;
}

/** Egy projekt összes fájljának törlése (a projekt vagy a tulajdonos fiókjának törlésekor). */
export async function deleteProjectFiles(projectId: number): Promise<void> {
  try {
    await rm(resolveStored(String(projectId)), { recursive: true, force: true });
  } catch (e) {
    console.warn('[storage] A projekt fájljai nem törölhetők teljesen:', projectId, String(e));
  }
}

/** Egy fájl törlése. Ha nincs ilyen, nem hiba; a hibát naplózzuk, de nem dobjuk tovább (a törlés fő része már megtörtént). */
export async function deleteStored(relative: string | null): Promise<void> {
  if (!relative) return;
  try {
    await rm(resolveStored(relative), { force: true });
  } catch (e) {
    console.warn('[storage] A fájl nem törölhető:', relative, String(e));
  }
}

async function writeAtomic(relative: string, data: Buffer): Promise<string> {
  const target = resolveStored(relative);
  await mkdir(path.dirname(target), { recursive: true });
  // Előbb ideiglenes fájlba írunk, aztán átnevezzük: félbeszakadt írás nem hagy csonka képet
  const tmp = `${target}.${randomHex(6)}.tmp`;
  try {
    await writeFile(tmp, data);
    await rename(tmp, target);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
  return relative;
}

/** A képernyőkép mentése; a tárolóhoz viszonyított útvonalat adja vissza (pl. `3/17.png`). */
export function saveScreenshot(projectId: number, commentId: number, extension: string, data: Buffer): Promise<string> {
  return writeAtomic(`${projectId}/${commentId}.${extension}`, data);
}

/** Melléklet mentése: véletlen fájlnév (a komment azonosítója + 128 bit), így több melléklet nem ütközik, és a név nem találgatható. */
export function saveAttachment(projectId: number, commentId: number, extension: string, data: Buffer): Promise<string> {
  return writeAtomic(`${projectId}/c${commentId}-${randomHex(16)}.${extension}`, data);
}
