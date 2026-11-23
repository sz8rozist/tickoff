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
 * újranyitás, kör jóváhagyása. Aki kikapcsolta az értesítéseket, nem kap levelet. Címzettenként korlátozott.
 */

async function notifyTeam(project: Project, subject: string, message: string): Promise<void> {
  if (!isMailEnabled()) return;
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, notify: schema.users.notifyEmail })
    .from(schema.users)
    .where(eq(schema.users.id, project.ownerId));
  const members = await db
    .select({ id: schema.users.id, email: schema.users.email, notify: schema.users.notifyEmail })
    .from(schema.projectMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.projectMembers.userId))
    .where(eq(schema.projectMembers.projectId, project.id));

  const text =
    `${message}\n\nMegnyitás: ${dashboardOrigin()}/\n\n` +
    'Ezt a levelet azért kaptad, mert a Tickoffban értesítést kértél az új visszajelzésekről. ' +
    'A beállítást a Tickoff felületén kapcsolhatod ki.\n';
  const seen = new Set<number>();
  for (const u of [...rows, ...members]) {
    if (seen.has(u.id) || !u.notify) continue;
    seen.add(u.id);
    if (allow('u' + u.id, LIMITS.notifyRecipient)) sendMail(u.email, `[Tickoff] ${subject}`, text);
    else console.info('[notify] Értesítés kihagyva (címzettenkénti korlát), felhasználó:', u.id);
  }
}

export function newCommentMail(project: Project, comment: Comment): Promise<void> {
  return notifyTeam(project, `Új visszajelzés: ${project.name}`,
    `${comment.authorName} új visszajelzést írt a(z) „${project.name}” projektben (oldal: ${comment.pageUrl}):\n\n${excerpt(comment.body)}`);
}

export function customerReplyMail(project: Project, comment: Comment, authorName: string, body: string): Promise<void> {
  return notifyTeam(project, `Új válasz: ${project.name}`,
    `${authorName} válaszolt ${comment.authorName} visszajelzésére a(z) „${project.name}” projektben (oldal: ${comment.pageUrl}):\n\n${excerpt(body)}`);
}

export function reopenedMail(project: Project, comment: Comment, by: string, reason: string | null): Promise<void> {
  return notifyTeam(project, `Újranyitott visszajelzés: ${project.name}`,
    `${by} újranyitotta a kész visszajelzését a(z) „${project.name}” projektben (oldal: ${comment.pageUrl}):\n\n${excerpt(comment.body)}` +
      (reason ? `\n\nIndoklás: ${excerpt(reason)}` : ''));
}

export function roundApprovedMail(project: Project, round: Round, by: string): Promise<void> {
  return notifyTeam(project, `Az ügyfél jóváhagyta a kört: ${project.name}`,
    `${by} jóváhagyta a(z) „${project.name}” projekt ${round.number}. körét: minden visszajelzés kész. Lezárhatod a kört.`);
}
