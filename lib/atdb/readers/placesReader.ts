import type { Place } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';

export function readPlaces(db: SqlJsDatabase): Place[] {
  const places: Place[] = [];

  try {
    const placesStmt = db.prepare('SELECT id FROM Places');
    while (placesStmt.step()) {
      const placeRow = placesStmt.getAsObject();
      const placeId = placeRow.id as number;
      const placeDetailsStmt = db.prepare('SELECT f_id, vstr FROM ValuesStr WHERE rec_table = 14 AND rec_id = ?');
      placeDetailsStmt.bind([placeId]);

      const place: Place = { id: placeId };
      while (placeDetailsStmt.step()) {
        const detailRow = placeDetailsStmt.getAsObject();
        const fieldId = detailRow.f_id as number;
        const valueStr = detailRow.vstr as string;

        switch (fieldId) {
          case 93:
            place.name = valueStr;
            break;
          case 94:
            place.shortName = valueStr;
            break;
          case 104:
            place.comment = valueStr;
            break;
          default:
        }
      }
      placeDetailsStmt.free();
      places.push(place);
    }
    placesStmt.free();
  } catch (err) {
    console.warn('Could not read Places table (this is optional):', err);
  }

  return places;
}
