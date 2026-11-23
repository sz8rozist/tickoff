import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { sha256 } from './crypto';

/**
 * Oldalankénti jóváhagyások egy körben. Az oldal jóváhagyása érvényét veszti, ha az oldalon új komment érkezik, vagy egy
 * komment nem kész állapotba kerül (a kör jóváhagyásához hasonlóan).
 */

export async function listPageApprovals(roundId: number): Promise<{ pageUrl: string; approvedBy: string }[]> {
  const rows = await db.select().from(schema.pageApprovals).where(eq(schema.pageApprovals.roundId, roundId)).orderBy(asc(schema.pageApprovals.id));
  return rows.map((r) => ({ pageUrl: r.pageUrl, approvedBy: r.approvedBy }));
}

export async function clearPageApproval(roundId: number, pageUrl: string): Promise<void> {
  await db.delete(schema.pageApprovals).where(and(eq(schema.pageApprovals.roundId, roundId), eq(schema.pageApprovals.pageHash, sha256(pageUrl))));
}
