import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';

/** Lefuttatja a függő migrációkat (a `drizzle/` mappából). Használat: `npm run db:migrate`. */
async function main() {
  const url = process.env.DATABASE_URL ?? 'mysql://tickoff:tickoff@localhost:3308/tickoff';
  const connection = await mysql.createConnection({ uri: url, timezone: 'Z' });
  await migrate(drizzle(connection), { migrationsFolder: './drizzle' });
  await connection.end();
  console.log('Az adatbázis naprakész.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
