import type { Place } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';

export function writePlaces(db: SqlJsDatabase, places: Place[] | undefined): void {
  // Update places data - delete old values and insert new ones
  if (places && places.length > 0) {
    for (const place of places) {
      // Delete existing string values in ValuesStr table for this place (table code 14 for Places)
      db.run('DELETE FROM ValuesStr WHERE rec_table = 14 AND rec_id = ?', [place.id]);

      // Insert updated string values for the place
      if (place.name) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 14, ?, ?)', [93, place.id, place.name]); // 93 is place name
      }
      if (place.shortName) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 14, ?, ?)', [94, place.id, place.shortName]); // 94 is short name
      }
      if (place.comment) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 14, ?, ?)', [104, place.id, place.comment]); // 104 is comment
      }

      // If the place doesn't exist in the Places table, add it
      const placeExists = db.prepare('SELECT id FROM Places WHERE id = ?');
      placeExists.bind([place.id]);
      if (!placeExists.step()) {
        // Place doesn't exist, so add it
        db.run('INSERT INTO Places (id) VALUES (?)', [place.id]);
      }
      placeExists.free();
    }
  }
}
