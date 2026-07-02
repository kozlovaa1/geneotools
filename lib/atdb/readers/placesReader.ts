import type { Place } from '../../types';
import { readAtdbDateValue } from '../dates';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { tableExists } from '../sqlHelpers';

export function readPlaces(db: SqlJsDatabase, context: AtdbSchemaContext): Place[] {
  const places: Place[] = [];
  const placeTable = context.tableCode('places');
  const hasValuesStr = tableExists(db, 'ValuesStr');
  const hasValuesDates = tableExists(db, 'ValuesDates');
  const hasParentColumn = columnExists(db, 'Places', 'parent_id');
  const name = context.resolveFieldRule('placeName', 'read');
  const shortName = context.resolveFieldRule('placeShortName', 'read');
  const comment = context.resolveFieldRule('placeComment', 'read');
  const namingDate = context.resolveFieldRule('placeNamingDate', 'read');

  try {
    const placesStmt = db.prepare(`SELECT id${hasParentColumn ? ', parent_id' : ''} FROM Places`);
    while (placesStmt.step()) {
      const placeRow = placesStmt.getAsObject();
      const placeId = placeRow.id as number;
      const place: Place = { id: placeId };
      if (typeof placeRow.parent_id === 'number') place.parentId = placeRow.parent_id;
      if (hasValuesStr) {
        const placeDetailsStmt = db.prepare('SELECT f_id, vstr FROM ValuesStr WHERE rec_table = ? AND rec_id = ?');
        placeDetailsStmt.bind([placeTable, placeId]);
        while (placeDetailsStmt.step()) {
          const detailRow = placeDetailsStmt.getAsObject();
          const fieldId = detailRow.f_id as number;
          const valueStr = detailRow.vstr as string;
          if (fieldId === name?.id) place.name = valueStr;
          else if (fieldId === shortName?.id) place.shortName = valueStr;
          else if (fieldId === comment?.id) place.comment = valueStr;
        }
        placeDetailsStmt.free();
      }
      if (hasValuesDates && namingDate) {
        const dateValue = readAtdbDateValue(db, {
          fieldId: namingDate.id,
          recTable: placeTable,
          recId: placeId,
          logger: context.logger,
        });
        place.placeNamingDate = dateValue?.value;
        place.placeNamingDateInfo = dateValue ?? undefined;
      }
      places.push(place);
    }
    placesStmt.free();
    context.logger({ level: 'DEBUG', code: 'places.read', details: { count: places.length, recTable: placeTable } });
  } catch {
    context.logger({ level: 'WARN', code: 'places.read.unavailable' });
  }

  return places;
}

function columnExists(db: SqlJsDatabase, tableName: string, columnName: string): boolean {
  const result = db.exec(`PRAGMA table_info(${tableName})`);
  const nameIndex = result[0]?.columns.indexOf('name') ?? -1;
  if (nameIndex === -1) return false;
  return result[0].values.some((row) => row[nameIndex] === columnName);
}
