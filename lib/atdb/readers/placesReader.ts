import type { Place } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { tableExists } from '../sqlHelpers';

export function readPlaces(db: SqlJsDatabase, context: AtdbSchemaContext): Place[] {
  const places: Place[] = [];
  const placeTable = context.tableCode('places');
  const hasValuesStr = tableExists(db, 'ValuesStr');
  const name = context.resolveFieldRule('placeName', 'read');
  const shortName = context.resolveFieldRule('placeShortName', 'read');
  const comment = context.resolveFieldRule('placeComment', 'read');

  try {
    const placesStmt = db.prepare('SELECT id FROM Places');
    while (placesStmt.step()) {
      const placeRow = placesStmt.getAsObject();
      const placeId = placeRow.id as number;
      const place: Place = { id: placeId };
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
      places.push(place);
    }
    placesStmt.free();
    context.logger({ level: 'DEBUG', code: 'places.read', details: { count: places.length, recTable: placeTable } });
  } catch {
    context.logger({ level: 'WARN', code: 'places.read.unavailable' });
  }

  return places;
}
