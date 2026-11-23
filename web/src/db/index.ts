import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

/**
 * Az adatbázis-kapcsolat: egy közös pool a folyamatban. Fejlesztői újratöltéskor a globális objektumon marad, hogy ne
 * szivárogjanak a kapcsolatok. Az időpontokat UTC-ben kezeljük (timezone: 'Z').
 */
const globalForDb = globalThis as unknown as { __tickoffPool?: mysql.Pool };

function createPool(): mysql.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('A DATABASE_URL nincs beállítva');
  return mysql.createPool({
    uri: url,
    connectionLimit: Number(process.env.DB_POOL_MAX ?? 10),
    timezone: 'Z',
    charset: 'utf8mb4',
    // A hosszan tétlen kapcsolatokat a szerver eldobhatja: életben tartjuk őket
    enableKeepAlive: true,
  });
}

export const pool = globalForDb.__tickoffPool ?? createPool();
if (process.env.NODE_ENV !== 'production') globalForDb.__tickoffPool = pool;

export const db = drizzle(pool, { schema, mode: 'default' });
export { schema };
