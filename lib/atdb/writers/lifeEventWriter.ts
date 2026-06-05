import type { Person } from '../../types';
import { EVENT_TYPE_IDS } from '../constants';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { tableExists } from '../sqlHelpers';
import { replaceOwnedValue } from './valueWriter';

export function hasLifeEventTables(db: SqlJsDatabase): boolean {
  return tableExists(db, 'Events') && tableExists(db, 'EventDetails') && tableExists(db, 'EventRoles');
}

export function findLifeEvent(db: SqlJsDatabase, personId: number, eventRoleId: number): number | null {
  const result = db.exec(
    'SELECT e_id FROM EventDetails WHERE p_id = ? AND er_id = ? LIMIT 1',
    [personId, eventRoleId],
  );
  const value = result[0]?.values[0]?.[0];
  return typeof value === 'number' ? value : null;
}

export function writeLifeEventPlaceLinks(db: SqlJsDatabase, persons: Person[], context: AtdbSchemaContext): void {
  if (!hasLifeEventTables(db)) return;
  const rule = context.resolveFieldRule('eventPlaceLink', 'write');
  if (!rule) return;
  const eventTable = context.tableCode('events', 'write');
  const placeTable = context.tableCode('places', 'write');
  for (const person of persons) {
    for (const [eventTypeId, placeId] of [
      [EVENT_TYPE_IDS.birth, person.birthPlaceId],
      [EVENT_TYPE_IDS.death, person.deathPlaceId],
    ] as const) {
      const primaryRole =
        eventTypeId === EVENT_TYPE_IDS.birth
          ? context.resolveMappedEventRole('bornPerson')
          : context.resolvePrimaryEventRole(eventTypeId);
      if (!primaryRole) continue;
      const eventId = findLifeEvent(db, person.id, primaryRole.id);
      if (eventId !== null) {
        replaceOwnedValue(
          db,
          rule,
          eventTable,
          eventId,
          typeof placeId === 'number' ? [placeTable, placeId] : null,
          context.logger,
          placeTable,
        );
      } else {
        context.logger({ level: 'WARN', code: 'life-event.write.skipped', details: { eventTypeId } });
      }
    }
  }
}
