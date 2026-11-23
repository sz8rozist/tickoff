import { sendDueDigests } from './digest';

/**
 * Egyszerű, folyamaton belüli ütemező (külön cron nélkül): percenként ránéz az időre, és reggel 8-kor (a beállított
 * időzónában) elindítja az összefoglaló e-mailek küldését. Fejlesztői újratöltéskor egyetlen példány fut. Több példányos
 * üzemeltetésnél a felhasználónkénti "utoljára küldve" védi a dupla levelet, de ilyenkor érdemes külső ütemezőt használni.
 */

const globalForScheduler = globalThis as unknown as { __tickoffScheduler?: NodeJS.Timeout; __tickoffLastDigestDay?: string };

function zoneParts(now: Date): { day: string; hour: number; minute: number } {
  const tz = process.env.TICKOFF_EXPORT_ZONE ?? 'Europe/Budapest';
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

export function startScheduler(): void {
  if (globalForScheduler.__tickoffScheduler) return;
  const timer = setInterval(() => {
    const { day, hour, minute } = zoneParts(new Date());
    if (hour !== 8 || minute !== 0 || globalForScheduler.__tickoffLastDigestDay === day) return;
    globalForScheduler.__tickoffLastDigestDay = day;
    sendDueDigests()
      .then((n) => n > 0 && console.info(`[digest] Összefoglaló e-mailek elküldve: ${n}`))
      .catch((e) => console.error('[digest] Az összefoglaló e-mailek küldése nem sikerült:', String(e)));
  }, 60_000);
  timer.unref();
  globalForScheduler.__tickoffScheduler = timer;
}
