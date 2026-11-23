import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';

// Mindig frissen fut (az adatbázis állapotát méri), nem gyorsítótárazható
export const dynamic = 'force-dynamic';

/** Állapotjelző: 200, ha az adatbázis elérhető, különben 503. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: 'UP' });
  } catch {
    return NextResponse.json({ status: 'DOWN' }, { status: 503 });
  }
}
