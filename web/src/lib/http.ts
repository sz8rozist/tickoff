import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';

/** Szándékos HTTP-hiba: a státuszkód és az üzenet a válaszba kerül. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message = '',
    public headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export const badRequest = (msg = 'Érvénytelen kérés') => new HttpError(400, msg);
export const unauthorized = (msg = 'Nincs bejelentkezve') => new HttpError(401, msg);
export const forbidden = (msg = 'Nincs jogosultságod ehhez') => new HttpError(403, msg);
export const notFound = (msg = 'Nem található') => new HttpError(404, msg);
export const conflict = (msg = 'Ütközés') => new HttpError(409, msg);

export function json(data: unknown, status = 200, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(data, { status, headers });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/** A kérés törzse JSON-ként, a séma szerint ellenőrizve; hibás vagy hiányzó törzsre 400. */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw badRequest('A kérés törzse nem érvényes JSON');
  }
  return validate(schema, data);
}

export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw badRequest(result.error.issues.map((i) => i.message).join('; '));
  return result.data;
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Egy kivétel HTTP-válasza: a HttpError a megfelelő státuszt kapja, minden más 500 (a részletek csak a naplóba kerülnek). */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status, headers: e.headers });
  }
  if (e instanceof ZodError) {
    return NextResponse.json({ error: 'Érvénytelen kérés' }, { status: 400 });
  }
  console.error('[api] Váratlan hiba:', e);
  return NextResponse.json({ error: 'Szerverhiba' }, { status: 500 });
}

/** Egységes hibakezelés minden végpontra. */
export function api<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** A kérés forrás-IP-címe. Reverse proxy (Caddy) mögött az `X-Forwarded-For` első eleme. */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/** Duplikált kulcs (egyedi index megsértése) a MySQL-ben; a drizzle a hibát becsomagolhatja. */
export function isDuplicateKey(e: unknown): boolean {
  const anyErr = e as { code?: string; errno?: number; cause?: { code?: string; errno?: number } };
  return anyErr?.code === 'ER_DUP_ENTRY' || anyErr?.errno === 1062 || anyErr?.cause?.code === 'ER_DUP_ENTRY' || anyErr?.cause?.errno === 1062;
}
