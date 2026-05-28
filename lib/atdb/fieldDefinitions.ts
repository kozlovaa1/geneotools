import type { SqlJsDatabase } from './dbTypes';

export interface FieldDefinition {
  tableCode: number;
  name: string;
}

export type FieldDefinitions = Map<number, FieldDefinition>;

export function readFieldDefinitions(db: SqlJsDatabase): FieldDefinitions {
  const fieldDefinitions: FieldDefinitions = new Map();
  try {
    const fieldsStmt = db.prepare("SELECT id, tablecode, area FROM Fields");
    while (fieldsStmt.step()) {
      const row = fieldsStmt.getAsObject();
      const fieldId = row.id as number;
      const tableCode = row.tablecode as number;
      const fieldName = row.area as string;
      fieldDefinitions.set(fieldId, { tableCode, name: fieldName });
    }
    fieldsStmt.free();
  } catch (err) {
    console.warn('Could not read Fields table (this is optional):', err);
  }

  return fieldDefinitions;
}
