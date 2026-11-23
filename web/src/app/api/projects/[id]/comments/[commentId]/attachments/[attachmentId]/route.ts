import { readFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { idParam } from '@/lib/access';
import { findProjectComment } from '@/lib/comments';
import { api, notFound } from '@/lib/http';
import { resolveStored } from '@/lib/storage';
import { teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

/** Egy melléklet képe. JWT védi, ezért a kliens fejléccel kéri le. */
export const GET = api<{ params: Promise<{ id: string; commentId: string; attachmentId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { project } = await teamContext(req, p.id);
  const { comment } = await findProjectComment(project.id, idParam(p.commentId));
  const [file] = await db
    .select()
    .from(schema.attachments)
    .where(and(eq(schema.attachments.id, idParam(p.attachmentId)), eq(schema.attachments.commentId, comment.id)))
    .limit(1);
  if (!file) throw notFound();
  let data: Buffer;
  try {
    data = await readFile(resolveStored(file.path));
  } catch {
    throw notFound();
  }
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': file.contentType, 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' },
  });
});
