import type { Event } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';

export function readEvents(db: SqlJsDatabase): Event[] {
    // Get all events
    const events: Event[] = [];
    try {
      const eventStmt = db.prepare("SELECT id, et_id FROM Events");
      while (eventStmt.step()) {
        const row = eventStmt.getAsObject();
        const eventId = row.id as number;
        const etId = row.et_id as number;

        // Initialize event object with data from Events table
        const event: Event = {
          id: eventId,
          eventType: `EventType${etId}` // This will be replaced with actual names later
        };

        // Get related persons through EventDetails table
        // EventDetails connects events to persons and their roles
        const eventDetailsStmt = db.prepare(`
          SELECT p_id, er_id, p_ord
          FROM EventDetails
          WHERE e_id = ?
          ORDER BY p_ord
        `);
        eventDetailsStmt.bind([eventId]);

        const personIds: number[] = [];
        while (eventDetailsStmt.step()) {
          const eventDetailsRow = eventDetailsStmt.getAsObject();
          const personId = eventDetailsRow.p_id as number;
          personIds.push(personId);
        }
        eventDetailsStmt.free();

        if (personIds.length > 0) {
          event.personIds = personIds;
        }

        // Get event date through ValuesDates where rec_table=7 (EventDetails table code)
        // We use the first person in the event (with the lowest p_ord) to get the date
        let firstPersonId: number | undefined;
        const firstPersonIdResult = db.prepare(`
          SELECT p_id
          FROM EventDetails
          WHERE e_id = ?
          ORDER BY p_ord
          LIMIT 1
        `);
        firstPersonIdResult.bind([eventId]);

        if (firstPersonIdResult.step()) {
          const firstPersonRow = firstPersonIdResult.getAsObject();
          firstPersonId = firstPersonRow.p_id as number;

          // Now get the date from ValuesDates where rec_table=7 (EventDetails) and
          // rec_id matches the EventDetails record for the first person
          const dateEventDetailsStmt = db.prepare(`
            SELECT ed.id
            FROM EventDetails ed
            WHERE ed.e_id = ? AND ed.p_id = ?
            ORDER BY ed.p_ord
            LIMIT 1
          `);
          dateEventDetailsStmt.bind([eventId, firstPersonId]);

          if (dateEventDetailsStmt.step()) {
            const dateEventDetailsRow = dateEventDetailsStmt.getAsObject();
            const eventDetailsId = dateEventDetailsRow.id as number;

            const valuesDatesStmt = db.prepare(`
              SELECT f_id, y, m, d
              FROM ValuesDates
              WHERE rec_table = 7 AND rec_id = ?  -- 7 is the code for EventDetails table
            `);
            valuesDatesStmt.bind([eventDetailsId]);

            while (valuesDatesStmt.step()) {
              const valuesDatesRow = valuesDatesStmt.getAsObject();
              const year = valuesDatesRow.y as number;
              const month = valuesDatesRow.m as number;
              const day = valuesDatesRow.d as number;

              if (year && month && day) {
                const dateStr = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                event.date = dateStr; // Use the date found
                break; // Assuming only one date per event
              }
            }
            valuesDatesStmt.free();
          }
          dateEventDetailsStmt.free();
        }
        firstPersonIdResult.free();

        // Get event place through ValuesLinks where rec_table=7 (EventDetails table code)
        // We use the first person in the event (with the lowest p_ord) to get the place
        if (firstPersonId !== undefined) {
          const placeEventDetailsStmt = db.prepare(`
            SELECT ed.id
            FROM EventDetails ed
            WHERE ed.e_id = ? AND ed.p_id = ?
            ORDER BY ed.p_ord
            LIMIT 1
          `);
          placeEventDetailsStmt.bind([eventId, firstPersonId]);

          if (placeEventDetailsStmt.step()) {
            const placeEventDetailsRow = placeEventDetailsStmt.getAsObject();
            const eventDetailsId = placeEventDetailsRow.id as number;

            // Get place link from ValuesLinks where rec_table=7 (EventDetails) and
            // rec_id matches the EventDetails record for the first person
            const valuesLinksStmt = db.prepare(`
              SELECT f_id, vlink_table, vlink_id
              FROM ValuesLinks
              WHERE rec_table = 7 AND rec_id = ? AND vlink_table = 14  -- 14 is the code for Places table
            `);
            valuesLinksStmt.bind([eventDetailsId]);

            if (valuesLinksStmt.step()) {
              const valuesLinksRow = valuesLinksStmt.getAsObject();
              const placeId = valuesLinksRow.vlink_id as number;

              // Now get the place name from the Places table via ValuesStr
              const placeStrStmt = db.prepare(`
                SELECT vstr
                FROM ValuesStr
                WHERE rec_table = 14 AND rec_id = ? AND f_id = 93  -- 93 is typically for place name
              `);
              placeStrStmt.bind([placeId]);

              if (placeStrStmt.step()) {
                const placeStrRow = placeStrStmt.getAsObject();
                event.place = placeStrRow.vstr as string;
              }
              placeStrStmt.free();
            }
            valuesLinksStmt.free();
          }
          placeEventDetailsStmt.free();
        }

        // Get event description from ValuesStr where rec_table=11 (Events) and rec_id=eventId
        const valuesStrStmt = db.prepare(`
          SELECT f_id, vstr
          FROM ValuesStr
          WHERE rec_table = 11 AND rec_id = ?  -- 11 is the code for Events table
        `);
        valuesStrStmt.bind([eventId]);

        while (valuesStrStmt.step()) {
          const valuesStrRow = valuesStrStmt.getAsObject();
          const fieldId = valuesStrRow.f_id as number;
          const valueStr = valuesStrRow.vstr as string;

          switch (fieldId) {
            case 4: // Event place
              if (!event.place) event.place = valueStr; // Only set if not already set from EventDetails
              break;
            case 5: // Event description
              event.description = valueStr;
              break;
            default:
              // Unknown string field, but continue processing
          }
        }
        valuesStrStmt.free();

        events.push(event);
      }
      eventStmt.free();
    } catch (err) {
      console.error('Error reading Events table:', err);
    }

  return events;
}
