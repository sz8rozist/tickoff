import type { Project } from './access';
import type { Comment, Round } from './comments';

/** A webhook-ként küldhető események. */
export const WebhookEvents = {
  commentCreated: 'comment.created',
  replyCreated: 'reply.created',
  commentReopened: 'comment.reopened',
  roundApproved: 'round.approved',
  test: 'test',
} as const;

/**
 * Esemény küldése a projekt webhookjára (ha van). A tényleges kézbesítés (aláírás, SSRF-védelem, időkorlát) a 6. fázisban
 * készül el; addig az esemény nem megy sehova. A hívók már most a végleges szerződést használják.
 */
export async function publishWebhook(
  _project: Project,
  _event: string,
  _text: string,
  _comment: Comment | null,
  _round: Round | null,
): Promise<void> {
  // 6. fázis
}
