import { dashboardOrigin } from './env';
import { isMailEnabled, sendMail } from './mail';
import { allow, LIMITS } from './rate-limit';
import type { Comment } from './comments';
import type { Project } from './access';
import type { User } from './auth/session';

/**
 * E-mail értesítések. A küldés a háttérben történik (lásd sendMail), és címzettenként korlátozott (inbox- és SMTP-hírnév
 * védelem): tartós, nagy forgalomnál a felesleges levelek elmaradnak, a kommentek ettől még mentődnek.
 */

const EXCERPT_LENGTH = 500;

export function excerpt(body: string): string {
  const text = body.trim();
  return text.length <= EXCERPT_LENGTH ? text : text.slice(0, EXCERPT_LENGTH) + '…';
}

/** Az oldal címe a komment mélylinkjével (a widget ezt a paramétert olvassa ki); egy meglévő paraméter lecserélődik. */
export function deepLink(pageUrl: string, commentId: number): string {
  const url = new URL(pageUrl);
  url.searchParams.delete('tickoff-comment');
  url.searchParams.append('tickoff-comment', String(commentId));
  return url.toString();
}

/**
 * Levél az ügyfélnek, ha a komment írója megadott e-mail-címet. A levél a kommentre mutató linket és leiratkozó linket
 * tartalmaz. Címenként ugyanaz a korlát él, mint a csapat tagjainál.
 */
function notifyCustomer(project: Project, comment: Comment, subject: string, message: string): void {
  const email = comment.customerEmail;
  const token = comment.notifyToken;
  if (!isMailEnabled() || !email || !token) return;
  if (!allow('c' + email.toLowerCase(), LIMITS.notifyRecipient)) {
    console.info('[notify] Ügyfél-értesítés kihagyva (címenkénti korlát), komment:', comment.id);
    return;
  }
  const unsubscribe = `${dashboardOrigin()}/api/notifications/unsubscribe/${token}`;
  const link = deepLink(comment.pageUrl, comment.id);
  const text =
    project.widgetLang === 'en'
      ? `Hi ${comment.authorName}!\n\n${message}\n\nOpen on the page: ${link}\n\n` +
        'You received this email because you gave your email address when submitting your feedback. ' +
        `If you do not want more notifications, you can unsubscribe here: ${unsubscribe}\n`
      : `Szia ${comment.authorName}!\n\n${message}\n\nMegnyitás az oldalon: ${link}\n\n` +
        'Ezt a levelet azért kaptad, mert a visszajelzésed beküldésekor megadtad az e-mail-címedet. ' +
        `Ha nem szeretnél több értesítést, itt leiratkozhatsz: ${unsubscribe}\n`;
  sendMail(email, '[Tickoff] ' + subject, text);
}

/** A csapat válaszolt: ha az ügyfél megadta az e-mail-címét, értesítjük. */
export function designerReply(project: Project, comment: Comment, authorName: string, replyBody: string): void {
  if (project.widgetLang === 'en') {
    notifyCustomer(project, comment, `Reply to your feedback: ${project.name}`,
      `${authorName} (from the team) replied to your feedback on the "${project.name}" project:\n\n${excerpt(replyBody)}`);
    return;
  }
  notifyCustomer(project, comment, `Válasz a visszajelzésedre: ${project.name}`,
    `${authorName} (a csapatból) válaszolt a visszajelzésedre a(z) „${project.name}” projektben:\n\n${excerpt(replyBody)}`);
}

/** A csapat késznek jelölte a kommentet: az ügyfél megnézheti, elfogadhatja vagy visszanyithatja. */
export function commentDone(project: Project, comment: Comment): void {
  if (project.widgetLang === 'en') {
    notifyCustomer(project, comment, `A fix is ready: ${project.name}`,
      `The team marked your feedback as done in the "${project.name}" project:\n\n${excerpt(comment.body)}\n\n` +
        'You can review it on the page, where you can also approve it or reopen it.');
    return;
  }
  notifyCustomer(project, comment, `Elkészült a javítás: ${project.name}`,
    `A csapat késznek jelölte a visszajelzésedet a(z) „${project.name}” projektben:\n\n${excerpt(comment.body)}\n\n` +
      'Megnézheted az oldalon, ott el is fogadhatod, vagy visszanyithatod.');
}

/** Valaki egy kommentet másra bízott: az új felelős értesítést kap (ha nem kapcsolta ki). */
export function assigned(project: Project, comment: Comment, assignee: User, by: string): void {
  if (!isMailEnabled() || !assignee.notifyEmail) return;
  if (!allow('u' + assignee.id, LIMITS.notifyRecipient)) return;
  sendMail(
    assignee.email,
    `[Tickoff] Feladatot kaptál: ${project.name}`,
    `${by} rád bízta ezt a visszajelzést a(z) „${project.name}” projektben (oldal: ${comment.pageUrl}):\n\n${excerpt(comment.body)}\n\n` +
      `Megnyitás: ${dashboardOrigin()}/\n\n` +
      'Ezt a levelet azért kaptad, mert a Tickoffban értesítést kértél. A beállítást a Tickoff felületén kapcsolhatod ki.\n',
  );
}
