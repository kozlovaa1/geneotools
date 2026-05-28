import { SQLITE_HEADER_LENGTH, SQLITE_HEADER_PREFIX } from './constants';
import type { SqlJsDatabase } from './dbTypes';

export function validateSqliteHeader(buffer: Uint8Array | Buffer): void {
  if (buffer.length < SQLITE_HEADER_LENGTH) {
    throw new Error('Invalid .atdb file: too small to be valid SQLite database');
  }

  const header = buffer.subarray(0, SQLITE_HEADER_LENGTH);
  const headerStr = String.fromCharCode(...header);

  if (!headerStr.startsWith(SQLITE_HEADER_PREFIX)) {
    throw new Error('Invalid .atdb file: not a valid SQLite database');
  }
}

export function tableExists(db: SqlJsDatabase, tableName: string): boolean {
  return db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name=?;", [tableName]).length > 0;
}

export function getLastInsertRowId(db: SqlJsDatabase): number | null {
  const result = db.exec('SELECT last_insert_rowid()');
  const value = result.length > 0 ? result[0].values[0][0] : null;
  return typeof value === 'number' ? value : null;
}
