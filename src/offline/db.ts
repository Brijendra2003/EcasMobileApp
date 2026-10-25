// SQLCipher-encrypted SQLite (op-sqlite, `"op-sqlite": { "sqlcipher": true }` in
// package.json). The key comes from the Keychain / Keystore (lib/storage.ts).
import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import { sqlCipherKey } from '../lib/storage';
import { MIGRATIONS } from './migrations';

let db: DB | null = null;

export async function openDatabase(): Promise<DB> {
  if (db) {
    return db;
  }
  const opened = open({ name: 'ecas.sqlite', encryptionKey: sqlCipherKey() });
  await opened.execute('pragma journal_mode = wal');
  await migrate(opened);
  db = opened;
  return opened;
}

async function migrate(conn: DB) {
  const res = await conn.execute('pragma user_version');
  const current = Number(res.rows[0]?.user_version ?? 0);
  for (let v = current; v < MIGRATIONS.length; v++) {
    await conn.transaction(async tx => {
      for (const statement of MIGRATIONS[v]) {
        await tx.execute(statement);
      }
      await tx.execute(`pragma user_version = ${v + 1}`);
    });
  }
}

export function getDb(): DB {
  if (!db) {
    throw new Error('Database used before openDatabase()');
  }
  return db;
}

export async function query<T>(sql: string, params: Scalar[] = []): Promise<T[]> {
  const res = await getDb().execute(sql, params);
  return res.rows as unknown as T[];
}

export async function exec(sql: string, params: Scalar[] = []): Promise<void> {
  await getDb().execute(sql, params);
}

/** Sign-out wipe (§5.2). Callers must check the outbox first. */
export async function wipeDatabase(): Promise<void> {
  const conn = getDb();
  await conn.transaction(async tx => {
    for (const table of ['local_sessions', 'local_roster', 'local_registers', 'local_marks', 'outbox']) {
      await tx.execute(`delete from ${table}`);
    }
  });
}
