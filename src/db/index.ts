import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

export function createDb(dbPath: string) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  if (dbPath !== ':memory:') {
    // WAL — чтобы чтение не ждало запись; ожидание — чтобы одновременный доступ
    // возвращал данные, а не ошибку «база занята». Для базы в памяти оба бессмысленны.
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');
  }
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  return db;
}

let instance: Db | null = null;

export function getDb(): Db {
  if (!instance) {
    instance = createDb(process.env.DB_PATH ?? path.join('data', 'kinobaza.db'));
  }
  return instance;
}
