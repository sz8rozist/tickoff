/**
 * A widget nyelve. A forrásszövegek magyarul vannak a kódban (ez a kulcs), az angol fordítás a szótárban. Az aktuális
 * nyelvet a projekt beállítása adja (a widget indulásakor töltődik be, még az első megjelenítés előtt), ezért elég
 * egyetlen modul-szintű érték. Ismeretlen nyelvnél vagy hiányzó fordításnál a magyar szöveg marad.
 */
export type Lang = 'hu' | 'en';

let current: Lang = 'hu';

export function setLang(lang: string | null | undefined) {
  current = lang === 'en' ? 'en' : 'hu';
}

/** A dátumformázás nyelve. */
export function locale(): string {
  return current === 'en' ? 'en-GB' : 'hu-HU';
}

const EN: Record<string, string> = {
  // Általános
  'Visszajelzés': 'Feedback',
  'Visszajelzések': 'Feedback',
  'Mégse': 'Cancel',
  'Rendben': 'OK',
  'Lista': 'List',
  'Küldés': 'Send',
  'Küldés…': 'Sending…',
  'Mentés': 'Save',
  'Mentés…': 'Saving…',
  'Betöltés…': 'Loading…',
  'Bezárás': 'Close',
  'A neved': 'Your name',
  'Nyitott': 'Open',
  'Folyamatban': 'In progress',
  'Kész': 'Done',
  'csapat': 'team',

  // Widget
  'Jelenleg nincs nyitott visszajelzési kör.': 'There is no open feedback round at the moment.',
  'Túl sok kérés érkezett tőled, várj egy kicsit, és próbáld újra.': 'Too many requests from you. Please wait a moment and try again.',
  'Ellenőrizd az adatokat: a név és a szöveg kötelező.': 'Please check the details: name and message are required.',
  'Nem sikerült elküldeni, próbáld újra.': 'Could not send. Please try again.',
  'Ez a visszajelzés ezen az oldalon már nem érhető el (lezárt kör vagy törölt komment).': 'This feedback is no longer available on this page (closed round or deleted comment).',
  'Az elem már nem található az oldalon.': 'The element can no longer be found on this page.',
  'Jelenleg nincs nyitott visszajelzési kör, ezért most nem tudsz észrevételt küldeni.': 'There is no open feedback round right now, so you cannot send feedback at the moment.',
  'A visszajelzés elküldve, de {n} kép csatolása nem sikerült.': 'Your feedback was sent, but {n} image(s) could not be attached.',
  'Köszönjük, a visszajelzés elküldve.': 'Thank you, your feedback has been sent.',
  'A visszajelzés elküldve, de a képernyőképet nem sikerült csatolni.': 'Your feedback was sent, but the screenshot could not be attached.',
  'Ehhez már nem lehet válaszolni (lezárt kör vagy betelt szál).': 'You can no longer reply to this (closed round or full thread).',
  'A szerkesztési idő lejárt.': 'The editing time has expired.',
  'A szerkesztési idő lejárt, vagy a komment már feldolgozás alatt áll.': 'The editing time has expired, or the comment is already being processed.',
  'A visszavonási idő lejárt.': 'The time to withdraw has expired.',
  'A visszajelzést visszavontad.': 'You withdrew your feedback.',
  'Már nem vonható vissza (lejárt az idő, vagy válaszoltak rá).': 'It can no longer be withdrawn (time expired, or someone has replied).',
  'Ez a visszajelzés közben megváltozott, frissítsd az oldalt.': 'This feedback has changed in the meantime. Please refresh the page.',
  'Köszönjük, a kört jóváhagytad.': 'Thank you, you approved the round.',
  'Jóváhagyás előtt minden visszajelzésnek késznek kell lennie.': 'All feedback must be done before the round can be approved.',
  'Koppints egy elemre, vagy húzz ujjal területet · Mégse: a gombbal': 'Tap an element, or drag with your finger to mark an area · Cancel: use the button',
  'Kattints egy elemre, vagy húzz egy téglalapot a területre · Esc: mégse': 'Click an element, or drag a rectangle over an area · Esc: cancel',

  // Űrlap
  'Új visszajelzés': 'New feedback',
  'Mit szeretnél módosítani?': 'What would you like changed?',
  'Pl.: ez a gomb mobilon kilóg a képből': 'E.g. this button overflows the screen on mobile',
  'E-mail (nem kötelező)': 'Email (optional)',
  'Ide írunk, ha válaszolunk': "We'll write here when we reply",
  'Ez nem tűnik érvényes e-mail-címnek.': "This doesn't look like a valid email address.",
  'Képek csatolása (nem kötelező)': 'Attach images (optional)',
  'Képernyőkép csatolása': 'Attach a screenshot',
  'Csak PNG, JPEG, GIF vagy WebP kép csatolható.': 'Only PNG, JPEG, GIF or WebP images can be attached.',
  '"{name}" túl nagy (legfeljebb 3 MB).': '"{name}" is too large (3 MB max).',
  'Legfeljebb {max} kép csatolható.': 'You can attach up to {max} images.',
  'Eltávolítás: {name}': 'Remove: {name}',

  // Jelölők és buborék
  'Válasz': 'Reply',
  'Válasz írása…': 'Write a reply…',
  'A komment szövege': 'Comment text',
  'Szerkesztés': 'Edit',
  'Biztosan visszavonod?': 'Really withdraw?',
  'Visszavonás': 'Withdraw',
  '✓ Elfogadva': '✓ Approved',
  'Mi nem jó még? (nem kötelező)': "What's still not right? (optional)",
  'Indoklás': 'Reason',
  'Visszanyitás': 'Reopen',
  'Rendben van így?': 'Is this OK now?',
  'Elfogadom': 'Approve',
  'Visszanyitom': 'Reopen',
  ' · szerkesztve': ' · edited',
  '{n}. visszajelzés: {author}': 'Feedback {n}: {author}',

  // Lista
  'Összes visszajelzés': 'All feedback',
  'Aktuális kör': 'Current round',
  '{n}. kör': 'Round {n}',
  'Korábbi körök': 'Previous rounds',
  'Még nincs visszajelzés ebben a körben.': 'No feedback in this round yet.',
  ' · elfogadva ✓': ' · approved ✓',
  ' · {n} válasz': ' · {n} replies',
  'ez az oldal': 'this page',
  'Jóváhagyva': 'Approved',
  'Köszönjük!': 'Thank you!',
  'A kör jóváhagyható, ha minden visszajelzés kész.': 'The round can be approved once all feedback is done.',
  'Minden visszajelzés kész. Ha elégedett vagy, hagyd jóvá a kört.': 'All feedback is done. If you are happy, please approve the round.',
  'Kör jóváhagyása': 'Approve round',
  'A korábbi körök betöltése nem sikerült.': 'Could not load previous rounds.',
  'Még nincs lezárt kör.': 'No closed rounds yet.',
  'lezárva: {date}': 'closed: {date}',
  'jóváhagyva': 'approved',
  'Nem volt visszajelzés.': 'There was no feedback.',
  'Határidő: {when} (lejárt)': 'Due: {when} (overdue)',
  'Határidő: {when} (ma)': 'Due: {when} (today)',
  'Határidő: {when} (még {days} nap)': 'Due: {when} ({days} days left)',
};

/** A szöveg az aktuális nyelven; a `{név}` helyőrzők a második paraméterből töltődnek. */
export function t(hu: string, vars?: Record<string, string | number>): string {
  let text = current === 'en' ? (EN[hu] ?? hu) : hu;
  if (vars) {
    for (const [key, value] of Object.entries(vars)) text = text.split(`{${key}}`).join(String(value));
  }
  return text;
}
