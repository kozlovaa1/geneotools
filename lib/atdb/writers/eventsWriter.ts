import type { Event } from '../../types';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbChangeSet } from '../rebuildContract';
import type { AtdbSchemaContext } from '../schemaContext';
import { replaceOwnedValue } from './valueWriter';

export function writeEvents(db: SqlJsDatabase, events: Event[], context: AtdbSchemaContext): void {
  for (const event of events) {
    const match = typeof event.eventType === 'string' ? /^EventType(\d+)$/.exec(event.eventType) : null;
    if (match && context.eventTypeIds.has(Number(match[1]))) {
      db.run('UPDATE Events SET et_id = ? WHERE id = ?', [Number(match[1]), event.id]);
    } else {
      context.logger({ level: 'WARN', code: 'event.type.write.skipped' });
    }
  }
  context.logger({ level: 'DEBUG', code: 'events.write', details: { count: events.length } });
}

export function writeEventChanges(db: SqlJsDatabase, changeSet: AtdbChangeSet, context: AtdbSchemaContext): void {
  const rule = context.resolveFieldRule('eventPlaceLink', 'write');
  if (!rule) {
    context.logger({ level: 'WARN', code: 'rebuild.events.place-field-missing' });
    return;
  }

  const eventTable = context.tableCode('events', 'write');
  const placeTable = context.tableCode('places', 'write');
  let applied = 0;

  for (const entityChange of changeSet.changes) {
    if (entityChange.entityType !== 'event') continue;

    for (const fieldChange of entityChange.fields) {
      if (fieldChange.field !== 'placeId') continue;
      replaceOwnedValue(
        db,
        rule,
        eventTable,
        entityChange.id,
        typeof fieldChange.value === 'number' ? [placeTable, fieldChange.value] : null,
        context.logger,
        placeTable,
      );
      applied++;
    }
  }

  context.logger({ level: 'DEBUG', code: 'rebuild.events.applied', details: { changes: applied } });
}
