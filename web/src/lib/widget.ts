import { and, desc, eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db, schema } from '@/db';
import type { Comment, Round } from './comments';
import type { Project } from './access';
import { clientIp, conflict, errorResponse, forbidden, HttpError, notFound } from './http';
import { LIMITS, limitByIp, limitByKey, type Limit } from './rate-limit';
import { rateLimitEnabled } from './env';
import { safeEqual, sha256 } from './crypto';

/** Ennyi ideig szerkesztheti vagy vonhatja vissza az ügyfél a saját kommentjét (a létrehozástól számítva). */
export const EDIT_WINDOW_MS = 10 * 60 * 1000;
export const MAX_ATTACHMENTS_PER_COMMENT = 5;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
/** A korábbi körökből legfeljebb ennyit adunk vissza (a legutóbbiakat). */
export const MAX_HISTORY_ROUNDS = 10;

/** Egy cím origin-je (séma + host + port, az alapértelmezett port elhagyva), vagy null, ha nem értelmezhető. */
export function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

/** Igaz, ha az oldal címe a projekt oldalának origin-jén van. */
export function sameOrigin(pageUrl: string, siteUrl: string): boolean {
  const a = originOf(pageUrl);
  return a !== null && a === originOf(siteUrl);
}

/** A widget útvonalainak paraméterei: a token mindig van, a commentId a komment-végpontoknál. */
type WidgetCtx = { token: string; commentId?: string };

/** A megosztó tokenhez tartozó, nem archivált projekt, vagy 404. */
async function projectByToken(token: string): Promise<Project> {
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.shareToken, token)).limit(1);
  // Archivált projektnél a widget leáll: úgy viselkedik, mintha a token nem létezne
  if (!project || project.archivedAt !== null) throw notFound();
  return project;
}

/** Böngészőből minden cross-origin kéréshez jön Origin. Ha van, egyeznie kell a projekt oldalának origin-jével. */
function checkOrigin(req: NextRequest, project: Project): void {
  const origin = req.headers.get('origin');
  if (origin !== null && origin !== originOf(project.siteUrl)) throw forbidden('Ez az origin nem engedélyezett');
}

/** CORS-fejlécek: csak a projekt oldalának origin-jére (és csak érvényes tokennél). */
function corsHeaders(req: NextRequest, project: Project): Record<string, string> {
  const origin = req.headers.get('origin');
  if (origin === null || origin !== originOf(project.siteUrl)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin',
  };
}

function withCors(res: Response, req: NextRequest, project: Project): Response {
  for (const [k, v] of Object.entries(corsHeaders(req, project))) res.headers.set(k, v);
  return res;
}

interface WidgetArgs<P> {
  req: NextRequest;
  project: Project;
  params: P;
}

/**
 * A widget végpontjainak közös burka: durva IP-korlát, token és origin ellenőrzése, a pontos korlátok (olvasás / írás), egységes
 * hibakezelés, és a CORS-fejlécek minden válaszon (a 429-esen is, hogy a widget el tudja olvasni).
 */
export function widgetRoute<P extends WidgetCtx>(
  kind: 'read' | 'write',
  handler: (args: WidgetArgs<P>) => Promise<Response>,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response> {
  return async (req, ctx) => {
    let project: Project | null = null;
    try {
      limitByIp(req, LIMITS.widgetCoarse);
      const params = await ctx.params;
      project = await projectByToken(params.token);
      checkOrigin(req, project);
      const [ipLimit, tokenLimit]: Limit[] = kind === 'write' ? [LIMITS.widgetWriteIp, LIMITS.widgetWriteToken] : [LIMITS.widgetReadIp, LIMITS.widgetReadToken];
      limitByIp(req, ipLimit);
      limitByKey(params.token, tokenLimit);
      return withCors(await handler({ req, project, params }), req, project);
    } catch (e) {
      const res = errorResponse(e);
      return project ? withCors(res, req, project) : res;
    }
  };
}

/** CORS-preflight (OPTIONS): a projekt oldalának origin-jére 204 a megfelelő fejlécekkel, másra 403 fejlécek nélkül. */
export async function widgetPreflight(req: NextRequest, ctx: { params: Promise<WidgetCtx> }): Promise<Response> {
  try {
    if (rateLimitEnabled()) limitByIp(req, LIMITS.widgetCoarse);
    const project = await projectByToken((await ctx.params).token);
    checkOrigin(req, project);
    return new NextResponse(null, { status: 204, headers: corsHeaders(req, project) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** A projekt nyitott köre (a legutóbbi kör, ha nyitott), vagy null. */
export async function openRound(project: Project): Promise<Round | null> {
  const [latest] = await db.select().from(schema.rounds).where(eq(schema.rounds.projectId, project.id)).orderBy(desc(schema.rounds.number)).limit(1);
  return latest && latest.status === 'OPEN' ? latest : null;
}

/** A nyitott kör kommentje: 404, ha nincs ilyen a projektben, 409, ha nincs nyitott kör vagy a komment lezárt körhöz tartozik. */
export async function openRoundComment(project: Project, commentId: number): Promise<{ comment: Comment; round: Round }> {
  const [row] = await db
    .select({ comment: schema.comments, round: schema.rounds })
    .from(schema.comments)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.comments.roundId))
    .where(and(eq(schema.comments.id, commentId), eq(schema.rounds.projectId, project.id)))
    .limit(1);
  if (!row) throw notFound();
  const open = await openRound(project);
  if (!open) throw conflict('Nincs nyitott kör');
  if (row.round.id !== open.id) throw conflict('Ez a komment egy lezárt körhöz tartozik');
  return row;
}

/** A komment, ha a szerkesztési titok egyezik és a határidő nem járt le (403 / 409 különben). */
export async function ownComment(project: Project, commentId: number, editToken: string) {
  const found = await openRoundComment(project, commentId);
  const { comment } = found;
  if (!comment.editTokenHash || !safeEqual(comment.editTokenHash, sha256(editToken))) throw forbidden('Ezt a kommentet nem te küldted');
  if (Date.now() > comment.createdAt.getTime() + EDIT_WINDOW_MS) throw conflict('A szerkesztési idő lejárt');
  return found;
}

/** A widget által látott komment-ábrázolás (az ügyfél e-mailje, a belső besorolás és a felelős nélkül). */
export function widgetCommentDto(
  c: Comment,
  replies: { id: number; authorName: string; authorType: string; body: string; createdAt: Date }[],
) {
  return {
    id: c.id,
    authorName: c.authorName,
    body: c.body,
    pageUrl: c.pageUrl,
    cssSelector: c.cssSelector,
    posX: c.posX,
    posY: c.posY,
    areaWidth: c.areaWidth,
    areaHeight: c.areaHeight,
    status: c.status,
    hasScreenshot: c.screenshotPath !== null,
    approved: c.customerApprovedAt !== null,
    createdAt: c.createdAt,
    edited: c.editedAt !== null,
    editToken: null as string | null,
    editableUntil: null as Date | null,
    replies,
  };
}

export function roundInfo(r: Round) {
  return { id: r.id, number: r.number, approved: r.approvedAt !== null, approvedBy: r.approvedBy, dueDate: r.dueDate };
}

/**
 * A kérés törzse nyers bájtokként, a megadott korláttal. A korlátot a Content-Length és olvasás közben is ellenőrizzük
 * (chunked kérésnél nincs Content-Length). Túl nagy kérésre 413.
 */
export async function readLimited(req: NextRequest, maxBytes: number): Promise<Buffer> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new HttpError(413, 'A kép túl nagy');
  if (!req.body) return Buffer.alloc(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, 'A kép túl nagy');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export { clientIp };
