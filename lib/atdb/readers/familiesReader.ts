import type { Family } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { tableExists } from '../sqlHelpers';

export function readFamilies(db: SqlJsDatabase, context: AtdbSchemaContext): Family[] {
  const families: Family[] = [];
  const familyTable = context.tableCode('families');
  const hasValuesStr = tableExists(db, 'ValuesStr');
  const husbandLastName = context.resolveFieldRule('familyHusbandLastName', 'read');
  const wifeLastName = context.resolveFieldRule('familyWifeLastName', 'read');
  const familyName = context.resolveFieldRule('familyName', 'read');
  const comment = context.resolveFieldRule('familyComment', 'read');
  try {
    const statement = db.prepare('SELECT id, color FROM Families');
    while (statement.step()) {
      const row = statement.getAsObject();
      const family: Family = { id: row.id as number, color: row.color as number, childrenIds: [] };
      if (hasValuesStr) {
        const values = db.prepare('SELECT f_id, vstr FROM ValuesStr WHERE rec_table = ? AND rec_id = ?');
        values.bind([familyTable, family.id]);
        while (values.step()) {
          const value = values.getAsObject();
          const fieldId = value.f_id as number;
          const text = value.vstr as string;
          if (fieldId === husbandLastName?.id) family.husbandLastName = text;
          else if (fieldId === wifeLastName?.id) family.wifeLastName = text;
          else if (fieldId === familyName?.id) family.familyName = text;
          else if (fieldId === comment?.id) family.comment = text;
        }
        values.free();
      }
      families.push(family);
    }
    statement.free();
    context.logger({ level: 'DEBUG', code: 'families.read', details: { count: families.length, recTable: familyTable } });
  } catch {
    context.logger({ level: 'ERROR', code: 'families.read.failed' });
  }
  return families;
}
