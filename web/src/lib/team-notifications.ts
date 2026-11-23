import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Project } from './access';
import type { Comment, Round } from './comments';
import { dashboardOrigin } from './env';
import { isMailEnabled, sendMail } from './mail';
import { excerpt } from './notifications';
import { allow, LIMITS } from './rate-limit';

/**
 * E-mail értesítés a projekt csapatának (tulajdonos és tagok) az ügyfelektől érkező eseményekről: új komment, ügyfél-válasz,
 * újranyitás, kör jóváhagyása. Aki kikapcsolta az értesítéseket, nem kap levelet. Címzettenként korlátozott. A levél nyelve
 * a címzett fiókjának beállítása (hu vagy en).
 */

type En = boolean;
interface Mail {
  subject: string;
  message: string;
}

async function notifyTeam(project: Project, build: (en: En) => Mail): Promise<void> {
  if (!isMailEnabled()) return;
  const columns = { id: schema.users.id, email: schema.users.email, notify: schema.users.notifyEmail, lang: schema.users.lang };
  const rows = await db.select(columns).from(schema.users).where(eq(schema.users.id, project.ownerId));
  const members = await db
    .select(columns)
    .from(schema.projectMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.projectMembers.userId))
    .where(eq(schema.projectMembers.projectId, project.id));

  const seen = new Set<number>();
  for (const u of [...rows, ...members]) {
    if (seen.has(u.id) || !u.notify) continue;
    seen.add(u.id);
    const en = u.lang === 'en';
    const { subject, message } = build(en);
    const text = en
      ? `${message}\n\nOpen: ${dashboardOrigin()}/\n\n` +
        'You received this email because you asked for notifications about new feedback in Tickoff. ' +
        'You can turn it off in the Tickoff interface.\n'
      : `${message}\n\nMegnyitás: ${dashboardOrigin()}/\n\n` +
        'Ezt a levelet azért kaptad, mert a Tickoffban értesítést kértél az új visszajelzésekről. ' +
        'A beállítást a Tickoff felületén kapcsolhatod ki.\n';
    if (allow('u' + u.id, LIMITS.notifyRecipient)) sendMail(u.email, `[Tickoff] ${subject}`, text);
    else console.info('[notify] Értesítés kihagyva (címzettenkénti korlát), felhasználó:', u.id);
  }
}

export function newCommentMail(project: Project, comment: Comment): Promise<void> {
  return notifyTeam(project, (en) =>
    en
      ? {
          subject: `New feedback: ${project.name}`,
          message: `${comment.authorName} wrote new feedback in the "${project.name}" project (page: ${comment.pageUrl}):\n\n${excerpt(comment.body)}`,
        }
      : {
          subject: `Új visszajelzés: ${project.name}`,
          message: `${comment.authorName} új visszajelzést írt a(z) „${project.name}” projektben (oldal: ${comment.pageUrl}):\n\n${excerpt(comment.body)}`,
        },
  );
}

export function customerReplyMail(project: Project, comment: Comment, authorName: string, body: string): Promise<void> {
  return notifyTeam(project, (en) =>
    en
      ? {
          subject: `New reply: ${project.name}`,
          message: `${authorName} replied to ${comment.authorName}'s feedback in the "${project.name}" project (page: ${comment.pageUrl}):\n\n${excerpt(body)}`,
        }
      : {
          subject: `Új válasz: ${project.name}`,
          message: `${authorName} válaszolt ${comment.authorName} visszajelzésére a(z) „${project.name}” projektben (oldal: ${comment.pageUrl}):\n\n${excerpt(body)}`,
        },
  );
}

export function reopenedMail(project: Project, comment: Comment, by: string, reason: string | null): Promise<void> {
  return notifyTeam(project, (en) =>
    en
      ? {
          subject: `Feedback reopened: ${project.name}`,
          message:
            `${by} reopened their feedback marked as done in the "${project.name}" project (page: ${comment.pageUrl}):\n\n${excerpt(comment.body)}` +
            (reason ? `\n\nReason: ${excerpt(reason)}` : ''),
        }
      : {
          subject: `Újranyitott visszajelzés: ${project.name}`,
          message:
            `${by} újranyitotta a kész visszajelzését a(z) „${project.name}” projektben (oldal: ${comment.pageUrl}):\n\n${excerpt(comment.body)}` +
            (reason ? `\n\nIndoklás: ${excerpt(reason)}` : ''),
        },
  );
}

export function roundApprovedMail(project: Project, round: Round, by: string): Promise<void> {
  return notifyTeam(project, (en) =>
    en
      ? {
          subject: `The customer approved the round: ${project.name}`,
          message: `${by} approved round ${round.number} of the "${project.name}" project: all feedback is done. You can close the round.`,
        }
      : {
          subject: `Az ügyfél jóváhagyta a kört: ${project.name}`,
          message: `${by} jóváhagyta a(z) „${project.name}” projekt ${round.number}. körét: minden visszajelzés kész. Lezárhatod a kört.`,
        },
  );
}
