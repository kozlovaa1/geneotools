import type { Event } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';

export function writeEvents(db: SqlJsDatabase, events: Event[]): void {
    // Update events data - delete old values and insert new ones
    for (const event of events) {
      // Update the event type in the Events table
      let eventTypeValue = 1; // default
      if (typeof event.eventType === 'string' && event.eventType.startsWith('EventType')) {
        const match = event.eventType.match(/EventType(\d+)/);
        if (match) {
          eventTypeValue = parseInt(match[1]) || 1;
        }
      } else if (typeof event.eventType === 'number') {
        eventTypeValue = event.eventType;
      } else if (typeof event.eventType === 'string') {
        // If it's a descriptive string, we'd need to look up the corresponding ID
        // For now, default to 1
        eventTypeValue = 1;
      }

      db.run('UPDATE Events SET et_id = ? WHERE id = ?', [eventTypeValue, event.id]);

      // Delete existing linked values in ValuesLinks table for this event (table code 11 for Events)
      db.run('DELETE FROM ValuesLinks WHERE rec_table = 11 AND rec_id = ?', [event.id]);

      // Insert updated linked values
      // Note: We're using the old method for backward compatibility with some databases
      // but the main event-person relationships are handled through EventDetails
      if (event.personIds && event.personIds.length > 0) {
        // Use the first person ID for the old structure (for backward compatibility)
        const firstPersonId = event.personIds[0];
        if (firstPersonId) {
          db.run('INSERT INTO ValuesLinks (f_id, rec_table, rec_id, vlink_table, vlink_id) VALUES (?, 11, ?, 9, ?)', [1, event.id, firstPersonId]); // 1 is person ID (link to Person table)
        }
      }

      // Delete existing date values in ValuesDates table for this event
      db.run('DELETE FROM ValuesDates WHERE rec_table = 11 AND rec_id = ?', [event.id]);

      // Insert updated date values
      if (event.date) {
        const [year, month, day] = event.date.split('-').map(Number);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          db.run('INSERT INTO ValuesDates (f_id, rec_table, rec_id, y, m, d) VALUES (?, 11, ?, ?, ?, ?)', [3, event.id, year, month, day]); // 3 is event date
        }
      }

      // Delete existing string values in ValuesStr table for this event
      db.run('DELETE FROM ValuesStr WHERE rec_table = 11 AND rec_id = ?', [event.id]);

      // Insert updated string values
      if (event.place) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 11, ?, ?)', [4, event.id, event.place]); // 4 is event place
      }
      if (event.description) {
        db.run('INSERT INTO ValuesStr (f_id, rec_table, rec_id, vstr) VALUES (?, 11, ?, ?)', [5, event.id, event.description]); // 5 is event description
      }

      // Handle EventDetails relationships for the current event
      if (event.personIds && event.personIds.length > 0) {
        // First, delete existing EventDetails records for this event
        db.run('DELETE FROM EventDetails WHERE e_id = ?', [event.id]);

        // Add each person to the event with proper order (p_ord)
        let order = 1;
        for (const personId of event.personIds) {
          // For now we'll use a default role ID of 1 (the person involved in the event)
          // In a more sophisticated system, we would determine the actual role from context
          db.run('INSERT INTO EventDetails (p_id, e_id, er_id, p_ord) VALUES (?, ?, 1, ?)', [personId, event.id, order]);
          order++;
        }
      }
    }

}
