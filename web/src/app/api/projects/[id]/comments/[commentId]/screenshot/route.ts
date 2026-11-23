import { readFile } from 'node:fs/promises';
import { idParam } from '@/lib/access';
import { findProjectComment } from '@/lib/comments';
import { api, notFound } from '@/lib/http';
import { resolveStored } from '@/lib/storage';
import { teamContext } from '@/lib/team';

export const dynamic = 'force-dynamic';

/** A komment képernyőképe. JWT védi, ezért a kliens fejléccel kéri le (nem `<img src>`-vel). */
export const GET = api<{ params: Promise<{ id: string; commentId: string }> }>(async (req, { params }) => {
  const p = await params;
  const { project } = await teamContext(req, p.id);
  const { comment } = await findProjectComment(project.id, idParam(p.commentId));
  if (!comment.screenshotPath) throw notFound();
  let data: Buffer;
  try {
    data = await readFile(resolveStored(comment.screenshotPath));
  } catch {
    throw notFound();
  }
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': comment.screenshotPath.endsWith('.png') ? 'image/png' : 'image/jpeg',
      'Cache-Control': 'private, max-age=600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
