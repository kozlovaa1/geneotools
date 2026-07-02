import type { Person } from '../../types';
import { EVENT_TYPE_IDS } from '../constants';
import { splitAtdbDate } from '../dates';
import type { SqlJsDatabase } from '../dbTypes';
import type { AtdbChangeSet } from '../rebuildContract';
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

export function writeLifeEventPlaceLinkChanges(
  db: SqlJsDatabase,
  changeSet: AtdbChangeSet,
  context: AtdbSchemaContext,
): void {
  if (!hasLifeEventTables(db)) {
    context.logger({ level: 'WARN', code: 'rebuild.life-event.tables-missing' });
    return;
  }

  const rule = context.resolveFieldRule('eventPlaceLink', 'write');
  if (!rule) {
    context.logger({ level: 'WARN', code: 'rebuild.life-event.field-missing' });
    return;
  }

  const eventTable = context.tableCode('events', 'write');
  const placeTable = context.tableCode('places', 'write');
  let applied = 0;

  for (const entityChange of changeSet.changes) {
    if (entityChange.entityType !== 'person') continue;

    for (const fieldChange of entityChange.fields) {
      if (fieldChange.field !== 'birthPlaceId' && fieldChange.field !== 'deathPlaceId') continue;

      const eventTypeId = fieldChange.field === 'birthPlaceId' ? EVENT_TYPE_IDS.birth : EVENT_TYPE_IDS.death;
      const primaryRole =
        eventTypeId === EVENT_TYPE_IDS.birth
          ? context.resolveMappedEventRole('bornPerson')
          : context.resolvePrimaryEventRole(eventTypeId);
      if (!primaryRole) {
        context.logger({ level: 'WARN', code: 'rebuild.life-event.role-missing', details: { eventTypeId } });
        continue;
      }

      const eventId = findLifeEvent(db, entityChange.id, primaryRole.id);
      if (eventId === null) {
        context.logger({ level: 'WARN', code: 'rebuild.life-event.event-missing', details: { eventTypeId } });
        continue;
      }

      replaceOwnedValue(
        db,
        rule,
        eventTable,
        eventId,
        typeof fieldChange.value === 'number' ? [placeTable, fieldChange.value] : null,
        context.logger,
        placeTable,
      );
      applied++;
    }
  }

  context.logger({ level: 'DEBUG', code: 'rebuild.life-event.places.applied', details: { changes: applied } });
}

export function writeLifeEventDateChanges(
  db: SqlJsDatabase,
  changeSet: AtdbChangeSet,
  context: AtdbSchemaContext,
): void {
  if (!hasLifeEventTables(db) || !tableExists(db, 'ValuesDates')) {
    context.logger({ level: 'WARN', code: 'rebuild.life-event.date-tables-missing' });
    return;
  }

  const rule = context.resolveFieldRule('eventDate', 'write');
  if (!rule) {
    context.logger({ level: 'WARN', code: 'rebuild.life-event.date-field-missing' });
    return;
  }

  const eventTable = context.tableCode('events', 'write');
  let applied = 0;

  for (const entityChange of changeSet.changes) {
    if (entityChange.entityType !== 'person') continue;

    for (const fieldChange of entityChange.fields) {
      if (fieldChange.field !== 'birthDate' && fieldChange.field !== 'deathDate') continue;

      const eventTypeId = fieldChange.field === 'birthDate' ? EVENT_TYPE_IDS.birth : EVENT_TYPE_IDS.death;
      const primaryRole =
        eventTypeId === EVENT_TYPE_IDS.birth
          ? context.resolveMappedEventRole('bornPerson')
          : context.resolvePrimaryEventRole(eventTypeId);
      if (!primaryRole) {
        context.logger({ level: 'WARN', code: 'rebuild.life-event.date-role-missing', details: { eventTypeId } });
        continue;
      }

      const eventId = findLifeEvent(db, entityChange.id, primaryRole.id);
      if (eventId === null) {
        context.logger({ level: 'WARN', code: 'rebuild.life-event.date-event-missing', details: { eventTypeId } });
        continue;
      }

      const parts = typeof fieldChange.value === 'string' ? splitAtdbDate(fieldChange.value) : null;
      replaceOwnedValue(db, rule, eventTable, eventId, parts ? parts : null, context.logger);
      applied++;
    }
  }

  context.logger({ level: 'DEBUG', code: 'rebuild.life-event.dates.applied', details: { changes: applied } });
}
