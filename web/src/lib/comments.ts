import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { conflict, notFound } from './http';

export type Comment = typeof schema.comments.$inferSelect;
export type Round = typeof schema.rounds.$inferSelect;
export type CommentStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export const MAX_REPLIES_PER_COMMENT = 200;
export const MAX_LABELS = 5;
export const MAX_LABEL_LENGTH = 24;

export function statusLabel(s: string): string {
  return s === 'OPEN' ? 'Nyitott' : s === 'IN_PROGRESS' ? 'Folyamatban' : 'Kész';
}

export function parseLabels(csv: string): string[] {
  return csv === '' ? [] : csv.split(',');
}

/** A címkék normalizálása: kisbetű, vessző és vezérlőkarakter nélkül, egyedi, legfeljebb 5 darab, egyenként 24 karakter. */
export function normalizeLabels(raw: string[] | null | undefined): string[] {
  const out = new Set<string>();
  for (const l of raw ?? []) {
    if (!l) continue;
    let clean = l.replace(/[,\p{Cc}]/gu, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!clean) continue;
    if (clean.length > MAX_LABEL_LENGTH) clean = clean.slice(0, MAX_LABEL_LENGTH).trim();
    out.add(clean);
    if (out.size === MAX_LABELS) break;
  }
  return [...out];
}

/** Egy komment és a köre, ha a komment a projekthez tartozik; különben 404. */
export async function findProjectComment(projectId: number, commentId: number): Promise<{ comment: Comment; round: Round }> {
  const [row] = await db
    .select({ comment: schema.comments, round: schema.rounds })
    .from(schema.comments)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.comments.roundId))
    .where(and(eq(schema.comments.id, commentId), eq(schema.rounds.projectId, projectId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

/** 409-et dob, ha a komment szála betelt. */
export async function requireReplyRoom(commentId: number): Promise<void> {
  const replies = await db.select({ id: schema.replies.id }).from(schema.replies).where(eq(schema.replies.commentId, commentId)).limit(MAX_REPLIES_PER_COMMENT);
  if (replies.length >= MAX_REPLIES_PER_COMMENT) throw conflict('Ehhez a kommenthez már nem fűzhető több válasz');
}

export function replyDto(r: typeof schema.replies.$inferSelect) {
  return { id: r.id, authorName: r.authorName, authorType: r.authorType, body: r.body, createdAt: r.createdAt };
}

/** A kommentek válaszai egyetlen lekérdezéssel, kommentazonosító szerint csoportosítva (időrendben). */
export async function repliesByComment(commentIds: number[]) {
  const map = new Map<number, ReturnType<typeof replyDto>[]>();
  if (commentIds.length === 0) return map;
  const rows = await db.select().from(schema.replies).where(inArray(schema.replies.commentId, commentIds)).orderBy(asc(schema.replies.createdAt), asc(schema.replies.id));
  for (const r of rows) {
    const list = map.get(r.commentId) ?? [];
    list.push(replyDto(r));
    map.set(r.commentId, list);
  }
  return map;
}

/** A komment csapat-oldali ábrázolása (válaszokkal, mellékletekkel, felelőssel). */
export async function commentDtos(rows: Comment[]) {
  const ids = rows.map((c) => c.id);
  const replies = await repliesByComment(ids);
  const files = ids.length
    ? await db.select().from(schema.attachments).where(inArray(schema.attachments.commentId, ids)).orderBy(asc(schema.attachments.id))
    : [];
  const assigneeIds = [...new Set(rows.map((c) => c.assigneeId).filter((x): x is number => x !== null))];
  const assignees = assigneeIds.length
    ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, assigneeIds))
    : [];
  const assigneeName = new Map(assignees.map((a) => [a.id, a.name]));

  return rows.map((c) => ({
    id: c.id,
    authorName: c.authorName,
    body: c.body,
    pageUrl: c.pageUrl,
    cssSelector: c.cssSelector,
    posX: c.posX,
    posY: c.posY,
    areaWidth: c.areaWidth,
    areaHeight: c.areaHeight,
    viewportWidth: c.viewportWidth,
    viewportHeight: c.viewportHeight,
    userAgent: c.userAgent,
    status: c.status,
    hasScreenshot: c.screenshotPath !== null,
    createdAt: c.createdAt,
    customerApprovedAt: c.customerApprovedAt,
    editedAt: c.editedAt,
    priority: c.priority,
    labels: parseLabels(c.labels),
    notifiesCustomer: c.notifyToken !== null && c.customerEmailVerifiedAt !== null,
    assigneeId: c.assigneeId,
    assigneeName: c.assigneeId === null ? null : (assigneeName.get(c.assigneeId) ?? null),
    attachments: files.filter((f) => f.commentId === c.id).map((f) => ({ id: f.id, contentType: f.contentType, size: f.sizeBytes })),
    replies: replies.get(c.id) ?? [],
  }));
}

export async function commentDto(comment: Comment) {
  return (await commentDtos([comment]))[0];
}

/** A komment friss állapota az adatbázisból. */
export async function reloadComment(id: number): Promise<Comment> {
  const [c] = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
  if (!c) throw notFound();
  return c;
}

/**
 * Státuszváltás. Az ügyfél elfogadása csak az adott "Kész" állapotra szól, ezért változáskor törlődik; ha a komment már nem
 * kész, a kör jóváhagyása sem érvényes.
 */
export async function changeStatus(comment: Comment, round: Round, status: CommentStatus): Promise<void> {
  if (comment.status === status) return;
  await db.transaction(async (tx) => {
    await tx.update(schema.comments).set({ status, customerApprovedAt: null }).where(eq(schema.comments.id, comment.id));
    if (status !== 'DONE') {
      await tx.update(schema.rounds).set({ approvedAt: null, approvedBy: null }).where(eq(schema.rounds.id, round.id));
    }
  });
}
