import type { SqlJsDatabase } from './dbTypes';
import type { AtdbDiagnosticLogger } from './diagnostics';
import { silentAtdbLogger } from './diagnostics';

export interface FieldDefinition {
  tableCode: number;
  datatype: number | null;
  area: string | null;
}

export type FieldDefinitions = Map<number, FieldDefinition>;

export function readFieldDefinitions(db: SqlJsDatabase, logger: AtdbDiagnosticLogger = silentAtdbLogger): FieldDefinitions {
  const fieldDefinitions: FieldDefinitions = new Map();
  try {
    const fieldsStmt = db.prepare('SELECT id, tablecode, datatype, area FROM Fields');
    while (fieldsStmt.step()) {
      const row = fieldsStmt.getAsObject();
      const fieldId = row.id as number;
      const tableCode = row.tablecode as number;
      fieldDefinitions.set(fieldId, {
        tableCode,
        datatype: typeof row.datatype === 'number' ? row.datatype : null,
        area: typeof row.area === 'string' ? row.area : null,
      });
    }
    fieldsStmt.free();
    logger({ level: 'DEBUG', code: 'fields.catalog.read', details: { count: fieldDefinitions.size } });
  } catch {
    logger({ level: 'WARN', code: 'fields.catalog.unavailable' });
  }

  return fieldDefinitions;
}
