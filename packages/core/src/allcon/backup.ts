import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { createSqliteAdapter } from '../db/client';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { StudioError } from './errors';
import { isAllConDatabase } from './schema';

export interface BackupHandle {
  adapter: DatabaseAdapter;
  raw: sqlite3.Database;
  filePath: string;
}

interface SqliteBackup {
  step(pages: number, callback: (error: Error | null) => void): void;
  finish(callback: (error: Error | null) => void): void;
}

export const backupSqlite = (raw: sqlite3.Database, destination: string) =>
  new Promise<void>((resolve, reject) => {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const backup = (raw as sqlite3.Database & { backup: (file: string) => SqliteBackup }).backup(destination);
    backup.step(-1, (stepError: Error | null) => {
      backup.finish((finishError: Error | null) => {
        if (stepError) reject(stepError);
        else if (finishError) reject(finishError);
        else resolve();
      });
    });
  });

const openRaw = (fullPath: string) =>
  new Promise<sqlite3.Database>((resolve, reject) => {
    const database = new sqlite3.Database(fullPath, error => {
      if (error) reject(new StudioError('error.failedToOpenDB', error.message));
      else resolve(database);
    });
  });

export const restoreDatabase = async (options: { handle: BackupHandle; sourcePath: string; confirmed: boolean }) => {
  if (!options.confirmed) {
    throw new StudioError('error.restoreNotConfirmed', 'Restore requires confirmation.');
  }
  if (!fs.existsSync(options.sourcePath)) throw new StudioError('error.databaseFileNotExist');

  const currentPath = options.handle.filePath;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safetyPath = path.join(path.dirname(currentPath), `all-con-studio-safety-${stamp}.db`);
  await backupSqlite(options.handle.raw, safetyPath);

  const sourceRaw = await openRaw(options.sourcePath);
  const sourceAdapter = createSqliteAdapter(sourceRaw);
  const sourceIsStudio = await isAllConDatabase(sourceAdapter);
  if (!sourceIsStudio) {
    await sourceAdapter.close();
    throw new StudioError('error.notAllConDatabase', 'Choose an All Con Studio backup.');
  }
  const tempPath = path.join(path.dirname(currentPath), `all-con-studio-restore-${stamp}.tmp.db`);
  try {
    await backupSqlite(sourceRaw, tempPath);
  } finally {
    await sourceAdapter.close();
  }

  await options.handle.adapter.close();
  fs.copyFileSync(tempPath, currentPath);
  fs.unlinkSync(tempPath);
  return { safetyPath, filePath: currentPath };
};
