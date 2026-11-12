import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { createSqliteAdapter } from '../db/client';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { StudioError } from './errors';
import { initAllConSchema, isAllConDatabase } from './schema';
import { rememberDatabasePath, seedDemo } from './store';

export interface AllConHandle {
  adapter: DatabaseAdapter;
  raw: sqlite3.Database;
  filePath: string;
  created: boolean;
}

const openRaw = (fullPath: string) =>
  new Promise<sqlite3.Database>((resolve, reject) => {
    const database = new sqlite3.Database(fullPath, error => {
      if (error) reject(new StudioError('error.failedToOpenDB', error.message));
      else resolve(database);
    });
  });

export const ensureAllConDatabase = async (
  fullPath: string,
  options?: { createIfMissing?: boolean; seed?: boolean; logo?: Buffer }
): Promise<AllConHandle> => {
  const createIfMissing = options?.createIfMissing !== false;
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const existed = fs.existsSync(fullPath);
  if (!existed && !createIfMissing) throw new StudioError('error.databaseFileNotExist');

  const raw = await openRaw(fullPath);
  const adapter = createSqliteAdapter(raw);
  await adapter.run('PRAGMA foreign_keys = ON;');
  let created = !existed;
  if (!(await isAllConDatabase(adapter))) {
    const invoices = await adapter.get<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'invoices'"
    );
    const tables = await adapter.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    );
    if (invoices || (existed && Number(tables?.count ?? 0) > 0)) {
      await adapter.close();
      throw new StudioError(
        'error.notAllConDatabase',
        'This file is not an All Con Studio database. Invoice Builder databases are not migrated.'
      );
    }
    await initAllConSchema(adapter);
    if (options?.seed !== false) await seedDemo(adapter, { logo: options?.logo });
    created = true;
  }
  await rememberDatabasePath(adapter, fullPath);
  return { adapter, raw, filePath: fullPath, created };
};
