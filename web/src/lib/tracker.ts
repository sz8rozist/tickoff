/** A hibajegy-követő URL-sablonjának ellenőrzése: https, és legalább a {title} helyőrző szerepeljen benne. */
export function isValidTrackerTemplate(template: string): boolean {
  if (!template.includes('{title}')) return false;
  try {
    // A helyőrzőket egy ártalmatlan értékkel pótolva érvényes https-címnek kell maradnia (felhasználónév nélkül)
    const u = new URL(template.replace(/\{(title|body|url)\}/g, 'x'));
    return u.protocol === 'https:' && u.username === '' && u.password === '';
  } catch {
    return false;
  }
}
