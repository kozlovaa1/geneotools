import type { SqlJsDatabase } from './dbTypes';
import type { AtdbDiagnosticLogger } from './diagnostics';

const SAVEPOINT_NAME = 'geneotools_rebuild_write';

export async function runAtdbTransaction<T>(
  db: SqlJsDatabase,
  phase: string,
  logger: AtdbDiagnosticLogger,
  callback: () => T | Promise<T>,
): Promise<T> {
  logger({ level: 'DEBUG', code: 'rebuild.transaction.start', details: { phase } });
  db.run(`SAVEPOINT ${SAVEPOINT_NAME}`);

  try {
    const result = await callback();
    try {
      db.run(`RELEASE ${SAVEPOINT_NAME}`);
    } catch {
      logger({ level: 'WARN', code: 'rebuild.transaction.release-savepoint-missing', details: { phase } });
    }
    logger({ level: 'DEBUG', code: 'rebuild.transaction.release', details: { phase } });
    return result;
  } catch (error) {
    try {
      db.run(`ROLLBACK TO ${SAVEPOINT_NAME}`);
      db.run(`RELEASE ${SAVEPOINT_NAME}`);
    } catch {
      logger({ level: 'WARN', code: 'rebuild.transaction.rollback-savepoint-missing', details: { phase } });
    }
    logger({
      level: 'ERROR',
      code: 'rebuild.transaction.rollback',
      details: { phase, reasonCode: error instanceof Error ? error.name : 'unknown' },
    });
    throw error;
  }
}
