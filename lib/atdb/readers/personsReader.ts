import type { Person } from '../../types';
import { EVENT_TYPE_IDS } from '../constants';
import { formatAtdbDate } from '../dates';
import type { SqlJsDatabase } from '../dbTypes';
import type { FieldRule } from '../mappingTypes';
import type { AtdbSchemaContext } from '../schemaContext';
import { tableExists } from '../sqlHelpers';

interface PersonStringRules {
  firstName: FieldRule | null;
  lastName: FieldRule | null;
  patronymic: FieldRule | null;
  occupation: FieldRule | null;
  notes: FieldRule | null;
}

function setStringField(person: Person, rules: PersonStringRules, fieldId: number, value: string): void {
  if (fieldId === rules.firstName?.id) person.firstName ??= value;
  else if (fieldId === rules.lastName?.id) person.lastName ??= value;
  else if (fieldId === rules.patronymic?.id) person.patronymic ??= value;
  else if (fieldId === rules.occupation?.id) person.occupation ??= value;
  else if (fieldId === rules.notes?.id) person.notes ??= value;
}

function readLifeEvents(
  db: SqlJsDatabase,
  context: AtdbSchemaContext,
  person: Person,
  hasEventDetails: boolean,
  hasDates: boolean,
  hasLinks: boolean,
): void {
  if (!hasEventDetails) return;
  const events = db.prepare('SELECT e_id, er_id FROM EventDetails WHERE p_id = ?');
  const eventDateField = context.resolveFieldRule('eventDate', 'read');
  const eventPlaceField = context.resolveFieldRule('eventPlaceLink', 'read');
  const eventPlaceFieldIds = [
    eventPlaceField?.id,
    context.resolveFieldRule('eventPlaceLinkAlternate', 'read')?.id,
  ].filter((fieldId): fieldId is number => fieldId !== undefined);
  const eventTable = context.tableCode('events');
  const placeTable = context.tableCode('places');
  const primaryRoleIds = new Map<number, number>();
  for (const eventTypeId of [EVENT_TYPE_IDS.birth, EVENT_TYPE_IDS.death]) {
    const role =
      eventTypeId === EVENT_TYPE_IDS.birth
        ? context.resolveMappedEventRole('bornPerson')
        : context.resolvePrimaryEventRole(eventTypeId);
    if (role) primaryRoleIds.set(eventTypeId, role.id);
  }
  events.bind([person.id]);
  while (events.step()) {
    const row = events.getAsObject();
    const eventId = row.e_id as number;
    const role = context.eventRoles.get(row.er_id as number);
    if (!role || primaryRoleIds.get(role.eventTypeId) !== role.id) continue;

    if (hasDates && eventDateField) {
      const dateStatement = db.prepare('SELECT y, m, d FROM ValuesDates WHERE f_id = ? AND rec_table = ? AND rec_id = ?');
      dateStatement.bind([eventDateField.id, eventTable, eventId]);
      if (dateStatement.step()) {
        const date = dateStatement.getAsObject();
        const formatted = formatAtdbDate(date.y as number, date.m as number, date.d as number);
        if (formatted && role.eventTypeId === EVENT_TYPE_IDS.birth) person.birthDate ??= formatted;
        if (formatted && role.eventTypeId === EVENT_TYPE_IDS.death) person.deathDate ??= formatted;
      }
      dateStatement.free();
    }

    if (hasLinks && eventPlaceFieldIds.length > 0) {
      const fieldPlaceholders = eventPlaceFieldIds.map(() => '?').join(', ');
      const placeStatement = db.prepare(
        `SELECT vlink_id
         FROM ValuesLinks
         WHERE f_id IN (${fieldPlaceholders}) AND rec_table = ? AND rec_id = ? AND vlink_table = ?
         ORDER BY CASE WHEN f_id = ? THEN 0 ELSE 1 END`,
      );
      placeStatement.bind([...eventPlaceFieldIds, eventTable, eventId, placeTable, eventPlaceField?.id ?? -1]);
      if (placeStatement.step()) {
        const placeId = placeStatement.getAsObject().vlink_id as number;
        if (role.eventTypeId === EVENT_TYPE_IDS.birth) person.birthPlaceId ??= placeId;
        if (role.eventTypeId === EVENT_TYPE_IDS.death) person.deathPlaceId ??= placeId;
      }
      placeStatement.free();
    }
  }
  events.free();
}

function readParents(
  db: SqlJsDatabase,
  context: AtdbSchemaContext,
  person: Person,
  hasEventDetails: boolean,
): void {
  if (!hasEventDetails) return;
  const bornRole = context.resolveMappedEventRole('bornPerson');
  const fatherRole = context.resolveMappedEventRole('father');
  const motherRole = context.resolveMappedEventRole('mother');
  if (!bornRole || !fatherRole || !motherRole) return;

  context.logger({ level: 'DEBUG', code: 'parents.roles.catalog-resolved', details: { roleCount: 3 } });
  const birthEvent = db.prepare('SELECT e_id FROM EventDetails WHERE p_id = ? AND er_id = ? LIMIT 1');
  birthEvent.bind([person.id, bornRole.id]);
  if (birthEvent.step()) {
    const eventId = birthEvent.getAsObject().e_id as number;
    const parents = db.prepare('SELECT p_id, er_id FROM EventDetails WHERE e_id = ? AND er_id IN (?, ?)');
    parents.bind([eventId, fatherRole.id, motherRole.id]);
    while (parents.step()) {
      const row = parents.getAsObject();
      if (row.er_id === fatherRole.id) person.fatherId = row.p_id as number;
      if (row.er_id === motherRole.id) person.motherId = row.p_id as number;
    }
    parents.free();
  }
  birthEvent.free();
}

export function readPersons(db: SqlJsDatabase, context: AtdbSchemaContext): Person[] {
  const persons: Person[] = [];
  const personTable = context.tableCode('persons');
  const hasValuesStr = tableExists(db, 'ValuesStr');
  const hasEventDetails = tableExists(db, 'EventDetails');
  const hasDates = tableExists(db, 'ValuesDates');
  const hasLinks = tableExists(db, 'ValuesLinks');
  const stringRules: PersonStringRules = {
    firstName: context.resolveFieldRule('personFirstName', 'read'),
    lastName: context.resolveFieldRule('personLastName', 'read'),
    patronymic: context.resolveFieldRule('personPatronymic', 'read'),
    occupation: context.resolveFieldRule('personOccupation', 'read'),
    notes: context.resolveFieldRule('personNotes', 'read'),
  };
  try {
    const statement = db.prepare('SELECT id, sex FROM Persons');
    while (statement.step()) {
      const row = statement.getAsObject();
      const person: Person = {
        id: row.id as number,
        gender: row.sex === 1 ? 'M' : row.sex === 2 ? 'F' : 'Unknown',
        spouseIds: [],
      };
      if (hasValuesStr) {
        const strings = db.prepare('SELECT f_id, vstr FROM ValuesStr WHERE rec_table = ? AND rec_id = ?');
        strings.bind([personTable, person.id]);
        while (strings.step()) {
          const value = strings.getAsObject();
          if (typeof value.f_id === 'number' && typeof value.vstr === 'string') {
            setStringField(person, stringRules, value.f_id, value.vstr);
          }
        }
        strings.free();
      }
      readLifeEvents(db, context, person, hasEventDetails, hasDates, hasLinks);
      readParents(db, context, person, hasEventDetails);
      persons.push(person);
    }
    statement.free();
    context.logger({ level: 'DEBUG', code: 'persons.read', details: { count: persons.length, recTable: personTable } });
  } catch {
    context.logger({ level: 'ERROR', code: 'persons.read.failed' });
  }
  return persons;
}
