import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Egyszerű, szöveges e-mailek küldése SMTP-n. A küldés a kérés után, a háttérben történik (a kérés nem vár az SMTP-
 * szerverre, és annak hibája nem bukatja el), a hibát csak naplózzuk. Ha nincs SMTP_HOST beállítva, a levelek nem
 * mennek el (az e-mailre épülő funkciók ilyenkor nem működnek).
 */

const globalForMail = globalThis as unknown as { __tickoffMail?: Transporter | null };

export function isMailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function transporter(): Transporter | null {
  if (!isMailEnabled()) return null;
  if (globalForMail.__tickoffMail === undefined) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    globalForMail.__tickoffMail = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: process.env.SMTP_STARTTLS === 'true',
      auth: user ? { user, pass: process.env.SMTP_PASSWORD ?? '' } : undefined,
    });
  }
  return globalForMail.__tickoffMail ?? null;
}

/** A tárgyból kiszedi a sortöréseket, hogy a (felhasználó által adott) szöveg ne injektálhasson fejlécet. */
export function singleLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

/** Levél küldése a háttérben. A címzett és a tárgy nem naplózható (személyes adat), csak a hiba oka. */
export function sendMail(to: string, subject: string, text: string): void {
  const t = transporter();
  if (!t) return;
  t.sendMail({
    from: process.env.TICKOFF_MAIL_FROM ?? 'Tickoff <no-reply@localhost>',
    to,
    subject: singleLine(subject),
    text,
  }).catch((e: unknown) => console.error('[mail] Az e-mail küldése nem sikerült:', String(e)));
}
