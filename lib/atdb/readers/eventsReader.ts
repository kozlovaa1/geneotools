import type { Event } from '../../types';
import { readAtdbDateValue } from '../dates';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { tableExists } from '../sqlHelpers';

export function readEvents(db: SqlJsDatabase, context: AtdbSchemaContext): Event[] {
  const events: Event[] = [];
  const eventTable = context.tableCode('events');
  const placeTable = context.tableCode('places');
  const eventDateField = context.resolveFieldRule('eventDate', 'read');
  const eventPlaceField = context.resolveFieldRule('eventPlaceLink', 'read');
  const eventPlaceFieldIds = [
    eventPlaceField?.id,
    context.resolveFieldRule('eventPlaceLinkAlternate', 'read')?.id,
  ].filter((fieldId): fieldId is number => fieldId !== undefined);
  const placeNameField = context.resolveFieldRule('placeName', 'read');
  const hasEventDetails = tableExists(db, 'EventDetails');
  const hasDates = tableExists(db, 'ValuesDates');
  const hasLinks = tableExists(db, 'ValuesLinks');
  const hasStrings = tableExists(db, 'ValuesStr');

  try {
    const eventStmt = db.prepare('SELECT id, et_id FROM Events');
    while (eventStmt.step()) {
      const row = eventStmt.getAsObject();
      const eventId = row.id as number;
      const event: Event = { id: eventId, eventType: `EventType${row.et_id as number}` };

      if (hasEventDetails) {
        const participants = db.prepare('SELECT p_id FROM EventDetails WHERE e_id = ? ORDER BY p_ord');
        participants.bind([eventId]);
        const personIds: number[] = [];
        while (participants.step()) {
          const personId = participants.getAsObject().p_id;
          if (typeof personId === 'number') personIds.push(personId);
        }
        participants.free();
        if (personIds.length > 0) event.personIds = personIds;
      }

      if (hasDates && eventDateField) {
        const dateValue = readAtdbDateValue(db, {
          fieldId: eventDateField.id,
          recTable: eventTable,
          recId: eventId,
          logger: context.logger,
        });
        event.date = dateValue?.value;
        event.dateInfo = dateValue ?? undefined;
      }

      if (hasLinks && eventPlaceFieldIds.length > 0) {
        const fieldPlaceholders = eventPlaceFieldIds.map(() => '?').join(', ');
        const links = db.prepare(
          `SELECT vlink_id
           FROM ValuesLinks
           WHERE f_id IN (${fieldPlaceholders}) AND rec_table = ? AND rec_id = ? AND vlink_table = ?
           ORDER BY CASE WHEN f_id = ? THEN 0 ELSE 1 END`,
        );
        links.bind([...eventPlaceFieldIds, eventTable, eventId, placeTable, eventPlaceField?.id ?? -1]);
        if (links.step()) {
          const placeId = links.getAsObject().vlink_id as number;
          event.placeId = placeId;
          if (placeNameField && hasStrings) {
            const placeName = db.prepare('SELECT vstr FROM ValuesStr WHERE f_id = ? AND rec_table = ? AND rec_id = ?');
            placeName.bind([placeNameField.id, placeTable, placeId]);
            if (placeName.step()) event.place = placeName.getAsObject().vstr as string;
            placeName.free();
          }
        }
        links.free();
      }

      events.push(event);
    }
    eventStmt.free();
    context.logger({ level: 'DEBUG', code: 'events.read', details: { count: events.length, recTable: eventTable } });
  } catch {
    context.logger({ level: 'ERROR', code: 'events.read.failed' });
  }
  return events;
}
