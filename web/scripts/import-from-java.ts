/**
 * A régi (Java) változat adatbázisának átvitele az új (Next.js) adatbázisba. Használat:
 *
 *   SOURCE_DATABASE_URL=mysql://tickoff:jelszo@regi-host:3306/tickoff \
 *   DATABASE_URL=mysql://tickoff:jelszo@uj-host:3306/tickoff \
 *   npx tsx scripts/import-from-java.ts
 *
 * - A forrás csak olvasódik, nem módosul.
 * - A cél adatbázisnak üresnek kell lennie (előbb `npm run db:migrate`): különben a script megáll, hogy ne keveredjen az adat.
 * - Az azonosítók megmaradnak, így a kapcsolatok és a megosztó tokenek (a beágyazott widgetek) változatlanul működnek.
 * - A jelszó-hash-ek (bcrypt), a titkok hash-ei és a TOTP-adatok formátuma azonos, ezért a felhasználók a jelszavukkal és a
 *   kétlépcsős belépésükkel lépnek be. Ha a TICKOFF_JWT_SECRET is ugyanaz, a bejelentkezett munkamenetek is megmaradnak.
 * - A feltöltött képek külön másolandók (lásd README): ugyanaz a könyvtárszerkezet, a /data/screenshots kötet tartalma.
 */
import mysql from 'mysql2/promise';

// Az idegen kulcsok miatti sorrend
const TABLES = [
  'users',
  'password_reset_tokens',
  'projects',
  'project_members',
  'project_invites',
  'rounds',
  'comments',
  'replies',
  'attachments',
  'activity',
  'api_keys',
] as const;

const BATCH = 200;

async function columnsOf(conn: mysql.Connection, table: string): Promise<string[]> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    'select column_name as name from information_schema.columns where table_schema = database() and table_name = ? order by ordinal_position',
    [table],
  );
  return rows.map((r) => r.name as string);
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL ?? 'mysql://tickoff:tickoff@localhost:3308/tickoff';
  if (!sourceUrl) throw new Error('Add meg a SOURCE_DATABASE_URL-t (a régi Java változat adatbázisa)');
  if (sourceUrl === targetUrl) throw new Error('A forrás és a cél nem lehet ugyanaz az adatbázis');

  // dateStrings: az időpontok szövegként mennek át, így nincs időzóna-átszámítás
  const source = await mysql.createConnection({ uri: sourceUrl, dateStrings: true, charset: 'utf8mb4' });
  const target = await mysql.createConnection({ uri: targetUrl, dateStrings: true, charset: 'utf8mb4', timezone: 'Z' });

  try {
    const [existing] = await target.query<mysql.RowDataPacket[]>('select count(*) as n from users');
    if (Number(existing[0].n) > 0) throw new Error('A cél adatbázis nem üres (van felhasználó): az import megáll');

    await target.query('set foreign_key_checks = 0');
    const summary: string[] = [];
    for (const table of TABLES) {
      const sourceCols = new Set(await columnsOf(source, table));
      // Csak a mindkét oldalon létező oszlopok kerülnek át: az újonnan hozzáadott oszlopok az alapértéküket kapják
      const cols = (await columnsOf(target, table)).filter((c) => sourceCols.has(c));
      const [rows] = await source.query<mysql.RowDataPacket[]>(`select ${cols.map((c) => `\`${c}\``).join(', ')} from \`${table}\` order by id`);
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        await target.query(`insert into \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')}) values ?`, [chunk.map((r) => cols.map((c) => r[c]))]);
      }
      const [count] = await target.query<mysql.RowDataPacket[]>(`select count(*) as n from \`${table}\``);
      const ok = Number(count[0].n) === rows.length;
      summary.push(`${ok ? 'OK ' : 'HIBA'} ${table.padEnd(22)} ${rows.length} sor → ${count[0].n}`);
      if (!ok) throw new Error(`A(z) ${table} tábla sorainak száma nem egyezik az import után`);
    }
    await target.query('set foreign_key_checks = 1');
    console.log(summary.join('\n'));
    console.log('Az import kész.');
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((e) => {
  console.error('Az import nem sikerült:', e.message ?? e);
  process.exit(1);
});
